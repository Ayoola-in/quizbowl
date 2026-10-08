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
 * The clock is based on saved deadlines, so refreshing or leaving the page
 * doesn't pause it; coming back resumes the same attempt.
 */
(function() {
    const RETURN_KEY = 'quizr_take_return';       // code to come back to after signing in
    const LOCAL_KEY = 'quizr_take_attempt_';      // + session id: this tab's attempt when accounts aren't set up
    const LETTERS = 'ABCDEFGHIJ';

    const UI = () => window.QuizBowl.Utils.UI;
    const Host = () => window.QuizBowl.Services.HostService;
    const Toast = () => window.QuizBowl.Components.Toast;
    const Modal = () => window.QuizBowl.Components.Modal;
    const Cloud = () => window.QuizBowl.Cloud;
    const esc = v => UI().escapeHtml(v);
    const $ = id => document.getElementById(id);

    let ticker = null;
    let busy = false;          // a confirm dialog is open or an action is running
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
        if (window.MathJax && MathJax.typesetPromise) MathJax.typesetPromise([el]).catch(() => {});
    }

    function sessionLocal(key, value) {
        try {
            if (value === undefined) return sessionStorage.getItem(key);
            if (value === null) sessionStorage.removeItem(key);
            else sessionStorage.setItem(key, value);
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

    function findAttempt(session, who) {
        if (who.mode === 'user') return Host().latestAttempt(session.id, { userId: who.userId });
        const id = sessionLocal(LOCAL_KEY + session.id);
        const attempt = id && Host().getAttempt(id);
        return attempt && attempt.sessionId === session.id ? attempt : null;
    }

    const optionText = (q, key) => (q.options || {})[key] == null ? '' : q.options[key];

    function displayLetter(attempt, q, key) {
        const order = (attempt.optionOrder && attempt.optionOrder[q.id]) || Object.keys(q.options || {}).sort();
        const i = order.indexOf(key);
        return i === -1 ? key : LETTERS[i];
    }

    const STATUS_BADGES = {
        correct: '<span class="badge badge-correct">Correct</span>',
        wrong: '<span class="badge badge-wrong">Wrong</span>',
        unanswered: '<span class="badge badge-answered">Not answered</span>',
        pending: '<span class="badge badge-partial">Awaiting marking</span>',
        marked: '<span class="badge badge-partial">Marked by host</span>'
    };

    const View = {
        // One question in a review list (used by the result screen and the host's marking page)
        reviewItem: function(q, attempt, index, result, extraHtml = '') {
            const given = attempt.answers[q.id];
            const status = result ? result.status : null;
            let answerHtml;
            if (q.type === 'mcq') {
                const order = (attempt.optionOrder && attempt.optionOrder[q.id]) || Object.keys(q.options || {}).sort();
                answerHtml = `<ul class="take-review-options">${order.map((key, i) => {
                    const chosen = given === key, right = q.correctAnswer === key;
                    return `<li class="${right ? 'is-right' : ''} ${chosen && !right ? 'is-wrong' : ''}">
                        <span class="take-letter">${LETTERS[i]}</span><span>${optionText(q, key)}</span>
                        ${chosen ? `<em>${right ? UI().icon('check') : UI().icon('x')} Chosen</em>` : right ? `<em>${UI().icon('check')} Correct answer</em>` : ''}
                    </li>`;
                }).join('')}</ul>`;
            } else if (q.type === 'true_false') {
                answerHtml = `<dl class="take-review-answers">
                    <div><dt>Answer given</dt><dd>${given ? esc(given) : '<span class="text-muted">No answer</span>'}</dd></div>
                    <div><dt>Correct answer</dt><dd>${esc(q.correctAnswer)}</dd></div>
                </dl>`;
            } else {
                answerHtml = `<dl class="take-review-answers">
                    <div><dt>Answer given</dt><dd class="take-written">${given ? esc(given) : '<span class="text-muted">No answer</span>'}</dd></div>
                    <div><dt>Expected answer</dt><dd>${q.expectedAnswer || '<span class="text-muted">Not set</span>'}${q.unit ? ' ' + esc(q.unit) : ''}</dd></div>
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
                    <div class="take-review-q">${q.question}</div>
                    ${answerHtml}
                    ${q.explanation ? `<p class="take-review-expl">${UI().icon('info')} <span>${q.explanation}</span></p>` : ''}
                    ${extraHtml}
                </li>`;
        },

        render: function(container, code) {
            stopTicker();
            busy = false;
            const wantRetake = retake;   // only for the render right after "Take it again"
            retake = false;
            this.container = container;
            this.stage = '';
            this.code = code ? String(code).toUpperCase().replace(/[^A-Z0-9]/g, '') : '';
            if (!this.code) return this.renderCodeEntry();

            const session = Host().getSessionByCode(this.code);
            if (!session) {
                container.innerHTML = `<div class="card take-card">${UI().emptyState('alert', 'Quiz not found',
                    `There's no quiz with the code <strong>${esc(this.code)}</strong> on this device. Check the code and try again.`,
                    `<a href="#take" class="btn btn-primary">Enter another code</a>`)}</div>`;
                return;
            }
            this.session = session;

            const who = identity();
            this.who = who;
            if (who.mode === 'loading') {
                this.stage = 'loading';
                container.innerHTML = `<div class="card take-card take-loading">${UI().icon('loader', 'spin')} Checking your account…</div>`;
                return;
            }
            if (who.mode === 'signin') return this.renderSignIn();

            let attempt = findAttempt(session, who);
            if (attempt && attempt.status === 'in_progress') {
                attempt = Host().checkTime(attempt.id).attempt;
                if (attempt.status === 'in_progress') return this.renderRunner(attempt.id);
            }
            if (attempt && attempt.status === 'submitted' && !(wantRetake && session.settings.allowRetake)) {
                return this.renderResult(attempt.id);
            }
            if (!session.open) {
                container.innerHTML = `<div class="card take-card">${UI().emptyState('lock', 'This quiz is closed',
                    `<strong>${esc(session.title)}</strong> isn't taking new attempts.`, `<a href="#host" class="btn btn-secondary">Back</a>`)}</div>`;
                return;
            }
            this.renderIntro(attempt);
        },

        renderCodeEntry: function() {
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
                const code = $('take-code').value.toUpperCase().replace(/[^A-Z0-9]/g, '');
                if (code) window.QuizBowl.Router.navigate('take/' + code);
            });
        },

        renderSignIn: function() {
            const s = this.session;
            this.stage = 'signin';
            this.container.innerHTML = `
                <div class="card take-card">
                    <span class="stat-icon accent take-big-icon">${UI().icon('user')}</span>
                    <h1>${esc(s.title)}</h1>
                    <p>Sign in to your Quizr account to take this quiz. Your score is saved with your account.</p>
                    <a href="#account" class="btn btn-primary btn-lg btn-block" id="take-signin">${UI().icon('user')} Sign in or create an account</a>
                    <p class="form-hint">You'll come back here after signing in.</p>
                </div>`;
            $('take-signin').addEventListener('click', () => sessionLocal(RETURN_KEY, this.code));
        },

        renderIntro: function(previous) {
            const s = this.session, st = s.settings, who = this.who;
            const HostUtils = window.QuizBowl.Views.HostUtils;
            const marks = Host().totalMarks(s);
            const name = (previous && previous.name) || who.suggestedName || '';
            const rules = st.timerMode === 'total'
                ? [`You have <strong>${HostUtils.formatDuration(st.totalSeconds)}</strong> for the whole quiz. The clock starts when you press Start and keeps running if you leave this page.`,
                   'Move between questions freely and change any answer until you submit.',
                   'When the time runs out, your answers are submitted automatically.']
                : ['Each question has its own countdown. The clock keeps running if you leave this page.',
                   'Press <strong>Next</strong> to move on. When a question\'s time runs out, the next one opens automatically.',
                   'You can look back at earlier questions, but you can\'t change their answers.'];
            rules.push('<strong>End quiz</strong> submits what you have so far. Unanswered questions score 0.');

            this.container.innerHTML = `
                <div class="card take-card take-intro">
                    <span class="stat-icon accent take-big-icon">${UI().icon('award')}</span>
                    <h1>${esc(s.title)}</h1>
                    <div class="take-intro-facts">
                        <span><strong>${s.questions.length}</strong> question${s.questions.length === 1 ? '' : 's'}</span>
                        <span><strong>${marks}</strong> mark${marks === 1 ? '' : 's'}</span>
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
                        <button type="submit" class="btn btn-primary btn-lg btn-block">${UI().icon('play')} Start quiz</button>
                    </form>
                </div>`;
            const input = $('take-name');
            if (!name) input.focus();
            $('take-start-form').addEventListener('submit', e => {
                e.preventDefault();
                // The account may have changed in another tab since this page was drawn
                const current = identity();
                if (current.mode !== who.mode || current.userId !== who.userId) return this.render(this.container, this.code);
                const fresh = Host().getSession(s.id);
                if (!fresh || !fresh.open) { Toast().show('This quiz is closed.', 'danger'); return this.render(this.container, this.code); }
                // Starting twice (another tab) resumes the attempt already running
                const running = findAttempt(fresh, who);
                if (running && running.status === 'in_progress') return this.render(this.container, this.code);
                try {
                    const attempt = Host().startAttempt(fresh, { name: input.value, userId: who.userId || null, email: who.email || '' });
                    if (who.mode !== 'user') sessionLocal(LOCAL_KEY + s.id, attempt.id);
                    this.session = fresh;
                    this.renderRunner(attempt.id);
                } catch (err) {
                    Toast().show(err.message, 'danger');
                    input.focus();
                }
            });
        },

        // ---------------- the quiz itself ----------------
        renderRunner: function(attemptId) {
            this.attemptId = attemptId;
            const attempt = Host().getAttempt(attemptId);
            const s = this.session;
            this.container.innerHTML = `
                <div class="take-view" id="take-root">
                    <header class="take-bar">
                        <div class="take-bar-title">
                            <strong>${esc(s.title)}</strong>
                            <small>${esc(attempt.name)}${attempt.email ? ' · ' + esc(attempt.email) : ''}</small>
                        </div>
                        <div class="take-timer" id="take-timer" role="timer" aria-live="off">
                            ${UI().icon('timer')}<span class="take-timer-label" id="take-timer-label"></span><span class="take-timer-value" id="take-timer-value">0:00</span>
                        </div>
                        <button type="button" class="btn btn-danger-ghost" id="take-end">${UI().icon('x')} End quiz</button>
                    </header>
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
            this.renderQuestion();
            this.bindRunner();
            this.tick();
            ticker = setInterval(() => this.tick(), 250);
        },

        renderQuestion: function() {
            const s = this.session, st = s.settings;
            const attempt = Host().getAttempt(this.attemptId);
            if (!attempt || attempt.status !== 'in_progress') return this.renderResult(this.attemptId);
            const map = Host().questionMap(s);
            const perQuestion = st.timerMode === 'question';
            const n = attempt.order.length;
            const index = perQuestion ? Math.min(attempt.view, attempt.current) : attempt.view;
            const q = map[attempt.order[index]];
            const editable = Host().canAnswer(s, attempt, index);
            const given = attempt.answers[q.id];
            const isLast = perQuestion ? attempt.current === n - 1 : index === n - 1;

            let answerHtml;
            if (q.type === 'mcq' || q.type === 'true_false') {
                const keys = q.type === 'mcq' ? (attempt.optionOrder[q.id] || Object.keys(q.options || {}).sort()) : ['True', 'False'];
                answerHtml = `<div class="take-options ${q.type === 'true_false' ? 'is-tf' : ''}" role="radiogroup" aria-label="Answer">
                    ${keys.map((key, i) => `
                        <button type="button" class="take-option ${given === key ? 'is-chosen' : ''}" role="radio" aria-checked="${given === key}" data-answer="${esc(key)}" ${editable ? '' : 'disabled'}>
                            <span class="take-letter">${q.type === 'mcq' ? LETTERS[i] : key.charAt(0)}</span>
                            <span class="take-option-text">${q.type === 'mcq' ? optionText(q, key) : key}</span>
                        </button>`).join('')}
                </div>`;
            } else if (q.type === 'theory') {
                answerHtml = `<label class="take-written-label" for="take-text">Your answer</label>
                    <textarea id="take-text" class="form-control take-text" rows="4" maxlength="5000" ${editable ? '' : 'disabled'} placeholder="Type your answer">${esc(given || '')}</textarea>`;
            } else {
                answerHtml = `<label class="take-written-label" for="take-text">Your answer</label>
                    <div class="take-calc">
                        <input type="text" id="take-text" class="form-control take-text" inputmode="decimal" maxlength="200" ${editable ? '' : 'disabled'} value="${esc(given || '')}" placeholder="e.g. 42">
                        ${q.unit ? `<span class="take-unit">${esc(q.unit)}</span>` : ''}
                    </div>
                    <small class="form-hint">Give the number${q.unit ? ` in ${esc(q.unit)}` : ''}. Round it the same way as the question asks.</small>`;
            }

            let footer;
            if (perQuestion && index < attempt.current) {
                footer = `
                    <button type="button" class="btn btn-secondary" data-go="${index - 1}" ${index === 0 ? 'disabled' : ''}>${UI().icon('back')} Previous</button>
                    <button type="button" class="btn btn-primary" data-go="${attempt.current}">Back to question ${attempt.current + 1}</button>`;
            } else if (perQuestion) {
                footer = `
                    <button type="button" class="btn btn-secondary" data-go="${index - 1}" ${index === 0 ? 'disabled' : ''}>${UI().icon('back')} Previous</button>
                    <button type="button" class="btn btn-primary" id="take-next">${isLast ? `${UI().icon('check')} Finish` : 'Next question'} </button>`;
            } else {
                footer = `
                    <button type="button" class="btn btn-secondary" data-go="${index - 1}" ${index === 0 ? 'disabled' : ''}>${UI().icon('back')} Previous</button>
                    ${isLast
                        ? `<button type="button" class="btn btn-primary" id="take-submit">${UI().icon('check')} Submit quiz</button>`
                        : `<button type="button" class="btn btn-primary" data-go="${index + 1}">Next question</button>`}`;
            }

            $('take-question').innerHTML = `
                ${perQuestion && index < attempt.current ? `<div class="callout callout-info take-preview">${UI().icon('lock')}<div><strong>Preview only</strong>This question has closed, so its answer can't be changed.</div></div>` : ''}
                <div class="take-q-meta">
                    <span class="take-q-count">Question ${index + 1} of ${n}</span>
                    ${UI().typeChip(q.type)}
                    <span class="text-muted">${esc(q.category)}</span>
                    <span class="take-q-marks">${q.marks} mark${q.marks == 1 ? '' : 's'}</span>
                </div>
                <div class="take-q-text">${q.question}</div>
                ${answerHtml}
                <div class="take-q-footer">${footer}</div>`;
            this.renderNav(attempt);
            typeset($('take-question'));
            const text = $('take-text');
            if (text && editable && !given) text.focus({ preventScroll: true });
        },

        renderNav: function(attempt) {
            const s = this.session;
            const perQuestion = s.settings.timerMode === 'question';
            const viewing = perQuestion ? Math.min(attempt.view, attempt.current) : attempt.view;
            $('take-nav').innerHTML = attempt.order.map((qid, i) => {
                const answered = attempt.answers[qid] != null && attempt.answers[qid] !== '';
                const locked = perQuestion && i > attempt.current;
                const closed = perQuestion && i < attempt.current;
                const cls = [answered ? 'is-answered' : '', closed ? 'is-closed' : '', locked ? 'is-locked' : '',
                    perQuestion && i === attempt.current ? 'is-live' : '', i === viewing ? 'is-viewing' : ''].join(' ');
                const label = `Question ${i + 1}${answered ? ', answered' : ', not answered'}${closed ? ', closed' : ''}${locked ? ', not open yet' : ''}`;
                return `<button type="button" class="take-nav-item ${cls}" data-go="${i}" ${locked ? 'disabled' : ''} aria-label="${label}" ${i === viewing ? 'aria-current="step"' : ''}>${i + 1}</button>`;
            }).join('');
            const answeredCount = attempt.order.filter(qid => attempt.answers[qid] != null && attempt.answers[qid] !== '').length;
            $('take-legend').innerHTML = `
                <span><i class="dot is-answered"></i> Answered (${answeredCount})</span>
                <span><i class="dot"></i> Not answered (${attempt.order.length - answeredCount})</span>
                ${perQuestion ? '<span><i class="dot is-locked"></i> Not open yet</span>' : ''}`;
        },

        tick: function() {
            if (!$('take-root')) return stopTicker();
            const s = this.session;
            const before = Host().getAttempt(this.attemptId);
            if (!before) { stopTicker(); return this.render(this.container, this.code); }
            const { attempt, changed } = Host().checkTime(this.attemptId);
            if (attempt.status === 'submitted') {
                stopTicker();
                if (changed === 'timeout') Toast().show('Time\'s up! Your answers have been submitted.', 'info');
                return this.renderResult(attempt.id);
            }
            if (changed === 'question') {
                Toast().show(`Time's up for question ${before.current + 1}.`, 'info');
                this.renderQuestion();
            }
            const now = Date.now();
            let remaining, full, label;
            if (s.settings.timerMode === 'total') {
                remaining = attempt.deadline - now;
                full = s.settings.totalSeconds * 1000;
                label = 'Time left';
            } else {
                const q = Host().questionMap(s)[attempt.order[attempt.current]];
                remaining = attempt.questionDeadline - now;
                full = Host().questionTime(s, q) * 1000;
                label = attempt.view < attempt.current ? `Question ${attempt.current + 1}` : '';
            }
            const warn = s.settings.timerMode === 'total' ? remaining <= Math.min(60000, full * 0.1) : remaining <= Math.min(10000, full * 0.3);
            $('take-timer-value').textContent = clock(remaining);
            $('take-timer-label').textContent = label;
            $('take-timer').classList.toggle('is-warning', warn);
            const fill = $('take-time-fill');
            fill.style.width = `${Math.max(0, Math.min(100, (remaining / full) * 100))}%`;
            fill.classList.toggle('is-warning', warn);
        },

        // Stop if the attempt was submitted (e.g. the time ran out while a dialog was open)
        stillRunning: function() {
            const a = Host().getAttempt(this.attemptId);
            if (!a || a.status !== 'in_progress') { this.renderResult(this.attemptId); return null; }
            return a;
        },

        go: function(index) {
            const a = this.stillRunning();
            if (!a) return;
            const limit = this.session.settings.timerMode === 'question' ? a.current : a.order.length - 1;
            if (index < 0 || index > limit) return;
            Host().setView(this.attemptId, index);
            this.renderQuestion();
            $('take-question').scrollIntoView({ block: 'nearest' });
        },

        answer: function(value) {
            const a = this.stillRunning();
            if (!a) return;
            const index = this.session.settings.timerMode === 'question' ? Math.min(a.view, a.current) : a.view;
            Host().saveAnswer(this.attemptId, a.order[index], value);
        },

        confirm: async function(options) {
            busy = true;
            try { return await Modal().confirm(options); } finally { busy = false; }
        },

        next: async function() {
            const a = this.stillRunning();
            if (!a) return;
            const opened = a.current;
            const qid = a.order[opened];
            const isLast = opened === a.order.length - 1;
            const unanswered = a.answers[qid] == null || a.answers[qid] === '';
            if (isLast) {
                const ok = await this.confirm({ title: 'Finish the quiz?', message: unanswered ? 'This question has no answer yet. Your answers will be submitted and marked.' : 'Your answers will be submitted and marked.', confirmText: 'Submit', icon: 'check' });
                if (!ok) return;
            } else if (unanswered) {
                const ok = await this.confirm({ title: 'Skip this question?', message: 'You haven\'t answered it, and you won\'t be able to come back and answer it later.', confirmText: 'Skip', icon: 'alert' });
                if (!ok) return;
            }
            // The question may have closed on its own while the dialog was open
            const now = this.stillRunning();
            if (!now) return;
            if (now.current !== opened) { this.renderQuestion(); return; }
            const after = Host().nextQuestion(this.attemptId);
            if (after.status === 'submitted') { stopTicker(); return this.renderResult(after.id); }
            this.renderQuestion();
            this.tick();
        },

        submit: async function(endedBy) {
            const a = this.stillRunning();
            if (!a) return;
            const unanswered = a.order.filter(qid => a.answers[qid] == null || a.answers[qid] === '').length;
            const ok = endedBy === 'ended'
                ? await this.confirm({ title: 'End the quiz now?', message: `Your answers so far will be submitted and marked${unanswered ? `, and the ${unanswered} unanswered question${unanswered === 1 ? '' : 's'} will score 0` : ''}. You can't change anything after this.`, confirmText: 'End quiz', danger: true })
                : await this.confirm({ title: 'Submit your answers?', message: unanswered ? `You have ${unanswered} unanswered question${unanswered === 1 ? '' : 's'}. You can't change anything after submitting.` : 'You can\'t change anything after submitting.', confirmText: 'Submit', icon: 'check' });
            if (!ok || !this.stillRunning()) return;
            stopTicker();
            Host().submit(this.attemptId, endedBy);
            this.renderResult(this.attemptId);
        },

        bindRunner: function() {
            const root = $('take-root');
            let saveTimer = null;
            root.addEventListener('click', e => {
                if (busy) return;
                const option = e.target.closest('[data-answer]');
                if (option && !option.disabled) {
                    const value = option.getAttribute('data-answer');
                    this.answer(value);
                    root.querySelectorAll('.take-option').forEach(b => {
                        const on = b === option;
                        b.classList.toggle('is-chosen', on);
                        b.setAttribute('aria-checked', on);
                    });
                    const a = Host().getAttempt(this.attemptId);
                    if (a) this.renderNav(a);
                    return;
                }
                const go = e.target.closest('[data-go]');
                if (go && !go.disabled) return this.go(Number(go.getAttribute('data-go')));
                if (e.target.closest('#take-next')) return this.next();
                if (e.target.closest('#take-submit')) return this.submit('finished');
                if (e.target.closest('#take-end')) return this.submit('ended');
            });
            root.addEventListener('input', e => {
                if (e.target.id !== 'take-text') return;
                const value = e.target.value;
                this.answer(value);
                clearTimeout(saveTimer);
                saveTimer = setTimeout(() => { const a = Host().getAttempt(this.attemptId); if (a && $('take-root')) this.renderNav(a); }, 300);
            });
            // Letter keys pick an option when not typing
            root.addEventListener('keydown', e => {
                if (busy || e.ctrlKey || e.metaKey || e.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
                const key = e.key.toUpperCase();
                const options = [...root.querySelectorAll('.take-option:not([disabled])')];
                const i = options.length === 2 && (key === 'T' || key === 'F') ? (key === 'T' ? 0 : 1) : LETTERS.indexOf(key);
                if (i >= 0 && options[i]) { e.preventDefault(); options[i].click(); }
            });
            root.setAttribute('tabindex', '-1');
        },

        // ---------------- result ----------------
        renderResult: function(attemptId) {
            stopTicker();
            const attempt = Host().getAttempt(attemptId);
            const s = Host().getSession(attempt ? attempt.sessionId : null) || this.session;
            if (!attempt || !s) return this.render(this.container, this.code);
            const HostUtils = window.QuizBowl.Views.HostUtils;
            const map = Host().questionMap(s);
            const pct = HostUtils.percent(attempt.score, attempt.maxScore);
            const counts = { correct: 0, wrong: 0, unanswered: 0, pending: 0 };
            attempt.order.forEach(qid => {
                const r = attempt.results[qid];
                if (!r) return;
                if (r.status === 'marked') counts[r.awarded > 0 ? 'correct' : 'wrong']++;
                else counts[r.status]++;
            });
            const canRetake = s.settings.allowRetake && s.open;
            const reason = { finished: 'You finished the quiz.', ended: 'You ended the quiz early.', timeout: 'The time ran out, so your answers were submitted.' }[attempt.endedBy] || '';

            this.container.innerHTML = `
                <div class="take-result">
                    <section class="card take-card take-result-card">
                        <div class="take-score-ring" style="--p: ${pct}"><span>${pct}%</span></div>
                        <h1>You scored ${attempt.score} out of ${attempt.maxScore}</h1>
                        <p>${esc(s.title)} · ${esc(attempt.name)}</p>
                        <p class="text-muted">${reason} Time taken: ${HostUtils.formatDuration((attempt.submittedAt - attempt.startedAt) / 1000)}.</p>
                        <div class="take-result-stats">
                            <span class="is-correct"><strong>${counts.correct}</strong> correct</span>
                            <span class="is-wrong"><strong>${counts.wrong}</strong> wrong</span>
                            <span><strong>${counts.unanswered}</strong> not answered</span>
                            ${counts.pending ? `<span class="is-pending"><strong>${counts.pending}</strong> awaiting marking</span>` : ''}
                        </div>
                        ${attempt.pending ? `<div class="callout callout-info">${UI().icon('info')}<div><strong>Some answers need marking</strong>The host will mark ${attempt.pending === 1 ? 'one written answer' : `${attempt.pending} written answers`}, so your score may go up.</div></div>` : ''}
                        <div class="take-result-actions">
                            ${canRetake ? `<button type="button" class="btn btn-primary" id="take-again">${UI().icon('reset')} Take it again</button>` : ''}
                            <a href="#host" class="btn btn-secondary">Done</a>
                        </div>
                    </section>
                    ${s.settings.showReview ? `
                    <section class="card">
                        <div class="card-header"><div><h2>Your answers</h2><p>What you chose and the correct answers</p></div></div>
                        <ol class="take-review">
                            ${attempt.order.map((qid, i) => map[qid] ? this.reviewItem(map[qid], attempt, i, attempt.results[qid]) : '').join('')}
                        </ol>
                    </section>` : ''}
                </div>`;
            typeset(this.container);
            const again = $('take-again');
            if (again) again.addEventListener('click', () => {
                retake = true;
                if (this.who && this.who.mode !== 'user') sessionLocal(LOCAL_KEY + s.id, null);
                this.render(this.container, s.code);
            });
        }
    };

    window.QuizBowl.Views.Take = View;

    // Re-check the account when sign-in finishes; send people back to the quiz they were opening
    if (window.QuizBowl.Cloud) {
        window.QuizBowl.Cloud.subscribe(event => {
            if (event.type !== 'ready' && event.type !== 'auth') return;
            const returnCode = sessionLocal(RETURN_KEY);
            const user = window.QuizBowl.Cloud.user();
            if (returnCode && user) {
                sessionLocal(RETURN_KEY, null);
                window.QuizBowl.Router.navigate('take/' + returnCode);
                return;
            }
            // Waiting on the account check, or asking to sign in: draw the page again
            if (window.QuizBowl.State.currentRoute === 'take' && (View.stage === 'loading' || View.stage === 'signin')) {
                View.render(View.container || document.getElementById('view-container'), View.code);
            }
        });
    }
})();
