/**
 * js/views/export.js
 * Export to PDF: choose which questions to include (everything, by type,
 * or one by one), choose how answers appear, then download or print.
 */
(function() {
    const TYPES = ['mcq', 'true_false', 'theory', 'calculation'];
    const TYPE_LABELS = { mcq: 'Multiple choice', true_false: 'True / False', theory: 'Short answer', calculation: 'Calculation' };

    // Choices made on this page, kept while the app is open
    const S = {
        quizId: null,
        mode: 'all',              // all | types | pick
        status: 'all',            // all | available | answered
        types: new Set(TYPES),
        picked: new Set(),
        search: '',
        listType: ''
    };

    const UI = () => window.QuizBowl.Utils.UI;
    const esc = v => UI().escapeHtml(v);
    const $ = id => document.getElementById(id);

    function idNumber(id) {
        return parseInt(String(id).replace(/\D+/g, ''), 10) || 0;
    }

    function allQuestions() {
        return window.QuizBowl.Services.QuestionService.getAllQuestions().slice()
            .sort((a, b) => TYPES.indexOf(a.type) - TYPES.indexOf(b.type) || idNumber(a.id) - idNumber(b.id));
    }

    function statusOk(q) {
        if (S.status === 'available') return q.status !== 'answered';
        if (S.status === 'answered') return q.status === 'answered';
        return true;
    }

    function selectedQuestions() {
        const all = allQuestions();
        if (S.mode === 'pick') return all.filter(q => S.picked.has(q.id));
        if (S.mode === 'types') return all.filter(q => S.types.has(q.type) && statusOk(q));
        return all.filter(statusOk);
    }

    function syncQuiz() {
        const quizId = window.QuizBowl.Data.QuizzesDB.getActiveId();
        if (S.quizId !== quizId) {
            // Question IDs belong to one quiz, so start fresh when the quiz changes
            S.quizId = quizId;
            S.picked = new Set();
            S.search = '';
            S.listType = '';
        }
    }

    window.QuizBowl.Views.Export = {
        // Called from the Question Bank to export its current selection
        preselect: function(ids) {
            syncQuiz();
            S.mode = 'pick';
            S.picked = new Set(ids);
        },

        render: function(container) {
            syncQuiz();
            const quiz = window.QuizBowl.Data.QuizzesDB.getActive();
            const all = allQuestions();

            container.innerHTML = `
                <div class="generate-view export-view">
                    <div class="page-header">
                        <div>
                            <h1>Export to PDF</h1>
                            <p>Make a printable question paper or answer sheet from <strong>${esc(quiz ? quiz.name : 'this quiz')}</strong>.</p>
                        </div>
                    </div>
                    ${all.length ? `
                    <div class="gen-layout">
                        <div class="gen-main">
                            <section class="card gen-step">
                                <div class="card-header">
                                    <div><h2><span class="gen-step-num">1</span> Choose questions</h2><p>Everything, whole question types, or hand-picked questions</p></div>
                                </div>
                                <div class="segmented export-mode" id="ex-mode" role="tablist" aria-label="What to include">
                                    ${[['all', 'All questions'], ['types', 'By question type'], ['pick', 'Pick questions']].map(([v, l]) =>
                                        `<button type="button" role="tab" data-value="${v}" class="${S.mode === v ? 'active' : ''}" aria-selected="${S.mode === v}">${l}</button>`).join('')}
                                </div>
                                <div id="ex-mode-body"></div>
                            </section>

                            <section class="card gen-step">
                                <div class="card-header">
                                    <div><h2><span class="gen-step-num">2</span> PDF options</h2><p>How answers appear, title and layout</p></div>
                                </div>
                                ${window.QuizBowl.Export.Options.html('xp', quiz ? quiz.name : 'Quiz')}
                            </section>
                        </div>
                        <aside class="gen-side">
                            <section class="card gen-summary" id="ex-summary"></section>
                        </aside>
                    </div>` : `
                    <div class="card">
                        ${UI().emptyState('questions', 'No questions to export yet', 'Add questions or generate some with AI first.',
                            `<a href="#generate" class="btn btn-primary">${UI().icon('sparkles')} Generate with AI</a>`)}
                    </div>`}
                </div>
            `;
            if (!all.length) return;

            window.QuizBowl.Export.Options.bind('xp');
            this.renderModeBody();
            this.renderSummary();
            this.bind(container);
        },

        renderModeBody: function() {
            const body = $('ex-mode-body');
            const all = allQuestions();
            const statusSeg = `
                <div class="export-filter-row">
                    <span class="form-label" style="margin: 0;">Include</span>
                    <div class="segmented" id="ex-status" role="radiogroup" aria-label="Question status">
                        ${[['all', 'All'], ['available', 'Not used yet'], ['answered', 'Already used']].map(([v, l]) =>
                            `<button type="button" role="radio" data-value="${v}" class="${S.status === v ? 'active' : ''}" aria-checked="${S.status === v}">${l}</button>`).join('')}
                    </div>
                </div>`;

            if (S.mode === 'all') {
                const count = all.filter(statusOk).length;
                body.innerHTML = `
                    ${statusSeg}
                    <p class="export-note">${UI().icon('checkCircle')} <span><strong>${count}</strong> question${count === 1 ? '' : 's'} will be exported.</span></p>
                `;
            } else if (S.mode === 'types') {
                body.innerHTML = `
                    ${statusSeg}
                    <div class="export-type-grid">
                        ${TYPES.map(t => {
                            const n = all.filter(q => q.type === t && statusOk(q)).length;
                            return `
                                <label class="choice-card export-type ${n ? '' : 'is-empty'}">
                                    <input type="checkbox" data-type="${t}" ${S.types.has(t) ? 'checked' : ''} ${n ? '' : 'disabled'}>
                                    <span>${UI().typeChip(t)}<strong>${TYPE_LABELS[t]}</strong><small>${n} question${n === 1 ? '' : 's'}</small></span>
                                </label>`;
                        }).join('')}
                    </div>
                `;
            } else {
                body.innerHTML = `
                    <div class="export-pick-tools">
                        <div class="filter-search">
                            ${UI().icon('search')}
                            <input type="search" id="ex-search" class="form-control" placeholder="Search questions…" value="${esc(S.search)}" autocomplete="off">
                        </div>
                        <select id="ex-list-type" class="form-control filter-select" aria-label="Filter by type">
                            <option value="">All types</option>
                            ${TYPES.map(t => `<option value="${t}" ${S.listType === t ? 'selected' : ''}>${TYPE_LABELS[t]}</option>`).join('')}
                        </select>
                    </div>
                    <div class="export-pick-bar">
                        <span id="ex-picked-count"></span>
                        <span>
                            <button type="button" class="btn btn-ghost btn-sm" id="ex-pick-shown">Select all shown</button>
                            <button type="button" class="btn btn-ghost btn-sm" id="ex-pick-none">Clear selection</button>
                        </span>
                    </div>
                    <ul class="export-list" id="ex-list"></ul>
                `;
                this.renderList();
            }
        },

        shownInList: function() {
            const term = S.search.trim().toLowerCase();
            return allQuestions().filter(q =>
                (!S.listType || q.type === S.listType) &&
                (!term || `${q.id} ${UI().stripHtml(q.question)} ${q.category || ''}`.toLowerCase().includes(term)));
        },

        renderList: function() {
            const list = $('ex-list');
            if (!list) return;
            const shown = this.shownInList();
            list.innerHTML = shown.length ? shown.map(q => `
                <li>
                    <label class="export-item ${S.picked.has(q.id) ? 'is-picked' : ''}">
                        <input type="checkbox" data-pick="${esc(q.id)}" ${S.picked.has(q.id) ? 'checked' : ''}>
                        <span class="qc-id">${esc(q.id)}</span>
                        ${UI().typeChip(q.type)}
                        <span class="export-item-text">${esc(UI().stripHtml(q.question).replace(/\s+/g, ' ').slice(0, 160))}</span>
                        ${q.status === 'answered' ? '<span class="badge badge-answered">used</span>' : ''}
                    </label>
                </li>`).join('') : `<li class="export-empty">No questions match.</li>`;
            $('ex-picked-count').textContent = `${S.picked.size} selected`;
        },

        renderSummary: function() {
            const el = $('ex-summary');
            if (!el) return;
            const questions = selectedQuestions();
            const marks = questions.reduce((a, q) => a + (Number(q.marks) || 0), 0);
            const byType = TYPES.map(t => [t, questions.filter(q => q.type === t).length]).filter(([, n]) => n);
            el.innerHTML = `
                <h2 class="gen-summary-title">${UI().icon('download')} Your PDF</h2>
                <dl class="gen-summary-list">
                    <div><dt>Questions</dt><dd>${questions.length}</dd></div>
                    ${byType.map(([t, n]) => `<div><dt>${UI().typeChip(t)}</dt><dd>${n}</dd></div>`).join('')}
                    <div><dt>Total marks</dt><dd>${marks}</dd></div>
                    <div><dt>Answers</dt><dd>${esc(window.QuizBowl.Export.Options.summary())}</dd></div>
                </dl>
                <button type="button" class="btn btn-primary btn-lg btn-block" id="ex-download" ${questions.length ? '' : 'disabled'}>${UI().icon('download')} Download PDF</button>
                <button type="button" class="btn btn-secondary btn-block" id="ex-print" style="margin-top: var(--spacing-sm);" ${questions.length ? '' : 'disabled'}>${UI().icon('fileText')} Print</button>
                <p class="form-hint gen-blocker">${questions.length
                    ? 'Print opens your browser\'s print window, where you can also choose "Save as PDF". It\'s best for Arabic, Chinese and similar scripts.'
                    : 'Choose at least one question.'}</p>
            `;
        },

        refresh: function() {
            this.renderSummary();
        },

        run: async function(kind, btn) {
            const questions = selectedQuestions();
            if (!questions.length) return;
            const quiz = window.QuizBowl.Data.QuizzesDB.getActive();
            const opts = window.QuizBowl.Export.Options.read('xp', { quizName: quiz ? quiz.name : '' });
            const original = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = `${UI().icon('loader', 'spin')} ${kind === 'print' ? 'Preparing…' : 'Making PDF…'}`;
            try {
                await window.QuizBowl.Export.run(kind, questions, opts);
            } catch (err) {
                console.error(err);
                window.QuizBowl.Components.Toast.show(err.message || 'The PDF couldn\'t be made.', 'danger');
            } finally {
                btn.disabled = false;
                btn.innerHTML = original;
            }
        },

        bind: function(container) {
            const view = container.querySelector('.export-view');
            const self = this;

            view.addEventListener('click', e => {
                const modeBtn = e.target.closest('#ex-mode button[data-value]');
                if (modeBtn) {
                    S.mode = modeBtn.getAttribute('data-value');
                    $('ex-mode').querySelectorAll('button').forEach(b => { b.classList.toggle('active', b === modeBtn); b.setAttribute('aria-selected', b === modeBtn); });
                    self.renderModeBody();
                    self.renderSummary();
                    return;
                }
                const statusBtn = e.target.closest('#ex-status button[data-value]');
                if (statusBtn) {
                    S.status = statusBtn.getAttribute('data-value');
                    self.renderModeBody();
                    self.renderSummary();
                    return;
                }
                if (e.target.closest('#ex-pick-shown')) {
                    self.shownInList().forEach(q => S.picked.add(q.id));
                    self.renderList();
                    self.renderSummary();
                    return;
                }
                if (e.target.closest('#ex-pick-none')) {
                    S.picked.clear();
                    self.renderList();
                    self.renderSummary();
                    return;
                }
                const dl = e.target.closest('#ex-download');
                if (dl) return self.run('download', dl);
                const pr = e.target.closest('#ex-print');
                if (pr) return self.run('print', pr);
            });

            view.addEventListener('change', e => {
                const typeBox = e.target.closest('[data-type]');
                if (typeBox) {
                    const t = typeBox.getAttribute('data-type');
                    if (typeBox.checked) S.types.add(t); else S.types.delete(t);
                    self.renderSummary();
                    return;
                }
                const pick = e.target.closest('[data-pick]');
                if (pick) {
                    const id = pick.getAttribute('data-pick');
                    if (pick.checked) S.picked.add(id); else S.picked.delete(id);
                    pick.closest('.export-item').classList.toggle('is-picked', pick.checked);
                    $('ex-picked-count').textContent = `${S.picked.size} selected`;
                    self.renderSummary();
                    return;
                }
                if (e.target.id === 'ex-list-type') {
                    S.listType = e.target.value;
                    self.renderList();
                }
            });

            view.addEventListener('input', e => {
                if (e.target.id === 'ex-search') {
                    S.search = e.target.value;
                    self.renderList();
                }
            });

            view.addEventListener('options-change', () => self.renderSummary());
        }
    };
})();
