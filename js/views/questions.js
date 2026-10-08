/**
 * js/views/questions.js
 * Questions List View
 */
(function() {
    // Filters persist while navigating between the list and question details
    const filters = { status: 'all', type: 'all' };
    let applyFilters = null;

    window.QuizBowl.Views.Questions = {
        render: function(container) {
            const QuestionService = window.QuizBowl.Services.QuestionService;
            const UI = window.QuizBowl.Utils.UI;
            const questions = QuestionService.getAllQuestions();
            const stats = QuestionService.getDashboardStats();

            const statusTabs = [
                { value: 'all', label: 'All', count: stats.total },
                { value: 'available', label: 'Available', count: stats.available },
                { value: 'answered', label: 'Answered', count: stats.answered }
            ];
            if (stats.disabled > 0) statusTabs.push({ value: 'disabled', label: 'Disabled', count: stats.disabled });

            const html = `
                <div class="questions-view">
                    <div class="page-header">
                        <div>
                            <h1>Question Bank</h1>
                            <p>Browse, filter and open questions to score them.</p>
                        </div>
                        <div class="page-actions">
                            <button class="btn btn-secondary" onclick="window.QuizBowl.Router.navigate('export')" title="Download questions as a PDF">
                                ${UI.icon('download')} Export PDF
                            </button>
                            <button class="btn btn-secondary" onclick="window.QuizBowl.Router.navigate('generate')" title="Create questions from documents with AI">
                                ${UI.icon('sparkles')} Generate with AI
                            </button>
                            <button class="btn btn-primary" onclick="window.QuizBowl.Router.navigate('add-question')" title="Add question (Alt+N)">
                                ${UI.icon('plus')} Add Question
                            </button>
                        </div>
                    </div>

                    <div class="filters-bar">
                        <div class="segmented" role="tablist" aria-label="Filter by status" id="filter-status">
                            ${statusTabs.map(t => `
                                <button type="button" role="tab" data-value="${t.value}" class="${filters.status === t.value ? 'active' : ''}" aria-selected="${filters.status === t.value}">
                                    ${t.label}<span class="count">${t.count}</span>
                                </button>
                            `).join('')}
                        </div>
                        <select id="filter-type" class="form-control filter-select" aria-label="Filter by type">
                            <option value="all">All types</option>
                            ${Object.keys(UI.QUESTION_TYPES).map(type => `
                                <option value="${type}" ${filters.type === type ? 'selected' : ''}>${UI.typeLabel(type)}</option>
                            `).join('')}
                        </select>
                        <div class="filter-search">
                            ${UI.icon('search')}
                            <input type="search" id="local-search" class="form-control" placeholder="Search by ID, keyword, category..." autocomplete="off" value="${UI.escapeHtml(window.QuizBowl.State.searchQuery)}">
                        </div>
                    </div>

                    <div class="results-meta">
                        <label class="select-all hide-in-display">
                            <input type="checkbox" id="select-all"> Select all
                        </label>
                        <span id="results-count"></span>
                    </div>

                    <div id="questions-grid" class="questions-grid">
                        <!-- Questions injected here -->
                    </div>

                    <div class="selection-bar hide-in-display" id="selection-bar" role="region" aria-label="Bulk actions">
                        <span><strong id="delete-count">0</strong> selected</span>
                        <div style="display: flex; gap: 0.25rem;">
                            <button class="btn btn-ghost btn-sm" onclick="window.QuizBowl.Views.Questions.clearSelection()">Cancel</button>
                            <button class="btn btn-ghost btn-sm" onclick="window.QuizBowl.Views.Questions.exportSelected()">
                                ${UI.icon('download')} Export PDF
                            </button>
                            <button id="btn-delete-selected" class="btn btn-danger btn-sm" onclick="window.QuizBowl.Views.Questions.deleteSelected()">
                                ${UI.icon('trash')} Delete
                            </button>
                        </div>
                    </div>
                </div>
            `;

            container.innerHTML = html;

            const grid = document.getElementById('questions-grid');
            const searchInput = document.getElementById('local-search');

            const renderGrid = (data) => {
                document.getElementById('results-count').textContent =
                    `Showing ${data.length} of ${questions.length} question${questions.length === 1 ? '' : 's'}`;

                if (data.length === 0) {
                    const hasFilters = filters.status !== 'all' || filters.type !== 'all' || searchInput.value.trim();
                    grid.innerHTML = `<div class="card" style="grid-column: 1 / -1;">${
                        hasFilters
                            ? UI.emptyState('search', 'No matching questions', 'Try a different search term or clear the filters.',
                                `<button class="btn btn-secondary btn-sm" id="btn-clear-filters">Clear filters</button>`)
                            : UI.emptyState('questions', 'Your question bank is empty', 'Add your first question to get started.',
                                `<a href="#add-question" class="btn btn-primary btn-sm">${UI.icon('plus')} Add Question</a>`)
                    }</div>`;
                    const clearBtn = document.getElementById('btn-clear-filters');
                    if (clearBtn) clearBtn.addEventListener('click', () => this.resetFilters());
                } else {
                    grid.innerHTML = data.map(q => `
                        <div class="question-card ${q.status === 'answered' ? 'is-answered' : ''}" role="link" tabindex="0" data-id="${UI.escapeHtml(q.id)}"
                            aria-label="Open question ${UI.escapeHtml(q.id)}">
                            <div class="qc-header">
                                <span class="qc-id">${UI.escapeHtml(q.id)}</span>
                                ${UI.typeChip(q.type)}
                                ${UI.statusBadge(q.status)}
                                <label class="qc-select hide-in-display" title="Select">
                                    <input type="checkbox" class="q-select-checkbox" data-id="${UI.escapeHtml(q.id)}" aria-label="Select ${UI.escapeHtml(q.id)}">
                                </label>
                            </div>
                            <div class="qc-body">
                                ${q.question}
                            </div>
                            <div class="qc-footer">
                                <span class="qc-category">${UI.escapeHtml(q.category || 'Uncategorised')}</span>
                                <span class="qc-marks">${q.marks} pts</span>
                            </div>
                        </div>
                    `).join('');
                }

                document.getElementById('select-all').checked = false;
                this.updateDeleteButton();

                // Tell MathJax to process the newly added content
                if (window.MathJax && MathJax.typesetPromise) {
                    MathJax.typesetPromise([grid]).catch((err) => console.log(err.message));
                }
            };

            // Setup listeners
            applyFilters = () => {
                let filtered = questions;
                if (filters.status !== 'all') filtered = filtered.filter(q => q.status === filters.status);
                if (filters.type !== 'all') filtered = filtered.filter(q => q.type === filters.type);
                filtered = window.QuizBowl.Utils.Search.searchQuestions(searchInput.value, filtered);
                renderGrid(filtered);
            };

            document.getElementById('filter-status').addEventListener('click', (e) => {
                const btn = e.target.closest('button[data-value]');
                if (!btn) return;
                filters.status = btn.getAttribute('data-value');
                document.querySelectorAll('#filter-status button').forEach(b => {
                    b.classList.toggle('active', b === btn);
                    b.setAttribute('aria-selected', b === btn);
                });
                applyFilters();
            });

            document.getElementById('filter-type').addEventListener('change', (e) => {
                filters.type = e.target.value;
                applyFilters();
            });

            searchInput.addEventListener('input', () => {
                window.QuizBowl.State.searchQuery = searchInput.value;
                const globalSearch = document.getElementById('global-search');
                if (globalSearch && globalSearch !== document.activeElement) globalSearch.value = searchInput.value;
                applyFilters();
            });

            // Card interactions: open on click / Enter, toggle selection via checkbox
            grid.addEventListener('click', (e) => {
                if (e.target.closest('.qc-select')) return;
                const card = e.target.closest('.question-card');
                if (card) window.QuizBowl.Router.navigate('question/' + encodeURIComponent(card.getAttribute('data-id')));
            });
            grid.addEventListener('keydown', (e) => {
                const card = e.target.closest('.question-card');
                if (card && e.target === card && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    card.click();
                }
            });
            grid.addEventListener('change', (e) => {
                if (e.target.classList.contains('q-select-checkbox')) this.updateDeleteButton();
            });

            document.getElementById('select-all').addEventListener('change', (e) => {
                document.querySelectorAll('.q-select-checkbox').forEach(cb => { cb.checked = e.target.checked; });
                this.updateDeleteButton();
            });

            applyFilters();
        },

        // Called by the header search box while this view is open
        applyExternalSearch: function(query) {
            const searchInput = document.getElementById('local-search');
            if (!searchInput || !applyFilters) return;
            searchInput.value = query;
            applyFilters();
        },

        resetFilters: function() {
            filters.status = 'all';
            filters.type = 'all';
            window.QuizBowl.State.searchQuery = '';
            const globalSearch = document.getElementById('global-search');
            if (globalSearch) globalSearch.value = '';
            this.render(document.getElementById('view-container'));
        },

        updateDeleteButton: function() {
            const checkboxes = document.querySelectorAll('.q-select-checkbox:checked');
            const bar = document.getElementById('selection-bar');
            if (!bar) return;

            document.querySelectorAll('.q-select-checkbox').forEach(cb => {
                cb.closest('.question-card').classList.toggle('selected', cb.checked);
            });
            document.getElementById('delete-count').textContent = checkboxes.length;
            bar.classList.toggle('show', checkboxes.length > 0);
        },

        exportSelected: function() {
            const ids = [...document.querySelectorAll('.q-select-checkbox:checked')].map(cb => cb.getAttribute('data-id'));
            if (!ids.length) return;
            window.QuizBowl.Views.Export.preselect(ids);
            window.QuizBowl.Router.navigate('export');
        },

        clearSelection: function() {
            document.querySelectorAll('.q-select-checkbox, #select-all').forEach(cb => { cb.checked = false; });
            this.updateDeleteButton();
        },

        deleteSelected: async function() {
            const checkboxes = document.querySelectorAll('.q-select-checkbox:checked');
            if (checkboxes.length === 0) return;
            const count = checkboxes.length;

            const confirmed = await window.QuizBowl.Components.Modal.confirm({
                title: `Delete ${count} question${count === 1 ? '' : 's'}?`,
                message: 'This cannot be undone. Remaining questions will be renumbered automatically.',
                confirmText: 'Delete',
                danger: true
            });
            if (!confirmed) return;

            const QuestionService = window.QuizBowl.Services.QuestionService;
            checkboxes.forEach(cb => QuestionService.deleteQuestion(cb.getAttribute('data-id')));

            // Renumber remaining questions so IDs stay sequential per type
            QuestionService.migrateIds();

            window.QuizBowl.Components.Toast.show(`${count} question${count === 1 ? '' : 's'} deleted`, 'success');
            this.render(document.getElementById('view-container'));
        }
    };
})();
