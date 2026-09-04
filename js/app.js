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
        isDisplayMode: false
    }
};

// Keyboard Shortcuts and Global UI Handlers
document.addEventListener('DOMContentLoaded', () => {
    // Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
        // Ctrl+K -> Focus Search
        if (e.ctrlKey && e.key === 'k') {
            e.preventDefault();
            const searchInput = document.getElementById('global-search');
            if (searchInput) searchInput.focus();
        }
        
        // Ctrl+N -> Add New Question
        if (e.ctrlKey && e.key === 'n') {
            e.preventDefault();
            window.QuizBowl.Router.navigate('add-question');
        }

        // Esc -> Exit Display Mode
        if (e.key === 'Escape' && window.QuizBowl.State.isDisplayMode) {
            toggleDisplayMode(false);
        }
    });

    // Display Mode Toggle
    const btnDisplayMode = document.getElementById('btn-display-mode');
    if (btnDisplayMode) {
        btnDisplayMode.addEventListener('click', () => {
            toggleDisplayMode(!window.QuizBowl.State.isDisplayMode);
        });
    }

    function toggleDisplayMode(enable) {
        window.QuizBowl.State.isDisplayMode = enable;
        const container = document.getElementById('app-container');
        
        if (enable) {
            container.classList.add('display-mode-active');
            btnDisplayMode.textContent = 'Exit Display Mode (Esc)';
            // Try to fullscreen
            if (document.documentElement.requestFullscreen) {
                document.documentElement.requestFullscreen().catch(err => console.log(err));
            }
        } else {
            container.classList.remove('display-mode-active');
            btnDisplayMode.textContent = 'Display Mode';
            // Exit fullscreen
            if (document.fullscreenElement) {
                document.exitFullscreen().catch(err => console.log(err));
            }
        }
    }
});

console.log('QuizBowl Application Initialized');
