/**
 * js/views/add-question.js
 * Form to add new questions
 */
(function() {
    window.QuizBowl.Views.AddQuestion = {
        render: function(container) {
            const html = `
                <div class="add-question-view">
                    <div class="questions-header">
                        <h1>Add New Question</h1>
                        <button class="btn" style="background: var(--bg-surface); border: 1px solid var(--border-color);" onclick="window.history.back()">
                            Cancel
                        </button>
                    </div>

                    <div class="form-container">
                        <form id="add-question-form">
                            <!-- ID is now auto-generated on save -->
                            
                            <div class="form-group">
                                <label for="q-type">Question Type</label>
                                <select id="q-type" class="form-control" required>
                                    <option value="mcq">Multiple Choice</option>
                                    <option value="calculation">Calculation</option>
                                    <option value="theory">Theory</option>
                                    <option value="true_false">True/False</option>
                                </select>
                            </div>

                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--spacing-md);">
                                <div class="form-group">
                                    <label for="q-category">Category</label>
                                    <input type="text" id="q-category" class="form-control" required placeholder="e.g., Circuit Theory">
                                </div>
                                <div class="form-group">
                                    <label for="q-marks">Marks</label>
                                    <input type="number" id="q-marks" class="form-control" required min="1" value="5">
                                </div>
                            </div>

                            <div class="form-group">
                                <label for="q-text">Question Text (MathJax supported: $$ \text{math} $$)</label>
                                <textarea id="q-text" class="form-control" required></textarea>
                            </div>

                            <!-- Dynamic Options Container -->
                            <div id="dynamic-options-container">
                                <!-- Filled via JS based on type -->
                            </div>

                            <div class="form-group">
                                <label for="q-explanation">Explanation / Solution</label>
                                <textarea id="q-explanation" class="form-control"></textarea>
                            </div>
                            
                            <button type="submit" class="btn btn-primary" style="width: 100%;">Save Question</button>
                        </form>
                    </div>
                </div>
            `;
            
            container.innerHTML = html;

            const form = document.getElementById('add-question-form');
            const typeSelect = document.getElementById('q-type');
            const dynamicContainer = document.getElementById('dynamic-options-container');
            const marksInput = document.getElementById('q-marks');
            const settings = window.QuizBowl.Data.SettingsDB.getSettings();

            const renderDynamicFields = () => {
                const type = typeSelect.value;
                let fields = '';
                
                if (type === 'mcq') {
                    fields = `
                        <div class="form-group">
                            <label>Options</label>
                            <input type="text" id="opt-A" class="form-control" placeholder="Option A" style="margin-bottom: 5px;" required>
                            <input type="text" id="opt-B" class="form-control" placeholder="Option B" style="margin-bottom: 5px;" required>
                            <input type="text" id="opt-C" class="form-control" placeholder="Option C" style="margin-bottom: 5px;" required>
                            <input type="text" id="opt-D" class="form-control" placeholder="Option D" style="margin-bottom: 5px;" required>
                        </div>
                        <div class="form-group">
                            <label for="q-correct">Correct Option</label>
                            <select id="q-correct" class="form-control" required>
                                <option value="A">A</option><option value="B">B</option>
                                <option value="C">C</option><option value="D">D</option>
                            </select>
                        </div>
                    `;
                } else if (type === 'calculation') {
                    fields = `
                        <div class="form-group">
                            <label for="q-expected">Expected Numerical Answer</label>
                            <input type="text" id="q-expected" class="form-control" required>
                        </div>
                        <div class="form-group">
                            <label for="q-unit">Unit</label>
                            <input type="text" id="q-unit" class="form-control">
                        </div>
                    `;
                } else if (type === 'theory') {
                    fields = `
                        <div class="form-group">
                            <label for="q-expected">Expected Key Phrases/Answer</label>
                            <textarea id="q-expected" class="form-control" required></textarea>
                        </div>
                    `;
                } else if (type === 'true_false') {
                    fields = `
                        <div class="form-group">
                            <label for="q-correct">Correct Answer</label>
                            <select id="q-correct" class="form-control" required>
                                <option value="True">True</option>
                                <option value="False">False</option>
                            </select>
                        </div>
                    `;
                }
                
                dynamicContainer.innerHTML = fields;
                
                // Set default marks based on type
                if (type === 'mcq') marksInput.value = settings.mcqMarks;
                else if (type === 'calculation') marksInput.value = settings.calculationMarks;
                else if (type === 'theory') marksInput.value = settings.theoryMarks;
                else if (type === 'true_false') marksInput.value = settings.true_falseMarks;
            };

            typeSelect.addEventListener('change', renderDynamicFields);
            renderDynamicFields(); // initial render

            form.addEventListener('submit', (e) => {
                e.preventDefault();
                
                try {
                    const type = typeSelect.value;
                    const question = {
                        type: type,
                        category: document.getElementById('q-category').value,
                        topic: "", // simplified
                        difficulty: "medium", // default for now
                        marks: parseInt(document.getElementById('q-marks').value, 10),
                        question: document.getElementById('q-text').value,
                        explanation: document.getElementById('q-explanation').value,
                        status: 'available',
                        keywords: []
                    };

                    if (type === 'mcq') {
                        question.options = {
                            "A": document.getElementById('opt-A').value,
                            "B": document.getElementById('opt-B').value,
                            "C": document.getElementById('opt-C').value,
                            "D": document.getElementById('opt-D').value
                        };
                        question.correctAnswer = document.getElementById('q-correct').value;
                    } else if (type === 'calculation' || type === 'theory') {
                        question.expectedAnswer = document.getElementById('q-expected').value;
                        if (type === 'calculation') question.unit = document.getElementById('q-unit').value;
                    } else if (type === 'true_false') {
                        question.correctAnswer = document.getElementById('q-correct').value;
                    }

                    window.QuizBowl.Services.QuestionService.addQuestion(question);
                    window.QuizBowl.Components.Toast.show('Question saved successfully!', 'success');
                    window.QuizBowl.Router.navigate('questions');
                    
                } catch (err) {
                    window.QuizBowl.Components.Toast.show(err.message, 'danger');
                }
            });
        }
    };

    window.QuizBowl.Router.routes['add-question'] = () => {
        window.QuizBowl.Views.AddQuestion.render(document.getElementById('view-container'));
    };
})();
