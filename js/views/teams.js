/**
 * js/views/teams.js
 * Team Management View
 */
(function() {
    window.QuizBowl.Views.Teams = {
        render: function(container) {
            const TeamService = window.QuizBowl.Services.TeamService;
            let teams = TeamService.getAllTeams();
            
            const html = `
                <div class="teams-view">
                    <div class="questions-header">
                        <h1>Team Management</h1>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 2fr; gap: var(--spacing-xl);">
                        <!-- Add Team Form -->
                        <div class="form-container" style="margin: 0; align-self: start;">
                            <h2>Add New Team</h2>
                            <form id="add-team-form" style="margin-top: var(--spacing-md);">
                                <div class="form-group">
                                    <label for="t-name">Team Name</label>
                                    <input type="text" id="t-name" class="form-control" required placeholder="e.g., Team Alpha">
                                </div>
                                <button type="submit" class="btn btn-primary" style="width: 100%;">Add Team</button>
                            </form>
                        </div>

                        <!-- Teams List -->
                        <div class="dashboard-section">
                            <h2>Registered Teams</h2>
                            <table style="width: 100%; border-collapse: collapse; margin-top: var(--spacing-md);">
                                <thead>
                                    <tr style="border-bottom: 2px solid var(--border-color); text-align: left;">
                                        <th style="padding: 0.5rem 0;">ID</th>
                                        <th style="padding: 0.5rem 0;">Name</th>
                                        <th style="padding: 0.5rem 0;">Questions Answered</th>
                                        <th style="padding: 0.5rem 0;">Score</th>
                                        <th style="padding: 0.5rem 0;">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${teams.map(t => `
                                        <tr style="border-bottom: 1px solid var(--border-color);">
                                            <td style="padding: 0.75rem 0; color: var(--text-muted); font-size: 0.8rem;">${t.id}</td>
                                            <td style="padding: 0.75rem 0; font-weight: 500;">${t.name}</td>
                                            <td style="padding: 0.75rem 0;">${t.questionsAnswered}</td>
                                            <td style="padding: 0.75rem 0; font-weight: bold; color: var(--color-accent);">${t.score}</td>
                                            <td style="padding: 0.75rem 0;">
                                                <button class="btn" style="background: var(--color-danger); color: white; padding: 0.25rem 0.5rem; font-size: 0.75rem;" onclick="window.QuizBowl.Views.Teams.deleteTeam('${t.id}')">Delete</button>
                                            </td>
                                        </tr>
                                    `).join('') || `<tr><td colspan="5" style="padding: 1rem 0; color: var(--text-muted); text-align: center;">No teams found.</td></tr>`}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            `;
            
            container.innerHTML = html;

            document.getElementById('add-team-form').addEventListener('submit', (e) => {
                e.preventDefault();
                try {
                    const name = document.getElementById('t-name').value;
                    TeamService.addTeam(name);
                    window.QuizBowl.Components.Toast.show('Team added successfully', 'success');
                    window.QuizBowl.Views.Teams.render(container); // Re-render
                } catch(err) {
                    window.QuizBowl.Components.Toast.show(err.message, 'danger');
                }
            });
        },
        
        deleteTeam: function(id) {
            if(confirm('Are you sure you want to delete this team? Their score will be lost (history events remain).')) {
                window.QuizBowl.Services.TeamService.deleteTeam(id);
                window.QuizBowl.Components.Toast.show('Team deleted', 'info');
                window.QuizBowl.Views.Teams.render(document.getElementById('view-container'));
            }
        }
    };

    window.QuizBowl.Router.routes['teams'] = () => {
        window.QuizBowl.Views.Teams.render(document.getElementById('view-container'));
    };
})();
