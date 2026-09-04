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
                        <button class="btn btn-primary" onclick="window.QuizBowl.Router.navigate('add-question')">
                            + Add Question
                        </button>
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
                    <div class="question-card" onclick="window.QuizBowl.Router.navigate('question/${q.id}')">
                        <div class="qc-header">
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
        }
    };

    window.QuizBowl.Router.routes['questions'] = () => {
        window.QuizBowl.Views.Questions.render(document.getElementById('view-container'));
    };
})();
