/**
 * js/pwa.js
 * Installable web app support: service worker registration, the
 * "Install App" button, and link handling when running from the home screen.
 */
(function() {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    let deferredPrompt = null;

    // Service workers only run over http(s), not when opened as a file://
    // Registered immediately rather than on 'load', which a slow CDN (fonts, MathJax) can hold up indefinitely
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
        navigator.serviceWorker.register('sw.js').catch(err => console.log('Service worker registration failed:', err));
    }

    function installButtons() {
        return document.querySelectorAll('[data-install-app]');
    }

    // Chrome/Edge/Android: offer our own install button
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        installButtons().forEach(btn => { btn.hidden = false; });
    });

    window.addEventListener('appinstalled', () => {
        deferredPrompt = null;
        installButtons().forEach(btn => { btn.hidden = true; });
        if (window.QuizBowl.Components.Toast) window.QuizBowl.Components.Toast.show('Quizr installed. Open it from your home screen.', 'success');
    });

    document.addEventListener('DOMContentLoaded', () => {
        if (isStandalone) document.documentElement.classList.add('standalone');

        installButtons().forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                if (!deferredPrompt) return;
                deferredPrompt.prompt();
                await deferredPrompt.userChoice;
                deferredPrompt = null;
                btn.hidden = true;
            });
        });

        // Inside the installed app, open the public display in the same window
        // (a new tab would leave the app, and on iOS would not share its data)
        if (isStandalone) {
            document.querySelectorAll('a[href="public.html"][target="_blank"]').forEach(a => a.removeAttribute('target'));
        }
    });
})();
