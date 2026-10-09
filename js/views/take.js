/**
 * js/views/take.js
 * Taking a hosted quiz (#take/CODE): enter your name, then answer one
 * question at a time against the clock, and see your score at the end.
 *
 * Timer modes:
 *  - per question: each question has its own countdown; Next (or running out
 *    of time) closes it and opens the next. Closed questions can be viewed
 *    but not changed.
 *  - total time: one countdown; answers can be changed anywhere until the
 *    quiz is submitted or the time runs out (then it submits itself).
 *
 * The quiz may live in the cloud or on this device (see services/hosting.js).
 * Either way the clock is based on saved deadlines (the server's clock for
 * cloud quizzes), so refreshing or leaving doesn't pause it, and coming back
 * resumes the same attempt.
 *
 * While a quiz is running the app is in exam mode (see Exam below): the rest
 * of the app is hidden and can't be reached until the quiz is submitted or ended.
 */
(function() {
    const RETURN_KEY = 'quizr_take_return';       // { code, at }: quiz to come back to after signing in
    const LOCAL_KEY = 'quizr_take_attempt_';      // + code: this tab's on-device attempt when there are no accounts
    const LETTERS = 'ABCDEFGHIJ';
    const SAVE_DELAY = 700;                       // ms after typing stops before a written answer is saved
    const EXAM_KEY = 'quizr_exam';                // route of the quiz running in this tab (exam mode)

    const UI = () => window.QuizBowl.Utils.UI;
    const Hosting = () => window.QuizBowl.Services.Hosting;
    const Toast = () => window.QuizBowl.Components.Toast;
    const Modal = () => window.QuizBowl.Components.Modal;
    const Cloud = () => window.QuizBowl.Cloud;
    const esc = v => UI().escapeHtml(v);
    const safe = v => UI().safeHtml(v);
    const $ = id => document.getElementById(id);
    const cleanCode = code => String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

    let ticker = null;
    let renderToken = 0;       // increases on every page render; stale async work checks it
    let busy = false;          // a confirm dialog is open
    let retake = false;        // the person chose "Take it again" on their result

    function stopTicker() {
        if (ticker) clearInterval(ticker);
        ticker = null;
    }

    function clock(ms) {
        const total = Math.max(0, Math.ceil(ms / 1000));
        const h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = total % 60;
        return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
    }

    function typeset(el) {
        if (el && window.MathJax && MathJax.typesetPromise) MathJax.typesetPromise([el]).catch(() => {});
    }

    function store(kind, key, value) {
        try {
            const s = kind === 'local' ? window.localStorage : window.sessionStorage;
            if (value === undefined) return s.getItem(key);
            if (value === null) s.removeItem(key);
            else s.setItem(key, value);
        } catch (e) { return null; }
        return null;
    }

    // Who is taking the quiz: a signed-in Quizr account, or just a name when this site has no accounts
    function identity() {
        const cloud = Cloud();
        if (!cloud || !cloud.configured) return { mode: 'local' };
        if (!cloud.isReady()) return { mode: 'loading' };
        const user = cloud.user();
        if (!user) return { mode: 'signin' };
        const meta = user.user_metadata || {};
        return { mode: 'user', userId: user.id, email: user.email || '', suggestedName: meta.full_name || meta.name || '' };
    }

    const isAnswered = v => v != null && String(v).trim() !== '';
    const optionText = (q, key) => (q.options || {})[key] == null ? '' : q.options[key];
    const optionKeys = (attempt, q) => (attempt.optionOrder && attempt.optionOrder[q.id]) || Object.keys(q.options || {}).sort();

    const STATUS_BADGES = {
        correct: '<span class="badge badge-correct">Correct</span>',
        wrong: '<span class="badge badge-wrong">Wrong</span>',
        unanswered: '<span class="badge badge-answered">Not answered</span>',
        pending: '<span class="badge badge-partial">Awaiting marking</span>',
        marked: '<span class="badge badge-partial">Marked by host</span>'
    };

    function errorCard(icon, title, message, actions = `<a href="#take" class="btn btn-primary">Enter another code</a>`) {
        Exam.unlock();
        return `<div class="card take-card">${UI().emptyState(icon, esc(title), message, actions)}</div>`;
    }

    /**
     * Exam mode while a quiz is running: the sidebar, menu and header are hidden,
     * the router refuses to leave the quiz (see router.js), the browser asks before
     * closing the tab, and the quiz runs in full screen where the device allows it.
     * Leaving full screen covers the quiz until the person goes back to full screen.
     * (A web page can't stop someone closing the browser; the clock keeps running
     * and the attempt resumes when they come back.)
     */
    const Exam = {
        route: null,
        ownFullscreen: false,
        noFullscreen: false,     // full screen was refused here; don't insist on it

        active() {
            return !!this.route;
        },

        lock() {
            const route = (location.hash.substring(1) || '').replace(/^\//, '');
            this.route = route;
            window.QuizBowl.State.examLock = route;
            // Remembered for this tab, so a reload locks the app again before anything else shows (see app.js)
            store('session', EXAM_KEY, route);
            document.body.classList.add('exam-mode');
            const app = document.getElementById('app-container');
            if (app) app.classList.remove('sidebar-open');
            if (document.activeElement && document.activeElement.id === 'global-search') document.activeElement.blur();
            this.updateGate();
        },

        unlock() {
            if (!this.route && !window.QuizBowl.State.examLock) return;
            this.route = null;
            window.QuizBowl.State.examLock = null;
            store('session', EXAM_KEY, null);
            document.body.classList.remove('exam-mode');
            if (this.ownFullscreen && document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
            this.ownFullscreen = false;
        },

        // Must be called from a click (browsers only allow full screen after one)
        enterFullscreen() {
            const el = document.documentElement;
            if (!document.fullscreenEnabled || !el.requestFullscreen || document.fullscreenElement || this.noFullscreen) return Promise.resolve();
            return el.requestFullscreen({ navigationUI: 'hide' })
                .then(() => { this.ownFullscreen = true; })
                .catch(() => { this.noFullscreen = true; })
                .then(() => this.updateGate());
        },

        needsFullscreen() {
            return this.active() && !!document.fullscreenEnabled && !this.noFullscreen && !document.fullscreenElement;
        },

        updateGate() {
            const gate = $('take-fs-gate');
            if (gate) gate.hidden = !this.needsFullscreen();
        }
    };

    window.addEventListener('beforeunload', e => {
        if (!Exam.active()) return;
        e.preventDefault();
        e.returnValue = '';
    });
    document.addEventListener('fullscreenchange', () => {
        if (!document.fullscreenElement) Exam.ownFullscreen = false;
        else if (Exam.active()) Exam.ownFullscreen = true;
        Exam.updateGate();
    });

    const View = {
        // One question in a review list (used by the result screen and the host's marking page)
        reviewItem: function(q, attempt, index, result, extraHtml = '') {
            const given = attempt.answers[q.id];
            const status = result ? result.status : null;
            let answerHtml;
            if (q.type === 'mcq') {
                answerHtml = `<ul class="take-review-options">${optionKeys(attempt, q).map((key, i) => {
                    const chosen = given === key, right = q.correctAnswer === key;
                    return `<li class="${right ? 'is-right' : ''} ${chosen && !right ? 'is-wrong' : ''}">
                        <span class="take-letter">${LETTERS[i]}</span><span>${safe(optionText(q, key))}</span>
                        ${chosen ? `<em>${right ? UI().icon('check') : UI().icon('x')} Chosen</em>` : right ? `<em>${UI().icon('check')} Correct answer</em>` : ''}
                    </li>`;
                }).join('')}</ul>`;
            } else if (q.type === 'true_false') {
                answerHtml = `<dl class="take-review-answers">
                    <div><dt>Answer given</dt><dd>${isAnswered(given) ? esc(given) : '<span class="text-muted">No answer</span>'}</dd></div>
                    <div><dt>Correct answer</dt><dd>${esc(q.correctAnswer)}</dd></div>
                </dl>`;
            } else {
                answerHtml = `<dl class="take-review-answers">
                    <div><dt>Answer given</dt><dd class="take-written">${isAnswered(given) ? esc(given) : '<span class="text-muted">No answer</span>'}</dd></div>
                    <div><dt>Expected answer</dt><dd>${q.expectedAnswer ? safe(q.expectedAnswer) : '<span class="text-muted">Not set</span>'}${q.unit ? ' ' + esc(q.unit) : ''}</dd></div>
                </dl>`;
            }
            return `
                <li class="take-review-item ${status ? 'is-' + status : ''}">
                    <div class="take-review-head">
                        <span class="take-review-num">${index + 1}</span>
                        ${UI().typeChip(q.type)}
                        <span class="text-muted">${esc(q.category)}</span>
                        <span class="take-review-marks">${status ? STATUS_BADGES[status] || '' : ''} ${result ? `<strong>${result.awarded}</strong> / ${result.marks}` : `${q.marks} mark${q.marks == 1 ? '' : 's'}`}</span>
                    </div>
                    <div class="take-review-q">${safe(q.question)}</div>
                    ${answerHtml}
                    ${q.explanation ? `<p class="take-review-expl">${UI().icon('info')} <span>${safe(q.explanation)}</span></p>` : ''}
                    ${extraHtml}
                </li>`;
        },

        render: async function(container, code) {
            stopTicker();
            busy = false;
            const wantRetake = retake;   // only for the render right after "Take it again"
            retake = false;
            const token = ++renderToken;
            this.container = container;
            this.stage = '';
            this.st = null;
            this.acting = false;
            this.code = cleanCode(code);
            if (!this.code) return this.renderCodeEntry();

            const who = identity();
            this.who = who;
            if (who.mode === 'loading') {
                this.stage = 'loading';
                container.innerHTML = `<div class="card take-card take-loading">${UI().icon('loader', 'spin')} Checking your account…</div>`;
                return;
            }
            if (who.mode === 'signin') return this.renderSignIn();

            container.innerHTML = `<div class="card take-card take-loading">${UI().icon('loader', 'spin')} Opening the quiz…</div>`;
            let joined;
            try {
                joined = await Hosting().join(this.code, { userId: who.userId, localAttemptId: store('session', LOCAL_KEY + this.code) });
            } catch (err) {
                if (token !== renderToken) return;
                const notFound = /no quiz with that code/i.test(err.message);
                container.innerHTML = errorCard(notFound ? 'alert' : 'cloud', notFound ? 'Quiz not found' : 'Couldn\'t open the quiz',
                    notFound ? `There's no quiz with the code <strong>${esc(this.code)}</strong>. Check the code and try again.` : esc(err.message),
                    notFound ? undefined : `<button type="button" class="btn btn-primary" id="take-retry">Try again</button>`);
                const retry = $('take-retry');
                if (retry) retry.addEventListener('click', () => this.render(container, this.code));
                return;
            }
            if (token !== renderToken) return;
            this.source = joined.source;
            this.session = joined.session;
            const latest = joined.latest;
            if (latest && latest.attempt.status === 'in_progress') return this.renderRunner(latest, true);
            if (latest && latest.attempt.status === 'submitted' && !(wantRetake && this.session.settings.allowRetake)) return this.renderResult(latest);
            if (!this.session.open) {
                container.innerHTML = errorCard('lock', 'This quiz is closed', `<strong>${esc(this.session.title)}</strong> isn't taking new attempts.`, '<a href="#dashboard" class="btn btn-secondary">Back</a>');
                return;
            }
            this.renderIntro(latest);
        },

        renderCodeEntry: function() {
            Exam.unlock();
            this.container.innerHTML = `
                <div class="card take-card take-code-entry">
                    <span class="stat-icon accent take-big-icon">${UI().icon('play')}</span>
                    <h1>Take a quiz</h1>
                    <p>Enter the code you were given.</p>
                    <form id="take-code-form" autocomplete="off">
                        <input type="text" id="take-code" class="form-control host-code-input" placeholder="e.g. K7Q2XP" maxlength="8" aria-label="Quiz code" spellcheck="false">
                        <button type="submit" class="btn btn-primary btn-lg btn-block">Continue</button>
                    </form>
                </div>`;
            $('take-code').focus();
            $('take-code-form').addEventListener('submit', e => {
                e.preventDefault();
                const code = cleanCode($('take-code').value);
                if (code) window.QuizBowl.Router.navigate('take/' + code);
            });
        },

        renderSignIn: function() {
            Exam.unlock();
            this.stage = 'signin';
            this.container.innerHTML = `
                <div class="card take-card">
                    <span class="stat-icon accent take-big-icon">${UI().icon('user')}</span>
                    <h1>Sign in to take this quiz</h1>
                    <p>Quiz code <strong class="take-code-inline">${esc(this.code)}</strong>. Your score is saved with your Quizr account, so the host knows it's yours.</p>
                    <a href="#account" class="btn btn-primary btn-lg btn-block" id="take-signin">${UI().icon('user')} Sign in or create an account</a>
                    <p class="form-hint">You'll come back to the quiz after signing in.</p>
                </div>`;
            $('take-signin').addEventListener('click', () => store('local', RETURN_KEY, JSON.stringify({ code: this.code, at: Date.now() })));
        },

        renderIntro: function(previous) {
            Exam.unlock();
            const s = this.session, st = s.settings, who = this.who;
            const HostUtils = window.QuizBowl.Views.HostUtils;
            const name = (previous && previous.attempt.name) || who.suggestedName || '';
            const rules = st.timerMode === 'total'
                ? [`You have <strong>${HostUtils.formatDuration(st.totalSeconds)}</strong> for the whole quiz. The clock starts when you press Start and keeps running if you leave this page.`,
                   'Move between questions freely and change any answer until you submit.',
                   'When the time runs out, your answers are submitted automatically.']
                : ['Each question has its own countdown. The clock keeps running if you leave this page.',
                   'Press <strong>Next</strong> to move on. When a question\'s time runs out, the next one opens automatically.',
                   'You can look back at earlier questions, but you can\'t change their answers.'];
            rules.push('<strong>End quiz</strong> submits what you have so far. Unanswered questions score 0.');
            rules.push('The quiz opens in full screen, and the rest of the app is locked until you submit or end it.');

            this.container.innerHTML = `
                <div class="card take-card take-intro">
                    <span class="stat-icon accent take-big-icon">${UI().icon('award')}</span>
                    <h1>${esc(s.title)}</h1>
                    <div class="take-intro-facts">
                        <span><strong>${s.questionCount}</strong> question${s.questionCount === 1 ? '' : 's'}</span>
                        <span><strong>${s.totalMarks}</strong> mark${s.totalMarks === 1 ? '' : 's'}</span>
                        <span><strong>${st.timerMode === 'total' ? HostUtils.formatDuration(st.totalSeconds) : 'Timed'}</strong> ${st.timerMode === 'total' ? 'in total' : 'per question'}</span>
                    </div>
                    <ul class="take-rules">${rules.map(r => `<li>${UI().icon('check')}<span>${r}</span></li>`).join('')}</ul>
                    <form id="take-start-form" autocomplete="off">
                        <div class="form-group">
                            <label for="take-name">Your name</label>
                            <input type="text" id="take-name" class="form-control" maxlength="80" value="${esc(name)}" placeholder="e.g. Ada Obi" required>
                            ${who.mode === 'user' ? `<small class="form-hint">Saved with your account ${esc(who.email)}.</small>`
                                : '<small class="form-hint">Accounts aren\'t set up on this site, so only your name is saved with your score.</small>'}
                        </div>
                        <button type="submit" class="btn btn-primary btn-lg btn-block" id="take-start">${UI().icon('play')} Start quiz</button>
                    </form>
                </div>`;
            const input = $('take-name');
            if (!name) input.focus();
            $('take-start-form').addEventListener('submit', async e => {
                e.preventDefault();
                const token = renderToken;
                // The account may have changed in another tab since this page was drawn
                const current = identity();
                if (current.mode !== who.mode || current.userId !== who.userId) return this.render(this.container, this.code);
                if (!input.value.trim()) { input.focus(); return; }
                // Ask for full screen now, while it still counts as the person's click
                Exam.enterFullscreen();
                const btn = $('take-start');
                btn.disabled = true;
                btn.innerHTML = `${UI().icon('loader', 'spin')} Starting…`;
                try {
                    const state = await this.call(() => Hosting().start(this.source, this.code, input.value, { userId: who.userId, email: who.email }));
                    if (token !== renderToken) return;
                    if (state.source === 'local' && who.mode !== 'user') store('session', LOCAL_KEY + this.code, state.attempt.id);
                    this.renderRunner(state);
                } catch (err) {
                    if (token !== renderToken) return;
                    Toast().show(err.message, 'danger');
                    if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
                    if (/closed|already taken/i.test(err.message)) return this.render(this.container, this.code);
                    btn.disabled = false;
                    btn.innerHTML = `${UI().icon('play')} Start quiz`;
                }
            });
        },

        // ---------------- talking to the quiz ----------------
        // Run a request and keep the clock in step with the server's
        call: async function(fn) {
            const sent = Date.now();
            const result = await fn();
            const got = Date.now();
            const s = result && result.state ? result.state : result;
            if (s && s.serverNow) this.offset = s.serverNow - Math.round((sent + got) / 2);
            return result;
        },

        now: function() {
            return Date.now() + (this.offset || 0);
        },

        // Take in a new state; returns what changed: 'new', 'question', 'submitted' or 'none'
        apply: function(state) {
            const before = this.st && this.st.attempt;
            this.st = state;
            this.session = state.session;
            const a = state.attempt;
            if (!before) { this.viewIndex = a.view || 0; return 'new'; }
            if (a.status !== 'in_progress') return before.status === 'in_progress' ? 'submitted' : 'none';
            if (a.current !== before.current) { this.viewIndex = a.current; return 'question'; }
            return 'none';
        },

        // Saves go out one at a time, in order
        save: function(questionId, value) {
            const attemptId = this.st.attempt.id, source = this.source, token = renderToken;
            this.pendingSaves = (this.pendingSaves || 0) + 1;
            this.saving = (this.saving || Promise.resolve()).then(async () => {
                try {
                    const result = await this.call(() => Hosting().answer(source, attemptId, questionId, value));
                    this.pendingSaves--;
                    if (token !== renderToken) return;
                    // Keep answers chosen on screen since this save was sent
                    if (this.pendingSaves > 0 && result.state.attempt.status === 'in_progress') {
                        result.state.attempt.answers = { ...result.state.attempt.answers, ...this.st.attempt.answers };
                    }
                    const change = this.apply(result.state);
                    if (!result.saved) Toast().show('That question had already closed, so the answer wasn\'t saved.', 'warning');
                    this.afterChange(change, !result.saved);
                } catch (err) {
                    this.pendingSaves--;
                    if (token === renderToken) Toast().show(`Your answer wasn't saved: ${err.message}`, 'danger');
                }
            });
            return this.saving;
        },

        flushText: function() {
            clearTimeout(this.textTimer);
            const pending = this.pendingText;
            this.pendingText = null;
            if (pending && this.st) {
                this.st.attempt.answers[pending.questionId] = pending.value;
                this.save(pending.questionId, pending.value);
            }
            return this.saving || Promise.resolve();
        },

        // React to a state change from the server or the clock
        afterChange: function(change, forceRedraw = false) {
            if (!$('take-root')) return;
            if (change === 'submitted') {
                stopTicker();
                if (this.st.attempt.endedBy === 'timeout') Toast().show('Time\'s up! Your answers have been submitted.', 'info');
                return this.renderResult(this.st);
            }
            if (change === 'question') {
                Toast().show(`Time's up for question ${this.st.attempt.current}. Here's the next one.`, 'info');
                return this.renderQuestion();
            }
            if (forceRedraw) return this.renderQuestion();
            this.renderNav();
        },

        refresh: async function() {
            if (this.refreshing || !this.st) return;
            this.refreshing = true;
            const token = renderToken;
            try {
                await this.flushText();
                const state = await this.call(() => Hosting().state(this.source, this.st.attempt.id));
                if (token !== renderToken) return;
                this.afterChange(this.apply(state));
            } catch (err) {
                if (token === renderToken) Toast().show(err.message, 'danger');
            } finally {
                this.refreshing = false;
                this.nextRefresh = Date.now() + 1500;
            }
        },

        // ---------------- the quiz itself ----------------
        renderRunner: function(state, resumed = false) {
            this.st = null;
            this.pendingText = null;
            this.pendingSaves = 0;
            this.saving = null;
            this.nextRefresh = 0;
            this.acting = false;
            if (resumed || this.offset == null) this.offset = state.serverNow - Date.now();
            this.apply(state);
            const s = this.session, a = state.attempt;
            this.container.innerHTML = `
                <div class="take-view" id="take-root">
                    <header class="take-bar">
                        <div class="take-bar-title">
                            <strong>${esc(s.title)}</strong>
                            <small>${esc(a.name)}${a.email ? ' · ' + esc(a.email) : ''}</small>
                        </div>
                        <div class="take-timer" id="take-timer" role="timer" aria-live="off">
                            ${UI().icon('timer')}<span class="take-timer-label" id="take-timer-label"></span><span class="take-timer-value" id="take-timer-value">0:00</span>
                        </div>
                        <button type="button" class="btn btn-danger-ghost" id="take-end">${UI().icon('x')} End quiz</button>
                    </header>
                    <div class="take-fs-gate" id="take-fs-gate" role="dialog" aria-modal="true" aria-labelledby="take-fs-title" hidden>
                        <div class="card take-card">
                            <span class="stat-icon accent take-big-icon">${UI().icon('maximize')}</span>
                            <h1 id="take-fs-title">Quiz in progress</h1>
                            <p>This quiz runs in full screen. Go back to full screen to carry on. Your time is still running.</p>
                            <button type="button" class="btn btn-primary btn-lg btn-block" id="take-fs-return">${UI().icon('maximize')} Return to full screen</button>
                        </div>
                    </div>
                    <div class="take-time-bar" aria-hidden="true"><span id="take-time-fill"></span></div>
                    <div class="take-layout">
                        <section class="card take-question" id="take-question" aria-live="polite"></section>
                        <aside class="card take-nav">
                            <h2>Questions</h2>
                            <div class="take-nav-grid" id="take-nav"></div>
                            <div class="take-nav-legend" id="take-legend"></div>
                        </aside>
                    </div>
                </div>`;
            Exam.lock();
            this.renderQuestion();
            this.bindRunner();
            this.tick();
            ticker = setInterval(() => this.tick(), 250);
        },

        perQuestion: function() {
            return this.session.settings.timerMode !== 'total';
        },

        viewing: function() {
            const a = this.st.attempt;
            const last = a.order.length - 1;
            return Math.max(0, Math.min(this.perQuestion() ? a.current : last, this.viewIndex || 0));
        },

        answerFor: function(questionId) {
            if (this.pendingText && this.pendingText.questionId === questionId) return this.pendingText.value;
            return this.st.attempt.answers[questionId];
        },

        renderQuestion: function() {
            if (!$('take-root')) return;
            const a = this.st.attempt;
            if (a.status !== 'in_progress') return this.renderResult(this.st);
            const perQuestion = this.perQuestion();
            const n = a.order.length;
            const index = this.viewing();
            const q = this.st.questions[a.order[index]];
            if (!q) {
                $('take-question').innerHTML = `<p class="take-loading">${UI().icon('loader', 'spin')} Loading the question…</p>`;
                this.refresh();
                return;
            }
            const editable = !perQuestion || index === a.current;
            const given = this.answerFor(q.id);
            const isLast = perQuestion ? a.current === n - 1 : index === n - 1;

            let answerHtml;
            if (q.type === 'mcq' || q.type === 'true_false') {
                const keys = q.type === 'mcq' ? optionKeys(a, q) : ['True', 'False'];
                answerHtml = `<div class="take-options ${q.type === 'true_false' ? 'is-tf' : ''}" role="radiogroup" aria-label="Answer">
                    ${keys.map((key, i) => `
                        <button type="button" class="take-option ${given === key ? 'is-chosen' : ''}" role="radio" aria-checked="${given === key}" data-answer="${esc(key)}" ${editable ? '' : 'disabled'}>
                            <span class="take-letter">${q.type === 'mcq' ? LETTERS[i] : key.charAt(0)}</span>
                            <span class="take-option-text">${q.type === 'mcq' ? safe(optionText(q, key)) : key}</span>
                        </button>`).join('')}
                </div>`;
            } else if (q.type === 'theory') {
                answerHtml = `<label class="take-written-label" for="take-text">Your answer</label>
                    <textarea id="take-text" class="form-control take-text" rows="4" maxlength="5000" ${editable ? '' : 'disabled'} placeholder="Type your answer" data-question="${esc(q.id)}">${esc(given || '')}</textarea>`;
            } else {
                answerHtml = `<label class="take-written-label" for="take-text">Your answer</label>
                    <div class="take-calc">
                        <input type="text" id="take-text" class="form-control take-text" inputmode="decimal" maxlength="200" ${editable ? '' : 'disabled'} value="${esc(given || '')}" placeholder="e.g. 42" data-question="${esc(q.id)}">
                        ${q.unit ? `<span class="take-unit">${esc(q.unit)}</span>` : ''}
                    </div>
                    <small class="form-hint">Give the number${q.unit ? ` in ${esc(q.unit)}` : ''}. Round it the way the question asks.</small>`;
            }

            let footer;
            if (perQuestion && index < a.current) {
                footer = `
                    <button type="button" class="btn btn-secondary" data-go="${index - 1}" ${index === 0 ? 'disabled' : ''}>${UI().icon('back')} Previous</button>
                    <button type="button" class="btn btn-primary" data-go="${a.current}">Back to question ${a.current + 1}</button>`;
            } else if (perQuestion) {
                footer = `
                    <button type="button" class="btn btn-secondary" data-go="${index - 1}" ${index === 0 ? 'disabled' : ''}>${UI().icon('back')} Previous</button>
                    <button type="button" class="btn btn-primary" id="take-next">${isLast ? `${UI().icon('check')} Finish` : 'Next question'}</button>`;
            } else {
                footer = `
                    <button type="button" class="btn btn-secondary" data-go="${index - 1}" ${index === 0 ? 'disabled' : ''}>${UI().icon('back')} Previous</button>
                    ${isLast
                        ? `<button type="button" class="btn btn-primary" id="take-submit">${UI().icon('check')} Submit quiz</button>`
                        : `<button type="button" class="btn btn-primary" data-go="${index + 1}">Next question</button>`}`;
            }

            $('take-question').innerHTML = `
                ${perQuestion && index < a.current ? `<div class="callout callout-info take-preview">${UI().icon('lock')}<div><strong>Preview only</strong>This question has closed, so its answer can't be changed.</div></div>` : ''}
                <div class="take-q-meta">
                    <span class="take-q-count">Question ${index + 1} of ${n}</span>
                    ${UI().typeChip(q.type)}
                    <span class="text-muted">${esc(q.category)}</span>
                    <span class="take-q-marks">${q.marks} mark${q.marks == 1 ? '' : 's'}</span>
                </div>
                <div class="take-q-text">${safe(q.question)}</div>
                ${answerHtml}
                <div class="take-q-footer">${footer}</div>`;
            this.renderNav();
            typeset($('take-question'));
            const text = $('take-text');
            if (text && editable && !isAnswered(given)) text.focus({ preventScroll: true });
        },

        renderNav: function() {
            if (!$('take-nav') || !this.st) return;
            const a = this.st.attempt;
            const perQuestion = this.perQuestion();
            const viewing = this.viewing();
            let answeredCount = 0;
            $('take-nav').innerHTML = a.order.map((qid, i) => {
                const answered = isAnswered(this.answerFor(qid));
                if (answered) answeredCount++;
                const locked = perQuestion && i > a.current;
                const closed = perQuestion && i < a.current;
                const cls = [answered ? 'is-answered' : '', closed ? 'is-closed' : '', locked ? 'is-locked' : '',
                    perQuestion && i === a.current ? 'is-live' : '', i === viewing ? 'is-viewing' : ''].join(' ');
                const label = `Question ${i + 1}${answered ? ', answered' : ', not answered'}${closed ? ', closed' : ''}${locked ? ', not open yet' : ''}`;
                return `<button type="button" class="take-nav-item ${cls}" data-go="${i}" ${locked ? 'disabled' : ''} aria-label="${label}" ${i === viewing ? 'aria-current="step"' : ''}>${i + 1}</button>`;
            }).join('');
            $('take-legend').innerHTML = `
                <span><i class="dot is-answered"></i> Answered (${answeredCount})</span>
                <span><i class="dot"></i> Not answered (${a.order.length - answeredCount})</span>
                ${perQuestion ? '<span><i class="dot is-locked"></i> Not open yet</span>' : ''}`;
        },

        tick: function() {
            if (!$('take-root') || !this.st) return stopTicker();
            const a = this.st.attempt, s = this.session;
            if (a.status !== 'in_progress') return;
            const now = this.now();
            let remaining, full, label = '';
            if (s.settings.timerMode === 'total') {
                remaining = a.deadline - now;
                full = s.settings.totalSeconds * 1000;
                label = 'Time left';
            } else {
                const q = this.st.questions[a.order[a.current]];
                remaining = a.questionDeadline - now;
                full = Math.max(5, Number(s.settings.times[q ? q.type : 'mcq']) || 30) * 1000;
                if (this.viewing() < a.current) label = `Question ${a.current + 1}`;
            }
            const warn = s.settings.timerMode === 'total' ? remaining <= Math.min(60000, full * 0.1) : remaining <= Math.min(10000, full * 0.3);
            $('take-timer-value').textContent = clock(remaining);
            $('take-timer-label').textContent = label;
            $('take-timer').classList.toggle('is-warning', warn);
            const fill = $('take-time-fill');
            fill.style.width = `${Math.max(0, Math.min(100, (remaining / full) * 100))}%`;
            fill.classList.toggle('is-warning', warn);
            // Time's up here: ask the quiz what happens next
            if (remaining <= 0 && Date.now() >= (this.nextRefresh || 0)) this.refresh();
        },

        go: function(index) {
            const a = this.st.attempt;
            const limit = this.perQuestion() ? a.current : a.order.length - 1;
            if (index < 0 || index > limit) return;
            this.flushText();
            this.viewIndex = index;
            this.renderQuestion();
            $('take-question').scrollIntoView({ block: 'nearest' });
            Hosting().view(this.source, a.id, index).catch(() => {});
        },

        confirm: async function(options) {
            busy = true;
            try { return await Modal().confirm(options); } finally { busy = false; }
        },

        // Run a button action that talks to the quiz, with the buttons locked meanwhile
        act: async function(fn) {
            if (this.acting) return;
            this.acting = true;
            const token = renderToken;
            const root = $('take-root');
            if (root) root.classList.add('is-busy');
            try {
                await fn();
            } catch (err) {
                if (token === renderToken) Toast().show(err.message, 'danger');
            } finally {
                if (token === renderToken) this.acting = false;
                const r = $('take-root');
                if (r) r.classList.remove('is-busy');
            }
        },

        next: function() {
            return this.act(async () => {
                const a = this.st.attempt;
                const opened = a.current;
                const isLast = opened === a.order.length - 1;
                const unanswered = !isAnswered(this.answerFor(a.order[opened]));
                if (isLast) {
                    const ok = await this.confirm({ title: 'Finish the quiz?', message: unanswered ? 'This question has no answer yet. Your answers will be submitted and marked.' : 'Your answers will be submitted and marked.', confirmText: 'Submit', icon: 'check' });
                    if (!ok) return;
                } else if (unanswered) {
                    const ok = await this.confirm({ title: 'Skip this question?', message: 'You haven\'t answered it, and you won\'t be able to come back and answer it later.', confirmText: 'Skip', icon: 'alert' });
                    if (!ok) return;
                }
                if (!$('take-root') || this.st.attempt.status !== 'in_progress') return;
                const token = renderToken;
                await this.flushText();
                // `opened` makes sure only that question closes, even if its time ran out meanwhile
                const state = await this.call(() => Hosting().next(this.source, this.st.attempt.id, opened));
                if (token !== renderToken) return;
                const change = this.apply(state);
                this.viewIndex = state.attempt.current;
                if (change === 'submitted') { stopTicker(); return this.renderResult(state); }
                this.renderQuestion();
                this.tick();
            });
        },

        submit: function(endedBy) {
            return this.act(async () => {
                const a = this.st.attempt;
                const unanswered = a.order.filter(qid => !isAnswered(this.answerFor(qid))).length;
                const ok = endedBy === 'ended'
                    ? await this.confirm({ title: 'End the quiz now?', message: `Your answers so far will be submitted and marked${unanswered ? `, and the ${unanswered} unanswered question${unanswered === 1 ? '' : 's'} will score 0` : ''}. You can't change anything after this.`, confirmText: 'End quiz', danger: true })
                    : await this.confirm({ title: 'Submit your answers?', message: unanswered ? `You have ${unanswered} unanswered question${unanswered === 1 ? '' : 's'}. You can't change anything after submitting.` : 'You can\'t change anything after submitting.', confirmText: 'Submit', icon: 'check' });
                if (!ok || !$('take-root') || this.st.attempt.status !== 'in_progress') return;
                const token = renderToken;
                await this.flushText();
                const state = await this.call(() => Hosting().submit(this.source, this.st.attempt.id, endedBy));
                if (token !== renderToken) return;
                stopTicker();
                this.apply(state);
                this.renderResult(state);
            });
        },

        bindRunner: function() {
            const root = $('take-root');
            root.setAttribute('tabindex', '-1');
            root.addEventListener('click', e => {
                if (e.target.closest('#take-fs-return')) { Exam.enterFullscreen(); return; }
                if (busy) return;
                const option = e.target.closest('[data-answer]');
                if (option && !option.disabled) {
                    const value = option.getAttribute('data-answer');
                    const qid = this.st.attempt.order[this.viewing()];
                    this.st.attempt.answers[qid] = value;
                    root.querySelectorAll('.take-option').forEach(b => {
                        const on = b === option;
                        b.classList.toggle('is-chosen', on);
                        b.setAttribute('aria-checked', on);
                    });
                    this.renderNav();
                    this.save(qid, value);
                    return;
                }
                if (this.acting) return;
                const go = e.target.closest('[data-go]');
                if (go && !go.disabled) return this.go(Number(go.getAttribute('data-go')));
                if (e.target.closest('#take-next')) return this.next();
                if (e.target.closest('#take-submit')) return this.submit('finished');
                if (e.target.closest('#take-end')) return this.submit('ended');
            });
            root.addEventListener('input', e => {
                if (e.target.id !== 'take-text') return;
                this.pendingText = { questionId: e.target.getAttribute('data-question'), value: e.target.value };
                clearTimeout(this.textTimer);
                this.textTimer = setTimeout(() => this.flushText(), SAVE_DELAY);
                clearTimeout(this.navTimer);
                this.navTimer = setTimeout(() => this.renderNav(), 300);
            });
            root.addEventListener('focusout', e => { if (e.target.id === 'take-text') this.flushText(); });
            // Letter keys pick an option when not typing
            root.addEventListener('keydown', e => {
                if (busy || e.ctrlKey || e.metaKey || e.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
                const key = e.key.toUpperCase();
                const options = [...root.querySelectorAll('.take-option:not([disabled])')];
                const i = options.length === 2 && (key === 'T' || key === 'F') ? (key === 'T' ? 0 : 1) : LETTERS.indexOf(key);
                if (i >= 0 && options[i]) { e.preventDefault(); options[i].click(); }
            });
        },

        // ---------------- result ----------------
        renderResult: function(state) {
            stopTicker();
            Exam.unlock();
            const token = renderToken;
            const a = state.attempt, s = state.session;
            this.session = s;
            const HostUtils = window.QuizBowl.Views.HostUtils;
            const pct = HostUtils.percent(a.score, a.maxScore);
            const counts = { correct: 0, wrong: 0, unanswered: 0, pending: 0 };
            Object.values(a.results || {}).forEach(r => {
                if (r.status === 'marked') counts[r.awarded > 0 ? 'correct' : 'wrong']++;
                else if (counts[r.status] != null) counts[r.status]++;
            });
            const canRetake = s.settings.allowRetake && s.open;
            const reason = { finished: 'You finished the quiz.', ended: 'You ended the quiz early.', timeout: 'The time ran out, so your answers were submitted.' }[a.endedBy] || '';
            const review = state.review;

            this.container.innerHTML = `
                <div class="take-result">
                    <section class="card take-card take-result-card">
                        <div class="take-score-ring" style="--p: ${pct}"><span>${pct}%</span></div>
                        <h1>You scored ${a.score} out of ${a.maxScore}</h1>
                        <p>${esc(s.title)} · ${esc(a.name)}</p>
                        <p class="text-muted">${reason} Time taken: ${HostUtils.formatDuration((a.submittedAt - a.startedAt) / 1000)}.</p>
                        <div class="take-result-stats">
                            <span class="is-correct"><strong>${counts.correct}</strong> correct</span>
                            <span class="is-wrong"><strong>${counts.wrong}</strong> wrong</span>
                            <span><strong>${counts.unanswered}</strong> not answered</span>
                            ${counts.pending ? `<span class="is-pending"><strong>${counts.pending}</strong> awaiting marking</span>` : ''}
                        </div>
                        ${a.pending ? `<div class="callout callout-info">${UI().icon('info')}<div><strong>Some answers need marking</strong>The host will mark ${a.pending === 1 ? 'one written answer' : `${a.pending} written answers`}, so your score may go up.</div></div>` : ''}
                        <div class="take-result-actions">
                            ${canRetake ? `<button type="button" class="btn btn-primary" id="take-again">${UI().icon('reset')} Take it again</button>` : ''}
                            <a href="#dashboard" class="btn btn-secondary">Done</a>
                        </div>
                    </section>
                    ${review ? `
                    <section class="card">
                        <div class="card-header"><div><h2>Your answers</h2><p>What you chose and the correct answers</p></div></div>
                        <ol class="take-review">
                            ${a.order.map((qid, i) => review[qid] ? this.reviewItem(review[qid], a, i, (a.results || {})[qid]) : '').join('')}
                        </ol>
                    </section>` : ''}
                </div>`;
            typeset(this.container);
            const again = $('take-again');
            if (again) again.addEventListener('click', () => {
                if (token !== renderToken) return;
                retake = true;
                if (this.source === 'local' && this.who && this.who.mode !== 'user') store('session', LOCAL_KEY + this.code, null);
                this.render(this.container, this.code);
            });
        }
    };

    window.QuizBowl.Views.Take = View;
    View.Exam = Exam;

    // Save a half-typed answer when the tab is hidden or closed
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden' && View.pendingText && $('take-root')) View.flushText();
    });

    // Re-check the account when sign-in finishes; send people back to the quiz they were opening
    if (window.QuizBowl.Cloud) {
        window.QuizBowl.Cloud.subscribe(event => {
            if (event.type !== 'ready' && event.type !== 'auth') return;
            // After the cloud has finished its own sign-in navigation
            setTimeout(() => {
                const user = window.QuizBowl.Cloud.user();
                let pending = null;
                try { pending = JSON.parse(store('local', RETURN_KEY) || 'null'); } catch (e) { pending = null; }
                if (pending && user) {
                    store('local', RETURN_KEY, null);
                    if (Date.now() - pending.at < 60 * 60 * 1000) {
                        window.QuizBowl.Router.navigate('take/' + cleanCode(pending.code));
                        return;
                    }
                }
                // Waiting on the account check, or asking to sign in: draw the page again
                if (window.QuizBowl.State.currentRoute === 'take' && (View.stage === 'loading' || View.stage === 'signin')) {
                    View.render(View.container || document.getElementById('view-container'), View.code);
                }
            }, 0);
        });
    }
})();
