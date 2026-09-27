/**
 * js/views/teams.js
 * Team Management View
 */
(function() {
    const TEAM_COLORS = [
        { value: '#ef4444', name: 'Red' },
        { value: '#3b82f6', name: 'Blue' },
        { value: '#22c55e', name: 'Green' },
        { value: '#eab308', name: 'Yellow' },
        { value: '#a855f7', name: 'Purple' },
        { value: '#f97316', name: 'Orange' },
        { value: '#ec4899', name: 'Pink' },
        { value: '#14b8a6', name: 'Teal' },
        { value: '#6366f1', name: 'Indigo' },
        { value: '#06b6d4', name: 'Cyan' }
    ];

    window.QuizBowl.Views.Teams = {
        render: function(container) {
            const TeamService = window.QuizBowl.Services.TeamService;
            const UI = window.QuizBowl.Utils.UI;
            const teams = TeamService.getAllTeams();
            const usedColors = new Set(teams.map(t => (t.color || '').toLowerCase()));
            const firstFree = TEAM_COLORS.find(c => !usedColors.has(c.value));

            const html = `
                <div class="teams-view">
                    <div class="page-header">
                        <div>
                            <h1>Teams</h1>
                            <p>Register competing teams and manage their scores.</p>
                        </div>
                    </div>

                    <div class="teams-layout">
                        <!-- Add Team Form -->
                        <section class="card hide-in-display">
                            <div class="card-header">
                                <h2>Add New Team</h2>
                            </div>
                            <form id="add-team-form">
                                <div class="form-group">
                                    <label for="t-name">Team Name</label>
                                    <input type="text" id="t-name" class="form-control" required placeholder="e.g., Team Alpha" maxlength="40" autocomplete="off">
                                </div>
                                <div class="form-group">
                                    <span class="form-label" id="t-color-label">Team Color</span>
                                    <div class="color-swatches" role="radiogroup" aria-labelledby="t-color-label">
                                        ${TEAM_COLORS.map(c => {
                                            const used = usedColors.has(c.value);
                                            return `
                                                <label class="color-swatch" title="${c.name}${used ? ' (in use)' : ''}">
                                                    <input type="radio" name="t-color" value="${c.value}" ${used ? 'disabled' : ''} ${firstFree && firstFree.value === c.value ? 'checked' : ''} aria-label="${c.name}">
                                                    <span style="background: ${c.value};"></span>
                                                </label>
                                            `;
                                        }).join('')}
                                    </div>
                                    ${!firstFree ? `<span class="form-hint">All colors are in use. Delete a team to free one up.</span>` : ''}
                                </div>
                                <button type="submit" class="btn btn-primary btn-block" ${!firstFree ? 'disabled' : ''}>${UI.icon('plus')} Add Team</button>
                            </form>
                        </section>

                        <!-- Teams List -->
                        <section class="card card-flush">
                            <div class="card-header">
                                <div>
                                    <h2>Registered Teams</h2>
                                    <p>${teams.length} team${teams.length === 1 ? '' : 's'} · sorted by score</p>
                                </div>
                                ${teams.length ? `
                                    <button class="btn btn-danger-ghost btn-sm hide-in-display" onclick="window.QuizBowl.Views.Teams.resetAllScores()">
                                        ${UI.icon('reset')} Reset All Scores
                                    </button>
                                ` : ''}
                            </div>
                            ${teams.length ? `
                                <div class="table-wrap" style="margin-top: var(--spacing-md);">
                                    <table class="table">
                                        <thead>
                                            <tr>
                                                <th>#</th>
                                                <th>Team</th>
                                                <th class="num">Answered</th>
                                                <th class="num">Score</th>
                                                <th class="hide-in-display"><span class="sr-only">Actions</span></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${teams.map((t, i) => `
                                                <tr>
                                                    <td class="text-muted" style="width: 1%;">${i + 1}</td>
                                                    <td>
                                                        <span class="team-name">
                                                            <span class="team-avatar" style="background: ${UI.teamColor(t)};">${UI.escapeHtml(UI.initials(t.name))}</span>
                                                            ${UI.escapeHtml(t.name)}
                                                        </span>
                                                    </td>
                                                    <td class="num">${t.questionsAnswered}</td>
                                                    <td class="num">
                                                        <span class="score-cell">
                                                            <button class="btn btn-secondary btn-icon btn-sm hide-in-display" onclick="window.QuizBowl.Views.Teams.adjustScore('${t.id}', -1)" title="Subtract points" aria-label="Subtract points from ${UI.escapeHtml(t.name)}">${UI.icon('minus')}</button>
                                                            <strong>${t.score}</strong>
                                                            <button class="btn btn-secondary btn-icon btn-sm hide-in-display" onclick="window.QuizBowl.Views.Teams.adjustScore('${t.id}', 1)" title="Add points" aria-label="Add points to ${UI.escapeHtml(t.name)}">${UI.icon('plus')}</button>
                                                        </span>
                                                    </td>
                                                    <td class="hide-in-display">
                                                        <div class="row-actions">
                                                            <button class="btn btn-ghost btn-icon btn-sm" onclick="window.QuizBowl.Views.Teams.deleteTeam('${t.id}')" title="Delete team" aria-label="Delete ${UI.escapeHtml(t.name)}" style="color: var(--color-danger);">${UI.icon('trash')}</button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            `).join('')}
                                        </tbody>
                                    </table>
                                </div>
                            ` : `<div style="padding: 0 var(--spacing-lg) var(--spacing-lg);">${UI.emptyState('teams', 'No teams yet', 'Use the form to register the first team.')}</div>`}
                        </section>
                    </div>
                </div>
            `;

            container.innerHTML = html;

            document.getElementById('add-team-form').addEventListener('submit', (e) => {
                e.preventDefault();
                const nameInput = document.getElementById('t-name');
                const name = nameInput.value.trim();
                const colorInput = document.querySelector('input[name="t-color"]:checked');

                if (!name) {
                    window.QuizBowl.Components.Toast.show('Please enter a team name.', 'warning');
                    nameInput.focus();
                    return;
                }
                if (teams.some(t => t.name.toLowerCase() === name.toLowerCase())) {
                    window.QuizBowl.Components.Toast.show('A team with this name already exists.', 'warning');
                    nameInput.focus();
                    return;
                }

                try {
                    TeamService.addTeam(name, colorInput ? colorInput.value : undefined);
                    window.QuizBowl.Components.Toast.show(`${name} added.`, 'success');
                    window.QuizBowl.Views.Teams.render(container); // Re-render
                    document.getElementById('t-name').focus();
                } catch (error) {
                    window.QuizBowl.Components.Toast.show(error.message, 'danger');
                }
            });
        },

        deleteTeam: async function(id) {
            const team = window.QuizBowl.Services.TeamService.getTeam(id);
            if (!team) return;
            const confirmed = await window.QuizBowl.Components.Modal.confirm({
                title: `Delete ${team.name}?`,
                message: 'Their score will be lost. Existing history entries are kept.',
                confirmText: 'Delete Team',
                danger: true
            });
            if (confirmed) {
                window.QuizBowl.Services.TeamService.deleteTeam(id);
                window.QuizBowl.Components.Toast.show(`${team.name} deleted.`, 'info');
                window.QuizBowl.Views.Teams.render(document.getElementById('view-container'));
            }
        },

        adjustScore: async function(id, direction) {
            const team = window.QuizBowl.Services.TeamService.getTeam(id);
            if (!team) return;
            const adding = direction > 0;
            const val = await window.QuizBowl.Components.Modal.prompt({
                title: `${adding ? 'Add points to' : 'Subtract points from'} ${team.name}`,
                message: `Current score: ${team.score} pts`,
                icon: adding ? 'plus' : 'minus',
                confirmText: adding ? 'Add Points' : 'Subtract Points',
                input: { label: 'Points', type: 'number', value: 1, min: 1 }
            });
            if (val === null) return;

            const marks = parseInt(val, 10);
            if (isNaN(marks) || marks === 0) {
                window.QuizBowl.Components.Toast.show('Enter a non-zero number of points.', 'warning');
                return;
            }
            const finalMarks = adding ? Math.abs(marks) : -Math.abs(marks);
            window.QuizBowl.Services.TeamService.updateScore(id, finalMarks);
            window.QuizBowl.Components.Toast.show(`${team.name}: ${finalMarks > 0 ? '+' : ''}${finalMarks} pts`, 'success');
            window.QuizBowl.Views.Teams.render(document.getElementById('view-container'));
        },

        resetAllScores: async function() {
            const confirmed = await window.QuizBowl.Components.Modal.confirm({
                title: 'Reset all team scores?',
                message: 'Every team will go back to 0 points. Question statuses and history are not changed.',
                confirmText: 'Reset Scores',
                danger: true
            });
            if (confirmed) {
                window.QuizBowl.Services.TeamService.resetAllScores();
                window.QuizBowl.Components.Toast.show('All team scores have been reset to 0.', 'success');
                window.QuizBowl.Views.Teams.render(document.getElementById('view-container'));
            }
        }
    };
})();
