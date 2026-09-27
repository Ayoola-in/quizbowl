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
        isDisplayMode: false,
        searchQuery: ''
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

// Keyboard Shortcuts and Global UI Handlers
document.addEventListener('DOMContentLoaded', () => {
    const appContainer = document.getElementById('app-container');
    const btnDisplayMode = document.getElementById('btn-display-mode');
    const displayModeLabel = document.getElementById('display-mode-label');
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

        // Esc -> Exit Display Mode / close mobile nav
        if (e.key === 'Escape') {
            if (window.QuizBowl.State.isDisplayMode) toggleDisplayMode(false);
            closeNav();
        }
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

    // Mobile navigation drawer
    function closeNav() {
        appContainer.classList.remove('sidebar-open');
    }
    document.getElementById('btn-menu').addEventListener('click', () => appContainer.classList.toggle('sidebar-open'));
    document.getElementById('sidebar-backdrop').addEventListener('click', closeNav);
    window.addEventListener('hashchange', closeNav);

    // Display Mode Toggle
    if (btnDisplayMode) {
        btnDisplayMode.addEventListener('click', () => {
            toggleDisplayMode(!window.QuizBowl.State.isDisplayMode);
        });
    }

    // Keep display mode in sync when the browser exits fullscreen on its own (e.g. user presses Esc)
    document.addEventListener('fullscreenchange', () => {
        if (!document.fullscreenElement && window.QuizBowl.State.isDisplayMode) {
            toggleDisplayMode(false);
        }
    });

    function toggleDisplayMode(enable) {
        window.QuizBowl.State.isDisplayMode = enable;

        if (enable) {
            appContainer.classList.add('display-mode-active');
            displayModeLabel.textContent = 'Exit Display Mode';
            btnDisplayMode.classList.replace('btn-primary', 'btn-secondary');
            // Try to fullscreen
            if (document.documentElement.requestFullscreen) {
                document.documentElement.requestFullscreen().catch(err => console.log(err));
            }
        } else {
            appContainer.classList.remove('display-mode-active');
            displayModeLabel.textContent = 'Display Mode';
            btnDisplayMode.classList.replace('btn-secondary', 'btn-primary');
            // Exit fullscreen
            if (document.fullscreenElement) {
                document.exitFullscreen().catch(err => console.log(err));
            }
        }
    }
});

console.log('QuizBowl Application Initialized');
