/**
 * js/views/account.js
 * Account & Sync: sign in (Google or email), then upload, download and sync
 * quizzes one at a time between this device and the cloud.
 */
(function() {
    const STATUS = {
        local: { label: 'Only on this device', tone: 'muted', icon: 'monitor' },
        synced: { label: 'Synced', tone: 'success', icon: 'checkCircle' },
        changed: { label: 'Changed here', tone: 'warning', icon: 'upload' },
        'cloud-newer': { label: 'Newer in cloud', tone: 'info', icon: 'download' },
        conflict: { label: 'Changed in both places', tone: 'danger', icon: 'alert' },
        'cloud-deleted': { label: 'Removed from cloud', tone: 'danger', icon: 'alert' },
        'other-account': { label: 'Linked to another account', tone: 'muted', icon: 'lock' },
        cloud: { label: 'Only in the cloud', tone: 'info', icon: 'cloud' }
    };

    let tab = 'signin';       // signin | signup | reset
    let pendingEmail = '';    // shown on the "check your inbox" message
    let message = null;       // { tone, text, resend }
    let loadingRemote = false;
    let remoteError = '';
    let busy = {};            // per-row actions in progress
    let unsubscribe = null;

    const UI = () => window.QuizBowl.Utils.UI;
    const Cloud = () => window.QuizBowl.Cloud;
    const Toast = () => window.QuizBowl.Components.Toast;
    const esc = v => UI().escapeHtml(v);
    const $ = id => document.getElementById(id);

    function timeAgo(value) {
        if (!value) return '';
        const t = typeof value === 'number' ? value : Date.parse(value);
        return UI().timeAgo(t);
    }

    function badge(status) {
        const s = STATUS[status];
        return `<span class="sync-badge sync-${s.tone}">${UI().icon(s.icon)}${esc(s.label)}</span>`;
    }

    window.QuizBowl.Views.Account = {
        render: function(container) {
            if (unsubscribe) unsubscribe();
            unsubscribe = Cloud().subscribe(event => {
                if (window.QuizBowl.State.currentRoute !== 'account') return;
                if (event.type === 'auth') {
                    if (event.event === 'SIGNED_IN') message = null;
                    this.render(document.getElementById('view-container'));
                } else {
                    this.renderQuizzes();
                }
            });

            container.innerHTML = `
                <div class="account-view">
                    <div class="page-header">
                        <div>
                            <h1>Account &amp; Sync</h1>
                            <p>Optional: back up quizzes to your account and use them on other devices.</p>
                        </div>
                    </div>
                    <div id="account-body"></div>
                </div>
            `;
            const body = $('account-body');

            if (!Cloud().configured) {
                body.innerHTML = this.notConfiguredHtml();
                return;
            }
            if (!Cloud().isReady() || (!Cloud().user() && !this._connected)) {
                // Load the sign-in service the first time this page is opened
                body.innerHTML = `<div class="card account-loading">${UI().icon('loader', 'spin')} Connecting…</div>`;
                Cloud().connect().then(() => {
                    this._connected = true;
                    if (window.QuizBowl.State.currentRoute === 'account') this.render(container);
                }).catch(err => {
                    body.innerHTML = `<div class="card">${UI().emptyState('alert', 'Can\'t connect right now', esc(err.message),
                        `<button class="btn btn-primary" onclick="window.QuizBowl.Router.handleRoute()">Try again</button>`)}</div>`;
                });
                return;
            }

            const user = Cloud().user();
            if (Cloud().inRecovery() && user) {
                body.innerHTML = this.recoveryHtml();
            } else if (!user) {
                body.innerHTML = this.signedOutHtml();
            } else {
                body.innerHTML = this.signedInHtml(user);
                this.renderQuizzes();
                this.refreshRemote();
            }
            this.bind(container);
        },

        notConfiguredHtml: function() {
            return `
                <div class="card">
                    ${UI().emptyState('cloud', 'Cloud sync isn\'t set up on this site yet',
                        'Everything still works and is saved on this device. To turn on accounts and syncing, whoever runs this site needs to create a free Supabase project and add its address and public key to <code>js/cloud/config.js</code>. Full steps are in <code>SETUP-CLOUD.md</code>.')}
                </div>
            `;
        },

        signedOutHtml: function() {
            const msg = message ? `
                <div class="callout callout-${message.tone}" style="margin-bottom: var(--spacing-md);">
                    ${UI().icon(message.tone === 'danger' ? 'alert' : message.tone === 'success' ? 'checkCircle' : 'info')}
                    <span>${esc(message.text)}${message.resend ? ` <button type="button" class="btn-link" id="acc-resend">Resend the email</button>` : ''}</span>
                </div>` : '';
            return `
                <div class="account-layout">
                    <section class="card account-auth">
                        <h2>${tab === 'signup' ? 'Create your account' : tab === 'reset' ? 'Reset your password' : 'Sign in'}</h2>
                        <p class="text-muted" style="margin-bottom: var(--spacing-lg);">${tab === 'reset' ? 'We\'ll email you a link to choose a new password.' : 'Use Google, or your email address.'}</p>
                        ${msg}
                        ${tab !== 'reset' ? `
                            <button type="button" class="btn btn-google btn-block btn-lg" id="acc-google">
                                <svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
                                Continue with Google
                            </button>
                            <div class="account-divider"><span>or</span></div>
                        ` : ''}
                        <form id="acc-form" novalidate>
                            <div class="form-group">
                                <label for="acc-email">Email</label>
                                <input type="email" id="acc-email" class="form-control" autocomplete="email" required value="${esc(pendingEmail)}">
                            </div>
                            ${tab !== 'reset' ? `
                                <div class="form-group">
                                    <label for="acc-password">Password</label>
                                    <input type="password" id="acc-password" class="form-control" autocomplete="${tab === 'signup' ? 'new-password' : 'current-password'}" required minlength="8">
                                    ${tab === 'signup' ? '<span class="form-hint">At least 8 characters.</span>' : ''}
                                </div>` : ''}
                            ${tab === 'signup' ? `
                                <div class="form-group">
                                    <label for="acc-password2">Confirm password</label>
                                    <input type="password" id="acc-password2" class="form-control" autocomplete="new-password" required minlength="8">
                                </div>` : ''}
                            <button type="submit" class="btn btn-primary btn-block" id="acc-submit">
                                ${tab === 'signup' ? 'Create account' : tab === 'reset' ? 'Send reset link' : 'Sign in'}
                            </button>
                        </form>
                        <div class="account-switch">
                            ${tab === 'signin' ? `
                                <button type="button" class="btn-link" data-tab="reset">Forgot password?</button>
                                <span>New here? <button type="button" class="btn-link" data-tab="signup">Create an account</button></span>
                            ` : `<span><button type="button" class="btn-link" data-tab="signin">Back to sign in</button></span>`}
                        </div>
                    </section>
                    <section class="card account-why">
                        <h2>${UI().icon('cloud')} Why sign in?</h2>
                        <ul>
                            <li>${UI().icon('check')}<span><strong>Back up quizzes</strong> so a lost or reset phone doesn't lose them.</span></li>
                            <li>${UI().icon('check')}<span><strong>Use the same quiz on several devices</strong>, e.g. prepare on a laptop and run it from a phone.</span></li>
                            <li>${UI().icon('check')}<span><strong>You choose, quiz by quiz</strong>: upload, download or keep a quiz only on this device.</span></li>
                            <li>${UI().icon('check')}<span><strong>Works offline as before.</strong> Signing in is optional and changes nothing until you sync.</span></li>
                        </ul>
                        <p class="form-hint">AI API keys are never uploaded; they stay on each device.</p>
                    </section>
                </div>
            `;
        },

        recoveryHtml: function() {
            return `
                <section class="card account-auth" style="max-width: 460px;">
                    <h2>Choose a new password</h2>
                    <form id="acc-newpass" novalidate>
                        <div class="form-group">
                            <label for="acc-np1">New password</label>
                            <input type="password" id="acc-np1" class="form-control" autocomplete="new-password" minlength="8" required>
                        </div>
                        <div class="form-group">
                            <label for="acc-np2">Confirm new password</label>
                            <input type="password" id="acc-np2" class="form-control" autocomplete="new-password" minlength="8" required>
                        </div>
                        <button type="submit" class="btn btn-primary btn-block">Save password</button>
                    </form>
                </section>
            `;
        },

        signedInHtml: function(user) {
            const provider = (user.app_metadata && user.app_metadata.provider) || 'email';
            const name = (user.user_metadata && (user.user_metadata.full_name || user.user_metadata.name)) || '';
            const avatar = user.user_metadata && user.user_metadata.avatar_url;
            return `
                <section class="card account-profile">
                    <div class="account-avatar">${avatar ? `<img src="${esc(avatar)}" alt="" referrerpolicy="no-referrer">` : esc(UI().initials(name || user.email))}</div>
                    <div class="account-who">
                        <strong>${esc(name || user.email)}</strong>
                        <span>${name ? esc(user.email) + ' · ' : ''}Signed in with ${provider === 'google' ? 'Google' : 'email'}
                            ${user.email_confirmed_at ? `<span class="sync-badge sync-success">${UI().icon('check')}Verified</span>` : ''}</span>
                    </div>
                    <button type="button" class="btn btn-secondary" id="acc-signout">Sign out</button>
                </section>

                <section class="card card-flush account-quizzes">
                    <div class="card-header">
                        <div>
                            <h2>Your quizzes</h2>
                            <p>Choose what to upload, download or keep in sync. Auto-sync keeps a quiz up to date whenever you're online.</p>
                        </div>
                        <div class="account-tools">
                            <button type="button" class="btn btn-ghost btn-sm" id="acc-refresh">${UI().icon('reset')} Refresh</button>
                            <button type="button" class="btn btn-primary btn-sm" id="acc-sync-all">${UI().icon('cloud')} Sync all changes</button>
                        </div>
                    </div>
                    <div id="acc-quizzes"></div>
                </section>
            `;
        },

        // Local quizzes plus cloud-only ones, with their sync status
        rows: function() {
            const remote = Cloud().remote() || {};
            const QuizzesDB = window.QuizBowl.Data.QuizzesDB;
            const activeId = QuizzesDB.getActiveId();
            const linked = new Set();
            const rows = QuizzesDB.getAll().map(q => {
                const st = Cloud().state(q.id) || {};
                const status = Cloud().status(q.id);
                if (st.cloudId && status !== 'other-account') linked.add(st.cloudId);
                return { kind: 'local', id: q.id, name: q.name, status, st, remote: st.cloudId ? remote[st.cloudId] : null, active: q.id === activeId };
            });
            Object.values(remote).forEach(r => {
                if (!linked.has(r.id)) rows.push({ kind: 'cloud', id: r.id, name: r.name, status: 'cloud', remote: r });
            });
            return rows;
        },

        renderQuizzes: function() {
            const el = $('acc-quizzes');
            if (!el) return;
            const rows = this.rows();
            const action = (key, label, cls = 'btn-secondary', icon = '') =>
                `<button type="button" class="btn ${cls} btn-sm" data-act="${key}">${icon ? UI().icon(icon) : ''}${label}</button>`;

            el.innerHTML = `
                ${remoteError ? `<div class="callout callout-danger" style="margin: 0 var(--spacing-lg) var(--spacing-md);">${UI().icon('alert')}<span>${esc(remoteError)}</span></div>` : ''}
                ${loadingRemote ? `<p class="account-loading-row">${UI().icon('loader', 'spin')} Checking the cloud…</p>` : ''}
                <ul class="sync-list">
                    ${rows.map(r => {
                        const key = `${r.kind}:${r.id}`;
                        const isBusy = busy[key];
                        let actions = '';
                        switch (r.status) {
                            case 'local': actions = action('upload', 'Upload', 'btn-primary', 'upload'); break;
                            case 'synced': actions = action('sync', 'Sync now', 'btn-secondary', 'reset'); break;
                            case 'changed': actions = action('upload', 'Upload changes', 'btn-primary', 'upload'); break;
                            case 'cloud-newer': actions = action('download', 'Download changes', 'btn-primary', 'download'); break;
                            case 'conflict': actions = action('resolve', 'Choose version…', 'btn-danger', 'alert'); break;
                            case 'cloud-deleted': actions = action('reupload', 'Upload again', 'btn-primary', 'upload') + action('unlink', 'Keep on this device only', 'btn-ghost'); break;
                            case 'other-account': actions = action('reupload', 'Upload a copy to this account', 'btn-secondary', 'upload'); break;
                            case 'cloud': actions = action('fetch', 'Download to this device', 'btn-primary', 'download') + action('delete-cloud', 'Delete from cloud', 'btn-ghost', 'trash'); break;
                        }
                        const linked = r.kind === 'local' && r.st && r.st.cloudId && !['other-account', 'cloud-deleted', 'local'].includes(r.status);
                        const detail = r.kind === 'cloud'
                            ? `${r.remote.question_count} questions · updated ${timeAgo(r.remote.updated_at)}${r.remote.updated_device ? ` on ${esc(r.remote.updated_device)}` : ''}`
                            : linked
                                ? `Last synced ${timeAgo(r.st.syncedAt)}${r.remote && r.remote.updated_device && r.status === 'cloud-newer' ? ` · changed on ${esc(r.remote.updated_device)}` : ''}`
                                : `${window.QuizBowl.Data.QuizzesDB.getStats(r.id).questions} questions on this device`;
                        return `
                            <li class="sync-row ${isBusy ? 'is-busy' : ''}" data-kind="${r.kind}" data-id="${esc(r.id)}">
                                <div class="sync-main">
                                    <div class="sync-name">
                                        <strong>${esc(r.name)}</strong>
                                        ${r.active ? '<span class="badge badge-available">Current</span>' : ''}
                                    </div>
                                    <div class="sync-meta">${badge(r.status)}<span>${detail}</span></div>
                                </div>
                                <div class="sync-actions">
                                    ${linked ? `
                                        <label class="sync-auto" title="Sync automatically whenever this quiz changes and you're online">
                                            <input type="checkbox" data-auto ${r.st.autoSync ? 'checked' : ''}> Auto-sync
                                        </label>` : ''}
                                    ${isBusy ? `<span class="sync-working">${UI().icon('loader', 'spin')} Working…</span>` : actions}
                                    ${linked && !isBusy ? `<button type="button" class="btn btn-ghost btn-icon btn-sm" data-act="more" title="More options" aria-label="More options for ${esc(r.name)}">${UI().icon('more')}</button>` : ''}
                                </div>
                            </li>`;
                    }).join('')}
                </ul>
            `;
        },

        refreshRemote: async function() {
            loadingRemote = true;
            remoteError = '';
            this.renderQuizzes();
            try {
                await Cloud().listRemote();
            } catch (err) {
                remoteError = err.message;
            } finally {
                loadingRemote = false;
                this.renderQuizzes();
            }
        },

        // Run a row action with a busy state and a friendly result message
        act: async function(kind, id, act) {
            const key = `${kind}:${id}`;
            const QuizzesDB = window.QuizBowl.Data.QuizzesDB;
            const name = kind === 'local' ? (QuizzesDB.getById(id) || {}).name : ((Cloud().remote() || {})[id] || {}).name;

            if (act === 'resolve') return this.resolveConflict(id);
            if (act === 'more') return this.moreOptions(id);
            if (act === 'delete-cloud') {
                const ok = await window.QuizBowl.Components.Modal.confirm({
                    title: `Delete "${name}" from the cloud?`,
                    message: 'It will be removed from your account on every device. Copies already downloaded to devices stay there.',
                    confirmText: 'Delete from cloud', danger: true
                });
                if (!ok) return;
            }
            if (act === 'unlink') {
                Cloud().unlink(id);
                this.renderQuizzes();
                return;
            }
            if (act === 'download' && Cloud().status(id) === 'conflict') return this.resolveConflict(id);

            busy[key] = true;
            this.renderQuizzes();
            try {
                if (act === 'upload' || act === 'reupload') {
                    if (act === 'reupload') Cloud().unlink(id);
                    await Cloud().upload(id);
                    Toast().show(`"${name}" uploaded.`, 'success');
                } else if (act === 'download') {
                    await Cloud().download(id);
                    Toast().show(`"${name}" updated from the cloud.`, 'success');
                } else if (act === 'sync') {
                    const { action } = await Cloud().sync(id);
                    Toast().show(action === 'none' ? `"${name}" is already up to date.` : action === 'upload' ? `"${name}" uploaded.` : `"${name}" updated from the cloud.`, 'success');
                } else if (act === 'fetch') {
                    const quiz = await Cloud().downloadNew(id);
                    Toast().show(`"${quiz.name}" downloaded to this device.`, 'success');
                } else if (act === 'delete-cloud') {
                    await Cloud().removeFromCloud(id);
                    Toast().show(`"${name}" deleted from the cloud.`, 'info');
                }
            } catch (err) {
                if (err.kind === 'conflict') {
                    delete busy[key];
                    return this.resolveConflict(id);
                }
                Toast().show(err.message, 'danger');
            } finally {
                delete busy[key];
                this.renderQuizzes();
                window.QuizBowl.App.refreshQuizSwitcher();
            }
        },

        syncAll: async function() {
            const rows = this.rows().filter(r => r.kind === 'local' && ['changed', 'cloud-newer', 'synced'].includes(r.status));
            const btn = $('acc-sync-all');
            btn.disabled = true;
            let done = 0, conflicts = 0, failed = 0;
            try { await Cloud().listRemote(); } catch (e) { /* continue with what we know */ }
            for (const r of rows) {
                busy[`local:${r.id}`] = true;
                this.renderQuizzes();
                try {
                    const { action } = await Cloud().sync(r.id);
                    if (action !== 'none') done++;
                } catch (err) {
                    if (err.kind === 'conflict') conflicts++; else failed++;
                } finally {
                    delete busy[`local:${r.id}`];
                }
            }
            btn.disabled = false;
            this.renderQuizzes();
            window.QuizBowl.App.refreshQuizSwitcher();
            const parts = [done ? `${done} quiz${done === 1 ? '' : 'zes'} synced` : 'Everything was already up to date'];
            if (conflicts) parts.push(`${conflicts} need${conflicts === 1 ? 's' : ''} you to choose a version`);
            if (failed) parts.push(`${failed} failed`);
            Toast().show(parts.join('; ') + '.', conflicts || failed ? 'warning' : 'success');
        },

        // Both copies changed: let the user pick which one wins
        resolveConflict: function(localId) {
            const quiz = window.QuizBowl.Data.QuizzesDB.getById(localId);
            const st = Cloud().state(localId) || {};
            const remote = (Cloud().remote() || {})[st.cloudId] || {};
            const overlay = document.createElement('div');
            overlay.className = 'modal-overlay';
            overlay.innerHTML = `
                <div class="modal" role="dialog" aria-modal="true" aria-labelledby="conflict-title" style="max-width: 520px;">
                    <div class="modal-head">
                        <div class="modal-icon danger">${UI().icon('alert')}</div>
                        <div style="flex: 1;">
                            <h2 id="conflict-title">Which version of "${esc(quiz ? quiz.name : '')}" do you want to keep?</h2>
                            <p>It was changed on this device and${remote.updated_device ? ` on ${esc(remote.updated_device)}` : ' on another device'} since the last sync.</p>
                        </div>
                    </div>
                    <div class="choice-cards conflict-choices" style="margin-top: var(--spacing-md);">
                        <button type="button" class="choice-card" data-choice="local">
                            <span><strong>${UI().icon('monitor')} Keep this device's version</strong>
                            <small>${window.QuizBowl.Data.QuizzesDB.getStats(localId).questions} questions. Replaces the cloud copy.</small></span>
                        </button>
                        <button type="button" class="choice-card" data-choice="cloud">
                            <span><strong>${UI().icon('cloud')} Use the cloud version</strong>
                            <small>${remote.question_count != null ? remote.question_count + ' questions, ' : ''}updated ${timeAgo(remote.updated_at)}. Replaces this device's copy.</small></span>
                        </button>
                    </div>
                    <div class="modal-actions"><button type="button" class="btn btn-secondary" data-choice="cancel">Decide later</button></div>
                </div>
            `;
            document.body.appendChild(overlay);
            requestAnimationFrame(() => overlay.classList.add('show'));
            const close = () => { overlay.classList.remove('show'); setTimeout(() => overlay.remove(), 180); };
            overlay.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Escape') close(); });
            overlay.addEventListener('click', async e => {
                const choice = e.target.closest('[data-choice]');
                if (!choice) { if (e.target === overlay) close(); return; }
                const value = choice.getAttribute('data-choice');
                close();
                if (value === 'cancel') return;
                const key = `local:${localId}`;
                busy[key] = true;
                this.renderQuizzes();
                try {
                    if (value === 'local') await Cloud().upload(localId, { force: true });
                    else await Cloud().download(localId);
                    Toast().show(value === 'local' ? 'Kept this device\'s version and uploaded it.' : 'Replaced with the cloud version.', 'success');
                } catch (err) {
                    Toast().show(err.message, 'danger');
                } finally {
                    delete busy[key];
                    this.renderQuizzes();
                    window.QuizBowl.App.refreshQuizSwitcher();
                }
            });
            overlay.querySelector('[data-choice="local"]').focus();
        },

        moreOptions: async function(localId) {
            const quiz = window.QuizBowl.Data.QuizzesDB.getById(localId);
            const choice = await window.QuizBowl.Components.Modal.confirm({
                title: `Stop syncing "${quiz ? quiz.name : ''}"?`,
                message: 'The quiz stays on this device and in the cloud, but they\'ll no longer be linked. To remove the cloud copy instead, use "Delete from cloud" after this.',
                confirmText: 'Stop syncing'
            });
            if (!choice) return;
            Cloud().unlink(localId);
            Toast().show('Stopped syncing. The cloud copy is now listed as "Only in the cloud".', 'info');
            this.renderQuizzes();
        },

        bind: function(container) {
            const view = container.querySelector('.account-view');
            const self = this;

            view.addEventListener('click', async e => {
                const t = e.target;
                const tabBtn = t.closest('[data-tab]');
                if (tabBtn) {
                    const email = $('acc-email');
                    if (email) pendingEmail = email.value.trim();
                    tab = tabBtn.getAttribute('data-tab');
                    message = null;
                    return self.render(container);
                }
                if (t.closest('#acc-google')) {
                    const btn = t.closest('#acc-google');
                    btn.disabled = true;
                    try { await Cloud().auth.signInWithGoogle(); }
                    catch (err) { message = { tone: 'danger', text: err.message }; self.render(container); }
                    return;
                }
                if (t.closest('#acc-resend')) {
                    try {
                        await Cloud().auth.resendConfirmation(pendingEmail);
                        message = { tone: 'success', text: `Sent another confirmation email to ${pendingEmail}.` };
                    } catch (err) {
                        message = { tone: 'danger', text: err.message };
                    }
                    return self.render(container);
                }
                if (t.closest('#acc-signout')) {
                    await Cloud().auth.signOut();
                    Toast().show('Signed out. Your quizzes are still on this device.', 'info');
                    return;
                }
                if (t.closest('#acc-refresh')) return self.refreshRemote();
                if (t.closest('#acc-sync-all')) return self.syncAll();
                const actBtn = t.closest('[data-act]');
                if (actBtn) {
                    const row = actBtn.closest('.sync-row');
                    return self.act(row.getAttribute('data-kind'), row.getAttribute('data-id'), actBtn.getAttribute('data-act'));
                }
            });

            view.addEventListener('change', e => {
                if (e.target.matches('[data-auto]')) {
                    const row = e.target.closest('.sync-row');
                    Cloud().setAutoSync(row.getAttribute('data-id'), e.target.checked);
                    Toast().show(e.target.checked ? 'Auto-sync on for this quiz.' : 'Auto-sync off for this quiz.', 'info');
                }
            });

            const form = $('acc-form');
            if (form) form.addEventListener('submit', async e => {
                e.preventDefault();
                const email = $('acc-email').value.trim();
                const password = $('acc-password') ? $('acc-password').value : '';
                pendingEmail = email;
                if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { message = { tone: 'danger', text: 'Enter a valid email address.' }; return self.render(container); }
                const submit = $('acc-submit');
                submit.disabled = true;
                submit.innerHTML = `${UI().icon('loader', 'spin')} Please wait…`;
                try {
                    if (tab === 'reset') {
                        await Cloud().auth.sendPasswordReset(email);
                        message = { tone: 'success', text: `If ${email} has an account, a reset link is on its way. Open it on this device.` };
                        tab = 'signin';
                    } else if (tab === 'signup') {
                        if (password.length < 8) throw new Error('Use at least 8 characters for your password.');
                        if (password !== $('acc-password2').value) throw new Error('The two passwords don\'t match.');
                        const { needsConfirmation } = await Cloud().auth.signUp(email, password);
                        if (needsConfirmation) {
                            message = { tone: 'info', text: `Almost done! We sent a confirmation link to ${email}. Open it to verify your email, then you'll be signed in.`, resend: true };
                            tab = 'signin';
                        }
                    } else {
                        await Cloud().auth.signIn(email, password);
                        message = null;
                    }
                } catch (err) {
                    message = { tone: 'danger', text: err.message, resend: err.kind === 'unconfirmed' };
                }
                if (!Cloud().user()) self.render(container);
            });

            const newPass = $('acc-newpass');
            if (newPass) newPass.addEventListener('submit', async e => {
                e.preventDefault();
                const p1 = $('acc-np1').value, p2 = $('acc-np2').value;
                if (p1.length < 8) return Toast().show('Use at least 8 characters.', 'warning');
                if (p1 !== p2) return Toast().show('The two passwords don\'t match.', 'warning');
                try {
                    await Cloud().auth.updatePassword(p1);
                    Toast().show('Password updated.', 'success');
                    self.render(container);
                } catch (err) {
                    Toast().show(err.message, 'danger');
                }
            });
        }
    };
})();
