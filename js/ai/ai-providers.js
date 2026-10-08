/**
 * js/ai/ai-providers.js
 * Adapters for the AI services the question generator can use.
 *
 * Each provider turns one generic request into its own HTTP API call and
 * returns the model's text. Calls go straight from the browser to the
 * provider using the key the user saved on this device; there is no server.
 *
 * Generic request:
 *   { model, apiKey, baseUrl, system, parts, schema, structured, maxTokens, signal }
 *   parts: [{ kind: 'text', text, cache? } | { kind: 'image', mime, data } | { kind: 'pdf', name, data }]
 *   (data is base64 without the "data:" prefix; `cache` marks the end of the reusable source block)
 */
(function() {
    class AIError extends Error {
        constructor(message, { kind = 'other', status = 0, retryable = false } = {}) {
            super(message);
            this.kind = kind;          // auth | model | rate | network | format | refusal | truncated | busy | aborted | other
            this.status = status;
            this.retryable = retryable;
        }
    }

    const sleep = (ms, signal) => new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, ms);
        if (signal) signal.addEventListener('abort', () => { clearTimeout(timer); reject(new AIError('Cancelled.', { kind: 'aborted' })); }, { once: true });
    });

    function providerMessage(body) {
        if (!body) return '';
        if (typeof body === 'string') return body.slice(0, 400);
        const err = Array.isArray(body) ? body[0] && body[0].error : body.error;
        if (err && typeof err === 'object') return err.message || JSON.stringify(err).slice(0, 400);
        if (typeof err === 'string') return err;
        return body.message || body.detail || '';
    }

    function errorFromStatus(status, detail, providerName, model) {
        const suffix = detail ? ` (${providerName} said: "${detail}")` : '';
        if (status === 401 || status === 403) {
            return new AIError(`${providerName} rejected the API key. Check that it is correct and that billing is set up on your account.${suffix}`, { kind: 'auth', status });
        }
        if (status === 404) {
            return new AIError(`The model "${model}" isn't available with this key. Pick another model or use "Load my models".${suffix}`, { kind: 'model', status });
        }
        if (status === 413) {
            return new AIError(`The files are too large for ${providerName} in one request. Remove some files or use fewer pages.${suffix}`, { kind: 'other', status });
        }
        if (status === 429) {
            return new AIError(`${providerName} rate limit or quota reached. Wait a minute and try again, or check your plan's usage limits.${suffix}`, { kind: 'rate', status, retryable: true });
        }
        if (status >= 500) {
            return new AIError(`${providerName} is busy or having problems right now. Please try again shortly.${suffix}`, { kind: 'busy', status, retryable: true });
        }
        return new AIError(`${providerName} returned an error (HTTP ${status}).${suffix}`, { kind: status === 400 ? 'format' : 'other', status });
    }

    // POST/GET JSON with retries for rate limits and server hiccups
    async function requestJson(url, { method = 'POST', headers = {}, body, signal, providerName, model }) {
        let attempt = 0;
        for (;;) {
            let response;
            try {
                response = await fetch(url, {
                    method,
                    headers: body ? { 'Content-Type': 'application/json', ...headers } : headers,
                    body: body ? JSON.stringify(body) : undefined,
                    signal
                });
            } catch (err) {
                if (err.name === 'AbortError') throw new AIError('Cancelled.', { kind: 'aborted' });
                throw new AIError(`Couldn't reach ${providerName}. Check your internet connection. Custom servers must also allow requests from web pages (CORS).`, { kind: 'network', retryable: true });
            }

            const text = await response.text();
            let json = null;
            try { json = text ? JSON.parse(text) : null; } catch (e) { json = null; }

            if (response.ok) return json;

            const error = errorFromStatus(response.status, providerMessage(json || text), providerName, model);
            if (error.retryable && attempt < 2) {
                attempt++;
                const retryAfter = parseFloat(response.headers.get('retry-after'));
                const wait = Number.isFinite(retryAfter) ? Math.min(retryAfter * 1000, 30000) : 3000 * attempt;
                await sleep(wait, signal);
                continue;
            }
            throw error;
        }
    }

    const dataUrl = (mime, data) => `data:${mime};base64,${data}`;

    // ---------- OpenAI (Responses API) ----------
    async function callOpenAI(req) {
        const content = req.parts.map(p => {
            if (p.kind === 'image') return { type: 'input_image', image_url: dataUrl(p.mime, p.data) };
            if (p.kind === 'pdf') return { type: 'input_file', filename: p.name, file_data: dataUrl('application/pdf', p.data) };
            return { type: 'input_text', text: p.text };
        });
        const body = {
            model: req.model,
            instructions: req.system,
            input: [{ role: 'user', content }],
            // Reasoning models count their thinking against this limit, so leave generous room
            max_output_tokens: 32000
        };
        if (req.structured) {
            body.text = { format: { type: 'json_schema', name: 'quiz_questions', schema: req.schema, strict: true } };
        }

        const json = await requestJson('https://api.openai.com/v1/responses', {
            headers: { Authorization: `Bearer ${req.apiKey}` },
            body, signal: req.signal, providerName: 'OpenAI', model: req.model
        });

        let text = typeof json.output_text === 'string' ? json.output_text : '';
        let refusal = '';
        (json.output || []).forEach(item => (item.content || []).forEach(c => {
            if (!json.output_text && c.type === 'output_text') text += c.text;
            if (c.type === 'refusal') refusal = c.refusal;
        }));
        if (refusal) throw new AIError(`OpenAI declined this request: ${refusal}`, { kind: 'refusal' });
        if (json.status === 'incomplete') {
            const reason = json.incomplete_details && json.incomplete_details.reason;
            if (reason === 'content_filter') throw new AIError('OpenAI blocked this request with its content filter.', { kind: 'refusal' });
            throw new AIError('The answer was cut off because it ran out of space.', { kind: 'truncated' });
        }
        return text;
    }

    async function listOpenAIModels(apiKey, signal) {
        const json = await requestJson('https://api.openai.com/v1/models', {
            method: 'GET', headers: { Authorization: `Bearer ${apiKey}` }, signal, providerName: 'OpenAI'
        });
        return (json.data || []).map(m => m.id)
            .filter(id => /^(gpt|o\d|chatgpt)/i.test(id) && !/(audio|realtime|transcribe|tts|image|embed|search|moderation|instruct|codex)/i.test(id))
            .sort();
    }

    // ---------- Anthropic (Claude Messages API) ----------
    // Models that support server-side refusal fallbacks (beta server-side-fallback-2026-07-01)
    const CLAUDE_FALLBACK_MODELS = ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-fable-5-1', 'claude-opus-5'];

    async function callAnthropic(req) {
        const content = req.parts.map(p => {
            let block;
            if (p.kind === 'image') block = { type: 'image', source: { type: 'base64', media_type: p.mime, data: p.data } };
            else if (p.kind === 'pdf') block = { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: p.data }, title: p.name };
            else block = { type: 'text', text: p.text };
            // Cache the source material so later batches re-read it cheaply
            if (p.cache) block.cache_control = { type: 'ephemeral' };
            return block;
        });

        const headers = {
            'x-api-key': req.apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true'
        };
        const body = {
            model: req.model,
            max_tokens: 16000,
            system: req.system,
            messages: [{ role: 'user', content }]
        };
        if (req.structured) {
            body.output_config = { format: { type: 'json_schema', schema: req.schema } };
        }
        if (CLAUDE_FALLBACK_MODELS.includes(req.model)) {
            // If a safety classifier declines, retry on Anthropic's recommended fallback model
            headers['anthropic-beta'] = 'server-side-fallback-2026-07-01';
            body.fallbacks = 'default';
        }

        const json = await requestJson('https://api.anthropic.com/v1/messages', {
            headers, body, signal: req.signal, providerName: 'Anthropic', model: req.model
        });

        if (json.stop_reason === 'refusal') {
            const category = json.stop_details && json.stop_details.category;
            throw new AIError(`Claude declined this request${category ? ` (${category})` : ''}. Try different material or another model.`, { kind: 'refusal' });
        }
        if (json.stop_reason === 'max_tokens') {
            throw new AIError('The answer was cut off because it ran out of space.', { kind: 'truncated' });
        }
        return (json.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
    }

    async function listAnthropicModels(apiKey, signal) {
        const json = await requestJson('https://api.anthropic.com/v1/models?limit=100', {
            method: 'GET',
            headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
            signal, providerName: 'Anthropic'
        });
        return (json.data || []).map(m => m.id);
    }

    // ---------- Google Gemini ----------
    async function callGemini(req) {
        const parts = req.parts.map(p => {
            if (p.kind === 'image') return { inlineData: { mimeType: p.mime, data: p.data } };
            if (p.kind === 'pdf') return { inlineData: { mimeType: 'application/pdf', data: p.data } };
            return { text: p.text };
        });
        const generationConfig = { responseMimeType: 'application/json', maxOutputTokens: 32000 };
        if (req.structured) generationConfig.responseJsonSchema = req.schema;

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(req.model)}:generateContent`;
        const json = await requestJson(url, {
            headers: { 'x-goog-api-key': req.apiKey },
            body: { systemInstruction: { parts: [{ text: req.system }] }, contents: [{ role: 'user', parts }], generationConfig },
            signal: req.signal, providerName: 'Google Gemini', model: req.model
        });

        if (json.promptFeedback && json.promptFeedback.blockReason) {
            throw new AIError(`Gemini blocked this request (${json.promptFeedback.blockReason}).`, { kind: 'refusal' });
        }
        const candidate = (json.candidates || [])[0];
        if (!candidate) throw new AIError('Gemini returned no answer. Please try again.', { kind: 'other' });
        const text = ((candidate.content && candidate.content.parts) || []).map(p => p.text || '').join('');
        if (candidate.finishReason === 'MAX_TOKENS') throw new AIError('The answer was cut off because it ran out of space.', { kind: 'truncated' });
        if (!text && candidate.finishReason && candidate.finishReason !== 'STOP') {
            throw new AIError(`Gemini stopped without answering (${candidate.finishReason}).`, { kind: 'refusal' });
        }
        return text;
    }

    async function listGeminiModels(apiKey, signal) {
        const json = await requestJson('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', {
            method: 'GET', headers: { 'x-goog-api-key': apiKey }, signal, providerName: 'Google Gemini'
        });
        return (json.models || [])
            .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
            .map(m => m.name.replace(/^models\//, ''))
            .filter(id => /^gemini/i.test(id) && !/(tts|image|embedding|live|audio)/i.test(id));
    }

    // ---------- OpenAI-compatible Chat Completions (OpenRouter, Groq, DeepSeek, Ollama, ...) ----------
    function chatCompletionsCaller(getBaseUrl, providerName, extraHeaders = () => ({})) {
        return async function(req) {
            const baseUrl = getBaseUrl(req);
            const userContent = req.parts.map(p => p.kind === 'image'
                ? { type: 'image_url', image_url: { url: dataUrl(p.mime, p.data) } }
                : { type: 'text', text: p.text });
            // Text-only requests are sent as a plain string, which every server accepts
            const content = userContent.every(c => c.type === 'text') ? userContent.map(c => c.text).join('\n\n') : userContent;
            const body = {
                model: req.model,
                messages: [{ role: 'system', content: req.system }, { role: 'user', content }],
                max_tokens: 16000
            };
            if (req.structured) {
                body.response_format = { type: 'json_schema', json_schema: { name: 'quiz_questions', strict: true, schema: req.schema } };
            }
            const headers = { ...extraHeaders() };
            if (req.apiKey) headers.Authorization = `Bearer ${req.apiKey}`;

            const json = await requestJson(`${baseUrl}/chat/completions`, {
                headers, body, signal: req.signal, providerName, model: req.model
            });
            const choice = (json.choices || [])[0];
            if (!choice) throw new AIError(`${providerName} returned no answer. ${providerMessage(json)}`.trim(), { kind: 'other' });
            if (choice.message && choice.message.refusal) throw new AIError(`The model declined: ${choice.message.refusal}`, { kind: 'refusal' });
            if (choice.finish_reason === 'length') throw new AIError('The answer was cut off because it ran out of space.', { kind: 'truncated' });
            const msg = choice.message && choice.message.content;
            return Array.isArray(msg) ? msg.map(c => c.text || '').join('') : (msg || '');
        };
    }

    function cleanBaseUrl(url) {
        return String(url || '').trim().replace(/\/+$/, '').replace(/\/chat\/completions$/, '');
    }

    async function listChatModels(baseUrl, apiKey, signal, providerName) {
        const headers = apiKey ? { Authorization: `Bearer ${apiKey}` } : {};
        const json = await requestJson(`${baseUrl}/models`, { method: 'GET', headers, signal, providerName });
        return (json.data || json.models || []).map(m => m.id || m.name).filter(Boolean).sort();
    }

    // ---------- Registry ----------
    const PROVIDERS = [
        {
            id: 'openai', name: 'ChatGPT (OpenAI)', short: 'OpenAI',
            keyUrl: 'https://platform.openai.com/api-keys', keyPlaceholder: 'sk-...',
            models: [
                { id: 'gpt-6.1-sol', label: 'GPT-6.1 Sol: strong and good value (recommended)' },
                { id: 'gpt-6-astra', label: 'GPT-6 Astra: most capable' },
                { id: 'gpt-6-luna', label: 'GPT-6 Luna: fastest and cheapest' }
            ],
            vision: true, nativePdf: true, maxPdfBytes: 30 * 1024 * 1024,
            generate: callOpenAI,
            listModels: (cfg, signal) => listOpenAIModels(cfg.apiKey, signal)
        },
        {
            id: 'anthropic', name: 'Claude (Anthropic)', short: 'Claude',
            keyUrl: 'https://console.anthropic.com/settings/keys', keyPlaceholder: 'sk-ant-...',
            models: [
                { id: 'claude-opus-5-5', label: 'Claude Opus 5.5: best quality (recommended)' },
                { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5: fast and capable' },
                { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5: fastest and cheapest' },
                { id: 'claude-fable-5-1', label: 'Claude Fable 5.1: most capable, premium price' }
            ],
            vision: true, nativePdf: true, maxPdfBytes: 24 * 1024 * 1024,
            generate: callAnthropic,
            listModels: (cfg, signal) => listAnthropicModels(cfg.apiKey, signal)
        },
        {
            id: 'gemini', name: 'Gemini (Google)', short: 'Gemini',
            keyUrl: 'https://aistudio.google.com/app/apikey', keyPlaceholder: 'AIza...',
            models: [
                { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash: fast and smart (recommended)' },
                { id: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro (preview): most capable' },
                { id: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash-Lite: cheapest' }
            ],
            vision: true, nativePdf: true, maxPdfBytes: 15 * 1024 * 1024,
            generate: callGemini,
            listModels: (cfg, signal) => listGeminiModels(cfg.apiKey, signal)
        },
        {
            id: 'openrouter', name: 'OpenRouter (Llama, DeepSeek, Mistral, Grok and more)', short: 'OpenRouter',
            keyUrl: 'https://openrouter.ai/keys', keyPlaceholder: 'sk-or-...',
            models: [
                { id: 'openrouter/auto', label: 'Auto: OpenRouter picks a model' }
            ],
            vision: true, nativePdf: false,
            generate: chatCompletionsCaller(() => 'https://openrouter.ai/api/v1', 'OpenRouter',
                () => ({ 'HTTP-Referer': location.origin, 'X-Title': 'Quizr' })),
            listModels: (cfg, signal) => listChatModels('https://openrouter.ai/api/v1', '', signal, 'OpenRouter')
        },
        {
            id: 'custom', name: 'Other (OpenAI-compatible server)', short: 'Custom',
            keyUrl: '', keyPlaceholder: 'API key (leave empty for local servers)',
            keyOptional: true, needsBaseUrl: true,
            baseUrlPresets: [
                { label: 'Groq', url: 'https://api.groq.com/openai/v1' },
                { label: 'DeepSeek', url: 'https://api.deepseek.com/v1' },
                { label: 'Mistral', url: 'https://api.mistral.ai/v1' },
                { label: 'xAI Grok', url: 'https://api.x.ai/v1' },
                { label: 'Together', url: 'https://api.together.xyz/v1' },
                { label: 'Ollama (this computer)', url: 'http://localhost:11434/v1' },
                { label: 'LM Studio (this computer)', url: 'http://localhost:1234/v1' }
            ],
            models: [],
            vision: false, nativePdf: false,
            generate: chatCompletionsCaller(req => cleanBaseUrl(req.baseUrl), 'the server'),
            listModels: (cfg, signal) => listChatModels(cleanBaseUrl(cfg.baseUrl), cfg.apiKey, signal, 'the server')
        }
    ];

    window.QuizBowl.AI = window.QuizBowl.AI || {};
    window.QuizBowl.AI.AIError = AIError;
    window.QuizBowl.AI.Providers = {
        all: PROVIDERS,
        get: id => PROVIDERS.find(p => p.id === id) || PROVIDERS[0],
        cleanBaseUrl: cleanBaseUrl
    };
})();
