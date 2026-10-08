/**
 * js/export/export-options.js
 * The PDF options panel (answers, title, layout) shared by the Export page
 * and the export dialog, plus the dialog itself (used by the AI generator).
 * Branding (organization logo and name, watermark) is part of the panel; the
 * logo is kept under its own key as a downscaled PNG data URL.
 */
(function() {
    const PREFS_KEY = 'export_prefs';
    const LOGO_KEY = 'export_logo';
    const LOGO_MAX = 480;   // longest side in px; keeps the stored image small
    const DEFAULTS = {
        answers: 'none',
        explanations: true,
        showMarks: true,
        showIds: false,
        groupByType: true,
        shuffle: false,
        studentFields: true,
        answerSpace: true,
        paper: 'a4',
        textSize: 'normal',
        instructions: '',
        orgName: '',
        watermark: 'none',      // none | text | logo
        watermarkText: ''
    };

    const ANSWER_MODES = [
        { value: 'marked', title: 'Show the answers', hint: 'Correct options are highlighted and ticked, and written answers appear under each question.' },
        { value: 'key', title: 'Answer key at the end', hint: 'Questions first, then a separate answer key page.' },
        { value: 'none', title: 'No answers', hint: 'A clean question paper.' }
    ];

    const UI = () => window.QuizBowl.Utils.UI;
    const Storage = () => window.QuizBowl.Data.Storage;
    const esc = v => UI().escapeHtml(v);

    function getPrefs() {
        return { ...DEFAULTS, ...(Storage().getGlobal(PREFS_KEY, {}) || {}) };
    }
    function savePrefs(patch) {
        Storage().setGlobal(PREFS_KEY, { ...getPrefs(), ...patch });
    }
    function getLogo() {
        const logo = Storage().getGlobal(LOGO_KEY, null);
        return logo && logo.data ? logo : null;
    }

    // Read an image file and shrink it to a PNG no larger than LOGO_MAX on its longest side
    function loadLogo(file) {
        return new Promise((resolve, reject) => {
            if (!file || !/^image\//.test(file.type)) return reject(new Error('Choose a PNG, JPG, WebP or SVG image.'));
            const reader = new FileReader();
            reader.onerror = () => reject(new Error('That image couldn\'t be read.'));
            reader.onload = () => {
                const img = new Image();
                img.onerror = () => reject(new Error('That image couldn\'t be opened.'));
                img.onload = () => {
                    const w0 = img.naturalWidth || img.width || LOGO_MAX;
                    const h0 = img.naturalHeight || img.height || LOGO_MAX;
                    const scale = Math.min(1, LOGO_MAX / Math.max(w0, h0));
                    const canvas = document.createElement('canvas');
                    canvas.width = Math.max(1, Math.round(w0 * scale));
                    canvas.height = Math.max(1, Math.round(h0 * scale));
                    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
                    resolve({ data: canvas.toDataURL('image/png'), w: canvas.width, h: canvas.height });
                };
                img.src = reader.result;
            };
            reader.readAsDataURL(file);
        });
    }

    const logoPreview = logo => logo
        ? `<img src="${logo.data}" alt="Organization logo">`
        : UI().icon('image');

    const Options = {
        /** HTML for the options panel. `p` prefixes element IDs so two panels can coexist. */
        html: function(p, title) {
            const prefs = getPrefs();
            const logo = getLogo();
            const toggle = (key, label, hint) => `
                <label class="gen-toggle" data-opt-row="${key}">
                    <input type="checkbox" id="${p}-${key}" data-opt="${key}" ${prefs[key] ? 'checked' : ''}>
                    <span><strong>${label}</strong><small>${hint}</small></span>
                </label>`;
            return `
                <div class="export-options" id="${p}-options">
                    <div class="form-group">
                        <span class="form-label">Answers</span>
                        <div class="choice-cards" role="radiogroup" aria-label="Answers">
                            ${ANSWER_MODES.map(m => `
                                <label class="choice-card">
                                    <input type="radio" name="${p}-answers" value="${m.value}" data-opt="answers" ${prefs.answers === m.value ? 'checked' : ''}>
                                    <span><strong>${m.title}</strong><small>${m.hint}</small></span>
                                </label>`).join('')}
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label for="${p}-title">Title</label>
                            <input type="text" id="${p}-title" class="form-control" value="${esc(title)}" maxlength="90">
                        </div>
                        <div class="form-group">
                            <span class="form-label">Paper and text size</span>
                            <div class="export-inline">
                                <div class="segmented" data-seg="paper" role="radiogroup" aria-label="Paper size">
                                    ${[['a4', 'A4'], ['letter', 'Letter']].map(([v, l]) => `<button type="button" role="radio" data-value="${v}" class="${prefs.paper === v ? 'active' : ''}" aria-checked="${prefs.paper === v}">${l}</button>`).join('')}
                                </div>
                                <div class="segmented" data-seg="textSize" role="radiogroup" aria-label="Text size">
                                    ${[['normal', 'Normal'], ['large', 'Large']].map(([v, l]) => `<button type="button" role="radio" data-value="${v}" class="${prefs.textSize === v ? 'active' : ''}" aria-checked="${prefs.textSize === v}">${l}</button>`).join('')}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="form-group">
                        <span class="form-label">Organization <span class="text-muted" style="font-weight: 400;">(optional)</span></span>
                        <div class="export-brand">
                            <div class="export-logo-preview" id="${p}-logo-preview">${logoPreview(logo)}</div>
                            <div class="export-brand-fields">
                                <input type="text" id="${p}-orgName" class="form-control" data-opt="orgName" value="${esc(prefs.orgName)}" maxlength="90" placeholder="Organization name, e.g., Greenfield High School" aria-label="Organization name">
                                <div class="export-logo-actions">
                                    <label class="btn btn-secondary btn-sm">
                                        ${UI().icon('upload')} <span id="${p}-logo-label">${logo ? 'Change logo' : 'Add logo'}</span>
                                        <input type="file" id="${p}-logo-file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" hidden>
                                    </label>
                                    <button type="button" class="btn btn-ghost btn-sm" id="${p}-logo-remove" ${logo ? '' : 'hidden'}>${UI().icon('trash')} Remove logo</button>
                                </div>
                            </div>
                        </div>
                        <small class="form-hint">The logo and name are centered at the top of the first page.</small>
                    </div>
                    <div class="form-group">
                        <span class="form-label">Watermark</span>
                        <div class="segmented" data-seg="watermark" role="radiogroup" aria-label="Watermark">
                            ${[['none', 'None'], ['text', 'Text'], ['logo', 'Logo']].map(([v, l]) => `<button type="button" role="radio" data-value="${v}" class="${prefs.watermark === v ? 'active' : ''}" aria-checked="${prefs.watermark === v}">${l}</button>`).join('')}
                        </div>
                        <input type="text" id="${p}-watermarkText" class="form-control export-wm-text" data-opt="watermarkText" value="${esc(prefs.watermarkText)}" maxlength="40" placeholder="e.g., CONFIDENTIAL (leave empty to use the organization name)" aria-label="Watermark text">
                        <small class="form-hint" id="${p}-wm-hint"></small>
                    </div>
                    <div class="form-group">
                        <label for="${p}-instructions">Instructions at the top <span class="text-muted" style="font-weight: 400;">(optional)</span></label>
                        <textarea id="${p}-instructions" class="form-control" rows="2" data-opt="instructions" placeholder="e.g., Answer all questions. Circle the correct option. Time allowed: 30 minutes.">${esc(prefs.instructions)}</textarea>
                    </div>
                    <div class="gen-toggles export-toggles">
                        ${toggle('explanations', 'Include explanations', 'Shown with the answers, when a question has one')}
                        ${toggle('showMarks', 'Show marks', 'Marks per question, per section and in total')}
                        ${toggle('groupByType', 'Group by question type', 'Separate sections for multiple choice, true/false and so on')}
                        ${toggle('studentFields', 'Name, date and score lines', 'At the top of the paper (not on answer sheets)')}
                        ${toggle('answerSpace', 'Space for written answers', 'Lines under short-answer and calculation questions')}
                        ${toggle('shuffle', 'Shuffle question order', 'Handy for making different versions of a test')}
                        ${toggle('showIds', 'Show app question numbers', 'e.g. MCQ004, to match questions on the public display')}
                    </div>
                </div>
            `;
        },

        /** Wire up the panel: remember choices and keep dependent toggles in sync */
        bind: function(p) {
            const root = document.getElementById(`${p}-options`);
            const sync = () => {
                const answers = (root.querySelector(`input[name="${p}-answers"]:checked`) || {}).value;
                root.querySelector('[data-opt-row="explanations"]').classList.toggle('is-muted', answers === 'none');
                root.querySelector('[data-opt-row="answerSpace"]').classList.toggle('is-muted', answers === 'marked');
                root.querySelector('[data-opt-row="studentFields"]').classList.toggle('is-muted', answers === 'marked');
                const wm = getPrefs().watermark;
                root.querySelector(`#${p}-watermarkText`).hidden = wm !== 'text';
                root.querySelector(`#${p}-wm-hint`).textContent = wm === 'none' ? 'No watermark.'
                    : wm === 'logo' && !getLogo() ? 'Add a logo above to use it as the watermark.'
                    : 'Printed faintly across the middle of every page.';
            };
            const showLogo = () => {
                const logo = getLogo();
                root.querySelector(`#${p}-logo-preview`).innerHTML = logoPreview(logo);
                root.querySelector(`#${p}-logo-label`).textContent = logo ? 'Change logo' : 'Add logo';
                root.querySelector(`#${p}-logo-remove`).hidden = !logo;
                sync();
            };
            root.addEventListener('change', async e => {
                if (e.target.id === `${p}-logo-file`) {
                    const file = e.target.files && e.target.files[0];
                    e.target.value = '';
                    if (!file) return;
                    try {
                        const logo = await loadLogo(file);
                        if (!Storage().setGlobal(LOGO_KEY, logo)) throw new Error('The logo couldn\'t be saved. Try a smaller image.');
                        showLogo();
                    } catch (err) {
                        window.QuizBowl.Components.Toast.show(err.message, 'danger');
                    }
                    return;
                }
                const key = e.target.getAttribute('data-opt');
                if (!key) return;
                savePrefs({ [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
                sync();
                root.dispatchEvent(new CustomEvent('options-change', { bubbles: true }));
            });
            root.querySelector(`#${p}-logo-remove`).addEventListener('click', () => {
                Storage().removeGlobal(LOGO_KEY);
                showLogo();
            });
            // Save typed text as it changes, so Download picks it up without leaving the field
            root.addEventListener('input', e => {
                const key = e.target.getAttribute('data-opt');
                if (key && (e.target.type === 'text' || e.target.tagName === 'TEXTAREA')) savePrefs({ [key]: e.target.value });
            });
            root.querySelectorAll('[data-seg]').forEach(seg => seg.addEventListener('click', e => {
                const btn = e.target.closest('button[data-value]');
                if (!btn) return;
                seg.querySelectorAll('button').forEach(b => { b.classList.toggle('active', b === btn); b.setAttribute('aria-checked', b === btn); });
                savePrefs({ [seg.getAttribute('data-seg')]: btn.getAttribute('data-value') });
                sync();
            }));
            sync();
        },

        read: function(p, extra = {}) {
            const prefs = getPrefs();
            const title = (document.getElementById(`${p}-title`).value || '').trim();
            return { ...prefs, ...extra, title: title || extra.title || 'Quiz', logo: getLogo() };
        },

        summary: function() {
            const prefs = getPrefs();
            return (ANSWER_MODES.find(m => m.value === prefs.answers) || ANSWER_MODES[2]).title;
        }
    };

    // Download or print, with friendly messages
    async function runExport(kind, questions, opts) {
        const Toast = window.QuizBowl.Components.Toast;
        const PDF = window.QuizBowl.Export.PDF;
        if (kind === 'print') {
            await PDF.print(questions, opts);
            return true;
        }
        const result = await PDF.download(questions, opts);
        let message = `Downloaded ${result.fileName} (${result.pages} page${result.pages === 1 ? '' : 's'}).`;
        if (result.fontFallback) {
            Toast.show('The full font couldn\'t be downloaded, so some accented letters may look plain. Use Print for the best result.', 'warning');
        } else if (result.missingCharacters > 0) {
            Toast.show(`Some characters (such as non-Latin scripts) can't be shown in the downloaded PDF. Use Print and choose "Save as PDF" instead.`, 'warning');
        }
        Toast.show(message, 'success');
        return true;
    }

    // Modal with the options panel; used where there's no room for the full page
    function openDialog(questions, { title = 'Quiz', quizName = '', heading = 'Download as PDF' } = {}) {
        const Toast = window.QuizBowl.Components.Toast;
        const previousFocus = document.activeElement;
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal modal-wide" role="dialog" aria-modal="true" aria-labelledby="export-dialog-title">
                <div class="modal-head">
                    <div class="modal-icon">${UI().icon('download')}</div>
                    <div style="flex: 1; min-width: 0;">
                        <h2 id="export-dialog-title">${esc(heading)}</h2>
                        <p>${questions.length} question${questions.length === 1 ? '' : 's'} will be included.</p>
                    </div>
                    <button type="button" class="btn btn-ghost btn-icon btn-sm" data-action="close" aria-label="Close">${UI().icon('x')}</button>
                </div>
                <div class="modal-body">${Options.html('xd', title)}</div>
                <div class="modal-actions">
                    <button type="button" class="btn btn-secondary" data-action="print" title="Opens your browser's print window: choose Save as PDF. Best for non-Latin scripts and maths.">${UI().icon('fileText')} Print</button>
                    <button type="button" class="btn btn-primary" data-action="download">${UI().icon('download')} Download PDF</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        requestAnimationFrame(() => overlay.classList.add('show'));
        Options.bind('xd');
        document.getElementById('xd-title').focus();

        const close = () => {
            overlay.classList.remove('show');
            setTimeout(() => overlay.remove(), 180);
            if (previousFocus && previousFocus.focus) previousFocus.focus();
        };
        const run = async (kind, btn) => {
            const original = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = `${UI().icon('loader', 'spin')} ${kind === 'print' ? 'Preparing…' : 'Making PDF…'}`;
            try {
                await runExport(kind, questions, Options.read('xd', { title, quizName }));
                close();
            } catch (err) {
                console.error(err);
                Toast.show(err.message || 'The PDF couldn\'t be made.', 'danger');
                btn.disabled = false;
                btn.innerHTML = original;
            }
        };
        overlay.addEventListener('click', e => {
            const action = e.target.closest('[data-action]');
            if (action && action.getAttribute('data-action') === 'close') close();
            else if (action && action.getAttribute('data-action') === 'download') run('download', action);
            else if (action && action.getAttribute('data-action') === 'print') run('print', action);
        });
        overlay.addEventListener('mousedown', e => { if (e.target === overlay) close(); });
        overlay.addEventListener('keydown', e => {
            e.stopPropagation();
            if (e.key === 'Escape') { e.preventDefault(); close(); }
        });
    }

    window.QuizBowl.Export = window.QuizBowl.Export || {};
    window.QuizBowl.Export.Options = Options;
    window.QuizBowl.Export.run = runExport;
    window.QuizBowl.Export.openDialog = openDialog;
})();
