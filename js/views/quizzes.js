/**
 * js/views/quizzes.js
 * Quiz Management View: create, open, rename and delete quizzes
 */
(function() {
    window.QuizBowl.Views.Quizzes = {
        render: function(container) {
            const QuizzesDB = window.QuizBowl.Data.QuizzesDB;
            const UI = window.QuizBowl.Utils.UI;
            const quizzes = QuizzesDB.getAll();
            const activeId = QuizzesDB.getActiveId();

            container.innerHTML = `
                <div class="quizzes-view">
                    <div class="page-header">
                        <div>
                            <h1>Quizzes</h1>
                            <p>Each quiz has its own questions, teams, history and settings.</p>
                        </div>
                        <button class="btn btn-primary hide-in-display" onclick="window.QuizBowl.Views.Quizzes.createQuiz()">
                            ${UI.icon('plus')} New Quiz
                        </button>
                    </div>

                    <section class="card card-flush">
                        <div class="table-wrap">
                            <table class="table">
                                <thead>
                                    <tr>
                                        <th>Quiz</th>
                                        <th class="num">Questions</th>
                                        <th class="num">Answered</th>
                                        <th class="num">Teams</th>
                                        <th>Created</th>
                                        <th class="hide-in-display"><span class="sr-only">Actions</span></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${quizzes.map(quiz => {
                                        const stats = QuizzesDB.getStats(quiz.id);
                                        const isActive = quiz.id === activeId;
                                        return `
                                            <tr class="${isActive ? 'quiz-row-active' : ''}">
                                                <td>
                                                    <strong>${UI.escapeHtml(quiz.name)}</strong>
                                                    ${isActive ? `<span class="badge badge-available" style="margin-left: 0.5rem;">Current</span>` : ''}
                                                </td>
                                                <td class="num">${stats.questions}</td>
                                                <td class="num">${stats.answered}</td>
                                                <td class="num">${stats.teams}</td>
                                                <td class="text-muted">${new Date(quiz.createdAt).toLocaleDateString()}</td>
                                                <td class="hide-in-display">
                                                    <div class="row-actions">
                                                        ${isActive ? '' : `<button class="btn btn-secondary btn-sm" onclick="window.QuizBowl.Views.Quizzes.openQuiz('${quiz.id}')">Open</button>`}
                                                        <button class="btn btn-ghost btn-sm" onclick="window.QuizBowl.Views.Quizzes.renameQuiz('${quiz.id}')" aria-label="Rename ${UI.escapeHtml(quiz.name)}">Rename</button>
                                                        ${quizzes.length > 1 ? `
                                                            <button class="btn btn-ghost btn-icon btn-sm" onclick="window.QuizBowl.Views.Quizzes.deleteQuiz('${quiz.id}')" title="Delete quiz" aria-label="Delete ${UI.escapeHtml(quiz.name)}" style="color: var(--color-danger);">${UI.icon('trash')}</button>
                                                        ` : ''}
                                                    </div>
                                                </td>
                                            </tr>
                                        `;
                                    }).join('')}
                                </tbody>
                            </table>
                        </div>
                    </section>
                </div>
            `;
        },

        createQuiz: async function() {
            const name = await window.QuizBowl.Components.Modal.prompt({
                title: 'Create a new quiz',
                message: 'It starts empty, with its own questions, teams, history and default settings.',
                icon: 'plus',
                confirmText: 'Create Quiz',
                input: { label: 'Quiz name', value: '' }
            });
            if (name === null) return;

            try {
                const quiz = window.QuizBowl.Data.QuizzesDB.create(name);
                window.QuizBowl.App.switchQuiz(quiz.id);
                window.QuizBowl.Components.Toast.show(`"${quiz.name}" created and opened.`, 'success');
            } catch (error) {
                window.QuizBowl.Components.Toast.show(error.message, 'warning');
            }
        },

        openQuiz: function(id) {
            const quiz = window.QuizBowl.Data.QuizzesDB.getById(id);
            if (!quiz) return;
            window.QuizBowl.App.switchQuiz(id);
            window.QuizBowl.Components.Toast.show(`Switched to "${quiz.name}".`, 'info');
        },

        renameQuiz: async function(id) {
            const QuizzesDB = window.QuizBowl.Data.QuizzesDB;
            const quiz = QuizzesDB.getById(id);
            if (!quiz) return;
            const name = await window.QuizBowl.Components.Modal.prompt({
                title: 'Rename quiz',
                icon: 'settings',
                confirmText: 'Rename',
                input: { label: 'Quiz name', value: quiz.name }
            });
            if (name === null) return;

            try {
                QuizzesDB.rename(id, name);
                window.QuizBowl.App.refreshQuizSwitcher();
                window.QuizBowl.Views.Quizzes.render(document.getElementById('view-container'));
            } catch (error) {
                window.QuizBowl.Components.Toast.show(error.message, 'warning');
            }
        },

        deleteQuiz: async function(id) {
            const QuizzesDB = window.QuizBowl.Data.QuizzesDB;
            const quiz = QuizzesDB.getById(id);
            if (!quiz) return;
            const confirmed = await window.QuizBowl.Components.Modal.confirm({
                title: `Delete "${quiz.name}"?`,
                message: 'All of its questions, teams, history and settings will be permanently deleted.',
                confirmText: 'Delete Quiz',
                danger: true
            });
            if (!confirmed) return;

            const wasActive = QuizzesDB.getActiveId() === id;
            try {
                QuizzesDB.delete(id);
            } catch (error) {
                window.QuizBowl.Components.Toast.show(error.message, 'warning');
                return;
            }
            window.QuizBowl.Components.Toast.show(`"${quiz.name}" deleted.`, 'info');
            if (wasActive) {
                window.QuizBowl.App.switchQuiz(QuizzesDB.getActiveId(), 'quizzes');
            } else {
                window.QuizBowl.App.refreshQuizSwitcher();
                window.QuizBowl.Views.Quizzes.render(document.getElementById('view-container'));
            }
        }
    };
})();
