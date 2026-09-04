/**
 * js/views/question.js
 * Individual Question View & Scoring Interface
 */
(function() {
    window.QuizBowl.Views.QuestionDetail = {
        render: function(container, id) {
            const question = window.QuizBowl.Services.QuestionService.getQuestion(id);
            if (!question) {
                container.innerHTML = `<div style="padding: 2rem; color: var(--color-danger);">Error: Question ${id} not found.</div>`;
                return;
            }

            const isAnswered = question.status === 'answered';
            
            let optionsHtml = '';
            if (question.type === 'mcq' && question.options) {
                optionsHtml = `
                    <div style="margin-top: var(--spacing-lg); display: grid; gap: var(--spacing-sm);">
                        ${Object.entries(question.options).map(([key, val]) => `
                            <div style="padding: var(--spacing-md); border: 1px solid var(--border-color); border-radius: var(--border-radius); background: var(--bg-main);">
                                <strong>${key}:</strong> ${val}
                            </div>
                        `).join('')}
                    </div>
                `;
            }

            const html = `
                <div class="question-detail-view" style="max-width: 900px; margin: 0 auto;">
                    <div class="questions-header">
                        <div>
                            <button class="btn" style="background: var(--bg-surface); border: 1px solid var(--border-color); margin-bottom: var(--spacing-md);" onclick="window.history.back()">← Back</button>
                            <h1 style="display: flex; align-items: center; gap: var(--spacing-sm);">
                                Question ${question.id}
                                <span class="badge badge-${question.status}">${question.status.toUpperCase()}</span>
                            </h1>
                        </div>
                    </div>

                    ${isAnswered ? `
                        <div style="background: rgba(239, 68, 68, 0.1); border-left: 4px solid var(--color-danger); padding: var(--spacing-md); margin-bottom: var(--spacing-lg); border-radius: 0 var(--border-radius) var(--border-radius) 0;">
                            <h3 style="color: var(--color-danger); margin-bottom: 0.25rem;">⚠️ QUESTION ALREADY ANSWERED</h3>
                            <p>Answered by: <strong>Team ${question.answeredBy}</strong></p>
                        </div>
                    ` : ''}

                    <div style="background: var(--bg-surface); padding: var(--spacing-xl); border-radius: var(--border-radius); box-shadow: var(--shadow-sm); border: 1px solid var(--border-color); margin-bottom: var(--spacing-lg);">
                        <div style="font-size: 1.25rem; font-weight: 500; line-height: 1.6; margin-bottom: var(--spacing-lg);">
                            ${question.question}
                        </div>
                        
                        ${optionsHtml}
                    </div>

                    <!-- Administrator View (Hidden in Display Mode) -->
                    <div class="admin-controls" style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--spacing-lg);">
                        
                        <div style="background: var(--bg-surface); padding: var(--spacing-lg); border-radius: var(--border-radius); border: 1px solid var(--border-color);">
                            <h3 style="margin-bottom: var(--spacing-md); color: var(--color-primary);">Answer Key</h3>
                            ${question.correctAnswer ? `<p style="margin-bottom: var(--spacing-sm);"><strong>Correct Answer:</strong> <span style="color: var(--color-success); font-weight: bold; font-size: 1.1rem;">${question.correctAnswer}</span></p>` : ''}
                            ${question.expectedAnswer ? `<p style="margin-bottom: var(--spacing-sm);"><strong>Expected Answer:</strong> ${question.expectedAnswer} ${question.unit ? question.unit : ''}</p>` : ''}
                            <p><strong>Explanation:</strong></p>
                            <div style="background: var(--bg-main); padding: var(--spacing-sm); border-radius: var(--border-radius-sm); margin-top: var(--spacing-xs); font-size: 0.9rem;">
                                ${question.explanation || 'No explanation provided.'}
                            </div>
                        </div>

                        <div style="background: var(--bg-surface); padding: var(--spacing-lg); border-radius: var(--border-radius); border: 1px solid var(--border-color);">
                            <h3 style="margin-bottom: var(--spacing-md); color: var(--color-primary);">Scoring</h3>
                            
                            ${!isAnswered ? `
                                <div class="form-group">
                                    <label>Select Team</label>
                                    <select id="score-team" class="form-control">
                                        <option value="">-- Choose Team --</option>
                                        ${window.QuizBowl.Services.TeamService.getAllTeams().map(t => `<option value="${t.id}">${t.name}</option>`).join('')}
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label>Result</label>
                                    <select id="score-result" class="form-control">
                                        <option value="correct">Correct</option>
                                        <option value="partial">Partially Correct</option>
                                        <option value="wrong">Wrong</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label>Marks Awarded (Max: ${question.marks})</label>
                                    <input type="number" id="score-marks" class="form-control" value="${question.marks}" min="0" max="${question.marks}">
                                </div>
                                <button class="btn btn-primary" id="btn-submit-score" style="width: 100%; margin-top: var(--spacing-sm);">Submit Score</button>
                            ` : `
                                <p style="color: var(--text-muted);">This question has already been scored.</p>
                                <button class="btn" id="btn-reset-status" style="width: 100%; margin-top: var(--spacing-md); background: var(--bg-main); border: 1px solid var(--border-color);">Reset Question Status</button>
                            `}
                        </div>
                    </div>
                </div>
            `;
            
            container.innerHTML = html;

            // Render math
            if (window.MathJax) {
                MathJax.typesetPromise([container]).catch(err => console.log(err));
            }

            // Bind scoring events
            if (!isAnswered) {
                document.getElementById('btn-submit-score').addEventListener('click', () => {
                    const teamId = document.getElementById('score-team').value;
                    const result = document.getElementById('score-result').value;
                    const marks = parseInt(document.getElementById('score-marks').value, 10);

                    if (!teamId) {
                        window.QuizBowl.Components.Toast.show("Please select a team.", "warning");
                        return;
                    }

                    try {
                        window.QuizBowl.Services.ScoringService.awardMarks(question.id, teamId, marks, result);
                        window.QuizBowl.Components.Toast.show("Score submitted successfully!", "success");
                        // Rerender view
                        window.QuizBowl.Views.QuestionDetail.render(container, id);
                    } catch (err) {
                        window.QuizBowl.Components.Toast.show(err.message, "danger");
                    }
                });
            } else {
                document.getElementById('btn-reset-status').addEventListener('click', () => {
                    if (confirm("Resetting will make this question available again, but will NOT subtract points from the team that answered it. Proceed?")) {
                        window.QuizBowl.Data.QuestionsDB.resetStatus(question.id);
                        window.QuizBowl.Components.Toast.show("Question status reset to available.", "info");
                        window.QuizBowl.Views.QuestionDetail.render(container, id);
                    }
                });
            }
        }
    };

    // Dynamic routing for question details
    // Note: The router needs a slight update to handle dynamic segments. We'll handle it inside the router handleRoute function.
})();
