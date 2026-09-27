/**
 * js/views/questions.js
 * Questions List View
 */
(function() {
    window.QuizBowl.Views.Questions = {
        render: function(container) {
            const QuestionService = window.QuizBowl.Services.QuestionService;
            let questions = QuestionService.getAllQuestions();
            
            // Initial render wrapper
            const html = `
                <div class="questions-view">
                    <div class="questions-header">
                        <h1>Question Bank</h1>
                        <div>
                            <button id="btn-delete-selected" class="btn" style="position: fixed; bottom: 2rem; right: 2rem; z-index: 1000; box-shadow: 0 4px 12px rgba(0,0,0,0.15); border-radius: 50px; padding: 1rem 2rem; background: var(--color-danger); color: white; display: none;" onclick="window.QuizBowl.Views.Questions.deleteSelected()">
                                Delete Selected (<span id="delete-count">0</span>)
                            </button>
                            <button class="btn btn-primary" onclick="window.QuizBowl.Router.navigate('add-question')">
                                + Add Question
                            </button>
                        </div>
                    </div>

                    <div class="filters-bar">
                        <div class="filter-group">
                            <label>Status</label>
                            <select id="filter-status">
                                <option value="all">All</option>
                                <option value="available">Available</option>
                                <option value="answered">Answered</option>
                                <option value="disabled">Disabled</option>
                            </select>
                        </div>
                        <div class="filter-group">
                            <label>Type</label>
                            <select id="filter-type">
                                <option value="all">All</option>
                                <option value="mcq">Multiple Choice</option>
                                <option value="calculation">Calculation</option>
                                <option value="theory">Theory</option>
                                <option value="true_false">True/False</option>
                            </select>
                        </div>
                        <div class="filter-group" style="flex: 1;">
                            <label>Quick Search</label>
                            <input type="text" id="local-search" placeholder="Search by ID, keyword, content...">
                        </div>
                    </div>

                    <div id="questions-grid" class="questions-grid">
                        <!-- Questions injected here -->
                    </div>
                </div>
            `;
            
            container.innerHTML = html;

            const grid = document.getElementById('questions-grid');
            
            const renderGrid = (data) => {
                grid.innerHTML = data.map(q => `
                    <div class="question-card" style="position: relative; cursor: pointer;" onclick="if(event.target.type !== 'checkbox') window.QuizBowl.Router.navigate('question/${q.id}')">
                        <input type="checkbox" class="q-select-checkbox" data-id="${q.id}" style="position: absolute; top: 15px; right: 15px; transform: scale(1.5); cursor: pointer;" onclick="event.stopPropagation()" onchange="window.QuizBowl.Views.Questions.updateDeleteButton()">
                        <div class="qc-header" style="padding-right: 30px;">
                            <span class="qc-id">${q.id}</span>
                            <span class="badge badge-${q.status}">${q.status}</span>
                        </div>
                        <div class="qc-body">
                            ${q.question}
                        </div>
                        <div class="qc-footer">
                            <span class="qc-category">${q.category}</span>
                            <span class="qc-type">${q.type.replace('_', '/')}</span>
                            <span class="qc-marks">${q.marks} pts</span>
                        </div>
                    </div>
                `).join('') || `<div class="text-muted" style="grid-column: 1 / -1; text-align: center; padding: 2rem;">No questions found.</div>`;
                
                // Tell MathJax to process the newly added content
                if (window.MathJax) {
                    MathJax.typesetPromise([grid]).catch((err) => console.log(err.message));
                }
            };

            // Initial render
            renderGrid(questions);

            // Setup listeners
            const applyFilters = () => {
                let filtered = questions;
                const status = document.getElementById('filter-status').value;
                const type = document.getElementById('filter-type').value;
                const query = document.getElementById('local-search').value;

                if (status !== 'all') filtered = filtered.filter(q => q.status === status);
                if (type !== 'all') filtered = filtered.filter(q => q.type === type);
                
                filtered = window.QuizBowl.Utils.Search.searchQuestions(query, filtered);
                
                renderGrid(filtered);
            };

            document.getElementById('filter-status').addEventListener('change', applyFilters);
            document.getElementById('filter-type').addEventListener('change', applyFilters);
            document.getElementById('local-search').addEventListener('input', applyFilters);

            // Connect global search
            const globalSearch = document.getElementById('global-search');
            if (globalSearch) {
                globalSearch.addEventListener('input', (e) => {
                    if (window.QuizBowl.State.currentRoute === 'questions') {
                        document.getElementById('local-search').value = e.target.value;
                        applyFilters();
                    }
                });
            }
        },
        
        updateDeleteButton: function() {
            const checkboxes = document.querySelectorAll('.q-select-checkbox:checked');
            const btn = document.getElementById('btn-delete-selected');
            const count = document.getElementById('delete-count');
            
            if (checkboxes.length > 0) {
                btn.style.display = 'inline-block';
                count.textContent = checkboxes.length;
            } else {
                btn.style.display = 'none';
            }
        },
        
        deleteSelected: function() {
            const checkboxes = document.querySelectorAll('.q-select-checkbox:checked');
            if (checkboxes.length === 0) return;
            
            if (confirm(`Are you sure you want to delete ${checkboxes.length} selected question(s)?`)) {
                const QuestionService = window.QuizBowl.Services.QuestionService;
                
                // Track types affected for renumbering
                const typesAffected = new Set();
                
                checkboxes.forEach(cb => {
                    const id = cb.getAttribute('data-id');
                    const q = QuestionService.getQuestion(id);
                    if (q) typesAffected.add(q.type);
                    QuestionService.deleteQuestion(id);
                });
                
                // Renumber only affected types (or just run global migrate)
                QuestionService.migrateIds();
                
                window.QuizBowl.Components.Toast.show(`${checkboxes.length} questions deleted`, 'success');
                window.QuizBowl.Views.Questions.render(document.getElementById('view-container'));
            }
        }
    };

    window.QuizBowl.Router.routes['questions'] = () => {
        window.QuizBowl.Views.Questions.render(document.getElementById('view-container'));
    };
})();
