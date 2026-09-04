/**
 * js/views/dashboard.js
 * Dashboard View Implementation
 */
(function() {
    window.QuizBowl.Views.Dashboard = {
        render: function(container) {
            const QuestionService = window.QuizBowl.Services.QuestionService;
            const TeamService = window.QuizBowl.Services.TeamService;
            
            const stats = QuestionService.getDashboardStats();
            const teams = TeamService.getAllTeams();
            
            // Build recent activity (mocked until history is fully implemented)
            const recentActivityHTML = `<p class="text-muted">No recent activity.</p>`;

            const html = `
                <div class="dashboard">
                    <h1 style="margin-bottom: 1.5rem;">Dashboard</h1>
                    
                    <div class="dashboard-grid">
                        <div class="stat-card">
                            <h3>Total Questions</h3>
                            <div class="stat-value">${stats.total}</div>
                        </div>
                        <div class="stat-card">
                            <h3>Available</h3>
                            <div class="stat-value" style="color: var(--color-success)">${stats.available}</div>
                        </div>
                        <div class="stat-card">
                            <h3>Answered</h3>
                            <div class="stat-value" style="color: var(--color-danger)">${stats.answered}</div>
                        </div>
                        <div class="stat-card">
                            <h3>Teams</h3>
                            <div class="stat-value" style="color: var(--color-info)">${teams.length}</div>
                        </div>
                    </div>

                    <div class="dashboard-grid" style="grid-template-columns: 1fr 1fr;">
                        <div class="dashboard-section">
                            <h2>Team Leaderboard</h2>
                            <table style="width: 100%; border-collapse: collapse;">
                                <thead>
                                    <tr style="border-bottom: 2px solid var(--border-color); text-align: left;">
                                        <th style="padding: 0.5rem 0;">Team</th>
                                        <th style="padding: 0.5rem 0;">Score</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${teams.map(t => `
                                        <tr style="border-bottom: 1px solid var(--border-color);">
                                            <td style="padding: 0.75rem 0; font-weight: 500;">${t.name}</td>
                                            <td style="padding: 0.75rem 0; color: var(--color-accent); font-weight: 700;">${t.score}</td>
                                        </tr>
                                    `).join('') || `<tr><td colspan="2" style="padding: 1rem 0; color: var(--text-muted);">No teams registered.</td></tr>`}
                                </tbody>
                            </table>
                        </div>

                        <div class="dashboard-section">
                            <h2>Recent Activity</h2>
                            <div class="activity-feed">
                                ${recentActivityHTML}
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            container.innerHTML = html;
        }
    };

    // Link it to the router
    window.QuizBowl.Router.routes['dashboard'] = () => {
        window.QuizBowl.Views.Dashboard.render(document.getElementById('view-container'));
    };
})();
