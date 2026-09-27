/**
 * js/views/dashboard.js
 * Dashboard View Implementation
 */
(function() {
    window.QuizBowl.Views.Dashboard = {
        render: function(container) {
            const QuestionService = window.QuizBowl.Services.QuestionService;
            const TeamService = window.QuizBowl.Services.TeamService;
            const UI = window.QuizBowl.Utils.UI;

            const stats = QuestionService.getDashboardStats();
            const teams = TeamService.getAllTeams();
            const events = window.QuizBowl.Data.HistoryDB.getAll().slice(0, 6);
            const progress = stats.total > 0 ? Math.round((stats.answered / stats.total) * 100) : 0;

            // Calculate max score for bar graph
            const maxScore = teams.length > 0 ? Math.max(...teams.map(t => t.score)) : 1;
            const safeMaxScore = maxScore > 0 ? maxScore : 1; // prevent division by zero

            const leaderboardHTML = teams.length ? `
                <ol class="leaderboard">
                    ${teams.map((t, i) => {
                        const width = Math.max(0, (t.score / safeMaxScore) * 100);
                        const color = UI.teamColor(t);
                        return `
                            <li>
                                <span class="rank ${i < 3 && t.score > 0 ? 'rank-' + (i + 1) : ''}">${i + 1}</span>
                                <span class="team-name"><span class="team-dot" style="background: ${color};"></span>${UI.escapeHtml(t.name)}</span>
                                <div class="bar"><div class="bar-fill" style="width: ${width}%; background: ${color};"></div></div>
                                <span class="score">${t.score}</span>
                            </li>
                        `;
                    }).join('')}
                </ol>
            ` : UI.emptyState('teams', 'No teams yet', 'Register teams to start tracking scores.',
                `<a href="#teams" class="btn btn-primary btn-sm">${UI.icon('plus')} Add Team</a>`);

            const activityHTML = events.length ? `
                <ul class="activity-feed">
                    ${events.map(e => {
                        const team = window.QuizBowl.Data.TeamsDB.getById(e.teamId);
                        return `
                            <li class="activity-item">
                                <span class="team-dot" style="background: ${UI.teamColor(team)};"></span>
                                <div class="activity-body">
                                    <p><strong>${UI.escapeHtml(e.teamName)}</strong> answered
                                        <a href="#question/${encodeURIComponent(e.questionId)}"><strong>${UI.escapeHtml(e.questionId)}</strong></a>
                                        <span class="badge badge-${e.result}" style="margin-left: 0.25rem;">${UI.escapeHtml(e.result)}</span>
                                    </p>
                                    <span class="activity-time">${UI.timeAgo(e.timestamp)}</span>
                                </div>
                                <span class="activity-marks ${e.marksAwarded ? '' : 'zero'}">+${e.marksAwarded}</span>
                            </li>
                        `;
                    }).join('')}
                </ul>
            ` : UI.emptyState('history', 'No activity yet', 'Scored questions will appear here as the quiz progresses.');

            const html = `
                <div class="dashboard">
                    <div class="page-header">
                        <div>
                            <h1>Dashboard</h1>
                            <p>Live overview of the competition.</p>
                        </div>
                        <div class="page-actions">
                            <a href="#add-question" class="btn btn-secondary">${UI.icon('plus')} Add Question</a>
                            <a href="#questions" class="btn btn-primary">${UI.icon('questions')} Open Question Bank</a>
                        </div>
                    </div>

                    <div class="dashboard-grid">
                        <a href="#questions" class="stat-card">
                            <div>
                                <h3>Total Questions</h3>
                                <div class="stat-value">${stats.total}</div>
                                <div class="stat-meta">In the question bank</div>
                            </div>
                            <span class="stat-icon accent">${UI.icon('questions')}</span>
                        </a>
                        <div class="stat-card">
                            <div>
                                <h3>Available</h3>
                                <div class="stat-value">${stats.available}</div>
                                <div class="stat-meta">Ready to be asked</div>
                            </div>
                            <span class="stat-icon success">${UI.icon('checkCircle')}</span>
                        </div>
                        <a href="#history" class="stat-card">
                            <div>
                                <h3>Answered</h3>
                                <div class="stat-value">${stats.answered}</div>
                                <div class="stat-meta">${progress}% of the bank used</div>
                            </div>
                            <span class="stat-icon muted">${UI.icon('history')}</span>
                        </a>
                        <a href="#teams" class="stat-card">
                            <div>
                                <h3>Teams</h3>
                                <div class="stat-value">${teams.length}</div>
                                <div class="stat-meta">${teams.length && teams[0].score > 0 ? 'Leading: ' + UI.escapeHtml(teams[0].name) : 'Competing'}</div>
                            </div>
                            <span class="stat-icon info">${UI.icon('teams')}</span>
                        </a>
                    </div>

                    <div class="dashboard-section" style="margin-bottom: var(--spacing-lg);">
                        <div class="progress-summary">
                            <span><strong>Quiz progress</strong> · ${stats.answered} of ${stats.total} questions answered</span>
                            <strong>${progress}%</strong>
                        </div>
                        <div class="bar"><div class="bar-fill" style="width: ${progress}%;"></div></div>
                    </div>

                    <div class="dashboard-columns">
                        <section class="dashboard-section">
                            <div class="card-header">
                                <div>
                                    <h2>Team Leaderboard</h2>
                                    <p>Ranked by total score</p>
                                </div>
                                ${teams.length ? `<a href="#teams" class="btn btn-ghost btn-sm">Manage</a>` : ''}
                            </div>
                            ${leaderboardHTML}
                        </section>

                        <section class="dashboard-section">
                            <div class="card-header">
                                <div>
                                    <h2>Recent Activity</h2>
                                    <p>Latest scoring events</p>
                                </div>
                                ${events.length ? `<a href="#history" class="btn btn-ghost btn-sm">View all</a>` : ''}
                            </div>
                            ${activityHTML}
                        </section>
                    </div>
                </div>
            `;

            container.innerHTML = html;
        }
    };
})();
