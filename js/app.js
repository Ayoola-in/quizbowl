/**
 * app.js
 * Application core and global namespace definition.
 * Since we are avoiding ES modules to allow running directly from the filesystem (file://),
 * we use the window.QuizBowl namespace.
 */

window.QuizBowl = {
    Data: {},
    Services: {},
    Views: {},
    Components: {},
    Utils: {},
    State: {
        currentRoute: 'dashboard',
        searchQuery: '',
        // Route of a quiz being taken in this tab: the rest of the app is locked until it ends (views/take.js)
        examLock: (function() {
            try {
                const route = sessionStorage.getItem('quizr_exam');
                return route && route === location.hash.replace(/^#\/?/, '') ? route : null;
            } catch (e) { return null; }
        })()
    }
};

// Theme helpers (shared by the admin app and the public display)
window.QuizBowl.Theme = {
    isDark: function() {
        return document.documentElement.getAttribute('data-theme') === 'dark';
    },

    set: function(dark) {
        if (dark) document.documentElement.setAttribute('data-theme', 'dark');
        else document.documentElement.removeAttribute('data-theme');
        try { localStorage.setItem('quizbowl_theme', dark ? 'dark' : 'light'); } catch (e) {}
        window.QuizBowl.Theme.syncButton();
    },

    syncButton: function() {
        const btn = document.getElementById('btn-theme');
        if (!btn || !window.QuizBowl.Utils.UI) return;
        const dark = window.QuizBowl.Theme.isDark();
        btn.innerHTML = window.QuizBowl.Utils.UI.icon(dark ? 'sun' : 'moon');
        btn.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
        btn.title = btn.getAttribute('aria-label');
    }
};

// Quiz switching (admin app)
window.QuizBowl.App = {
    refreshQuizSwitcher: function() {
        const select = document.getElementById('quiz-select');
        if (!select) return;
        const UI = window.QuizBowl.Utils.UI;
        const QuizzesDB = window.QuizBowl.Data.QuizzesDB;
        const activeId = QuizzesDB.getActiveId();
        select.innerHTML = QuizzesDB.getAll().map(q =>
            `<option value="${UI.escapeHtml(q.id)}" ${q.id === activeId ? 'selected' : ''}>${UI.escapeHtml(q.name)}</option>`
        ).join('') + '<option value="__new">+ New quiz…</option>';
    },

    // Re-render the app for the now-active quiz; `route` is where to land
    showActiveQuiz: function(route = 'dashboard') {
        window.QuizBowl.Services.QuestionService.migrateIds();
        window.QuizBowl.App.refreshQuizSwitcher();
        const searchInput = document.getElementById('global-search');
        if (searchInput) searchInput.value = '';
        window.QuizBowl.State.searchQuery = '';
        if (window.location.hash.substring(1) === route) window.QuizBowl.Router.handleRoute();
        else window.QuizBowl.Router.navigate(route);
    },

    switchQuiz: function(id, route = 'dashboard') {
        window.QuizBowl.Data.QuizzesDB.setActive(id);
        window.QuizBowl.App.showActiveQuiz(route);
    },

    // Sidebar dot: green = all synced, amber = changes to sync, red = needs a decision
    refreshCloudBadge: function() {
        const Cloud = window.QuizBowl.Cloud;
        const dot = document.getElementById('cloud-dot');
        if (!dot || !Cloud) return;
        if (!Cloud.configured || !Cloud.user()) { dot.hidden = true; return; }
        const statuses = window.QuizBowl.Data.QuizzesDB.getAll().map(q => Cloud.status(q.id)).filter(s => s !== 'local');
        if (!statuses.length) { dot.hidden = true; return; }
        const tone = statuses.some(s => s === 'conflict' || s === 'cloud-deleted') ? 'danger'
            : statuses.some(s => s === 'changed' || s === 'cloud-newer') ? 'warning' : 'success';
        dot.hidden = false;
        dot.className = `cloud-dot cloud-dot-${tone}`;
        dot.title = tone === 'danger' ? 'A synced quiz needs your attention' : tone === 'warning' ? 'Some quizzes have changes to sync' : 'All synced quizzes are up to date';
    },

    watchCloud: function() {
        const Cloud = window.QuizBowl.Cloud;
        if (!Cloud) return;
        Cloud.subscribe(event => {
            window.QuizBowl.App.refreshCloudBadge();
            // Downloaded data for the quiz on screen: redraw the page (except the sync page, which redraws itself)
            if ((event.type === 'downloaded' || event.type === 'active-replaced')
                && event.localId === window.QuizBowl.Data.QuizzesDB.getActiveId()
                && window.QuizBowl.State.currentRoute !== 'account') {
                window.QuizBowl.App.refreshQuizSwitcher();
                window.QuizBowl.Router.handleRoute();
            }
        });
        window.addEventListener('hashchange', () => window.QuizBowl.App.refreshCloudBadge());
    }
};

// Keyboard Shortcuts and Global UI Handlers
document.addEventListener('DOMContentLoaded', () => {
    const appContainer = document.getElementById('app-container');
    const searchInput = document.getElementById('global-search');

    // Admin-only page elements; the public display shares this file
    if (!appContainer) return;

    // Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
        // Ctrl+K -> Focus Search
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
            e.preventDefault();
            if (searchInput) {
                searchInput.focus();
                searchInput.select();
            }
        }

        // Alt+N -> Add New Question (Ctrl+N is reserved by browsers for a new window)
        if (e.altKey && e.key.toLowerCase() === 'n') {
            e.preventDefault();
            window.QuizBowl.Router.navigate('add-question');
        }

        // Esc -> close mobile nav
        if (e.key === 'Escape') closeNav();
    });

    // Global search: routes to the question bank and filters as you type
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            window.QuizBowl.State.searchQuery = e.target.value;
            if (window.QuizBowl.State.currentRoute !== 'questions') {
                window.QuizBowl.Router.navigate('questions');
            } else if (window.QuizBowl.Views.Questions.applyExternalSearch) {
                window.QuizBowl.Views.Questions.applyExternalSearch(e.target.value);
            }
        });
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                searchInput.value = '';
                searchInput.dispatchEvent(new Event('input'));
                searchInput.blur();
            }
        });
    }

    // Theme toggle
    const btnTheme = document.getElementById('btn-theme');
    if (btnTheme) {
        window.QuizBowl.Theme.syncButton();
        btnTheme.addEventListener('click', () => window.QuizBowl.Theme.set(!window.QuizBowl.Theme.isDark()));
    }

    // Quiz switcher in the sidebar
    const quizSelect = document.getElementById('quiz-select');
    if (quizSelect) {
        quizSelect.addEventListener('change', () => {
            const QuizzesDB = window.QuizBowl.Data.QuizzesDB;
            if (quizSelect.value === '__new') {
                quizSelect.value = QuizzesDB.getActiveId();
                window.QuizBowl.Views.Quizzes.createQuiz();
                return;
            }
            const quiz = QuizzesDB.getById(quizSelect.value);
            if (!quiz) return;
            window.QuizBowl.App.switchQuiz(quiz.id);
            window.QuizBowl.Components.Toast.show(`Switched to "${quiz.name}".`, 'info');
            closeNav();
        });
    }

    // Follow quiz changes made in another tab
    window.addEventListener('storage', (e) => {
        const Storage = window.QuizBowl.Data.Storage;
        if (e.key === Storage.PREFIX + Storage.ACTIVE_QUIZ_KEY) {
            window.QuizBowl.App.showActiveQuiz();
        } else if (e.key === Storage.PREFIX + 'quizzes') {
            window.QuizBowl.App.refreshQuizSwitcher();
            if (window.QuizBowl.State.currentRoute === 'quizzes') window.QuizBowl.Router.handleRoute();
        }
    });

    // Mobile navigation drawer
    function closeNav() {
        appContainer.classList.remove('sidebar-open');
    }
    document.getElementById('btn-menu').addEventListener('click', () => appContainer.classList.toggle('sidebar-open'));
    document.getElementById('sidebar-backdrop').addEventListener('click', closeNav);
    window.addEventListener('hashchange', closeNav);
});

console.log('Quizr Application Initialized');
