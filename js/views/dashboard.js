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
            
            // Calculate max score for bar graph
            const maxScore = teams.length > 0 ? Math.max(...teams.map(t => t.score)) : 1;
            const safeMaxScore = maxScore > 0 ? maxScore : 1; // prevent division by zero
            
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
                                    ${teams.map(t => {
                                        const width = Math.max(0, (t.score / safeMaxScore) * 100);
                                        return `
                                        <tr style="border-bottom: 1px solid var(--border-color);">
                                            <td style="padding: 0.75rem 0; font-weight: 500; display: flex; align-items: center; gap: 0.5rem;">
                                                <div style="width: 12px; height: 12px; border-radius: 50%; background-color: ${t.color || '#3b82f6'};"></div>
                                                ${t.name}
                                            </td>
                                            <td style="padding: 0.75rem 0;">
                                                <div style="display: flex; align-items: center; gap: 1rem; width: 100%;">
                                                    <div style="flex: 1; height: 12px; background: var(--bg-main); border-radius: 6px; overflow: hidden;">
                                                        <div style="width: ${width}%; height: 100%; background-color: ${t.color || '#3b82f6'}; transition: width 0.3s ease;"></div>
                                                    </div>
                                                    <span style="color: var(--color-accent); font-weight: 700; min-width: 40px; text-align: right;">${t.score}</span>
                                                </div>
                                            </td>
                                        </tr>
                                    `}).join('') || `<tr><td colspan="2" style="padding: 1rem 0; color: var(--text-muted);">No teams registered.</td></tr>`}
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
