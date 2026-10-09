/**
 * js/views/results.js
 * My Results: every hosted quiz this person has taken (#results), and one
 * result in full (#results/ATTEMPT_ID, shown with the quiz page's result view).
 *
 * When the host marks written answers (or changes a mark), the result shows
 * "Newly marked" and the sidebar item gets a dot until the person opens it.
 * What they've seen is remembered per device.
 */
(function() {
    const SEEN_KEY = 'quizr_results_seen';   // { attemptId: markedAt the person has seen }
    const ENDED = { finished: 'Finished', ended: 'Ended early', timeout: 'Time ran out' };
    const DOT_CHECK_MS = 60000;

    const UI = () => window.QuizBowl.Utils.UI;
    const Hosting = () => window.QuizBowl.Services.Hosting;
    const Cloud = () => window.QuizBowl.Cloud;
    const esc = v => UI().escapeHtml(v);
    const $ = id => document.getElementById(id);

    let renderToken = 0;
    let lastDotCheck = 0;

    function readSeen() {
        try { return JSON.parse(localStorage.getItem(SEEN_KEY) || '{}') || {}; } catch (e) { return {}; }
    }
    function markSeen(attemptId, markedAt) {
        if (!markedAt) return;
        const seen = readSeen();
        seen[attemptId] = markedAt;
        try { localStorage.setItem(SEEN_KEY, JSON.stringify(seen)); } catch (e) { /* ignore */ }
    }
    const isNew = (a, seen) => a.status === 'submitted' && !!a.markedAt && a.markedAt > (seen[a.id] || 0);

    function percent(score, max) {
        return max ? Math.round((score / max) * 100) : 0;
    }

    function formatDate(ts) {
        return new Date(ts).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    }

    // Sidebar dot: a result was marked since the person last looked
    function showDot(attempts) {
        const dot = $('results-dot');
        if (!dot) return;
        const seen = readSeen();
        const count = attempts.filter(a => isNew(a, seen)).length;
        dot.hidden = !count;
        dot.title = count ? `${count} result${count === 1 ? ' has' : 's have'} been marked since you last looked` : '';
    }

    async function checkDot(force) {
        const mode = Hosting().hostMode();
        if (mode !== 'cloud' && mode !== 'local') { const dot = $('results-dot'); if (dot) dot.hidden = true; return; }
        if (!force && Date.now() - lastDotCheck < DOT_CHECK_MS) return;
        lastDotCheck = Date.now();
        try {
            const { attempts } = await Hosting().myAttempts();
            showDot(attempts);
        } catch (e) { /* the dot is a nicety; ignore failures */ }
    }

    function scoreBlock(a) {
        if (a.status !== 'submitted') return `<span class="results-score is-running">${UI().icon('timer')}</span>`;
        const pct = percent(a.score, a.maxScore);
        return `<span class="take-score-ring results-ring" style="--p: ${pct}"><span>${pct}%</span></span>`;
    }

    function item(a, seen) {
        const running = a.status !== 'submitted';
        const href = running ? `#take/${encodeURIComponent(a.code)}` : `#results/${encodeURIComponent(a.id)}`;
        const fresh = isNew(a, seen);
        return `
            <a class="results-item ${fresh ? 'is-new' : ''}" href="${href}">
                ${scoreBlock(a)}
                <span class="results-main">
                    <strong>${esc(a.title)}</strong>
                    <small>${[`Code ${esc(a.code)}`, formatDate(running ? a.startedAt : a.submittedAt), running ? '' : ENDED[a.endedBy] || 'Submitted', a.source === 'local' ? 'on this device' : '']
                        .filter(Boolean).join(' · ')}</small>
                </span>
                <span class="results-side">
                    ${fresh ? '<span class="badge badge-partial">Newly marked</span>' : ''}
                    ${!running && a.pending ? `<span class="badge badge-answered">${a.pending} awaiting marking</span>` : ''}
                    ${running ? `<span class="btn btn-primary btn-sm">${UI().icon('play')} Continue</span>`
                        : `<span class="results-points"><strong>${a.score}</strong> / ${a.maxScore}</span>`}
                </span>
            </a>`;
    }

    const Results = {
        render: function(container, attemptId) {
            if (attemptId) return this.renderOne(container, attemptId);
            return this.renderList(container);
        },

        renderList: async function(container) {
            const token = ++renderToken;
            const mode = Hosting().hostMode();
            const header = `
                <div class="page-header">
                    <div>
                        <h1>My Results</h1>
                        <p>Every quiz you've taken. When the host marks written answers, your score updates here.</p>
                    </div>
                    <div class="page-actions">
                        <a href="#take" class="btn btn-secondary">${UI().icon('play')} Take a quiz</a>
                    </div>
                </div>`;
            container.innerHTML = `<div class="results-view">${header}
                <div class="card host-loading">${UI().icon('loader', 'spin')} ${mode === 'loading' ? 'Checking your account…' : 'Loading your results…'}</div></div>`;
            if (mode === 'loading') return;   // drawn again once the account check finishes

            let data;
            try {
                data = await Hosting().myAttempts();
            } catch (err) {
                data = { attempts: [], cloudError: err.message };
            }
            if (token !== renderToken) return;
            const { attempts, cloudError } = data;
            const seen = readSeen();
            const done = attempts.filter(a => a.status === 'submitted');
            const running = attempts.filter(a => a.status !== 'submitted');
            const avg = done.length ? Math.round(done.reduce((s, a) => s + percent(a.score, a.maxScore), 0) / done.length) : null;
            const best = done.length ? Math.max(...done.map(a => percent(a.score, a.maxScore))) : null;
            const awaiting = done.reduce((n, a) => n + (a.pending || 0), 0);
            const fresh = done.filter(a => isNew(a, seen)).length;
            showDot(attempts);

            container.innerHTML = `
                <div class="results-view">
                    ${header}
                    ${mode === 'signin' ? `<div class="callout callout-info host-callout">${UI().icon('user')}<div><strong>Sign in to see your results</strong>Results from quizzes you took with your Quizr account are kept with your account.
                        <a href="#account" class="btn btn-primary btn-sm host-callout-btn">Sign in</a></div></div>` : ''}
                    ${cloudError ? `<div class="callout callout-danger host-callout">${UI().icon('alert')}<div><strong>Couldn't load your results</strong>${esc(cloudError)}</div></div>` : ''}
                    ${fresh ? `<div class="callout callout-warning host-callout">${UI().icon('pencil')}<div><strong>${fresh === 1 ? 'A result has' : `${fresh} results have`} been marked since you last looked</strong>Open ${fresh === 1 ? 'it' : 'them'} to see your updated score.</div></div>` : ''}
                    ${done.length ? `
                    <section class="results-stats">
                        <div class="card"><span>Quizzes taken</span><strong>${done.length}</strong></div>
                        <div class="card"><span>Average</span><strong>${avg}%</strong></div>
                        <div class="card"><span>Best</span><strong>${best}%</strong></div>
                        <div class="card"><span>Awaiting marking</span><strong>${awaiting}</strong></div>
                    </section>` : ''}
                    ${running.length ? `
                    <section class="card">
                        <div class="card-header"><div><h2>In progress</h2><p>The clock is still running on ${running.length === 1 ? 'this one' : 'these'}</p></div></div>
                        <div class="results-list">${running.map(a => item(a, seen)).join('')}</div>
                    </section>` : ''}
                    ${done.length ? `
                    <section class="card">
                        <div class="card-header"><div><h2>Results</h2><p>${done.length} quiz${done.length === 1 ? '' : 'zes'}, newest first</p></div></div>
                        <div class="results-list">${done.map(a => item(a, seen)).join('')}</div>
                    </section>` : ''}
                    ${!attempts.length && !cloudError && mode !== 'signin' ? `
                    <section class="card">${UI().emptyState('award', 'No results yet', 'When you take a quiz someone has hosted, your score appears here.',
                        `<a href="#take" class="btn btn-primary">${UI().icon('play')} Take a quiz</a>`)}</section>` : ''}
                </div>`;
        },

        renderOne: async function(container, attemptId) {
            const token = ++renderToken;
            const source = Hosting().isCloudId(attemptId) ? 'cloud' : 'local';
            const mode = Hosting().hostMode();
            container.innerHTML = `<div class="card host-loading">${UI().icon('loader', 'spin')} ${mode === 'loading' ? 'Checking your account…' : 'Loading your result…'}</div>`;
            if (mode === 'loading') return;
            if (source === 'cloud' && mode !== 'cloud') {
                container.innerHTML = `<div class="card">${UI().emptyState('user', 'Sign in to see this result', 'It\'s saved with your Quizr account.',
                    '<a href="#account" class="btn btn-primary">Sign in</a>')}</div>`;
                return;
            }
            let state;
            try {
                state = await Hosting().state(source, attemptId);
            } catch (err) {
                if (token !== renderToken) return;
                const gone = /no longer exists/i.test(err.message);
                container.innerHTML = `<div class="card">${UI().emptyState(gone ? 'inbox' : 'cloud', gone ? 'Result not found' : 'Couldn\'t load this result',
                    gone ? 'The host may have deleted it, or the hosted quiz.' : esc(err.message), '<a href="#results" class="btn btn-primary">My results</a>')}</div>`;
                return;
            }
            if (token !== renderToken) return;
            if (state.attempt.status !== 'submitted') {
                window.QuizBowl.Router.navigate('take/' + state.session.code);
                return;
            }
            markSeen(state.attempt.id, state.attempt.markedAt);
            window.QuizBowl.Views.Take.renderResult(state, { container, fromResults: true });
            checkDot(true);
        },

        checkDot
    };

    window.QuizBowl.Views.Results = Results;

    // Keep the sidebar dot up to date: when the account is known, and now and then while the app is open
    if (window.QuizBowl.Cloud) {
        window.QuizBowl.Cloud.subscribe(event => {
            if (event.type !== 'ready' && event.type !== 'auth') return;
            setTimeout(() => {
                checkDot(true);
                if (window.QuizBowl.State.currentRoute === 'results' && !document.querySelector('.take-result, .results-item, .results-view .empty-state')) {
                    window.QuizBowl.Router.handleRoute();
                }
            }, 0);
        });
    }
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkDot(false); });
    document.addEventListener('DOMContentLoaded', () => setTimeout(() => checkDot(true), 1500));
    setInterval(() => { if (document.visibilityState === 'visible' && !window.QuizBowl.State.examLock) checkDot(false); }, DOT_CHECK_MS * 2);
})();
