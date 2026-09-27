/**
 * js/router.js
 * Basic hash-based SPA router
 */
(function() {
    window.QuizBowl.Router = {
        routes: {
            'dashboard': () => window.QuizBowl.Views.Dashboard.render(document.getElementById('view-container')),
            'questions': () => window.QuizBowl.Views.Questions.render(document.getElementById('view-container')),
            'add-question': () => window.QuizBowl.Views.AddQuestion.render(document.getElementById('view-container')),
            'question': (id) => window.QuizBowl.Views.QuestionDetail.render(document.getElementById('view-container'), id),
            'teams': () => window.QuizBowl.Views.Teams.render(document.getElementById('view-container')),
            'history': () => renderHistory(),
            'settings': () => window.QuizBowl.Views.Settings.render(document.getElementById('view-container')),
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

            // Update state
            window.QuizBowl.State.currentRoute = hash;

            // Update sidebar UI
            document.querySelectorAll('.sidebar-nav .nav-item').forEach(el => {
                el.classList.remove('active');
                if (el.getAttribute('data-route') === hash.split('/')[0]) {
                    el.classList.add('active');
                }
            });

            // Route matching
            const viewContainer = document.getElementById('view-container');
            const routeParts = hash.split('/');
            const baseRoute = routeParts[0];
            const param = routeParts[1];
            
            if (this.routes[baseRoute]) {
                this.routes[baseRoute](param);
            } else {
                // Temporary placeholder
                viewContainer.innerHTML = `
                    <div style="padding: 2rem; text-align: center;">
                        <h2>View: ${hash}</h2>
                        <p>This view is under construction.</p>
                    </div>
                `;
            }
            
            // Rerender MathJax if needed
            if (window.MathJax) {
                MathJax.typesetPromise();
            }
        }
    };

    // Stubs for future rendering functions
    function renderDashboard() {}
    function renderQuestions() {}
    function renderTeams() {}
    function renderHistory() {}
    function renderSettings() {}

})();
