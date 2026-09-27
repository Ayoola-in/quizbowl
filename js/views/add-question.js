/**
 * js/views/add-question.js
 * Form to add new questions
 */
(function() {
    window.QuizBowl.Views.AddQuestion = {
        render: function(container) {
            const UI = window.QuizBowl.Utils.UI;
            const QuestionService = window.QuizBowl.Services.QuestionService;

            const html = `
                <div class="add-question-view" style="max-width: 820px;">
                    <button class="back-link" onclick="window.history.back()">${UI.icon('back')} Back</button>
                    <div class="page-header">
                        <div>
                            <h1>Add New Question</h1>
                            <p>The question ID is generated automatically: <strong id="next-id"></strong></p>
                        </div>
                    </div>

                    <div class="form-container">
                        <form id="add-question-form" novalidate>
                            <div class="form-section">
                                <div class="form-section-title">Question type</div>
                                <div class="form-group type-picker" role="radiogroup" aria-label="Question type">
                                    ${Object.entries(UI.QUESTION_TYPES).map(([type, meta], i) => `
                                        <label class="type-option">
                                            <input type="radio" name="q-type" value="${type}" ${i === 0 ? 'checked' : ''}>
                                            <strong>${meta.label}</strong>
                                            <span>${meta.hint}</span>
                                        </label>
                                    `).join('')}
                                </div>
                            </div>

                            <div class="form-section">
                                <div class="form-section-title">Details</div>
                                <div class="form-row">
                                    <div class="form-group">
                                        <label for="q-category">Category</label>
                                        <input type="text" id="q-category" class="form-control" required placeholder="e.g., Circuit Theory" list="category-suggestions">
                                        <datalist id="category-suggestions">
                                            ${[...new Set(QuestionService.getAllQuestions().map(q => q.category).filter(Boolean))]
                                                .map(c => `<option value="${UI.escapeHtml(c)}"></option>`).join('')}
                                        </datalist>
                                    </div>
                                    <div class="form-group">
                                        <label for="q-marks">Marks</label>
                                        <div class="input-group">
                                            <input type="number" id="q-marks" class="form-control" required min="1" value="5">
                                            <span class="input-addon">pts</span>
                                        </div>
                                    </div>
                                </div>

                                <div class="form-group">
                                    <label for="q-text">Question</label>
                                    <textarea id="q-text" class="form-control" required rows="4" placeholder="Type the question here..."></textarea>
                                    <span class="form-hint">Math is supported: use <code>$...$</code> for inline and <code>$$...$$</code> for block equations.</span>
                                </div>
                            </div>

                            <div class="form-section">
                                <div class="form-section-title">Answer</div>
                                <!-- Dynamic Options Container -->
                                <div id="dynamic-options-container">
                                    <!-- Filled via JS based on type -->
                                </div>

                                <div class="form-group">
                                    <label for="q-explanation">Explanation / Solution <span class="text-muted" style="font-weight: 400;">(optional)</span></label>
                                    <textarea id="q-explanation" class="form-control" rows="3" placeholder="Shown to the quiz master alongside the answer key"></textarea>
                                </div>
                            </div>

                            <div class="form-footer">
                                <button type="button" class="btn btn-secondary" onclick="window.history.back()">Cancel</button>
                                <button type="submit" class="btn btn-secondary" data-next="add">Save & Add Another</button>
                                <button type="submit" class="btn btn-primary" data-next="list">${UI.icon('check')} Save Question</button>
                            </div>
                        </form>
                    </div>
                </div>
            `;

            container.innerHTML = html;

            const form = document.getElementById('add-question-form');
            const dynamicContainer = document.getElementById('dynamic-options-container');
            const marksInput = document.getElementById('q-marks');
            const settings = window.QuizBowl.Data.SettingsDB.getSettings();
            const getType = () => form.querySelector('input[name="q-type"]:checked').value;

            const renderDynamicFields = () => {
                const type = getType();
                let fields = '';

                if (type === 'mcq') {
                    fields = `
                        <div class="form-group">
                            <label class="form-label">Options <span class="form-hint" style="display: inline; margin-left: 0.25rem;">— click a letter to mark the correct answer</span></label>
                            <div class="mcq-options">
                                ${['A', 'B', 'C', 'D'].map((letter, i) => `
                                    <div class="mcq-option-row">
                                        <label title="Mark ${letter} as correct">
                                            <input type="radio" name="q-correct" value="${letter}" ${i === 0 ? 'checked' : ''}>
                                            <span class="mcq-letter">${letter}</span>
                                        </label>
                                        <input type="text" id="opt-${letter}" class="form-control" placeholder="Option ${letter}" required aria-label="Option ${letter}">
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    `;
                } else if (type === 'calculation') {
                    fields = `
                        <div class="form-row">
                            <div class="form-group">
                                <label for="q-expected">Expected Numerical Answer</label>
                                <input type="text" id="q-expected" class="form-control" required placeholder="e.g., 4.7">
                            </div>
                            <div class="form-group">
                                <label for="q-unit">Unit <span class="text-muted" style="font-weight: 400;">(optional)</span></label>
                                <input type="text" id="q-unit" class="form-control" placeholder="e.g., kΩ">
                            </div>
                        </div>
                    `;
                } else if (type === 'theory') {
                    fields = `
                        <div class="form-group">
                            <label for="q-expected">Expected Key Phrases / Answer</label>
                            <textarea id="q-expected" class="form-control" required rows="3"></textarea>
                        </div>
                    `;
                } else if (type === 'true_false') {
                    fields = `
                        <div class="form-group">
                            <span class="form-label">Correct Answer</span>
                            <div class="result-options" style="grid-template-columns: repeat(2, 1fr); max-width: 320px;">
                                <label class="result-option"><input type="radio" name="q-correct" value="True" checked><span>True</span></label>
                                <label class="result-option"><input type="radio" name="q-correct" value="False"><span>False</span></label>
                            </div>
                        </div>
                    `;
                }

                dynamicContainer.innerHTML = fields;

                // Set default marks based on type
                if (type === 'mcq') marksInput.value = settings.mcqMarks;
                else if (type === 'calculation') marksInput.value = settings.calculationMarks;
                else if (type === 'theory') marksInput.value = settings.theoryMarks;
                else if (type === 'true_false') marksInput.value = settings.true_falseMarks;

                document.getElementById('next-id').textContent = QuestionService.generateIdForType(type);
            };

            form.querySelectorAll('input[name="q-type"]').forEach(r => r.addEventListener('change', renderDynamicFields));
            renderDynamicFields(); // initial render

            form.addEventListener('submit', (e) => {
                e.preventDefault();

                // Custom validation so the first empty field gets focus with a clear message
                const invalid = [...form.querySelectorAll('[required]')].find(el => !el.value.trim());
                if (invalid) {
                    invalid.focus();
                    window.QuizBowl.Components.Toast.show('Please fill in all required fields.', 'warning');
                    return;
                }

                try {
                    const type = getType();
                    const question = {
                        type: type,
                        category: document.getElementById('q-category').value.trim(),
                        topic: "", // simplified
                        difficulty: "medium", // default for now
                        marks: parseInt(marksInput.value, 10) || 1,
                        question: document.getElementById('q-text').value.trim(),
                        explanation: document.getElementById('q-explanation').value.trim(),
                        status: 'available',
                        keywords: []
                    };

                    if (type === 'mcq') {
                        question.options = {
                            "A": document.getElementById('opt-A').value.trim(),
                            "B": document.getElementById('opt-B').value.trim(),
                            "C": document.getElementById('opt-C').value.trim(),
                            "D": document.getElementById('opt-D').value.trim()
                        };
                        question.correctAnswer = form.querySelector('input[name="q-correct"]:checked').value;
                    } else if (type === 'calculation' || type === 'theory') {
                        question.expectedAnswer = document.getElementById('q-expected').value.trim();
                        if (type === 'calculation') question.unit = document.getElementById('q-unit').value.trim();
                    } else if (type === 'true_false') {
                        question.correctAnswer = form.querySelector('input[name="q-correct"]:checked').value;
                    }

                    QuestionService.addQuestion(question);
                    window.QuizBowl.Components.Toast.show(`Question ${question.id} saved.`, 'success');

                    if (e.submitter && e.submitter.getAttribute('data-next') === 'add') {
                        // Keep type and category, clear the rest for fast data entry
                        const category = question.category;
                        form.reset();
                        form.querySelector(`input[name="q-type"][value="${type}"]`).checked = true;
                        document.getElementById('q-category').value = category;
                        renderDynamicFields();
                        document.getElementById('q-text').focus();
                    } else {
                        window.QuizBowl.Router.navigate('questions');
                    }
                } catch (err) {
                    window.QuizBowl.Components.Toast.show(err.message, 'danger');
                }
            });
        }
    };
})();
