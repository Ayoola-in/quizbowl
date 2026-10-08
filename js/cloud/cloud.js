/**
 * js/cloud/cloud.js
 * Optional accounts and per-quiz cloud sync (Supabase).
 *
 * The app keeps working entirely from this device; signing in only adds the
 * ability to upload, download and sync individual quizzes. Each quiz is
 * stored in the cloud as one row (see supabase/schema.sql).
 *
 * Change detection: a fingerprint of the quiz's data is stored at every
 * sync. If the current fingerprint differs, the quiz changed on this device
 * (in any tab, including the public display). If the cloud row's version
 * differs from the one last synced, it changed on another device.
 */
(function() {
    const SDK_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.3/dist/umd/supabase.js';
    const SYNC_KEY = 'cloud_sync';          // { [localQuizId]: { cloudId, userId, version, hash, syncedAt, autoSync, attention } }
    const AFTER_AUTH_KEY = 'quizr_after_auth';
    const DATA_KEYS = ['questions', 'teams', 'history', 'settings'];
    const FORMAT = 1;
    const AUTO_DELAY = 4000;
    const POLL_MS = 120000;

    const Storage = window.QuizBowl.Data.Storage;
    const QuizzesDB = window.QuizBowl.Data.QuizzesDB;
    const config = window.QuizBowl.CloudConfig || {};
    const configured = !!(config.supabaseUrl && config.supabaseKey);

    let client = null;
    let clientPromise = null;
    let session = null;
    let ready = false;
    let recovery = false;
    const listeners = [];
    const timers = {};
    let remoteCache = null;   // last list of cloud quizzes, keyed by cloud id

    class CloudError extends Error {
        constructor(message, kind = 'other') {
            super(message);
            this.kind = kind; // network | auth | conflict | missing | config | other
        }
    }

    function emit(event) {
        listeners.forEach(fn => { try { fn(event); } catch (e) { console.error(e); } });
    }

    // ---------- Sync state (per local quiz) ----------
    function allState() { return Storage.getGlobal(SYNC_KEY, {}) || {}; }
    function getState(localId) { return allState()[localId] || null; }
    function setState(localId, patch) {
        const all = allState();
        if (patch === null) delete all[localId];
        else all[localId] = { ...(all[localId] || {}), ...patch };
        Storage.setGlobal(SYNC_KEY, all);
    }

    function payloadOf(localId) {
        const data = { format: FORMAT };
        DATA_KEYS.forEach(key => { data[key] = Storage.getForQuiz(localId, key, null); });
        return data;
    }

    // FNV-1a fingerprint of the quiz's name and data
    function hashOf(localId) {
        const quiz = QuizzesDB.getById(localId);
        const text = JSON.stringify([quiz ? quiz.name : '', DATA_KEYS.map(k => Storage.getForQuiz(localId, k, null))]);
        let h = 0x811c9dc5;
        for (let i = 0; i < text.length; i++) {
            h ^= text.charCodeAt(i);
            h = Math.imul(h, 0x01000193);
        }
        return (h >>> 0).toString(36) + ':' + text.length.toString(36);
    }

    function deviceName() {
        const ua = navigator.userAgent;
        const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
        const os = /Android/.test(ua) ? 'Android' : /iPhone|iPad|iPod/.test(ua) ? 'iPhone/iPad' : /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : 'device';
        return `${browser} on ${os}`;
    }

    // ---------- Client & auth ----------
    function loadSdk() {
        if (window.supabase && window.supabase.createClient) return Promise.resolve(window.supabase);
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = SDK_URL;
            script.onload = () => resolve(window.supabase);
            script.onerror = () => reject(new CloudError('Couldn\'t load the sign-in service. Check your internet connection.', 'network'));
            document.head.appendChild(script);
        });
    }

    function baseUrl() {
        return location.origin + location.pathname;
    }

    // Remove ?code=… / ?error=… left by sign-in redirects, keeping the #page
    function cleanUrl() {
        const url = new URL(location.href);
        const params = ['code', 'error', 'error_code', 'error_description', 'type'];
        if (params.some(p => url.searchParams.has(p))) {
            const description = url.searchParams.get('error_description');
            params.forEach(p => url.searchParams.delete(p));
            history.replaceState(history.state, '', url.pathname + (url.searchParams.toString() ? '?' + url.searchParams : '') + url.hash);
            return description;
        }
        return null;
    }

    function getClient() {
        if (!configured) return Promise.reject(new CloudError('Cloud sync isn\'t set up on this site yet.', 'config'));
        if (client) return Promise.resolve(client);
        if (!clientPromise) {
            clientPromise = loadSdk().then(async sdk => {
                client = sdk.createClient(config.supabaseUrl, config.supabaseKey, {
                    auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
                });
                client.auth.onAuthStateChange((event, newSession) => {
                    const wasSignedIn = !!session;
                    session = newSession;
                    if (event === 'PASSWORD_RECOVERY') recovery = true;
                    if (event === 'SIGNED_OUT') remoteCache = null;
                    // Supabase asks not to make other calls inside this callback
                    setTimeout(() => {
                        emit({ type: 'auth', event });
                        if (!wasSignedIn && newSession) autoSyncAll('sign-in');
                    }, 0);
                });
                const { data } = await client.auth.getSession();
                session = data.session;
                ready = true;
                return client;
            }).catch(err => {
                clientPromise = null;
                throw err;
            });
        }
        return clientPromise;
    }

    // Start quietly when there's a saved session or a sign-in redirect to finish
    function hasStoredSession() {
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (/^sb-.*-auth-token$/.test(key)) return true;
            }
        } catch (e) { /* ignore */ }
        return false;
    }

    async function init() {
        if (!configured) { ready = true; emit({ type: 'ready' }); return; }
        const url = new URL(location.href);
        const returning = url.searchParams.has('code') || url.searchParams.has('error_description');
        if (!returning && !hasStoredSession()) { ready = true; emit({ type: 'ready' }); return; }
        try {
            await getClient();
        } catch (err) {
            console.warn('Cloud sign-in unavailable', err);
            ready = true;
        }
        const problem = cleanUrl();
        emit({ type: 'ready' });
        if (problem && window.QuizBowl.Components.Toast) {
            window.QuizBowl.Components.Toast.show(`Sign-in didn't complete: ${problem}`, 'danger');
        }
        let after = null;
        try { after = sessionStorage.getItem(AFTER_AUTH_KEY); sessionStorage.removeItem(AFTER_AUTH_KEY); } catch (e) { /* ignore */ }
        if (returning && after && window.QuizBowl.Router) window.QuizBowl.Router.navigate(after);
        if (session) autoSyncAll('start');
    }

    function friendlyAuthError(error) {
        const msg = (error && error.message) || String(error);
        const code = error && (error.code || '');
        if (code === 'email_not_confirmed' || /email not confirmed/i.test(msg)) return new CloudError('Please confirm your email first. Check your inbox for the link, or resend it below.', 'unconfirmed');
        if (code === 'invalid_credentials' || /invalid login credentials/i.test(msg)) return new CloudError('Wrong email or password.', 'auth');
        if (/password should be at least/i.test(msg) || code === 'weak_password') return new CloudError('Choose a stronger password: at least 8 characters, mixing letters and numbers.', 'auth');
        if (/rate limit|too many/i.test(msg) || code === 'over_email_send_rate_limit') return new CloudError('Too many attempts. Please wait a minute and try again.', 'auth');
        if (/failed to fetch|network/i.test(msg)) return new CloudError('Can\'t reach the sign-in service. Check your internet connection.', 'network');
        return new CloudError(msg, 'auth');
    }

    function friendlyDbError(error) {
        const msg = (error && error.message) || String(error);
        if (/failed to fetch|network|load failed/i.test(msg)) return new CloudError('Can\'t reach the cloud. Check your internet connection.', 'network');
        if (/jwt|token/i.test(msg)) return new CloudError('Your sign-in has expired. Please sign in again.', 'auth');
        if (/row-level security|permission/i.test(msg)) return new CloudError('The cloud refused this change (no permission).', 'auth');
        if (/relation .* does not exist|could not find the table/i.test(msg)) return new CloudError('The cloud database isn\'t set up yet. Run supabase/schema.sql in your Supabase project.', 'config');
        return new CloudError(msg);
    }

    function requireUser() {
        if (!session || !session.user) throw new CloudError('Please sign in first.', 'auth');
        return session.user;
    }

    const Auth = {
        async signInWithGoogle() {
            const c = await getClient();
            try { sessionStorage.setItem(AFTER_AUTH_KEY, 'account'); } catch (e) { /* ignore */ }
            const { error } = await c.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: baseUrl() } });
            if (error) throw friendlyAuthError(error);
        },
        async signUp(email, password) {
            const c = await getClient();
            try { sessionStorage.setItem(AFTER_AUTH_KEY, 'account'); } catch (e) { /* ignore */ }
            const { data, error } = await c.auth.signUp({ email, password, options: { emailRedirectTo: baseUrl() } });
            if (error) throw friendlyAuthError(error);
            // With email confirmation on, there's no session until the link is clicked
            return { needsConfirmation: !data.session };
        },
        async signIn(email, password) {
            const c = await getClient();
            const { error } = await c.auth.signInWithPassword({ email, password });
            if (error) throw friendlyAuthError(error);
        },
        async resendConfirmation(email) {
            const c = await getClient();
            const { error } = await c.auth.resend({ type: 'signup', email, options: { emailRedirectTo: baseUrl() } });
            if (error) throw friendlyAuthError(error);
        },
        async sendPasswordReset(email) {
            const c = await getClient();
            try { sessionStorage.setItem(AFTER_AUTH_KEY, 'account'); } catch (e) { /* ignore */ }
            const { error } = await c.auth.resetPasswordForEmail(email, { redirectTo: baseUrl() });
            if (error) throw friendlyAuthError(error);
        },
        async updatePassword(password) {
            const c = await getClient();
            const { error } = await c.auth.updateUser({ password });
            if (error) throw friendlyAuthError(error);
            recovery = false;
            emit({ type: 'auth', event: 'PASSWORD_UPDATED' });
        },
        async signOut() {
            const c = await getClient();
            await c.auth.signOut();
            session = null;
            remoteCache = null;
            emit({ type: 'auth', event: 'SIGNED_OUT' });
        }
    };

    // ---------- Cloud data ----------
    const COLUMNS = 'id, name, version, question_count, team_count, updated_at, updated_device, owner_id';

    async function listRemote() {
        requireUser();
        const c = await getClient();
        const { data, error } = await c.from('quizzes').select(COLUMNS).order('updated_at', { ascending: false });
        if (error) throw friendlyDbError(error);
        remoteCache = {};
        data.forEach(row => { remoteCache[row.id] = row; });
        emit({ type: 'remote' });
        return data;
    }

    async function fetchRow(cloudId, columns = COLUMNS) {
        const c = await getClient();
        const { data, error } = await c.from('quizzes').select(columns).eq('id', cloudId).maybeSingle();
        if (error) throw friendlyDbError(error);
        if (remoteCache) {
            if (data) remoteCache[cloudId] = { ...(remoteCache[cloudId] || {}), ...data };
            else delete remoteCache[cloudId];
        }
        return data;
    }

    /**
     * Sync status of a local quiz:
     * local | synced | changed | cloud-newer | conflict | cloud-deleted | other-account
     */
    // `freshRow` (when given) is the cloud row just fetched; null means it no longer exists
    function statusOf(localId, freshRow) {
        const st = getState(localId);
        if (!st || !st.cloudId) return 'local';
        const user = session && session.user;
        if (!user) return st.hash === hashOf(localId) ? 'synced' : 'changed';
        if (st.userId !== user.id) return 'other-account';
        const localChanged = st.hash !== hashOf(localId);
        let remoteChanged = false;
        const row = freshRow !== undefined ? freshRow : (remoteCache ? (remoteCache[st.cloudId] || null) : undefined);
        if (row !== undefined) {
            if (!row) return 'cloud-deleted';
            remoteChanged = row.version !== st.version;
        }
        if (localChanged && remoteChanged) return 'conflict';
        if (localChanged) return 'changed';
        if (remoteChanged) return 'cloud-newer';
        return 'synced';
    }

    function counts(payload) {
        return {
            question_count: Array.isArray(payload.questions) ? payload.questions.length : 0,
            team_count: Array.isArray(payload.teams) ? payload.teams.length : 0
        };
    }

    async function upload(localId, { force = false } = {}) {
        const user = requireUser();
        const c = await getClient();
        const quiz = QuizzesDB.getById(localId);
        if (!quiz) throw new CloudError('This quiz no longer exists on this device.', 'missing');
        const st = getState(localId);
        const payload = payloadOf(localId);
        const hash = hashOf(localId);
        const linked = st && st.cloudId && st.userId === user.id;
        // Keep the cloud name unless the quiz was deliberately renamed on this device
        // (a local "(2)" added to avoid a name clash shouldn't rename it everywhere)
        const cloudName = linked && st.cloudName && st.linkedLocalName === quiz.name ? st.cloudName : quiz.name;
        const row = { name: cloudName, data: payload, ...counts(payload), updated_device: deviceName() };

        let result;
        if (linked) {
            let expected = st.version;
            if (force) {
                const current = await fetchRow(st.cloudId, 'id, version');
                if (!current) {
                    // The cloud copy was deleted: upload this one as new
                    setState(localId, { cloudId: null, version: 0 });
                    return upload(localId);
                }
                expected = current.version;
            }
            const { data, error } = await c.from('quizzes')
                .update({ ...row, version: expected + 1 })
                .eq('id', st.cloudId).eq('version', expected)
                .select('id, version');
            if (error) throw friendlyDbError(error);
            if (!data.length) {
                const current = await fetchRow(st.cloudId, 'id, version');
                if (!current) {
                    setState(localId, { cloudId: null, version: 0 });
                    throw new CloudError('This quiz was removed from the cloud on another device.', 'missing');
                }
                throw new CloudError('This quiz was changed on another device since your last sync.', 'conflict');
            }
            result = data[0];
        } else {
            const { data, error } = await c.from('quizzes').insert(row).select('id, version').single();
            if (error) throw friendlyDbError(error);
            result = data;
        }
        setState(localId, { cloudId: result.id, userId: user.id, version: result.version, hash, syncedAt: Date.now(), attention: false, cloudName, linkedLocalName: quiz.name });
        if (remoteCache) remoteCache[result.id] = { ...(remoteCache[result.id] || {}), id: result.id, name: cloudName, version: result.version, ...counts(payload), updated_at: new Date().toISOString(), updated_device: row.updated_device };
        emit({ type: 'synced', localId });
        return result;
    }

    function writeLocal(localId, row) {
        const data = row.data || {};
        DATA_KEYS.forEach(key => {
            if (data[key] === null || data[key] === undefined) return;
            Storage.setForQuiz(localId, key, data[key], { silent: true });
        });
        const quiz = QuizzesDB.getById(localId);
        if (quiz && row.name && quiz.name !== row.name) {
            try { QuizzesDB.rename(localId, row.name); } catch (e) { /* keep the local name if it clashes */ }
        }
    }

    async function download(localId) {
        const user = requireUser();
        const st = getState(localId);
        if (!st || !st.cloudId) throw new CloudError('This quiz isn\'t in the cloud yet.', 'missing');
        const row = await fetchRow(st.cloudId, 'id, name, data, version');
        if (!row) {
            setState(localId, { cloudId: null, version: 0 });
            throw new CloudError('This quiz was removed from the cloud.', 'missing');
        }
        // Follow a rename made on another device; otherwise keep this device's name
        writeLocal(localId, row.name !== st.cloudName ? row : { ...row, name: null });
        setState(localId, { userId: user.id, version: row.version, hash: hashOf(localId), syncedAt: Date.now(), attention: false,
            cloudName: row.name, linkedLocalName: (QuizzesDB.getById(localId) || {}).name });
        emit({ type: 'downloaded', localId });
        return row;
    }

    function uniqueName(name) {
        const names = new Set(QuizzesDB.getAll().map(q => q.name.toLowerCase()));
        if (!names.has(name.toLowerCase())) return name;
        for (let i = 2; ; i++) {
            const candidate = `${name} (${i})`;
            if (!names.has(candidate.toLowerCase())) return candidate;
        }
    }

    // Bring a cloud-only quiz onto this device as a new local quiz
    async function downloadNew(cloudId) {
        const user = requireUser();
        const row = await fetchRow(cloudId, 'id, name, data, version');
        if (!row) throw new CloudError('That quiz is no longer in the cloud.', 'missing');
        const quiz = QuizzesDB.create(uniqueName(row.name));
        writeLocal(quiz.id, { ...row, name: null });
        setState(quiz.id, { cloudId: row.id, userId: user.id, version: row.version, hash: hashOf(quiz.id), syncedAt: Date.now(), autoSync: false, attention: false,
            cloudName: row.name, linkedLocalName: quiz.name });
        emit({ type: 'downloaded', localId: quiz.id });
        return quiz;
    }

    // Do whatever brings the quiz up to date; conflicts are left for the user
    async function sync(localId) {
        requireUser();
        const st = getState(localId);
        if (!st || !st.cloudId) return { action: 'upload', result: await upload(localId) };
        const row = await fetchRow(st.cloudId, 'id, version, name, question_count, team_count, updated_at, updated_device');
        const status = statusOf(localId, row);
        if (status === 'changed') return { action: 'upload', result: await upload(localId) };
        if (status === 'cloud-newer') return { action: 'download', result: await download(localId) };
        if (status === 'conflict') {
            setState(localId, { attention: true });
            emit({ type: 'conflict', localId });
            throw new CloudError('This quiz changed both here and on another device.', 'conflict');
        }
        if (status === 'cloud-deleted') throw new CloudError('This quiz was removed from the cloud.', 'missing');
        return { action: 'none' };
    }

    async function removeFromCloud(cloudId) {
        requireUser();
        const c = await getClient();
        const { error } = await c.from('quizzes').delete().eq('id', cloudId);
        if (error) throw friendlyDbError(error);
        const all = allState();
        Object.keys(all).forEach(localId => {
            if (all[localId].cloudId === cloudId) all[localId] = { ...all[localId], cloudId: null, version: 0, autoSync: false };
        });
        Storage.setGlobal(SYNC_KEY, all);
        if (remoteCache) delete remoteCache[cloudId];
        emit({ type: 'removed', cloudId });
    }

    function unlink(localId) {
        setState(localId, null);
        emit({ type: 'unlinked', localId });
    }

    function setAutoSync(localId, on) {
        setState(localId, { autoSync: !!on });
        emit({ type: 'auto', localId });
        if (on) scheduleAutoSync(localId, 200);
    }

    // ---------- Auto-sync ----------
    function canAutoSync(localId) {
        const st = getState(localId);
        return !!(st && st.autoSync && st.cloudId && session && session.user && st.userId === session.user.id && navigator.onLine !== false);
    }

    function scheduleAutoSync(localId, delay = AUTO_DELAY) {
        if (!canAutoSync(localId)) return;
        clearTimeout(timers[localId]);
        timers[localId] = setTimeout(async () => {
            if (!canAutoSync(localId)) return;
            try {
                const { action } = await sync(localId);
                if (action === 'download' && window.QuizBowl.Data.QuizzesDB.getActiveId() === localId) {
                    emit({ type: 'active-replaced', localId });
                }
            } catch (err) {
                if (err.kind === 'conflict') {
                    const quiz = QuizzesDB.getById(localId);
                    window.QuizBowl.Components.Toast.show(`"${quiz ? quiz.name : 'A quiz'}" changed on two devices. Open Account & Sync to choose which version to keep.`, 'warning');
                } else if (err.kind !== 'network') {
                    console.warn('Auto-sync failed', err);
                }
            }
        }, delay);
    }

    function autoSyncAll() {
        Object.keys(allState()).forEach(localId => scheduleAutoSync(localId, 800));
    }

    // Local edits in this tab, and in other tabs (e.g. scoring on the public display)
    Storage.onQuizChange(localId => scheduleAutoSync(localId));
    window.addEventListener('storage', e => {
        const m = e.key && /^quizbowl_quiz_(.+?)_(questions|teams|history|settings)$/.exec(e.key);
        if (m) scheduleAutoSync(m[1]);
        if (e.key === Storage.PREFIX + SYNC_KEY) emit({ type: 'state' });
    });
    window.addEventListener('online', () => { if (session) autoSyncAll(); });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && session) autoSyncAll(); });
    setInterval(() => { if (session && document.visibilityState === 'visible') autoSyncAll(); }, POLL_MS);

    // Keep sync records tidy when quizzes are renamed or deleted locally
    const originalDelete = QuizzesDB.delete.bind(QuizzesDB);
    QuizzesDB.delete = function(id) {
        const result = originalDelete(id);
        setState(id, null);
        return result;
    };
    const originalRename = QuizzesDB.rename.bind(QuizzesDB);
    QuizzesDB.rename = function(id, name) {
        const result = originalRename(id, name);
        scheduleAutoSync(id);
        return result;
    };

    window.QuizBowl.Cloud = {
        configured: configured,
        init: init,
        isReady: () => ready,
        user: () => (session && session.user) || null,
        inRecovery: () => recovery,
        subscribe: fn => { listeners.push(fn); return () => { const i = listeners.indexOf(fn); if (i !== -1) listeners.splice(i, 1); }; },
        connect: getClient,
        auth: Auth,
        listRemote: listRemote,
        remote: () => remoteCache,
        status: statusOf,
        state: getState,
        upload: upload,
        download: download,
        downloadNew: downloadNew,
        sync: sync,
        removeFromCloud: removeFromCloud,
        unlink: unlink,
        setAutoSync: setAutoSync,
        CloudError: CloudError,
        // exposed for testing
        _hashOf: hashOf
    };
})();
