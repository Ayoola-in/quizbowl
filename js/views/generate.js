/**
 * js/views/generate.js
 * AI Question Generator: upload material, pick an AI model and question
 * options, generate, review/edit, then add the questions to the quiz.
 *
 * Work in progress (files, results) lives in this module so it survives
 * moving between pages; preferences and API keys are saved on the device.
 */
(function() {
    const PREFS_KEY = 'ai_prefs';
    const KEYS_KEY = 'ai_keys';
    const MODELS_KEY = 'ai_models';
    const MAX_FILES = 20;

    const AUDIENCES = [
        { value: '', label: 'General audience' },
        { value: 'young children (primary school)', label: 'Children (primary school)' },
        { value: 'teenagers (secondary / high school)', label: 'Teenagers (secondary school)' },
        { value: 'university students', label: 'University students' },
        { value: 'adults in a workplace or professional setting', label: 'Workplace / professionals' },
        { value: 'subject experts', label: 'Experts' }
    ];
    const LANGUAGES = ['English', 'French', 'Spanish', 'Portuguese', 'German', 'Italian', 'Dutch', 'Arabic', 'Swahili',
        'Yoruba', 'Igbo', 'Hausa', 'Amharic', 'Hindi', 'Bengali', 'Urdu', 'Chinese (Simplified)', 'Japanese', 'Korean',
        'Indonesian', 'Turkish', 'Russian', 'Polish', 'Ukrainian'];
    const DIFFICULTIES = [
        { value: 'easy', label: 'Easy' }, { value: 'medium', label: 'Medium' },
        { value: 'hard', label: 'Hard' }, { value: 'mixed', label: 'Mixed' }
    ];
    const TYPE_INFO = {
        mcq: { label: 'Multiple choice', hint: 'Options with one correct answer' },
        true_false: { label: 'True / False', hint: 'Statements to judge' },
        theory: { label: 'Short answer', hint: 'Answered in a few words' },
        calculation: { label: 'Calculation', hint: 'Work out a number' }
    };

    const DEFAULT_PREFS = {
        providerId: 'anthropic',
        models: {},
        baseUrl: '',
        counts: { mcq: 10, true_false: 5, theory: 5, calculation: 0 },
        mcqOptions: 4,
        difficulty: 'mixed',
        audience: '',
        language: 'English',
        category: '',
        instructions: '',
        explanations: true,
        avoidExisting: true,
        reviewFirst: true
    };

    // Session state (kept while the app is open)
    const S = {
        docs: [],
        notes: '',
        topic: '',
        running: false,
        controller: null,
        startedAt: 0,
        progress: '',
        error: '',
        result: null,     // { drafts, warnings, quizId, quizName, meta, imported, addedCount }
        editing: null
    };
    let timer = null;
    let pasteBound = false;

    const Storage = () => window.QuizBowl.Data.Storage;
    const UI = () => window.QuizBowl.Utils.UI;
    const Toast = () => window.QuizBowl.Components.Toast;
    const AI = () => window.QuizBowl.AI;

    function getPrefs() {
        const saved = Storage().getGlobal(PREFS_KEY, {}) || {};
        return { ...DEFAULT_PREFS, ...saved, counts: { ...DEFAULT_PREFS.counts, ...(saved.counts || {}) }, models: { ...(saved.models || {}) } };
    }
    function savePrefs(patch) {
        Storage().setGlobal(PREFS_KEY, { ...getPrefs(), ...patch });
    }
    function getKey(providerId) {
        return (Storage().getGlobal(KEYS_KEY, {}) || {})[providerId] || '';
    }
    function setKey(providerId, key) {
        const keys = Storage().getGlobal(KEYS_KEY, {}) || {};
        if (key) keys[providerId] = key; else delete keys[providerId];
        Storage().setGlobal(KEYS_KEY, keys);
    }
    function loadedModels(providerId) {
        return (Storage().getGlobal(MODELS_KEY, {}) || {})[providerId] || [];
    }
    function saveLoadedModels(providerId, list) {
        const all = Storage().getGlobal(MODELS_KEY, {}) || {};
        all[providerId] = list;
        Storage().setGlobal(MODELS_KEY, all);
    }
    function currentModel(prefs, provider) {
        return prefs.models[provider.id] || (provider.models[0] && provider.models[0].id) || '';
    }

    const esc = v => UI().escapeHtml(v);
    const $ = id => document.getElementById(id);
    const totalCount = counts => AI().Generator.TYPES.reduce((s, t) => s + (parseInt(counts[t], 10) || 0), 0);

    function formatSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1048576) return Math.round(bytes / 1024) + ' KB';
        return (bytes / 1048576).toFixed(1) + ' MB';
    }

    // ---------- Rendering ----------
    window.QuizBowl.Views.Generate = {
        render: function(container) {
            const prefs = getPrefs();
            const quiz = window.QuizBowl.Data.QuizzesDB.getActive();
            const providers = AI().Providers.all;

            container.innerHTML = `
                <div class="generate-view">
                    <div class="page-header">
                        <div>
                            <h1>AI Question Generator</h1>
                            <p>Turn documents, notes or photos into questions for <strong>${esc(quiz ? quiz.name : 'this quiz')}</strong>.</p>
                        </div>
                    </div>

                    <div class="gen-layout">
                        <div class="gen-main">
                            <section class="card gen-step">
                                <div class="card-header">
                                    <div><h2><span class="gen-step-num">1</span> Source material</h2><p>Upload files, paste notes or just name a topic</p></div>
                                </div>
                                <label class="gen-drop" id="gen-drop" tabindex="0">
                                    <input type="file" id="gen-file-input" multiple accept="${AI().DocExtract.ACCEPT}" hidden>
                                    <span class="gen-drop-icon">${UI().icon('upload')}</span>
                                    <strong>Choose files or drop them here</strong>
                                    <span>PDF, Word (.docx), PowerPoint (.pptx), text, Markdown, CSV, HTML, OpenDocument, or photos and screenshots. You can also paste images.</span>
                                </label>
                                <ul class="gen-files" id="gen-files"></ul>
                                <div class="form-row" style="margin-top: var(--spacing-md);">
                                    <div class="form-group">
                                        <label for="gen-notes">Paste notes or text <span class="text-muted" style="font-weight: 400;">(optional)</span></label>
                                        <textarea id="gen-notes" class="form-control" rows="4" placeholder="Paste lesson notes, an article, a sermon outline, meeting notes…">${esc(S.notes)}</textarea>
                                    </div>
                                    <div class="form-group">
                                        <label for="gen-topic">Topic or focus <span class="text-muted" style="font-weight: 400;">(optional)</span></label>
                                        <input type="text" id="gen-topic" class="form-control" value="${esc(S.topic)}" placeholder="e.g., The water cycle, or Chapter 3 only">
                                        <span class="form-hint">No files? Type a topic and the AI will write questions from its own knowledge.</span>
                                    </div>
                                </div>
                            </section>

                            <section class="card gen-step">
                                <div class="card-header">
                                    <div><h2><span class="gen-step-num">2</span> AI model</h2><p>Use your own account with any of these services</p></div>
                                </div>
                                <div class="form-row">
                                    <div class="form-group">
                                        <label for="gen-provider">AI service</label>
                                        <select id="gen-provider" class="form-control">
                                            ${providers.map(p => `<option value="${p.id}" ${p.id === prefs.providerId ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}
                                        </select>
                                    </div>
                                    <div class="form-group">
                                        <label for="gen-model">Model</label>
                                        <select id="gen-model" class="form-control"></select>
                                        <input type="text" id="gen-model-custom" class="form-control" placeholder="Model ID, e.g. llama-3.3-70b" style="margin-top: var(--spacing-sm);" hidden autocomplete="off">
                                    </div>
                                </div>
                                <div class="form-group" id="gen-baseurl-group" hidden>
                                    <label for="gen-baseurl">Server address (OpenAI-compatible)</label>
                                    <input type="url" id="gen-baseurl" class="form-control" placeholder="https://api.example.com/v1" value="${esc(prefs.baseUrl)}" autocomplete="off">
                                    <div class="gen-chips" id="gen-baseurl-presets"></div>
                                    <span class="form-hint">Local servers such as Ollama must allow browser requests (for Ollama, set OLLAMA_ORIGINS=*).</span>
                                </div>
                                <div class="form-group">
                                    <label for="gen-key" id="gen-key-label">API key</label>
                                    <div class="gen-key-row">
                                        <input type="password" id="gen-key" class="form-control" autocomplete="off" spellcheck="false">
                                        <button type="button" class="btn btn-secondary btn-icon" id="gen-key-toggle" aria-label="Show key" title="Show key">${UI().icon('eye')}</button>
                                    </div>
                                    <div class="gen-key-meta">
                                        <span class="form-hint" style="margin: 0;">${UI().icon('lock')} Saved only in this browser and sent only to the AI service you pick.</span>
                                        <span class="gen-key-links">
                                            <a href="#" target="_blank" rel="noopener" id="gen-key-link">Get a key</a>
                                            <button type="button" class="btn-link" id="gen-key-forget">Forget key</button>
                                            <button type="button" class="btn-link" id="gen-load-models">Load my models</button>
                                        </span>
                                    </div>
                                </div>
                            </section>

                            <section class="card gen-step">
                                <div class="card-header">
                                    <div><h2><span class="gen-step-num">3</span> Questions</h2><p>What to generate and how</p></div>
                                </div>
                                <div class="gen-counts">
                                    ${AI().Generator.TYPES.map(t => `
                                        <div class="gen-count-row">
                                            <div class="gen-count-label">
                                                ${UI().typeChip(t)}
                                                <span><strong>${TYPE_INFO[t].label}</strong><small>${TYPE_INFO[t].hint}</small></span>
                                            </div>
                                            <div class="stepper">
                                                <button type="button" class="btn btn-secondary btn-icon btn-sm" data-step="${t}" data-delta="-1" aria-label="Fewer ${TYPE_INFO[t].label}">${UI().icon('minus')}</button>
                                                <input type="number" class="form-control" id="gen-count-${t}" data-count="${t}" min="0" max="${AI().Generator.MAX_QUESTIONS}" value="${parseInt(prefs.counts[t], 10) || 0}" aria-label="${TYPE_INFO[t].label} questions">
                                                <button type="button" class="btn btn-secondary btn-icon btn-sm" data-step="${t}" data-delta="1" aria-label="More ${TYPE_INFO[t].label}">${UI().icon('plus')}</button>
                                            </div>
                                        </div>
                                    `).join('')}
                                    <div class="gen-count-total" id="gen-count-total"></div>
                                </div>

                                <div class="gen-options">
                                    <div class="form-group" id="gen-mcq-options-group">
                                        <span class="form-label">Options per multiple-choice question</span>
                                        <div class="segmented" id="gen-mcq-options" role="radiogroup" aria-label="Options per multiple-choice question">
                                            ${[2, 3, 4, 5, 6].map(n => `<button type="button" role="radio" data-value="${n}" class="${n === prefs.mcqOptions ? 'active' : ''}" aria-checked="${n === prefs.mcqOptions}">${n}</button>`).join('')}
                                        </div>
                                    </div>
                                    <div class="form-group">
                                        <span class="form-label">Difficulty</span>
                                        <div class="segmented" id="gen-difficulty" role="radiogroup" aria-label="Difficulty">
                                            ${DIFFICULTIES.map(d => `<button type="button" role="radio" data-value="${d.value}" class="${d.value === prefs.difficulty ? 'active' : ''}" aria-checked="${d.value === prefs.difficulty}">${d.label}</button>`).join('')}
                                        </div>
                                    </div>
                                    <div class="form-row">
                                        <div class="form-group">
                                            <label for="gen-audience">Audience</label>
                                            <select id="gen-audience" class="form-control">
                                                ${AUDIENCES.map(a => `<option value="${esc(a.value)}" ${a.value === prefs.audience ? 'selected' : ''}>${esc(a.label)}</option>`).join('')}
                                            </select>
                                        </div>
                                        <div class="form-group">
                                            <label for="gen-language">Language</label>
                                            <input type="text" id="gen-language" class="form-control" list="gen-language-list" value="${esc(prefs.language)}" autocomplete="off">
                                            <datalist id="gen-language-list">${LANGUAGES.map(l => `<option value="${l}"></option>`).join('')}</datalist>
                                        </div>
                                    </div>
                                    <div class="form-group">
                                        <label for="gen-category">Category for all questions <span class="text-muted" style="font-weight: 400;">(optional)</span></label>
                                        <input type="text" id="gen-category" class="form-control" value="${esc(prefs.category)}" placeholder="Leave empty to let the AI label each question" maxlength="40">
                                    </div>
                                    <div class="form-group">
                                        <label for="gen-instructions">Extra instructions <span class="text-muted" style="font-weight: 400;">(optional)</span></label>
                                        <textarea id="gen-instructions" class="form-control" rows="2" placeholder="e.g., Focus on dates and people. Avoid questions about chapter 1. Keep questions under 20 words.">${esc(prefs.instructions)}</textarea>
                                    </div>
                                    <div class="gen-toggles">
                                        <label class="gen-toggle"><input type="checkbox" id="gen-explanations" ${prefs.explanations ? 'checked' : ''}><span><strong>Include explanations</strong><small>A short "why" the host can read after revealing the answer</small></span></label>
                                        <label class="gen-toggle"><input type="checkbox" id="gen-avoid" ${prefs.avoidExisting ? 'checked' : ''}><span><strong>Avoid repeating this quiz's questions</strong><small>Skips facts already covered by existing questions</small></span></label>
                                        <label class="gen-toggle"><input type="checkbox" id="gen-review" ${prefs.reviewFirst ? 'checked' : ''}><span><strong>Review before adding</strong><small>Check and edit the questions first. When off, they're added straight away.</small></span></label>
                                    </div>
                                </div>
                            </section>
                        </div>

                        <aside class="gen-side">
                            <section class="card gen-summary" id="gen-summary"></section>
                        </aside>
                    </div>

                    <section id="gen-results"></section>
                </div>
            `;

            this.bind(container);
            this.renderModelPicker();
            this.renderFiles();
            this.renderCountTotal();
            this.renderSummary();
            this.renderResults();
        },

        // ---------- Step 2: provider / model / key ----------
        renderModelPicker: function() {
            const prefs = getPrefs();
            const provider = AI().Providers.get(prefs.providerId);
            const model = currentModel(prefs, provider);
            const presets = provider.models.map(m => m.id);
            const fetched = loadedModels(provider.id).filter(id => !presets.includes(id));
            const isCustom = model && !presets.includes(model) && !fetched.includes(model);

            $('gen-model').innerHTML = `
                ${provider.models.length ? `<optgroup label="Suggested">${provider.models.map(m => `<option value="${esc(m.id)}" ${m.id === model ? 'selected' : ''}>${esc(m.label)}</option>`).join('')}</optgroup>` : ''}
                ${fetched.length ? `<optgroup label="From your account">${fetched.map(id => `<option value="${esc(id)}" ${id === model ? 'selected' : ''}>${esc(id)}</option>`).join('')}</optgroup>` : ''}
                <option value="__custom" ${isCustom || (!model && !provider.models.length) ? 'selected' : ''}>Other model (type its ID)…</option>
            `;
            const customInput = $('gen-model-custom');
            customInput.hidden = $('gen-model').value !== '__custom';
            if (!customInput.hidden) customInput.value = isCustom ? model : (customInput.value || '');

            $('gen-baseurl-group').hidden = !provider.needsBaseUrl;
            if (provider.needsBaseUrl) {
                $('gen-baseurl-presets').innerHTML = provider.baseUrlPresets.map(p =>
                    `<button type="button" class="gen-chip" data-url="${esc(p.url)}">${esc(p.label)}</button>`).join('');
            }

            const keyInput = $('gen-key');
            keyInput.value = getKey(provider.id);
            keyInput.placeholder = provider.keyPlaceholder;
            $('gen-key-label').innerHTML = `${esc(provider.short)} API key${provider.keyOptional ? ' <span class="text-muted" style="font-weight: 400;">(optional)</span>' : ''}`;
            const link = $('gen-key-link');
            link.hidden = !provider.keyUrl;
            if (provider.keyUrl) link.href = provider.keyUrl;
            $('gen-key-forget').hidden = !keyInput.value;
        },

        selectedModel: function() {
            const value = $('gen-model').value;
            return value === '__custom' ? $('gen-model-custom').value.trim() : value;
        },

        // ---------- Step 1: files ----------
        renderFiles: function() {
            const list = $('gen-files');
            if (!list) return;
            const icons = { pdf: 'fileText', docx: 'fileText', pptx: 'monitor', odf: 'fileText', text: 'fileText', html: 'fileText', image: 'image', unknown: 'alert' };
            list.innerHTML = S.docs.map(doc => {
                let status;
                if (doc.reading) status = `<span class="gen-file-status">${UI().icon('loader', 'spin')} Reading…</span>`;
                else if (doc.error) status = `<span class="gen-file-status is-error">${esc(doc.error)}</span>`;
                else {
                    const bits = [];
                    if (doc.pages) bits.push(`${doc.pages} ${doc.kind === 'pptx' ? 'slide' : 'page'}${doc.pages === 1 ? '' : 's'}`);
                    if (doc.text) {
                        const words = doc.text.split(/\s+/).filter(Boolean).length;
                        bits.push(words < 1000 ? `${words} word${words === 1 ? '' : 's'}` : `${(words / 1000).toFixed(words < 10000 ? 1 : 0)}k words`);
                    }
                    if (doc.kind === 'image') bits.push('picture');
                    status = `<span class="gen-file-status">${UI().icon('check')} ${esc(bits.join(' · ') || 'Ready')}</span>`;
                }
                return `
                    <li class="gen-file ${doc.error ? 'has-error' : ''}">
                        <span class="gen-file-icon">${UI().icon(icons[doc.kind] || 'fileText')}</span>
                        <div class="gen-file-body">
                            <strong title="${esc(doc.name)}">${esc(doc.name)}</strong>
                            <span class="gen-file-meta">${formatSize(doc.size)} ${status}</span>
                            ${(doc.notes || []).map(n => `<span class="gen-file-note">${esc(n)}</span>`).join('')}
                        </div>
                        <button type="button" class="btn btn-ghost btn-icon btn-sm" data-remove-doc="${doc.id}" aria-label="Remove ${esc(doc.name)}" title="Remove">${UI().icon('x')}</button>
                    </li>
                `;
            }).join('');
        },

        addFiles: async function(fileList) {
            const files = [...fileList];
            if (!files.length) return;
            const room = MAX_FILES - S.docs.length;
            if (room <= 0) {
                Toast().show(`You can add up to ${MAX_FILES} files.`, 'warning');
                return;
            }
            if (files.length > room) Toast().show(`Only the first ${room} file${room === 1 ? '' : 's'} were added (limit ${MAX_FILES}).`, 'warning');

            const placeholders = files.slice(0, room).map(file => ({
                id: 'P' + Math.random().toString(36).slice(2, 9), name: file.name || 'Pasted image.png', size: file.size,
                kind: '', reading: true, file
            }));
            S.docs.push(...placeholders);
            this.renderFiles();
            this.renderSummary();

            // Read one at a time to keep memory use low on phones
            for (const ph of placeholders) {
                const doc = await AI().DocExtract.readFile(ph.file);
                if (!ph.file.name) doc.name = ph.name;
                const index = S.docs.indexOf(ph);
                if (index !== -1) S.docs[index] = doc; // skipped if removed while reading
                this.renderFiles();
                this.renderSummary();
            }
        },

        // ---------- Step 3: counts ----------
        readCounts: function() {
            const counts = {};
            AI().Generator.TYPES.forEach(t => {
                const input = $(`gen-count-${t}`);
                counts[t] = Math.max(0, Math.min(AI().Generator.MAX_QUESTIONS, parseInt(input && input.value, 10) || 0));
            });
            return counts;
        },

        renderCountTotal: function() {
            const counts = this.readCounts();
            const total = totalCount(counts);
            const max = AI().Generator.MAX_QUESTIONS;
            const el = $('gen-count-total');
            el.className = 'gen-count-total' + (total > max ? ' is-error' : '');
            el.textContent = total > max ? `${total} questions: the limit is ${max} per run` : `${total} question${total === 1 ? '' : 's'} in total`;
            $('gen-mcq-options-group').classList.toggle('is-muted', !counts.mcq);
        },

        // ---------- Summary + progress ----------
        renderSummary: function() {
            const el = $('gen-summary');
            if (!el) return;
            const prefs = getPrefs();
            const provider = AI().Providers.get(prefs.providerId);
            const model = $('gen-model') ? this.selectedModel() : currentModel(prefs, provider);
            const quiz = window.QuizBowl.Data.QuizzesDB.getActive();
            const counts = $('gen-count-mcq') ? this.readCounts() : prefs.counts;
            const total = totalCount(counts);
            const ready = S.docs.filter(d => !d.reading && !d.error);
            const reading = S.docs.some(d => d.reading);
            const hasSource = ready.length > 0 || S.notes.trim() || S.topic.trim();

            let blocker = '';
            if (reading) blocker = 'Waiting for files to finish reading…';
            else if (!hasSource) blocker = 'Add a file, paste notes, or type a topic.';
            else if (!total) blocker = 'Choose how many questions to generate.';
            else if (total > AI().Generator.MAX_QUESTIONS) blocker = `Generate at most ${AI().Generator.MAX_QUESTIONS} questions per run.`;
            else if (provider.needsBaseUrl && !(prefs.baseUrl || '').trim()) blocker = 'Enter the server address.';
            else if (!model) blocker = 'Choose a model.';
            else if (!provider.keyOptional && !getKey(provider.id)) blocker = `Enter your ${provider.short} API key.`;

            if (S.running) {
                const seconds = Math.round((Date.now() - S.startedAt) / 1000);
                el.innerHTML = `
                    <div class="gen-progress" role="status" aria-live="polite">
                        <div class="gen-progress-head">${UI().icon('loader', 'spin')}<strong>Generating…</strong><span class="text-muted">${seconds}s</span></div>
                        <p>${esc(S.progress)}</p>
                        <div class="gen-progress-bar"><span></span></div>
                        <p class="form-hint">Large files and bigger models can take a minute or two.</p>
                        <button type="button" class="btn btn-secondary btn-block" id="gen-cancel">Cancel</button>
                    </div>
                `;
                return;
            }

            el.innerHTML = `
                <h2 class="gen-summary-title">${UI().icon('sparkles')} Ready to generate</h2>
                <dl class="gen-summary-list">
                    <div><dt>Material</dt><dd>${ready.length ? `${ready.length} file${ready.length === 1 ? '' : 's'}` : ''}${ready.length && (S.notes.trim() || S.topic.trim()) ? ' + ' : ''}${S.notes.trim() ? 'notes' : ''}${S.notes.trim() && S.topic.trim() ? ', ' : ''}${S.topic.trim() ? 'topic' : ''}${!hasSource ? '<span class="text-muted">None yet</span>' : ''}</dd></div>
                    <div><dt>Questions</dt><dd>${total}</dd></div>
                    <div><dt>Model</dt><dd title="${esc(model)}">${esc(model || '-')}</dd></div>
                    <div><dt>Adds to</dt><dd>${esc(quiz ? quiz.name : '-')}</dd></div>
                </dl>
                ${S.error ? `<div class="callout callout-danger gen-error">${UI().icon('alert')}<span>${esc(S.error)}</span></div>` : ''}
                <button type="button" class="btn btn-primary btn-lg btn-block" id="gen-run" ${blocker ? 'disabled' : ''}>${UI().icon('sparkles')} Generate ${total || ''} question${total === 1 ? '' : 's'}</button>
                <p class="form-hint gen-blocker">${esc(blocker || 'You pay the AI service for usage on your own account.')}</p>
            `;
        },

        // ---------- Results ----------
        renderResults: function() {
            const el = $('gen-results');
            if (!el) return;
            const R = S.result;
            if (!R) { el.innerHTML = ''; return; }

            const selected = R.drafts.filter(d => d.selected);
            const L = AI().Generator.LETTERS;

            const cardHtml = (d) => {
                if (S.editing === d.id && !R.imported) return this.editCardHtml(d);
                const answer = d.type === 'mcq' ? '' : `
                    <div class="gen-q-answer"><span>Answer</span><strong>${esc(d.answer)}${d.unit ? ' ' + esc(d.unit) : ''}</strong></div>`;
                return `
                    <article class="gen-q ${d.selected || R.imported ? '' : 'is-off'}" data-draft="${d.id}">
                        <header class="gen-q-head">
                            ${R.imported ? '' : `<label class="gen-q-check" title="Include this question"><input type="checkbox" data-select="${d.id}" ${d.selected ? 'checked' : ''} aria-label="Include this question"></label>`}
                            ${UI().typeChip(d.type)}
                            <span class="badge gen-diff gen-diff-${d.difficulty}">${esc(d.difficulty)}</span>
                            <span class="gen-q-cat">${esc(d.category)}</span>
                            ${R.imported ? '' : `
                                <span class="gen-q-actions">
                                    <button type="button" class="btn btn-ghost btn-sm" data-edit="${d.id}">${UI().icon('pencil')} Edit</button>
                                </span>`}
                        </header>
                        <div class="gen-q-text">${esc(d.question).replace(/\n/g, '<br>')}</div>
                        ${d.type === 'mcq' ? `
                            <ol class="gen-q-options">
                                ${d.options.map((o, i) => `<li class="${i === d.correctIndex ? 'is-correct' : ''}"><span class="mcq-letter">${L[i]}</span><span>${esc(o)}</span>${i === d.correctIndex ? UI().icon('check') : ''}</li>`).join('')}
                            </ol>` : answer}
                        ${d.explanation ? `<p class="gen-q-expl">${UI().icon('info')}<span>${esc(d.explanation)}</span></p>` : ''}
                    </article>
                `;
            };

            el.innerHTML = `
                <div class="gen-results-head">
                    <div>
                        <h2>${R.imported ? `${UI().icon('checkCircle')} Added ${R.addedCount} question${R.addedCount === 1 ? '' : 's'} to ${esc(R.quizName)}` : `Review ${R.drafts.length} generated question${R.drafts.length === 1 ? '' : 's'}`}</h2>
                        <p>${R.imported
                            ? 'They\'re in the Question Bank and ready to use on the public display.'
                            : `Untick any you don't want, or edit them. Then add them to <strong>${esc(R.quizName)}</strong>, or download them as a PDF without adding them.`}</p>
                    </div>
                    <div class="gen-results-actions">
                        ${R.imported ? `
                            <button type="button" class="btn btn-secondary" id="gen-pdf">${UI().icon('download')} Download PDF</button>
                            <a href="#questions" class="btn btn-primary">${UI().icon('questions')} Open Question Bank</a>
                            <button type="button" class="btn btn-secondary" id="gen-clear-results">Generate more</button>
                        ` : `
                            <button type="button" class="btn btn-ghost btn-sm" id="gen-select-all">Select all</button>
                            <button type="button" class="btn btn-ghost btn-sm" id="gen-select-none">Select none</button>
                            <button type="button" class="btn btn-secondary" id="gen-discard">Discard</button>
                            <button type="button" class="btn btn-secondary" id="gen-pdf" ${selected.length ? '' : 'disabled'} title="Download the selected questions as a PDF without adding them">${UI().icon('download')} Download PDF</button>
                            <button type="button" class="btn btn-primary" id="gen-add" ${selected.length ? '' : 'disabled'}>${UI().icon('plus')} Add ${selected.length} to quiz</button>
                        `}
                    </div>
                </div>
                ${R.warnings.length ? `<div class="callout callout-warning" style="margin-bottom: var(--spacing-md);">${UI().icon('alert')}<span>${R.warnings.map(esc).join('<br>')}</span></div>` : ''}
                <div class="gen-q-list">${R.drafts.map(cardHtml).join('')}</div>
                ${!R.imported && R.drafts.length > 4 ? `
                    <div class="gen-results-foot">
                        <button type="button" class="btn btn-primary btn-lg" id="gen-add-bottom" ${selected.length ? '' : 'disabled'}>${UI().icon('plus')} Add ${selected.length} question${selected.length === 1 ? '' : 's'} to ${esc(R.quizName)}</button>
                    </div>` : ''}
            `;

            if (window.MathJax && MathJax.typesetPromise) {
                MathJax.typesetPromise([el]).catch(err => console.log(err));
            }
        },

        editCardHtml: function(d) {
            const L = AI().Generator.LETTERS;
            return `
                <article class="gen-q is-editing" data-draft="${d.id}">
                    <header class="gen-q-head">${UI().typeChip(d.type)}<strong>Edit question</strong></header>
                    <div class="form-group">
                        <label for="edit-q-${d.id}">Question</label>
                        <textarea id="edit-q-${d.id}" class="form-control" rows="3" data-field="question">${esc(d.question)}</textarea>
                    </div>
                    ${d.type === 'mcq' ? `
                        <div class="form-group">
                            <span class="form-label">Options <span class="form-hint" style="display: inline;">(select the correct one)</span></span>
                            <div class="mcq-options">
                                ${d.options.map((o, i) => `
                                    <div class="mcq-option-row">
                                        <label title="Mark ${L[i]} as correct">
                                            <input type="radio" name="edit-correct-${d.id}" value="${i}" ${i === d.correctIndex ? 'checked' : ''}>
                                            <span class="mcq-letter">${L[i]}</span>
                                        </label>
                                        <input type="text" class="form-control" data-option="${i}" value="${esc(o)}" aria-label="Option ${L[i]}">
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    ` : d.type === 'true_false' ? `
                        <div class="form-group">
                            <span class="form-label">Correct answer</span>
                            <div class="result-options" style="grid-template-columns: repeat(2, 1fr); max-width: 320px;">
                                <label class="result-option"><input type="radio" name="edit-tf-${d.id}" value="True" ${d.answer === 'True' ? 'checked' : ''}><span>True</span></label>
                                <label class="result-option"><input type="radio" name="edit-tf-${d.id}" value="False" ${d.answer === 'False' ? 'checked' : ''}><span>False</span></label>
                            </div>
                        </div>
                    ` : `
                        <div class="form-row">
                            <div class="form-group">
                                <label for="edit-a-${d.id}">Answer</label>
                                <input type="text" id="edit-a-${d.id}" class="form-control" data-field="answer" value="${esc(d.answer)}">
                            </div>
                            ${d.type === 'calculation' ? `
                                <div class="form-group">
                                    <label for="edit-u-${d.id}">Unit</label>
                                    <input type="text" id="edit-u-${d.id}" class="form-control" data-field="unit" value="${esc(d.unit)}">
                                </div>` : ''}
                        </div>
                    `}
                    <div class="form-row">
                        <div class="form-group">
                            <label for="edit-c-${d.id}">Category</label>
                            <input type="text" id="edit-c-${d.id}" class="form-control" data-field="category" value="${esc(d.category)}" maxlength="40">
                        </div>
                        <div class="form-group">
                            <label for="edit-d-${d.id}">Difficulty</label>
                            <select id="edit-d-${d.id}" class="form-control" data-field="difficulty">
                                ${['easy', 'medium', 'hard'].map(v => `<option value="${v}" ${v === d.difficulty ? 'selected' : ''}>${v.charAt(0).toUpperCase() + v.slice(1)}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="edit-e-${d.id}">Explanation <span class="text-muted" style="font-weight: 400;">(optional)</span></label>
                        <textarea id="edit-e-${d.id}" class="form-control" rows="2" data-field="explanation">${esc(d.explanation)}</textarea>
                    </div>
                    <div class="gen-edit-actions">
                        <button type="button" class="btn btn-secondary" data-edit-cancel="${d.id}">Cancel</button>
                        <button type="button" class="btn btn-primary" data-edit-save="${d.id}">${UI().icon('check')} Save</button>
                    </div>
                </article>
            `;
        },

        saveEdit: function(id) {
            const R = S.result;
            const d = R && R.drafts.find(x => x.id === id);
            const card = document.querySelector(`.gen-q[data-draft="${id}"]`);
            if (!d || !card) return;
            const updated = { ...d };
            card.querySelectorAll('[data-field]').forEach(el => { updated[el.getAttribute('data-field')] = el.value.trim(); });
            if (d.type === 'mcq') {
                updated.options = [...card.querySelectorAll('[data-option]')].map(el => el.value.trim());
                const checked = card.querySelector(`input[name="edit-correct-${id}"]:checked`);
                updated.correctIndex = checked ? parseInt(checked.value, 10) : -1;
            } else if (d.type === 'true_false') {
                const checked = card.querySelector(`input[name="edit-tf-${id}"]:checked`);
                updated.answer = checked ? checked.value : '';
            }
            const problem = AI().Generator.validateDraft(updated);
            if (problem) {
                Toast().show(problem, 'warning');
                return;
            }
            Object.assign(d, updated, { category: updated.category || 'General' });
            S.editing = null;
            this.renderResults();
        },

        // ---------- Generate ----------
        run: async function() {
            if (S.running) return;
            const prefs = getPrefs();
            const provider = AI().Providers.get(prefs.providerId);
            const model = this.selectedModel();

            if (S.result && !S.result.imported && S.result.drafts.some(d => d.selected)) {
                const ok = await window.QuizBowl.Components.Modal.confirm({
                    title: 'Replace the questions you haven\'t added?',
                    message: 'Generating again replaces the current review list. Add them first if you want to keep them.',
                    confirmText: 'Generate Anyway'
                });
                if (!ok) return;
            }

            const quiz = window.QuizBowl.Data.QuizzesDB.getActive();
            const input = {
                docs: S.docs.filter(d => !d.reading && !d.error),
                notes: S.notes,
                topic: S.topic,
                providerId: provider.id,
                model: model,
                apiKey: getKey(provider.id),
                baseUrl: prefs.baseUrl,
                counts: this.readCounts(),
                mcqOptions: prefs.mcqOptions,
                difficulty: prefs.difficulty,
                audience: prefs.audience,
                language: (prefs.language || 'English').trim() || 'English',
                category: (prefs.category || '').trim(),
                instructions: prefs.instructions,
                explanations: prefs.explanations,
                avoidExisting: prefs.avoidExisting,
                existingQuestions: window.QuizBowl.Services.QuestionService.getAllQuestions().map(q => q.question)
            };

            S.running = true;
            S.error = '';
            S.progress = 'Preparing your material…';
            S.startedAt = Date.now();
            S.controller = new AbortController();
            S.result = null;
            S.editing = null;
            this.renderResults();
            this.renderSummary();
            clearInterval(timer);
            timer = setInterval(() => {
                if (window.QuizBowl.State.currentRoute === 'generate') this.renderSummary();
            }, 1000);

            try {
                const out = await AI().Generator.generate(input, {
                    signal: S.controller.signal,
                    onProgress: p => { S.progress = p.message; this.renderSummary(); }
                });
                S.result = {
                    drafts: out.drafts,
                    warnings: out.warnings,
                    quizId: quiz.id,
                    quizName: quiz.name,
                    meta: {
                        kind: 'ai', provider: provider.id, model: model,
                        files: input.docs.map(d => d.name), createdAt: Date.now()
                    },
                    imported: false,
                    addedCount: 0
                };
                if (!prefs.reviewFirst) {
                    this.addToQuiz(true);
                } else {
                    Toast().show(`${out.drafts.length} question${out.drafts.length === 1 ? '' : 's'} ready to review.`, 'success');
                }
            } catch (err) {
                if (err.kind !== 'aborted') {
                    console.error(err);
                    S.error = err.message || 'Something went wrong. Please try again.';
                    Toast().show('Generation failed. See the details next to the Generate button.', 'danger');
                } else {
                    Toast().show('Generation cancelled.', 'info');
                }
            } finally {
                S.running = false;
                S.controller = null;
                clearInterval(timer);
                if (window.QuizBowl.State.currentRoute === 'generate') {
                    this.renderSummary();
                    this.renderResults();
                    if (S.result) {
                        const results = $('gen-results');
                        if (results) results.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                }
            }
        },

        addToQuiz: function(auto = false) {
            const R = S.result;
            if (!R || R.imported) return;
            const QuizzesDB = window.QuizBowl.Data.QuizzesDB;
            if (!QuizzesDB.getById(R.quizId)) {
                Toast().show(`The quiz "${R.quizName}" no longer exists.`, 'danger');
                return;
            }
            const invalid = R.drafts.filter(d => d.selected).map(d => AI().Generator.validateDraft(d)).find(Boolean);
            if (invalid) {
                Toast().show(invalid, 'warning');
                return;
            }

            // Questions always go to the quiz the material was uploaded in
            let switched = false;
            if (QuizzesDB.getActiveId() !== R.quizId) {
                QuizzesDB.setActive(R.quizId);
                window.QuizBowl.App.refreshQuizSwitcher();
                switched = true;
            }

            const settings = window.QuizBowl.Data.SettingsDB.getSettings();
            const QuestionService = window.QuizBowl.Services.QuestionService;
            let added = 0;
            R.drafts.filter(d => d.selected).forEach(d => {
                try {
                    QuestionService.addQuestion(AI().Generator.toAppQuestion(d, settings, R.meta));
                    added++;
                } catch (err) {
                    console.error('Could not add question', err);
                }
            });

            R.drafts = R.drafts.filter(d => d.selected);
            R.imported = true;
            R.addedCount = added;
            S.editing = null;
            Toast().show(`Added ${added} question${added === 1 ? '' : 's'} to ${R.quizName}${switched ? ' (switched back to that quiz)' : ''}.`, 'success');
            if (window.QuizBowl.State.currentRoute === 'generate') {
                if (switched) this.render(document.getElementById('view-container'));
                else { this.renderResults(); this.renderSummary(); }
            }
            return auto;
        },

        // Export the reviewed questions straight to PDF, without adding them to the quiz
        downloadPdf: function() {
            const R = S.result;
            if (!R) return;
            const drafts = R.imported ? R.drafts : R.drafts.filter(d => d.selected);
            if (!drafts.length) {
                Toast().show('Select at least one question.', 'warning');
                return;
            }
            const invalid = drafts.map(d => AI().Generator.validateDraft(d)).find(Boolean);
            if (invalid) {
                Toast().show(invalid, 'warning');
                return;
            }
            const settings = window.QuizBowl.Data.SettingsDB.getSettings();
            const prefixes = { mcq: 'MCQ', true_false: 'TF', theory: 'THRY', calculation: 'CALC' };
            const counters = {};
            const questions = drafts.map(d => {
                const q = AI().Generator.toAppQuestion(d, settings, R.meta);
                counters[d.type] = (counters[d.type] || 0) + 1;
                q.id = `${prefixes[d.type]}${String(counters[d.type]).padStart(3, '0')}`;
                return q;
            });
            const topic = S.topic.trim();
            window.QuizBowl.Export.openDialog(questions, {
                title: topic ? `${topic} quiz` : `${R.quizName} questions`,
                quizName: R.quizName,
                heading: `Download ${questions.length} question${questions.length === 1 ? '' : 's'} as PDF`
            });
        },

        // ---------- Events ----------
        bind: function(container) {
            const view = container.querySelector('.generate-view');
            const self = this;

            // Files: picker, drag & drop, paste
            const drop = $('gen-drop');
            const fileInput = $('gen-file-input');
            fileInput.addEventListener('change', () => { self.addFiles(fileInput.files); fileInput.value = ''; });
            drop.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); } });
            ['dragenter', 'dragover'].forEach(evt => drop.addEventListener(evt, e => { e.preventDefault(); drop.classList.add('is-over'); }));
            ['dragleave', 'drop'].forEach(evt => drop.addEventListener(evt, e => { e.preventDefault(); drop.classList.remove('is-over'); }));
            drop.addEventListener('drop', e => self.addFiles(e.dataTransfer.files));
            if (!pasteBound) {
                pasteBound = true;
                document.addEventListener('paste', e => {
                    if (window.QuizBowl.State.currentRoute !== 'generate') return;
                    const files = [...(e.clipboardData ? e.clipboardData.files : [])];
                    if (files.length) { e.preventDefault(); self.addFiles(files); }
                });
            }

            $('gen-notes').addEventListener('input', e => { S.notes = e.target.value; self.renderSummary(); });
            $('gen-topic').addEventListener('input', e => { S.topic = e.target.value; self.renderSummary(); });

            // Provider / model / key
            $('gen-provider').addEventListener('change', e => {
                savePrefs({ providerId: e.target.value });
                S.error = '';
                self.renderModelPicker();
                self.renderSummary();
            });
            $('gen-model').addEventListener('change', e => {
                const prefs = getPrefs();
                const custom = e.target.value === '__custom';
                $('gen-model-custom').hidden = !custom;
                if (custom) $('gen-model-custom').focus();
                else savePrefs({ models: { ...prefs.models, [prefs.providerId]: e.target.value } });
                self.renderSummary();
            });
            $('gen-model-custom').addEventListener('input', e => {
                const prefs = getPrefs();
                savePrefs({ models: { ...prefs.models, [prefs.providerId]: e.target.value.trim() } });
                self.renderSummary();
            });
            $('gen-baseurl').addEventListener('input', e => { savePrefs({ baseUrl: e.target.value.trim() }); self.renderSummary(); });
            $('gen-baseurl-presets').addEventListener('click', e => {
                const chip = e.target.closest('[data-url]');
                if (!chip) return;
                $('gen-baseurl').value = chip.getAttribute('data-url');
                savePrefs({ baseUrl: chip.getAttribute('data-url') });
                self.renderSummary();
            });
            $('gen-key').addEventListener('input', e => {
                setKey(getPrefs().providerId, e.target.value.trim());
                $('gen-key-forget').hidden = !e.target.value.trim();
                S.error = '';
                self.renderSummary();
            });
            $('gen-key-toggle').addEventListener('click', () => {
                const input = $('gen-key');
                const show = input.type === 'password';
                input.type = show ? 'text' : 'password';
                $('gen-key-toggle').innerHTML = UI().icon(show ? 'eyeOff' : 'eye');
                $('gen-key-toggle').setAttribute('aria-label', show ? 'Hide key' : 'Show key');
            });
            $('gen-key-forget').addEventListener('click', () => {
                setKey(getPrefs().providerId, '');
                $('gen-key').value = '';
                $('gen-key-forget').hidden = true;
                Toast().show('API key removed from this browser.', 'info');
                self.renderSummary();
            });
            $('gen-load-models').addEventListener('click', async () => {
                const prefs = getPrefs();
                const provider = AI().Providers.get(prefs.providerId);
                const btn = $('gen-load-models');
                btn.disabled = true;
                btn.textContent = 'Loading…';
                try {
                    const list = await provider.listModels({ apiKey: getKey(provider.id), baseUrl: prefs.baseUrl });
                    saveLoadedModels(provider.id, list);
                    self.renderModelPicker();
                    Toast().show(list.length ? `Found ${list.length} model${list.length === 1 ? '' : 's'}. Pick one under "From your account".` : 'No models were found for this key.', list.length ? 'success' : 'warning');
                } catch (err) {
                    Toast().show(err.message, 'danger');
                } finally {
                    btn.disabled = false;
                    btn.textContent = 'Load my models';
                }
            });

            // Question options
            view.querySelectorAll('[data-step]').forEach(btn => btn.addEventListener('click', () => {
                const input = $(`gen-count-${btn.getAttribute('data-step')}`);
                input.value = Math.max(0, Math.min(AI().Generator.MAX_QUESTIONS, (parseInt(input.value, 10) || 0) + parseInt(btn.getAttribute('data-delta'), 10)));
                input.dispatchEvent(new Event('input', { bubbles: true }));
            }));
            view.querySelectorAll('[data-count]').forEach(input => input.addEventListener('input', () => {
                savePrefs({ counts: self.readCounts() });
                self.renderCountTotal();
                self.renderSummary();
            }));
            const segmented = (id, key, parse = v => v) => {
                $(id).addEventListener('click', e => {
                    const btn = e.target.closest('button[data-value]');
                    if (!btn) return;
                    $(id).querySelectorAll('button').forEach(b => {
                        const on = b === btn;
                        b.classList.toggle('active', on);
                        b.setAttribute('aria-checked', on);
                    });
                    savePrefs({ [key]: parse(btn.getAttribute('data-value')) });
                });
            };
            segmented('gen-mcq-options', 'mcqOptions', v => parseInt(v, 10));
            segmented('gen-difficulty', 'difficulty');
            $('gen-audience').addEventListener('change', e => savePrefs({ audience: e.target.value }));
            $('gen-language').addEventListener('input', e => savePrefs({ language: e.target.value }));
            $('gen-category').addEventListener('input', e => savePrefs({ category: e.target.value }));
            $('gen-instructions').addEventListener('input', e => savePrefs({ instructions: e.target.value }));
            $('gen-explanations').addEventListener('change', e => savePrefs({ explanations: e.target.checked }));
            $('gen-avoid').addEventListener('change', e => savePrefs({ avoidExisting: e.target.checked }));
            $('gen-review').addEventListener('change', e => savePrefs({ reviewFirst: e.target.checked }));

            // Delegated clicks (files, summary, results)
            view.addEventListener('click', async e => {
                const t = e.target;
                const removeDoc = t.closest('[data-remove-doc]');
                if (removeDoc) {
                    S.docs = S.docs.filter(d => d.id !== removeDoc.getAttribute('data-remove-doc'));
                    self.renderFiles();
                    self.renderSummary();
                    return;
                }
                if (t.closest('#gen-run')) return self.run();
                if (t.closest('#gen-cancel')) { if (S.controller) S.controller.abort(); return; }

                const R = S.result;
                if (!R) return;
                if (t.closest('#gen-add') || t.closest('#gen-add-bottom')) return self.addToQuiz();
                if (t.closest('#gen-pdf')) return self.downloadPdf();
                if (t.closest('#gen-select-all') || t.closest('#gen-select-none')) {
                    const on = !!t.closest('#gen-select-all');
                    R.drafts.forEach(d => { d.selected = on; });
                    return self.renderResults();
                }
                if (t.closest('#gen-discard')) {
                    const ok = await window.QuizBowl.Components.Modal.confirm({
                        title: 'Discard these questions?', message: 'They haven\'t been added to the quiz.',
                        confirmText: 'Discard', danger: true
                    });
                    if (ok) { S.result = null; S.editing = null; self.renderResults(); }
                    return;
                }
                if (t.closest('#gen-clear-results')) {
                    S.result = null;
                    self.renderResults();
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                    document.getElementById('view-container').scrollTo({ top: 0, behavior: 'smooth' });
                    return;
                }
                const edit = t.closest('[data-edit]');
                if (edit) { S.editing = edit.getAttribute('data-edit'); self.renderResults(); return; }
                const cancel = t.closest('[data-edit-cancel]');
                if (cancel) { S.editing = null; self.renderResults(); return; }
                const save = t.closest('[data-edit-save]');
                if (save) { self.saveEdit(save.getAttribute('data-edit-save')); return; }
            });
            view.addEventListener('change', e => {
                const sel = e.target.closest('[data-select]');
                if (!sel || !S.result) return;
                const d = S.result.drafts.find(x => x.id === sel.getAttribute('data-select'));
                if (d) { d.selected = sel.checked; self.renderResults(); }
            });
        }
    };
})();
