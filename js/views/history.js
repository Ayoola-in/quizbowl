/**
 * js/views/history.js
 * Quiz History View
 */
(function() {
    window.QuizBowl.Views.History = {
        render: function(container) {
            const HistoryDB = window.QuizBowl.Data.HistoryDB;
            const events = HistoryDB.getAll();
            
            const html = `
                <div class="history-view">
                    <div class="questions-header">
                        <h1>Quiz History</h1>
                        <button class="btn" style="background: var(--bg-surface); border: 1px solid var(--border-color);" onclick="window.QuizBowl.Views.History.clearHistory()">
                            Clear History
                        </button>
                    </div>

                    <div class="dashboard-section">
                        <table style="width: 100%; border-collapse: collapse;">
                            <thead>
                                <tr style="border-bottom: 2px solid var(--border-color); text-align: left;">
                                    <th style="padding: 0.75rem 0;">Time</th>
                                    <th style="padding: 0.75rem 0;">Question</th>
                                    <th style="padding: 0.75rem 0;">Team</th>
                                    <th style="padding: 0.75rem 0;">Result</th>
                                    <th style="padding: 0.75rem 0;">Marks</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${events.map(e => `
                                    <tr style="border-bottom: 1px solid var(--border-color);">
                                        <td style="padding: 0.75rem 0; color: var(--text-muted); font-size: 0.85rem;">
                                            ${new Date(e.timestamp).toLocaleTimeString()}
                                        </td>
                                        <td style="padding: 0.75rem 0; font-weight: 500; max-width: 300px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                                            ${e.questionId} - ${e.questionText.replace(/<[^>]+>/g, '')}
                                        </td>
                                        <td style="padding: 0.75rem 0;">${e.teamName}</td>
                                        <td style="padding: 0.75rem 0;">
                                            <span class="badge ${e.result === 'correct' ? 'badge-available' : e.result === 'wrong' ? 'badge-answered' : 'badge-disabled'}">
                                                ${e.result.toUpperCase()}
                                            </span>
                                        </td>
                                        <td style="padding: 0.75rem 0; font-weight: bold; color: var(--color-accent);">
                                            +${e.marksAwarded}
                                        </td>
                                    </tr>
                                `).join('') || `<tr><td colspan="5" style="padding: 2rem 0; color: var(--text-muted); text-align: center;">No history recorded yet.</td></tr>`}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
            
            container.innerHTML = html;
        },
        
        clearHistory: function() {
            if(confirm("Are you sure you want to clear all history? This does not reset team scores.")) {
                window.QuizBowl.Data.HistoryDB.clear();
                window.QuizBowl.Components.Toast.show("History cleared.", "info");
                window.QuizBowl.Views.History.render(document.getElementById('view-container'));
            }
        }
    };

    window.QuizBowl.Router.routes['history'] = () => {
        window.QuizBowl.Views.History.render(document.getElementById('view-container'));
    };
})();
