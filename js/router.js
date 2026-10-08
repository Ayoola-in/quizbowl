/**
 * js/router.js
 * Basic hash-based SPA router
 */
(function() {
    const TITLES = {
        'dashboard': 'Dashboard',
        'questions': 'Question Bank',
        'add-question': 'Add Question',
        'question': 'Question',
        'teams': 'Teams',
        'history': 'History',
        'settings': 'Settings',
        'quizzes': 'Quizzes',
        'generate': 'AI Generator'
    };

    window.QuizBowl.Router = {
        routes: {
            'dashboard': () => window.QuizBowl.Views.Dashboard.render(document.getElementById('view-container')),
            'questions': () => window.QuizBowl.Views.Questions.render(document.getElementById('view-container')),
            'add-question': () => window.QuizBowl.Views.AddQuestion.render(document.getElementById('view-container')),
            'question': (id) => window.QuizBowl.Views.QuestionDetail.render(document.getElementById('view-container'), id),
            'teams': () => window.QuizBowl.Views.Teams.render(document.getElementById('view-container')),
            'history': () => window.QuizBowl.Views.History.render(document.getElementById('view-container')),
            'settings': () => window.QuizBowl.Views.Settings.render(document.getElementById('view-container')),
            'quizzes': () => window.QuizBowl.Views.Quizzes.render(document.getElementById('view-container')),
            'generate': () => window.QuizBowl.Views.Generate.render(document.getElementById('view-container')),
        },

        init: function() {
            window.addEventListener('hashchange', () => this.handleRoute());
            this.handleRoute(); // initial load
        },

        navigate: function(route) {
            window.location.hash = route;
        },

        handleRoute: function() {
            let hash = window.location.hash.substring(1) || 'dashboard';

            // Clean up hash route
            if (hash.startsWith('/')) {
                hash = hash.substring(1);
            }

            // Route matching
            const viewContainer = document.getElementById('view-container');
            const routeParts = hash.split('/');
            const baseRoute = routeParts[0];
            const param = routeParts[1] ? decodeURIComponent(routeParts[1]) : undefined;

            // Update state
            window.QuizBowl.State.currentRoute = baseRoute;

            // Global search only applies to the question bank
            if (baseRoute !== 'questions') {
                window.QuizBowl.State.searchQuery = '';
                const globalSearch = document.getElementById('global-search');
                if (globalSearch && document.activeElement !== globalSearch) globalSearch.value = '';
            }

            // Update sidebar UI (question detail/add pages belong to "Questions")
            const navRoute = (baseRoute === 'question' || baseRoute === 'add-question') ? 'questions' : baseRoute;
            document.querySelectorAll('.sidebar-nav .nav-item').forEach(el => {
                const isActive = el.getAttribute('data-route') === navRoute;
                el.classList.toggle('active', isActive);
                if (isActive) el.setAttribute('aria-current', 'page');
                else el.removeAttribute('aria-current');
            });

            const activeQuiz = window.QuizBowl.Data.QuizzesDB.getActive();
            document.title = `${TITLES[baseRoute] ? TITLES[baseRoute] + (param ? ' ' + param : '') : 'Not Found'} · ${activeQuiz ? activeQuiz.name + ' · ' : ''}Quizr`;
            viewContainer.scrollTop = 0;

            if (this.routes[baseRoute]) {
                this.routes[baseRoute](param);
            } else {
                const UI = window.QuizBowl.Utils.UI;
                viewContainer.innerHTML = `
                    <div class="card">
                        ${UI.emptyState('inbox', 'Page not found', `There is no page at <code>#${UI.escapeHtml(hash)}</code>.`,
                            `<a href="#dashboard" class="btn btn-primary">Back to Dashboard</a>`)}
                    </div>
                `;
            }

            // Rerender MathJax if needed
            if (window.MathJax && MathJax.typesetPromise) {
                MathJax.typesetPromise([viewContainer]).catch(err => console.log(err));
            }
        }
    };
})();
