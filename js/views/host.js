/**
 * js/views/host.js
 * Hosting quizzes that people take on their own:
 *  - #host              hosted quizzes, and a box to enter a quiz code
 *  - #host-new          choose the quiz, questions, order and timer, then launch
 *  - #host-session/ID   the join code, rules and everyone's scores
 *  - #host-attempt/ID   one person's answers, with marking for written answers
 */
(function() {
    const TYPE_LABELS = { mcq: 'Multiple choice', true_false: 'True / False', theory: 'Short answer', calculation: 'Calculation' };
    const PREFS_KEY = 'host_prefs';
    const ENDED = { finished: 'Finished', ended: 'Ended early', timeout: 'Time ran out' };

    const UI = () => window.QuizBowl.Utils.UI;
    const Host = () => window.QuizBowl.Services.HostService;
    const Storage = () => window.QuizBowl.Data.Storage;
    const Toast = () => window.QuizBowl.Components.Toast;
    const esc = v => UI().escapeHtml(v);
    const $ = id => document.getElementById(id);

    function idNumber(id) {
        return parseInt(String(id).replace(/\D+/g, ''), 10) || 0;
    }

    function formatDuration(seconds) {
        seconds = Math.max(0, Math.round(seconds));
        const h = Math.floor(seconds / 3600), m = Math.floor((seconds % 3600) / 60), s = seconds % 60;
        if (h) return `${h} hr ${m} min`;
        if (m && s) return `${m} min ${s} sec`;
        if (m) return `${m} min`;
        return `${s} sec`;
    }

    function formatDate(ts) {
        return new Date(ts).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    }

    function percent(score, max) {
        return max ? Math.round((score / max) * 100) : 0;
    }

    function timerSummary(session) {
        const st = session.settings;
        if (st.timerMode === 'total') return `${formatDuration(st.totalSeconds)} in total`;
        return 'Timed per question';
    }

    function attemptState(a) {
        if (a.status !== 'submitted') return '<span class="badge badge-partial">In progress</span>';
        return `<span class="badge ${a.endedBy === 'finished' ? 'badge-correct' : 'badge-answered'}">${ENDED[a.endedBy] || 'Submitted'}</span>`;
    }

    function getPrefs() {
        const saved = Storage().getGlobal(PREFS_KEY, {}) || {};
        const defaults = Host().DEFAULT_SETTINGS;
        return { ...defaults, ...saved, times: { ...defaults.times, ...(saved.times || {}) } };
    }
    function savePrefs(patch) {
        Storage().setGlobal(PREFS_KEY, { ...getPrefs(), ...patch });
    }

    // =====================================================================
    // #host: list of hosted quizzes
    // =====================================================================
    window.QuizBowl.Views.Host = {
        render: function(container) {
            const sessions = Host().listSessions();
            container.innerHTML = `
                <div class="host-view">
                    <div class="page-header">
                        <div>
                            <h1>Host a Quiz</h1>
                            <p>Pick questions, set a timer and get a code. People take the quiz one question at a time and their scores are saved here.</p>
                        </div>
                        <div class="page-actions">
                            <a href="#host-new" class="btn btn-primary">${UI().icon('plus')} Host a new quiz</a>
                        </div>
                    </div>

                    <section class="card host-join">
                        <div>
                            <h2>Take a quiz</h2>
                            <p>Enter the quiz code to start an attempt on this device.</p>
                        </div>
                        <form id="host-join-form" class="host-join-form" autocomplete="off">
                            <input type="text" id="host-join-code" class="form-control host-code-input" placeholder="e.g. K7Q2XP" maxlength="8" aria-label="Quiz code" spellcheck="false">
                            <button type="submit" class="btn btn-secondary">${UI().icon('play')} Start</button>
                        </form>
                    </section>

                    ${sessions.length ? `
                    <section class="card">
                        <div class="card-header"><div><h2>Your hosted quizzes</h2><p>${sessions.length} quiz${sessions.length === 1 ? '' : 'zes'}</p></div></div>
                        <div class="host-list">
                            ${sessions.map(s => {
                                const attempts = Host().listAttempts(s.id);
                                const done = attempts.filter(a => a.status === 'submitted');
                                const pending = done.reduce((n, a) => n + (a.pending || 0), 0);
                                return `
                                <a class="host-item" href="#host-session/${encodeURIComponent(s.id)}">
                                    <span class="host-item-code">${esc(s.code)}</span>
                                    <span class="host-item-main">
                                        <strong>${esc(s.title)}</strong>
                                        <small>${s.questions.length} question${s.questions.length === 1 ? '' : 's'} · ${esc(timerSummary(s))} · ${formatDate(s.createdAt)}</small>
                                    </span>
                                    <span class="host-item-stats">
                                        ${pending ? `<span class="badge badge-partial">${pending} to mark</span>` : ''}
                                        <span class="badge ${s.open ? 'badge-available' : 'badge-answered'}">${s.open ? 'Open' : 'Closed'}</span>
                                        <span class="host-item-count">${done.length} score${done.length === 1 ? '' : 's'}</span>
                                    </span>
                                </a>`;
                            }).join('')}
                        </div>
                    </section>` : `
                    <section class="card">
                        ${UI().emptyState('play', 'No hosted quizzes yet', 'Host a quiz to get a code that people can use to take it.',
                            `<a href="#host-new" class="btn btn-primary">${UI().icon('plus')} Host a new quiz</a>`)}
                    </section>`}
                </div>
            `;

            $('host-join-form').addEventListener('submit', e => {
                e.preventDefault();
                const code = $('host-join-code').value.toUpperCase().replace(/[^A-Z0-9]/g, '');
                if (!code) { $('host-join-code').focus(); return; }
                if (!Host().getSessionByCode(code)) {
                    Toast().show(`There's no quiz with the code ${code} on this device.`, 'danger');
                    return;
                }
                window.QuizBowl.Router.navigate('take/' + code);
            });
        }
    };

    // =====================================================================
    // #host-new: set up and launch
    // =====================================================================
    const S = {
        quizId: null,
        mode: 'all',            // all | types | categories | pick
        types: new Set(),
        cats: new Set(),
        picked: new Set(),
        search: '',
        title: '',
        totalTouched: false
    };

    function quizQuestions(quizId) {
        return (Storage().getForQuiz(quizId, 'questions', []) || [])
            .filter(q => q && q.status !== 'disabled' && Host().TYPES.includes(q.type))
            .sort((a, b) => Host().TYPES.indexOf(a.type) - Host().TYPES.indexOf(b.type) || idNumber(a.id) - idNumber(b.id));
    }

    const categoryOf = q => (q.category || '').trim() || Host().UNCATEGORISED;

    function selected() {
        const all = quizQuestions(S.quizId);
        if (S.mode === 'types') return all.filter(q => S.types.has(q.type));
        if (S.mode === 'categories') return all.filter(q => S.cats.has(categoryOf(q)));
        if (S.mode === 'pick') return all.filter(q => S.picked.has(q.id));
        return all;
    }

    // Per-type seconds: the host's last choice, else the quiz's own timer settings
    function defaultTimes(quizId) {
        const quizSettings = Storage().getForQuiz(quizId, 'settings', {}) || {};
        const fromQuiz = {};
        Host().TYPES.forEach(t => {
            const v = Number(quizSettings[t + 'Time']);
            if (v > 0) fromQuiz[t] = Math.max(5, v);
        });
        const saved = (Storage().getGlobal(PREFS_KEY, {}) || {}).times || {};
        return { ...Host().DEFAULT_TIMES, ...fromQuiz, ...saved };
    }

    function suggestedTotal(questions, times) {
        const secs = questions.reduce((sum, q) => sum + Math.max(5, Number(times[q.type]) || 30), 0);
        return Math.max(1, Math.ceil(secs / 60));
    }

    window.QuizBowl.Views.HostNew = {
        render: function(container) {
            const QuizzesDB = window.QuizBowl.Data.QuizzesDB;
            const quizzes = QuizzesDB.getAll();
            if (!S.quizId || !QuizzesDB.getById(S.quizId)) this.resetFor(QuizzesDB.getActiveId());
            const prefs = getPrefs();
            S.times = S.times || defaultTimes(S.quizId);

            const toggle = (key, label, hint) => `
                <label class="gen-toggle">
                    <input type="checkbox" data-pref="${key}" ${prefs[key] ? 'checked' : ''}>
                    <span><strong>${label}</strong><small>${hint}</small></span>
                </label>`;

            container.innerHTML = `
                <div class="generate-view host-new-view">
                    <a href="#host" class="back-link">${UI().icon('back')} Hosted quizzes</a>
                    <div class="page-header">
                        <div>
                            <h1>Host a new quiz</h1>
                            <p>Choose the questions and the rules. You'll get a code for taking the quiz.</p>
                        </div>
                    </div>
                    <div class="gen-layout">
                        <div class="gen-main">
                            <section class="card gen-step">
                                <div class="card-header">
                                    <div><h2><span class="gen-step-num">1</span> Quiz and questions</h2><p>Everything, whole types or categories, or hand-picked questions</p></div>
                                </div>
                                <div class="form-row">
                                    <div class="form-group">
                                        <label for="hn-quiz">Quiz</label>
                                        <select id="hn-quiz" class="form-control">
                                            ${quizzes.map(q => `<option value="${esc(q.id)}" ${q.id === S.quizId ? 'selected' : ''}>${esc(q.name)}</option>`).join('')}
                                        </select>
                                    </div>
                                    <div class="form-group">
                                        <label for="hn-title">Title people will see</label>
                                        <input type="text" id="hn-title" class="form-control" maxlength="120" value="${esc(S.title)}">
                                    </div>
                                </div>
                                <div class="segmented export-mode" id="hn-mode" role="tablist" aria-label="Which questions">
                                    ${[['all', 'All questions'], ['types', 'By type'], ['categories', 'By category'], ['pick', 'Pick questions']].map(([v, l]) =>
                                        `<button type="button" role="tab" data-value="${v}" class="${S.mode === v ? 'active' : ''}" aria-selected="${S.mode === v}">${l}</button>`).join('')}
                                </div>
                                <div id="hn-mode-body"></div>
                            </section>

                            <section class="card gen-step">
                                <div class="card-header">
                                    <div><h2><span class="gen-step-num">2</span> Question order</h2><p>Each person gets their own order when shuffling is on</p></div>
                                </div>
                                <div class="gen-toggles">
                                    ${toggle('groupByCategory', 'Group questions by category', 'Questions from the same category come together, categories A to Z')}
                                    ${toggle('shuffleQuestions', 'Shuffle questions', 'A different order for each person (within each category when grouped)')}
                                    ${toggle('shuffleOptions', 'Shuffle answer options', 'Multiple-choice options appear in a different order for each person')}
                                </div>
                            </section>

                            <section class="card gen-step">
                                <div class="card-header">
                                    <div><h2><span class="gen-step-num">3</span> Timer</h2><p>How long people get</p></div>
                                </div>
                                <div class="choice-cards" role="radiogroup" aria-label="Timer">
                                    <label class="choice-card">
                                        <input type="radio" name="hn-timer" value="question" ${prefs.timerMode !== 'total' ? 'checked' : ''}>
                                        <span><strong>Per question</strong><small>Each question has its own countdown. The next one opens on Next or when time runs out. Earlier questions can be viewed but not changed.</small></span>
                                    </label>
                                    <label class="choice-card">
                                        <input type="radio" name="hn-timer" value="total" ${prefs.timerMode === 'total' ? 'checked' : ''}>
                                        <span><strong>Total time</strong><small>One countdown for the whole quiz. People can move between questions and change answers until it runs out, then it's submitted.</small></span>
                                    </label>
                                </div>
                                <div id="hn-timer-body" class="host-timer-body"></div>
                            </section>

                            <section class="card gen-step">
                                <div class="card-header">
                                    <div><h2><span class="gen-step-num">4</span> After the quiz</h2><p>What people see and whether they can try again</p></div>
                                </div>
                                <div class="gen-toggles">
                                    ${toggle('showReview', 'Show answers after submitting', 'People see which answers were right, the correct answers and explanations. Otherwise they only see their score.')}
                                    ${toggle('allowRetake', 'Allow more than one attempt', 'Each attempt is scored separately')}
                                </div>
                            </section>
                        </div>
                        <aside class="gen-side">
                            <section class="card gen-summary" id="hn-summary"></section>
                        </aside>
                    </div>
                </div>
            `;
            this.renderModeBody();
            this.renderTimerBody();
            this.renderSummary();
            this.bind(container);
        },

        resetFor: function(quizId) {
            const quiz = window.QuizBowl.Data.QuizzesDB.getById(quizId);
            S.quizId = quizId;
            S.mode = 'all';
            S.types = new Set(Host().TYPES);
            S.cats = new Set(quizQuestions(quizId).map(categoryOf));
            S.picked = new Set();
            S.search = '';
            S.title = quiz ? quiz.name : 'Quiz';
            S.times = defaultTimes(quizId);
            S.totalTouched = false;
        },

        renderModeBody: function() {
            const body = $('hn-mode-body');
            const all = quizQuestions(S.quizId);
            if (!all.length) {
                body.innerHTML = `<p class="export-note">${UI().icon('info')} <span>This quiz has no questions yet. <a href="#generate">Generate some</a> or choose another quiz.</span></p>`;
                return;
            }
            const hasWritten = all.some(q => q.type === 'theory');
            const writtenNote = hasWritten ? `<p class="form-hint host-note">${UI().icon('info')} Short answers are marked right automatically when they match the expected answer. Anything else waits for you to mark it on the scores page.</p>` : '';

            if (S.mode === 'all') {
                body.innerHTML = `<p class="export-note">${UI().icon('checkCircle')} <span><strong>${all.length}</strong> question${all.length === 1 ? '' : 's'} will be used.</span></p>${writtenNote}`;
            } else if (S.mode === 'types') {
                body.innerHTML = `
                    <div class="export-type-grid">
                        ${Host().TYPES.map(t => {
                            const n = all.filter(q => q.type === t).length;
                            return `
                                <label class="choice-card export-type ${n ? '' : 'is-empty'}">
                                    <input type="checkbox" data-type="${t}" ${S.types.has(t) && n ? 'checked' : ''} ${n ? '' : 'disabled'}>
                                    <span>${UI().typeChip(t)}<strong>${TYPE_LABELS[t]}</strong><small>${n} question${n === 1 ? '' : 's'}</small></span>
                                </label>`;
                        }).join('')}
                    </div>${writtenNote}`;
            } else if (S.mode === 'categories') {
                const cats = [...new Set(all.map(categoryOf))].sort((a, b) => a.localeCompare(b));
                body.innerHTML = `
                    <div class="export-type-grid">
                        ${cats.map(c => {
                            const n = all.filter(q => categoryOf(q) === c).length;
                            return `
                                <label class="choice-card export-type">
                                    <input type="checkbox" data-cat="${esc(c)}" ${S.cats.has(c) ? 'checked' : ''}>
                                    <span><strong>${esc(c)}</strong><small>${n} question${n === 1 ? '' : 's'}</small></span>
                                </label>`;
                        }).join('')}
                    </div>${writtenNote}`;
            } else {
                body.innerHTML = `
                    <div class="export-pick-tools">
                        <div class="filter-search">
                            ${UI().icon('search')}
                            <input type="search" id="hn-search" class="form-control" placeholder="Search questions or categories…" value="${esc(S.search)}" autocomplete="off">
                        </div>
                    </div>
                    <div class="export-pick-bar">
                        <span id="hn-picked-count"></span>
                        <span>
                            <button type="button" class="btn btn-ghost btn-sm" id="hn-pick-shown">Select all shown</button>
                            <button type="button" class="btn btn-ghost btn-sm" id="hn-pick-none">Clear selection</button>
                        </span>
                    </div>
                    <ul class="export-list" id="hn-list"></ul>${writtenNote}`;
                this.renderList();
            }
        },

        shownInList: function() {
            const term = S.search.trim().toLowerCase();
            return quizQuestions(S.quizId).filter(q => !term ||
                `${q.id} ${UI().stripHtml(q.question)} ${categoryOf(q)}`.toLowerCase().includes(term));
        },

        renderList: function() {
            const list = $('hn-list');
            if (!list) return;
            const shown = this.shownInList();
            list.innerHTML = shown.length ? shown.map(q => `
                <li>
                    <label class="export-item ${S.picked.has(q.id) ? 'is-picked' : ''}">
                        <input type="checkbox" data-pick="${esc(q.id)}" ${S.picked.has(q.id) ? 'checked' : ''}>
                        <span class="qc-id">${esc(q.id)}</span>
                        ${UI().typeChip(q.type)}
                        <span class="export-item-text">${esc(UI().stripHtml(q.question).replace(/\s+/g, ' ').slice(0, 160))}</span>
                        <span class="host-cat">${esc(categoryOf(q))}</span>
                    </label>
                </li>`).join('') : `<li class="export-empty">No questions match.</li>`;
            $('hn-picked-count').textContent = `${S.picked.size} selected`;
        },

        renderTimerBody: function() {
            const body = $('hn-timer-body');
            const prefs = getPrefs();
            const questions = selected();
            const typesUsed = Host().TYPES.filter(t => questions.some(q => q.type === t));
            if (prefs.timerMode === 'total') {
                if (!S.totalTouched) S.totalMinutes = suggestedTotal(questions, S.times);
                body.innerHTML = `
                    <div class="form-group host-total">
                        <label for="hn-total">Total time</label>
                        <div class="host-number">
                            <input type="number" id="hn-total" class="form-control" min="1" max="600" step="1" value="${S.totalMinutes}">
                            <span>minutes</span>
                        </div>
                        <small class="form-hint">Suggested from the per-question times: ${suggestedTotal(questions, S.times)} min.</small>
                    </div>`;
            } else {
                body.innerHTML = `
                    <div class="host-times">
                        ${(typesUsed.length ? typesUsed : Host().TYPES).map(t => `
                            <div class="form-group">
                                <label for="hn-time-${t}">${UI().typeChip(t)} ${TYPE_LABELS[t]}</label>
                                <div class="host-number">
                                    <input type="number" id="hn-time-${t}" class="form-control" data-time="${t}" min="5" max="3600" step="5" value="${S.times[t]}">
                                    <span>sec</span>
                                </div>
                            </div>`).join('')}
                    </div>
                    <small class="form-hint">Seconds for each question of that type. Defaults come from this quiz's timer settings.</small>`;
            }
        },

        settings: function() {
            const prefs = getPrefs();
            return {
                timerMode: prefs.timerMode,
                times: { ...S.times },
                totalSeconds: Math.round((Number(S.totalMinutes) || 0) * 60),
                groupByCategory: !!prefs.groupByCategory,
                shuffleQuestions: !!prefs.shuffleQuestions,
                shuffleOptions: !!prefs.shuffleOptions,
                showReview: !!prefs.showReview,
                allowRetake: !!prefs.allowRetake
            };
        },

        renderSummary: function() {
            const el = $('hn-summary');
            if (!el) return;
            const questions = selected();
            const st = this.settings();
            const marks = questions.reduce((a, q) => a + (Number(q.marks) || 0), 0);
            const byType = Host().TYPES.map(t => [t, questions.filter(q => q.type === t).length]).filter(([, n]) => n);
            const perQuestion = questions.reduce((sum, q) => sum + Math.max(5, Number(st.times[q.type]) || 30), 0);
            const totalOk = st.timerMode !== 'total' || st.totalSeconds >= 60;
            const blocker = !questions.length ? 'Choose at least one question.' : !totalOk ? 'Set a total time of at least 1 minute.' : '';
            el.innerHTML = `
                <h2 class="gen-summary-title">${UI().icon('play')} Your hosted quiz</h2>
                <dl class="gen-summary-list">
                    <div><dt>Questions</dt><dd>${questions.length}</dd></div>
                    ${byType.map(([t, n]) => `<div><dt>${UI().typeChip(t)}</dt><dd>${n}</dd></div>`).join('')}
                    <div><dt>Total marks</dt><dd>${marks}</dd></div>
                    <div><dt>Timer</dt><dd>${st.timerMode === 'total' ? 'Total time' : 'Per question'}</dd></div>
                    <div><dt>${st.timerMode === 'total' ? 'Time allowed' : 'Longest possible'}</dt><dd>${formatDuration(st.timerMode === 'total' ? st.totalSeconds : perQuestion)}</dd></div>
                    <div><dt>Order</dt><dd>${[st.groupByCategory ? 'By category' : '', st.shuffleQuestions ? 'Shuffled' : ''].filter(Boolean).join(', ') || 'As listed'}</dd></div>
                </dl>
                <button type="button" class="btn btn-primary btn-lg btn-block" id="hn-launch" ${blocker ? 'disabled' : ''}>${UI().icon('play')} Launch quiz</button>
                <p class="form-hint gen-blocker">${blocker || 'You\'ll get a code. People need to sign in to their Quizr account to take the quiz.'}</p>
            `;
        },

        refresh: function() {
            this.renderTimerBody();
            this.renderSummary();
        },

        launch: function() {
            const quiz = window.QuizBowl.Data.QuizzesDB.getById(S.quizId);
            try {
                const session = Host().createSession({
                    title: ($('hn-title').value || '').trim() || (quiz ? quiz.name : 'Quiz'),
                    quizId: S.quizId,
                    quizName: quiz ? quiz.name : '',
                    questions: selected(),
                    settings: this.settings()
                });
                savePrefs({ times: { ...S.times } });
                S.quizId = null;   // start fresh next time
                Toast().show(`Quiz launched. The code is ${session.code}.`, 'success');
                window.QuizBowl.Router.navigate('host-session/' + encodeURIComponent(session.id));
            } catch (err) {
                Toast().show(err.message, 'danger');
            }
        },

        bind: function(container) {
            const view = container.querySelector('.host-new-view');
            const self = this;

            view.addEventListener('click', e => {
                const modeBtn = e.target.closest('#hn-mode button[data-value]');
                if (modeBtn) {
                    S.mode = modeBtn.getAttribute('data-value');
                    $('hn-mode').querySelectorAll('button').forEach(b => { b.classList.toggle('active', b === modeBtn); b.setAttribute('aria-selected', b === modeBtn); });
                    self.renderModeBody();
                    self.refresh();
                    return;
                }
                if (e.target.closest('#hn-pick-shown')) {
                    self.shownInList().forEach(q => S.picked.add(q.id));
                    self.renderList();
                    self.refresh();
                    return;
                }
                if (e.target.closest('#hn-pick-none')) {
                    S.picked.clear();
                    self.renderList();
                    self.refresh();
                    return;
                }
                if (e.target.closest('#hn-launch')) self.launch();
            });

            view.addEventListener('change', e => {
                const t = e.target;
                if (t.id === 'hn-quiz') {
                    self.resetFor(t.value);
                    $('hn-title').value = S.title;
                    self.renderModeBody();
                    self.refresh();
                    return;
                }
                if (t.hasAttribute('data-type')) {
                    const type = t.getAttribute('data-type');
                    if (t.checked) S.types.add(type); else S.types.delete(type);
                    return self.refresh();
                }
                if (t.hasAttribute('data-cat')) {
                    const cat = t.getAttribute('data-cat');
                    if (t.checked) S.cats.add(cat); else S.cats.delete(cat);
                    return self.refresh();
                }
                if (t.hasAttribute('data-pick')) {
                    const id = t.getAttribute('data-pick');
                    if (t.checked) S.picked.add(id); else S.picked.delete(id);
                    t.closest('.export-item').classList.toggle('is-picked', t.checked);
                    $('hn-picked-count').textContent = `${S.picked.size} selected`;
                    return self.refresh();
                }
                if (t.hasAttribute('data-pref')) {
                    savePrefs({ [t.getAttribute('data-pref')]: t.checked });
                    return self.renderSummary();
                }
                if (t.name === 'hn-timer') {
                    savePrefs({ timerMode: t.value });
                    return self.refresh();
                }
                if (t.hasAttribute('data-time')) {
                    const v = Math.round(Number(t.value));
                    S.times[t.getAttribute('data-time')] = Math.min(3600, Math.max(5, Number.isFinite(v) ? v : 30));
                    t.value = S.times[t.getAttribute('data-time')];
                    return self.renderSummary();
                }
                if (t.id === 'hn-total') {
                    const v = Math.round(Number(t.value));
                    S.totalMinutes = Math.min(600, Math.max(1, Number.isFinite(v) ? v : 1));
                    t.value = S.totalMinutes;
                    S.totalTouched = true;
                    return self.renderSummary();
                }
            });

            view.addEventListener('input', e => {
                if (e.target.id === 'hn-search') {
                    S.search = e.target.value;
                    self.renderList();
                } else if (e.target.id === 'hn-title') {
                    S.title = e.target.value;
                }
            });
        }
    };

    // =====================================================================
    // #host-session/ID: code, rules and scores
    // =====================================================================
    function csvCell(v) {
        const s = String(v == null ? '' : v);
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }

    function downloadCsv(session) {
        const attempts = Host().listAttempts(session.id).filter(a => a.status === 'submitted')
            .sort((a, b) => b.score - a.score || a.submittedAt - b.submittedAt);
        const rows = [['Name', 'Email', 'Score', 'Out of', 'Percent', 'Awaiting marking', 'Time taken (sec)', 'How it ended', 'Started', 'Submitted']];
        attempts.forEach(a => rows.push([a.name, a.email, a.score, a.maxScore, percent(a.score, a.maxScore), a.pending || 0,
            Math.round((a.submittedAt - a.startedAt) / 1000), ENDED[a.endedBy] || '', new Date(a.startedAt).toISOString(), new Date(a.submittedAt).toISOString()]));
        const blob = new Blob(['﻿' + rows.map(r => r.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${session.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'quiz'}-scores.csv`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    window.QuizBowl.Views.HostSession = {
        render: function(container, id) {
            const session = Host().getSession(id);
            if (!session) {
                container.innerHTML = `<div class="card">${UI().emptyState('inbox', 'Hosted quiz not found', 'It may have been deleted.',
                    `<a href="#host" class="btn btn-primary">Hosted quizzes</a>`)}</div>`;
                return;
            }
            const st = session.settings;
            const attempts = Host().listAttempts(session.id);
            const done = attempts.filter(a => a.status === 'submitted').sort((a, b) => b.score - a.score || a.submittedAt - b.submittedAt);
            const live = attempts.filter(a => a.status !== 'submitted').sort((a, b) => b.startedAt - a.startedAt);
            const avg = done.length ? Math.round(done.reduce((s, a) => s + percent(a.score, a.maxScore), 0) / done.length) : null;
            const best = done.length ? Math.max(...done.map(a => percent(a.score, a.maxScore))) : null;
            const pending = done.reduce((n, a) => n + (a.pending || 0), 0);
            const typeCounts = Host().TYPES.map(t => [t, session.questions.filter(q => q.type === t).length]).filter(([, n]) => n);

            const row = (a, rank) => {
                const time = a.status === 'submitted' ? formatDuration((a.submittedAt - a.startedAt) / 1000) : '—';
                return `
                <tr class="host-row" data-attempt="${esc(a.id)}" tabindex="0">
                    <td class="host-rank">${rank || ''}</td>
                    <td><strong>${esc(a.name)}</strong><small class="host-email">${esc(a.email || 'Not signed in')}</small></td>
                    <td class="host-score">${a.status === 'submitted' ? `<strong>${a.score}</strong> / ${a.maxScore} <small>${percent(a.score, a.maxScore)}%</small>` : '—'}
                        ${a.pending ? `<span class="badge badge-partial">${a.pending} to mark</span>` : ''}</td>
                    <td>${time}</td>
                    <td>${attemptState(a)}</td>
                    <td class="text-muted">${formatDate(a.status === 'submitted' ? a.submittedAt : a.startedAt)}</td>
                </tr>`;
            };

            container.innerHTML = `
                <div class="host-session-view">
                    <a href="#host" class="back-link">${UI().icon('back')} Hosted quizzes</a>
                    <div class="page-header">
                        <div>
                            <h1>${esc(session.title)} <span class="badge ${session.open ? 'badge-available' : 'badge-answered'}">${session.open ? 'Open' : 'Closed'}</span></h1>
                            <p>${session.quizName && session.quizName !== session.title ? `From ${esc(session.quizName)} · ` : ''}Hosted ${formatDate(session.createdAt)}</p>
                        </div>
                        <div class="page-actions">
                            <button type="button" class="btn btn-secondary" id="hs-toggle">${UI().icon(session.open ? 'lock' : 'play')} ${session.open ? 'Close quiz' : 'Reopen quiz'}</button>
                            <button type="button" class="btn btn-danger-ghost" id="hs-delete">${UI().icon('trash')} Delete</button>
                        </div>
                    </div>

                    <div class="host-session-grid">
                        <section class="card host-code-card">
                            <span class="host-code-label">Quiz code</span>
                            <div class="host-code" id="hs-code">${esc(session.code)}</div>
                            <div class="host-code-actions">
                                <button type="button" class="btn btn-secondary btn-sm" id="hs-copy">${UI().icon('copy')} Copy code</button>
                                <a href="#take/${esc(session.code)}" class="btn btn-primary btn-sm ${session.open ? '' : 'is-disabled'}" id="hs-take" ${session.open ? '' : 'aria-disabled="true" tabindex="-1"'}>${UI().icon('play')} Take the quiz</a>
                            </div>
                            <p class="form-hint">${session.open ? 'For now, the quiz can be taken on this device. Sharing with other devices is coming next.' : 'Closed: no new attempts can start.'}</p>
                        </section>
                        <section class="card host-rules">
                            <h2>Rules</h2>
                            <dl class="gen-summary-list">
                                <div><dt>Questions</dt><dd>${session.questions.length} · ${Host().totalMarks(session)} marks</dd></div>
                                <div><dt>Types</dt><dd>${typeCounts.map(([t, n]) => `${UI().typeChip(t)} ${n}`).join(' ')}</dd></div>
                                <div><dt>Timer</dt><dd>${st.timerMode === 'total' ? `${formatDuration(st.totalSeconds)} in total` : 'Per question'}</dd></div>
                                ${st.timerMode === 'question' ? `<div><dt>Seconds each</dt><dd>${Host().TYPES.filter(t => session.questions.some(q => q.type === t)).map(t => `${UI().typeChip(t)} ${st.times[t]}`).join(' ')}</dd></div>` : ''}
                                <div><dt>Order</dt><dd>${[st.groupByCategory ? 'By category' : '', st.shuffleQuestions ? 'Shuffled' : '', st.shuffleOptions ? 'Options shuffled' : ''].filter(Boolean).join(', ') || 'As listed'}</dd></div>
                                <div><dt>After submitting</dt><dd>${st.showReview ? 'Score and answers' : 'Score only'}</dd></div>
                                <div><dt>Attempts</dt><dd>${st.allowRetake ? 'More than one allowed' : 'One per person'}</dd></div>
                            </dl>
                        </section>
                    </div>

                    <section class="card">
                        <div class="card-header">
                            <div>
                                <h2>Scores</h2>
                                <p>${done.length} submitted${live.length ? ` · ${live.length} in progress` : ''}${avg != null ? ` · average ${avg}% · best ${best}%` : ''}</p>
                            </div>
                            ${done.length ? `<button type="button" class="btn btn-secondary btn-sm" id="hs-csv">${UI().icon('download')} Download CSV</button>` : ''}
                        </div>
                        ${pending ? `<div class="callout callout-warning host-callout">${UI().icon('alert')}<div><strong>${pending} written answer${pending === 1 ? '' : 's'} to mark</strong>Open a score to mark them. Totals update as you go.</div></div>` : ''}
                        ${attempts.length ? `
                        <div class="table-wrap">
                            <table class="table host-table">
                                <thead><tr><th>#</th><th>Name</th><th>Score</th><th>Time taken</th><th>Status</th><th>When</th></tr></thead>
                                <tbody>
                                    ${done.map((a, i) => row(a, i + 1)).join('')}
                                    ${live.map(a => row(a, 0)).join('')}
                                </tbody>
                            </table>
                        </div>` : UI().emptyState('award', 'No scores yet', 'Scores appear here as soon as someone submits the quiz.')}
                    </section>
                </div>
            `;

            const open = el => { if (el) window.QuizBowl.Router.navigate('host-attempt/' + encodeURIComponent(el.getAttribute('data-attempt'))); };
            container.querySelectorAll('.host-row').forEach(tr => {
                tr.addEventListener('click', () => open(tr));
                tr.addEventListener('keydown', e => { if (e.key === 'Enter') open(tr); });
            });
            $('hs-copy').addEventListener('click', async () => {
                try {
                    await navigator.clipboard.writeText(session.code);
                    Toast().show(`Copied ${session.code}.`, 'success');
                } catch (e) {
                    const range = document.createRange();
                    range.selectNodeContents($('hs-code'));
                    const sel = window.getSelection();
                    sel.removeAllRanges();
                    sel.addRange(range);
                    Toast().show('Press Ctrl+C to copy the code.', 'info');
                }
            });
            $('hs-take').addEventListener('click', e => { if (!session.open) e.preventDefault(); });
            $('hs-toggle').addEventListener('click', () => {
                Host().setOpen(session.id, !session.open);
                Toast().show(session.open ? 'Quiz closed. No new attempts can start.' : 'Quiz reopened.', 'info');
                this.render(container, id);
            });
            $('hs-delete').addEventListener('click', async () => {
                const ok = await window.QuizBowl.Components.Modal.confirm({
                    title: 'Delete this hosted quiz?',
                    message: `"${session.title}" and all ${attempts.length} score${attempts.length === 1 ? '' : 's'} will be deleted. The questions in your quiz aren't affected.`,
                    confirmText: 'Delete', danger: true
                });
                if (!ok) return;
                Host().deleteSession(session.id);
                Toast().show('Hosted quiz deleted.', 'info');
                window.QuizBowl.Router.navigate('host');
            });
            if ($('hs-csv')) $('hs-csv').addEventListener('click', () => downloadCsv(session));
        }
    };

    // =====================================================================
    // #host-attempt/ID: one person's answers, with marking
    // =====================================================================
    window.QuizBowl.Views.HostAttempt = {
        render: function(container, id) {
            const attempt = Host().getAttempt(id);
            const session = attempt && Host().getSession(attempt.sessionId);
            if (!attempt || !session) {
                container.innerHTML = `<div class="card">${UI().emptyState('inbox', 'Score not found', 'It may have been deleted.',
                    `<a href="#host" class="btn btn-primary">Hosted quizzes</a>`)}</div>`;
                return;
            }
            const map = Host().questionMap(session);
            const submitted = attempt.status === 'submitted';
            const Review = window.QuizBowl.Views.Take;

            container.innerHTML = `
                <div class="host-attempt-view">
                    <a href="#host-session/${encodeURIComponent(session.id)}" class="back-link">${UI().icon('back')} ${esc(session.title)}</a>
                    <div class="page-header">
                        <div>
                            <h1>${esc(attempt.name)} ${attemptState(attempt)}</h1>
                            <p>${esc(attempt.email || 'Not signed in')}${attempt.userId ? ` · Quizr ID <code>${esc(attempt.userId)}</code>` : ''}</p>
                        </div>
                        <div class="page-actions">
                            <button type="button" class="btn btn-danger-ghost" id="ha-delete">${UI().icon('trash')} Delete score</button>
                        </div>
                    </div>
                    ${submitted ? `
                    <section class="card host-attempt-summary">
                        <div class="take-score-ring" style="--p: ${percent(attempt.score, attempt.maxScore)}"><span>${percent(attempt.score, attempt.maxScore)}%</span></div>
                        <dl class="gen-summary-list">
                            <div><dt>Score</dt><dd>${attempt.score} / ${attempt.maxScore}</dd></div>
                            <div><dt>Awaiting marking</dt><dd>${attempt.pending || 0}</dd></div>
                            <div><dt>Time taken</dt><dd>${formatDuration((attempt.submittedAt - attempt.startedAt) / 1000)}</dd></div>
                            <div><dt>How it ended</dt><dd>${ENDED[attempt.endedBy] || 'Submitted'}</dd></div>
                            <div><dt>Started</dt><dd>${formatDate(attempt.startedAt)}</dd></div>
                        </dl>
                    </section>` : `
                    <div class="callout callout-info host-callout">${UI().icon('info')}<div><strong>This attempt is still in progress</strong>Its score appears when it's submitted or its time runs out.</div></div>`}
                    <section class="card">
                        <div class="card-header"><div><h2>Answers</h2><p>${submitted ? 'Change any mark if needed; written answers that didn\'t match are waiting for you.' : 'Answers so far'}</p></div></div>
                        <ol class="take-review">
                            ${attempt.order.map((qid, i) => {
                                const q = map[qid];
                                if (!q) return '';
                                const r = submitted ? attempt.results[qid] : null;
                                return Review.reviewItem(q, attempt, i, r, submitted ? `
                                    <form class="host-mark" data-qid="${esc(qid)}">
                                        <label>Marks
                                            <input type="number" class="form-control" min="0" max="${q.marks}" step="0.5" value="${r ? r.awarded : 0}" aria-label="Marks for question ${i + 1}">
                                            <span>/ ${q.marks}</span>
                                        </label>
                                        <button type="submit" class="btn btn-secondary btn-sm">Save</button>
                                        ${r && r.status === 'marked' ? `<button type="button" class="btn btn-ghost btn-sm" data-clear="${esc(qid)}">Use automatic mark</button>` : ''}
                                    </form>` : '');
                            }).join('')}
                        </ol>
                    </section>
                </div>
            `;

            if (window.MathJax && MathJax.typesetPromise) MathJax.typesetPromise([container]).catch(() => {});

            container.querySelectorAll('.host-mark').forEach(form => form.addEventListener('submit', e => {
                e.preventDefault();
                try {
                    Host().setMark(attempt.id, form.getAttribute('data-qid'), form.querySelector('input').value);
                    Toast().show('Mark saved.', 'success');
                    this.render(container, id);
                } catch (err) {
                    Toast().show(err.message, 'danger');
                }
            }));
            container.querySelectorAll('[data-clear]').forEach(btn => btn.addEventListener('click', () => {
                Host().clearMark(attempt.id, btn.getAttribute('data-clear'));
                this.render(container, id);
            }));
            $('ha-delete').addEventListener('click', async () => {
                const ok = await window.QuizBowl.Components.Modal.confirm({
                    title: 'Delete this score?',
                    message: `${attempt.name}'s attempt will be removed${session.settings.allowRetake ? '' : ', and they will be able to take the quiz again'}.`,
                    confirmText: 'Delete', danger: true
                });
                if (!ok) return;
                Host().deleteAttempt(attempt.id);
                Toast().show('Score deleted.', 'info');
                window.QuizBowl.Router.navigate('host-session/' + encodeURIComponent(session.id));
            });
        }
    };

    window.QuizBowl.Views.HostUtils = { formatDuration, percent, ENDED };
})();
