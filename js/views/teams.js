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
                                <div class="form-group" style="margin-top: 1rem;">
                                    <label for="t-color">Team Color</label>
                                    <select id="t-color" class="form-control" style="cursor: pointer;">
                                        <option value="#ef4444">Red</option>
                                        <option value="#3b82f6">Blue</option>
                                        <option value="#22c55e">Green</option>
                                        <option value="#eab308">Yellow</option>
                                        <option value="#a855f7">Purple</option>
                                        <option value="#f97316">Orange</option>
                                        <option value="#ec4899">Pink</option>
                                        <option value="#14b8a6">Teal</option>
                                        <option value="#6366f1">Indigo</option>
                                        <option value="#06b6d4">Cyan</option>
                                    </select>
                                </div>
                                <button type="submit" class="btn btn-primary" style="width: 100%;">Add Team</button>
                            </form>
                        </div>

                        <!-- Teams List -->
                        <div class="dashboard-section">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <h2>Registered Teams</h2>
                                <button class="btn" style="background: var(--color-danger); color: white;" onclick="window.QuizBowl.Views.Teams.resetAllScores()">Reset All Scores</button>
                            </div>
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
                                            <td style="padding: 0.75rem 0; font-weight: 500; display: flex; align-items: center; gap: 0.5rem;">
                                                <div style="width: 16px; height: 16px; border-radius: 50%; background-color: ${t.color || '#3b82f6'};"></div>
                                                ${t.name}
                                            </td>
                                            <td style="padding: 0.75rem 0;">${t.questionsAnswered}</td>
                                            <td style="padding: 0.75rem 0; font-weight: bold; color: var(--color-accent); display: flex; align-items: center; gap: 0.5rem;">
                                                ${t.score}
                                                <div style="display: flex; gap: 0.25rem;">
                                                    <button class="btn" style="padding: 0.1rem 0.4rem; font-size: 0.8rem; background: var(--bg-surface); border: 1px solid var(--border-color);" onclick="window.QuizBowl.Views.Teams.adjustScore('${t.id}', 1)" title="Add score">+</button>
                                                    <button class="btn" style="padding: 0.1rem 0.4rem; font-size: 0.8rem; background: var(--bg-surface); border: 1px solid var(--border-color);" onclick="window.QuizBowl.Views.Teams.adjustScore('${t.id}', -1)" title="Subtract score">-</button>
                                                </div>
                                            </td>
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
                const name = document.getElementById('t-name').value;
                const color = document.getElementById('t-color').value;
                
                try {
                    TeamService.addTeam(name, color);
                    window.QuizBowl.Components.Toast.show('Team added successfully!', 'success');
                    window.QuizBowl.Views.Teams.render(container); // Re-render
                } catch (error) {
                    window.QuizBowl.Components.Toast.show(error.message, 'error');
                }
            });
        },
        
        deleteTeam: function(id) {
            if(confirm('Are you sure you want to delete this team? Their score will be lost (history events remain).')) {
                window.QuizBowl.Services.TeamService.deleteTeam(id);
                window.QuizBowl.Components.Toast.show('Team deleted', 'info');
                window.QuizBowl.Views.Teams.render(document.getElementById('view-container'));
            }
        },
        
        adjustScore: function(id, direction) {
            const val = prompt(`Enter points to ${direction > 0 ? 'add' : 'subtract'}:`, '0');
            if (val !== null) {
                const marks = parseInt(val, 10);
                if (!isNaN(marks) && marks !== 0) {
                    const finalMarks = direction > 0 ? Math.abs(marks) : -Math.abs(marks);
                    window.QuizBowl.Services.TeamService.updateScore(id, finalMarks);
                    window.QuizBowl.Components.Toast.show(`Score adjusted by ${finalMarks}`, 'success');
                    window.QuizBowl.Views.Teams.render(document.getElementById('view-container'));
                }
            }
        },
        
        resetAllScores: function() {
            if(confirm('Are you sure you want to reset all team scores to 0?')) {
                window.QuizBowl.Services.TeamService.resetAllScores();
                window.QuizBowl.Components.Toast.show('All team scores have been reset to 0', 'success');
                window.QuizBowl.Views.Teams.render(document.getElementById('view-container'));
            }
        }
    };

    window.QuizBowl.Router.routes['teams'] = () => {
        window.QuizBowl.Views.Teams.render(document.getElementById('view-container'));
    };
})();
