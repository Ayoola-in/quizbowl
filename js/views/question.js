/**
 * js/views/question.js
 * Individual Question View & Scoring Interface
 */
(function() {
    window.QuizBowl.Views.QuestionDetail = {
        render: function(container, id) {
            const UI = window.QuizBowl.Utils.UI;
            const question = window.QuizBowl.Services.QuestionService.getQuestion(id);
            if (!question) {
                container.innerHTML = `
                    <div class="card">
                        ${UI.emptyState('search', `Question ${UI.escapeHtml(id || '')} not found`,
                            'It may have been deleted or renumbered.',
                            `<a href="#questions" class="btn btn-primary">Back to Question Bank</a>`)}
                    </div>
                `;
                return;
            }

            const isAnswered = question.status === 'answered';
            const teams = window.QuizBowl.Services.TeamService.getAllTeams();
            const answeredTeam = isAnswered ? window.QuizBowl.Data.TeamsDB.getById(question.answeredBy) : null;

            let optionsHtml = '';
            if (question.type === 'mcq' && question.options) {
                optionsHtml = `
                    <div class="qd-options">
                        ${Object.entries(question.options).map(([key, val]) => `
                            <div class="qd-option">
                                <span class="mcq-letter">${key}</span>
                                <span>${val}</span>
                            </div>
                        `).join('')}
                    </div>
                `;
            }

            let correctAnswerText = question.correctAnswer;
            if (question.type === 'mcq' && question.options && question.options[question.correctAnswer]) {
                correctAnswerText = `${question.correctAnswer} — ${question.options[question.correctAnswer]}`;
            }

            const html = `
                <div class="question-detail-view">
                    <button class="back-link" onclick="window.history.back()">${UI.icon('back')} Back</button>
                    <div class="page-header">
                        <div>
                            <h1 class="qd-title">
                                Question ${UI.escapeHtml(question.id)}
                                ${UI.statusBadge(question.status)}
                            </h1>
                            <div class="qd-meta">
                                ${UI.typeChip(question.type)}
                                <span>${UI.escapeHtml(question.category || 'Uncategorised')}</span>
                                <span class="sep">•</span>
                                <strong style="color: var(--text-primary);">${question.marks} pts</strong>
                            </div>
                        </div>
                        <div class="page-actions">
                            <button class="btn btn-danger-ghost" id="btn-delete-question">${UI.icon('trash')} Delete</button>
                        </div>
                    </div>

                    ${isAnswered ? `
                        <div class="callout callout-warning" style="margin-bottom: var(--spacing-lg);">
                            ${UI.icon('alert')}
                            <div>
                                <strong>This question has already been answered</strong>
                                Scored by
                                ${answeredTeam
                                    ? `<span class="team-name" style="vertical-align: middle;"><span class="team-dot" style="background: ${UI.teamColor(answeredTeam)};"></span>${UI.escapeHtml(answeredTeam.name)}</span>`
                                    : 'a team that no longer exists'}
                                ${question.answeredAt ? `<span class="text-muted">· ${UI.timeAgo(question.answeredAt)}</span>` : ''}
                            </div>
                        </div>
                    ` : ''}

                    <div class="card">
                        <div class="qd-question">
                            ${question.question}
                        </div>
                        ${optionsHtml}
                    </div>

                    <!-- Administrator View (Hidden in Display Mode) -->
                    <div class="admin-controls qd-panels">
                        <section class="card">
                            <div class="card-header">
                                <h2>Answer Key</h2>
                                <span class="badge">Admin only</span>
                            </div>
                            ${correctAnswerText ? `
                                <div class="answer-row">
                                    <span class="form-label">Correct answer</span>
                                    <div class="answer-value">${correctAnswerText}</div>
                                </div>
                            ` : ''}
                            ${question.expectedAnswer ? `
                                <div class="answer-row">
                                    <span class="form-label">Expected answer</span>
                                    <div class="answer-value">${question.expectedAnswer} ${question.unit ? UI.escapeHtml(question.unit) : ''}</div>
                                </div>
                            ` : ''}
                            <div class="answer-row">
                                <span class="form-label">Explanation</span>
                                <div class="explanation-box">
                                    ${question.explanation || '<span class="text-muted">No explanation provided.</span>'}
                                </div>
                            </div>
                        </section>

                        <section class="card">
                            <div class="card-header">
                                <h2>Scoring</h2>
                            </div>

                            ${!isAnswered ? (teams.length ? `
                                <div class="form-group">
                                    <label for="score-team">Team</label>
                                    <select id="score-team" class="form-control">
                                        <option value="">Choose a team…</option>
                                        ${teams.map(t => `<option value="${UI.escapeHtml(t.id)}">${UI.escapeHtml(t.name)} (${t.score} pts)</option>`).join('')}
                                    </select>
                                </div>
                                <div class="form-group">
                                    <span class="form-label">Result</span>
                                    <div class="result-options" id="score-result">
                                        <label class="result-option"><input type="radio" name="score-result" value="correct" checked><span>Correct</span></label>
                                        <label class="result-option"><input type="radio" name="score-result" value="partial"><span>Partial</span></label>
                                        <label class="result-option"><input type="radio" name="score-result" value="wrong"><span>Wrong</span></label>
                                    </div>
                                </div>
                                <div class="form-group">
                                    <label for="score-marks">Marks awarded</label>
                                    <div class="input-group">
                                        <input type="number" id="score-marks" class="form-control" value="${question.marks}" min="0" max="${question.marks}">
                                        <span class="input-addon">of ${question.marks}</span>
                                    </div>
                                </div>
                                <button class="btn btn-primary btn-block" id="btn-submit-score">${UI.icon('check')} Submit Score</button>
                            ` : UI.emptyState('teams', 'No teams registered', 'Add teams before scoring questions.',
                                `<a href="#teams" class="btn btn-primary btn-sm">Manage Teams</a>`)
                            ) : `
                                <p class="text-muted" style="font-size: 0.9rem;">Resetting makes the question available again and removes the awarded points from the team.</p>
                                <button class="btn btn-secondary btn-block" id="btn-reset-status" style="margin-top: var(--spacing-md);">${UI.icon('reset')} Reset Question Status</button>
                            `}
                        </section>
                    </div>
                </div>
            `;

            container.innerHTML = html;

            // Render math
            if (window.MathJax && MathJax.typesetPromise) {
                MathJax.typesetPromise([container]).catch(err => console.log(err));
            }

            const Modal = window.QuizBowl.Components.Modal;
            const Toast = window.QuizBowl.Components.Toast;

            // Bind scoring events
            const btnSubmit = document.getElementById('btn-submit-score');
            if (btnSubmit) {
                const marksInput = document.getElementById('score-marks');

                // Keep marks in sync with the chosen result
                document.getElementById('score-result').addEventListener('change', (e) => {
                    if (e.target.value === 'correct') marksInput.value = question.marks;
                    else if (e.target.value === 'wrong') marksInput.value = 0;
                    else marksInput.value = Math.ceil(question.marks / 2);
                });

                btnSubmit.addEventListener('click', () => {
                    const teamSelect = document.getElementById('score-team');
                    const teamId = teamSelect.value;
                    const result = document.querySelector('input[name="score-result"]:checked').value;
                    const marks = parseInt(marksInput.value, 10);

                    if (!teamId) {
                        Toast.show("Please select a team.", "warning");
                        teamSelect.focus();
                        return;
                    }
                    if (isNaN(marks) || marks < 0 || marks > question.marks) {
                        Toast.show(`Marks must be between 0 and ${question.marks}.`, "warning");
                        marksInput.focus();
                        return;
                    }

                    try {
                        window.QuizBowl.Services.ScoringService.awardMarks(question.id, teamId, marks, result);
                        Toast.show(`${UI.teamName(teamId)} awarded ${marks} pts.`, "success");
                        // Rerender view
                        window.QuizBowl.Views.QuestionDetail.render(container, id);
                    } catch (err) {
                        Toast.show(err.message, "danger");
                    }
                });
            }

            const btnReset = document.getElementById('btn-reset-status');
            if (btnReset) {
                btnReset.addEventListener('click', async () => {
                    const confirmed = await Modal.confirm({
                        title: 'Reset this question?',
                        message: 'It will become available again, and the points previously awarded for it will be subtracted from the team.',
                        confirmText: 'Reset',
                        icon: 'reset'
                    });
                    if (confirmed) {
                        window.QuizBowl.Services.ScoringService.resetScoreAndStatus(question.id);
                        Toast.show("Question reset and points reversed.", "info");
                        window.QuizBowl.Views.QuestionDetail.render(container, id);
                    }
                });
            }

            // Bind delete event
            document.getElementById('btn-delete-question').addEventListener('click', async () => {
                const confirmed = await Modal.confirm({
                    title: `Delete question ${question.id}?`,
                    message: 'This cannot be undone. The remaining questions of this type will be renumbered.',
                    confirmText: 'Delete',
                    danger: true
                });
                if (confirmed) {
                    window.QuizBowl.Services.QuestionService.deleteAndRenumber(question.id);
                    Toast.show("Question deleted and others renumbered.", "success");
                    window.QuizBowl.Router.navigate('questions');
                }
            });
        }
    };
})();
