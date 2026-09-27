/**
 * js/views/history.js
 * Quiz History View
 */
(function() {
    let resultFilter = 'all';

    window.QuizBowl.Views.History = {
        render: function(container) {
            const UI = window.QuizBowl.Utils.UI;
            const TeamsDB = window.QuizBowl.Data.TeamsDB;
            const allEvents = window.QuizBowl.Data.HistoryDB.getAll();
            const events = resultFilter === 'all' ? allEvents : allEvents.filter(e => e.result === resultFilter);
            const countOf = (result) => allEvents.filter(e => e.result === result).length;
            const totalMarks = allEvents.reduce((sum, e) => sum + (e.marksAwarded || 0), 0);

            const tabs = [
                { value: 'all', label: 'All', count: allEvents.length },
                { value: 'correct', label: 'Correct', count: countOf('correct') },
                { value: 'partial', label: 'Partial', count: countOf('partial') },
                { value: 'wrong', label: 'Wrong', count: countOf('wrong') }
            ];

            const html = `
                <div class="history-view">
                    <div class="page-header">
                        <div>
                            <h1>Quiz History</h1>
                            <p>${allEvents.length} scoring event${allEvents.length === 1 ? '' : 's'} · ${totalMarks} points awarded in total</p>
                        </div>
                        ${allEvents.length ? `
                            <div class="page-actions">
                                <button class="btn btn-danger-ghost" onclick="window.QuizBowl.Views.History.clearHistory()">
                                    ${UI.icon('trash')} Clear History
                                </button>
                            </div>
                        ` : ''}
                    </div>

                    ${allEvents.length ? `
                        <div class="history-summary">
                            <div class="segmented" id="history-filter" role="tablist" aria-label="Filter by result">
                                ${tabs.map(t => `
                                    <button type="button" role="tab" data-value="${t.value}" class="${resultFilter === t.value ? 'active' : ''}" aria-selected="${resultFilter === t.value}">
                                        ${t.label}<span class="count">${t.count}</span>
                                    </button>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}

                    <section class="card card-flush">
                        ${events.length ? `
                            <div class="table-wrap">
                                <table class="table">
                                    <thead>
                                        <tr>
                                            <th>Time</th>
                                            <th>Question</th>
                                            <th>Team</th>
                                            <th>Result</th>
                                            <th class="num">Marks</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${events.map(e => {
                                            const team = TeamsDB.getById(e.teamId);
                                            const date = new Date(e.timestamp);
                                            return `
                                                <tr>
                                                    <td class="history-time">
                                                        ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        <small>${date.toLocaleDateString()}</small>
                                                    </td>
                                                    <td>
                                                        <div class="history-question" title="${UI.escapeHtml(UI.stripHtml(e.questionText))}">
                                                            <a href="#question/${encodeURIComponent(e.questionId)}"><code>${UI.escapeHtml(e.questionId)}</code></a>${UI.escapeHtml(UI.stripHtml(e.questionText))}
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <span class="team-name"><span class="team-dot" style="background: ${UI.teamColor(team)};"></span>${UI.escapeHtml(e.teamName)}</span>
                                                    </td>
                                                    <td><span class="badge badge-${e.result}">${UI.escapeHtml(e.result)}</span></td>
                                                    <td class="num" style="font-weight: 700; color: ${e.marksAwarded ? 'var(--color-success)' : 'var(--text-muted)'};">
                                                        +${e.marksAwarded}
                                                    </td>
                                                </tr>
                                            `;
                                        }).join('')}
                                    </tbody>
                                </table>
                            </div>
                        ` : `<div style="padding: var(--spacing-lg);">${
                            allEvents.length
                                ? UI.emptyState('search', 'No matching events', 'No events with this result yet.')
                                : UI.emptyState('history', 'No history recorded yet', 'Every scored question will be logged here.',
                                    `<a href="#questions" class="btn btn-primary btn-sm">Go to Question Bank</a>`)
                        }</div>`}
                    </section>
                </div>
            `;

            container.innerHTML = html;

            const filter = document.getElementById('history-filter');
            if (filter) {
                filter.addEventListener('click', (e) => {
                    const btn = e.target.closest('button[data-value]');
                    if (!btn) return;
                    resultFilter = btn.getAttribute('data-value');
                    this.render(container);
                });
            }
        },

        clearHistory: async function() {
            const confirmed = await window.QuizBowl.Components.Modal.confirm({
                title: 'Clear all history?',
                message: 'The event log will be emptied. Team scores and question statuses are not changed.',
                confirmText: 'Clear History',
                danger: true
            });
            if (confirmed) {
                window.QuizBowl.Data.HistoryDB.clear();
                window.QuizBowl.Components.Toast.show("History cleared.", "info");
                window.QuizBowl.Views.History.render(document.getElementById('view-container'));
            }
        }
    };
})();
