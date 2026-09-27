/**
 * js/components/toast.js
 * Toast Notification System
 */
(function() {
    const ICONS = { success: 'checkCircle', danger: 'alert', warning: 'alert', info: 'info' };

    window.QuizBowl.Components.Toast = {
        show: function(message, type = 'info') {
            if (type === 'error') type = 'danger';

            // Create container if it doesn't exist
            let container = document.getElementById('toast-container');
            if (!container) {
                container = document.createElement('div');
                container.id = 'toast-container';
                container.setAttribute('role', 'status');
                container.setAttribute('aria-live', 'polite');
                document.body.appendChild(container);
            }

            const UI = window.QuizBowl.Utils.UI;
            const toast = document.createElement('div');
            toast.className = `toast toast-${type}`;
            toast.innerHTML = `${UI ? UI.icon(ICONS[type] || 'info') : ''}<span></span>`;
            toast.querySelector('span').textContent = message;

            container.appendChild(toast);

            // Animate in
            requestAnimationFrame(() => toast.classList.add('show'));

            // Remove after a few seconds (errors linger a little longer)
            setTimeout(() => {
                toast.classList.remove('show');
                setTimeout(() => toast.remove(), 300);
            }, type === 'danger' ? 4500 : 3000);
        }
    };
})();
