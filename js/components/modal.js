/**
 * js/components/modal.js
 * Promise-based confirm/prompt dialogs replacing the native browser popups
 */
(function() {
    const UI = window.QuizBowl.Utils.UI;

    function open({ title, message = '', confirmText = 'Confirm', cancelText = 'Cancel', danger = false, icon, input }) {
        return new Promise(resolve => {
            const previousFocus = document.activeElement;
            const overlay = document.createElement('div');
            overlay.className = 'modal-overlay';
            overlay.innerHTML = `
                <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
                    <div class="modal-head">
                        <div class="modal-icon ${danger ? 'danger' : ''}">${UI.icon(icon || (danger ? 'alert' : 'info'))}</div>
                        <div style="flex: 1; min-width: 0;">
                            <h2 id="modal-title">${UI.escapeHtml(title)}</h2>
                            ${message ? `<p>${UI.escapeHtml(message)}</p>` : ''}
                            ${input ? `
                                <div class="form-group">
                                    ${input.label ? `<label for="modal-input">${UI.escapeHtml(input.label)}</label>` : ''}
                                    <input id="modal-input" class="form-control" type="${input.type || 'text'}"
                                        value="${UI.escapeHtml(input.value == null ? '' : input.value)}"
                                        ${input.min != null ? `min="${input.min}"` : ''} autocomplete="off">
                                </div>
                            ` : ''}
                        </div>
                    </div>
                    <div class="modal-actions">
                        <button type="button" class="btn btn-secondary" data-action="cancel">${UI.escapeHtml(cancelText)}</button>
                        <button type="button" class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-action="confirm">${UI.escapeHtml(confirmText)}</button>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);
            requestAnimationFrame(() => overlay.classList.add('show'));

            const inputEl = overlay.querySelector('#modal-input');
            const confirmBtn = overlay.querySelector('[data-action="confirm"]');
            (inputEl || confirmBtn).focus();
            if (inputEl) inputEl.select();

            const close = (result) => {
                overlay.classList.remove('show');
                setTimeout(() => overlay.remove(), 180);
                if (previousFocus && previousFocus.focus) previousFocus.focus();
                resolve(result);
            };

            const confirm = () => close(input ? inputEl.value : true);
            const cancel = () => close(input ? null : false);

            confirmBtn.addEventListener('click', confirm);
            overlay.querySelector('[data-action="cancel"]').addEventListener('click', cancel);
            overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) cancel(); });

            overlay.addEventListener('keydown', (e) => {
                // Keep modal keys from reaching global shortcuts (e.g. Esc exits display mode)
                e.stopPropagation();
                if (e.key === 'Escape') {
                    e.preventDefault();
                    cancel();
                } else if (e.key === 'Enter' && e.target.tagName !== 'BUTTON') {
                    e.preventDefault();
                    confirm();
                } else if (e.key === 'Tab') {
                    // Trap focus inside the dialog
                    const focusables = overlay.querySelectorAll('input, button');
                    const first = focusables[0];
                    const last = focusables[focusables.length - 1];
                    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
                    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
                }
            });
        });
    }

    window.QuizBowl.Components.Modal = {
        confirm: function(options) {
            return open(options);
        },

        prompt: function(options) {
            return open({ ...options, input: options.input || {} });
        }
    };
})();
