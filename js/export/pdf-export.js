/**
 * js/export/pdf-export.js
 * Builds question papers from app questions:
 *  - download(): a real PDF file made in the browser with jsPDF and an
 *    embedded Unicode font (Noto Sans), so accents such as ẹ ọ ṣ work.
 *  - print(): the same paper rendered as HTML for the browser's own
 *    "Print / Save as PDF", which also handles scripts such as Arabic or
 *    Chinese and typesets maths with MathJax.
 *
 * Options: { title, instructions, answers: 'marked'|'key'|'none', explanations,
 *            showMarks, showIds, groupByType, shuffle, studentFields, answerSpace,
 *            paper: 'a4'|'letter', textSize: 'normal'|'large', quizName,
 *            orgName, logo: { data (PNG data URL), w, h } | null,
 *            watermark: 'none'|'text'|'logo', watermarkText }
 */
(function() {
    const JSPDF_URL = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/3.0.4/jspdf.umd.min.js';
    const FONT_BASE = 'https://cdn.jsdelivr.net/npm/@expo-google-fonts/noto-sans@0.4.2';
    const FONT_FILES = {
        normal: '/400Regular/NotoSans_400Regular.ttf',
        bold: '/700Bold/NotoSans_700Bold.ttf',
        italic: '/400Regular_Italic/NotoSans_400Regular_Italic.ttf'
    };
    const MATHJAX_URL = 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js';

    const TYPES = ['mcq', 'true_false', 'theory', 'calculation'];
    const SECTION_NAMES = { mcq: 'Multiple choice', true_false: 'True or false', theory: 'Short answer', calculation: 'Calculation' };
    const COLORS = {
        text: [17, 24, 39], muted: [100, 116, 139], faint: [203, 213, 225], rule: [226, 232, 240],
        accent: [217, 119, 6], correct: [21, 128, 61], correctBg: [220, 252, 231], white: [255, 255, 255]
    };

    // ---------- Loading ----------
    let jsPdfPromise = null;
    function loadJsPdf() {
        if (window.jspdf && window.jspdf.jsPDF) return Promise.resolve(window.jspdf.jsPDF);
        if (!jsPdfPromise) {
            jsPdfPromise = new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = JSPDF_URL;
                script.onload = () => resolve(window.jspdf.jsPDF);
                script.onerror = () => {
                    jsPdfPromise = null;
                    reject(new Error('Couldn\'t load the PDF maker. Connect to the internet once so it can be downloaded, then try again.'));
                };
                document.head.appendChild(script);
            });
        }
        return jsPdfPromise;
    }

    let fontPromise = null;
    function loadFonts() {
        if (!fontPromise) {
            fontPromise = Promise.all(Object.entries(FONT_FILES).map(async ([style, file]) => {
                const response = await fetch(FONT_BASE + file);
                if (!response.ok) throw new Error('font ' + response.status);
                const bytes = new Uint8Array(await response.arrayBuffer());
                let binary = '';
                for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
                return [style, btoa(binary)];
            })).then(Object.fromEntries).catch(err => {
                fontPromise = null;
                throw err;
            });
        }
        return fontPromise;
    }

    // ---------- Text preparation ----------
    function htmlToText(html) {
        const source = String(html == null ? '' : html)
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<\/(p|div|li|h[1-6])>/gi, '\n');
        const doc = new DOMParser().parseFromString(`<body>${source}</body>`, 'text/html');
        return (doc.body.textContent || '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    }

    const SYMBOLS = {
        times: '×', div: '÷', cdot: '·', pm: '±', mp: '∓', le: '≤', leq: '≤', ge: '≥', geq: '≥', neq: '≠', ne: '≠',
        approx: '≈', equiv: '≡', sim: '~', infty: '∞', to: '→', rightarrow: '→', leftarrow: '←', Rightarrow: '⇒',
        leftrightarrow: '↔', degree: '°', circ: '°', sum: 'Σ', prod: 'Π', int: '∫', partial: '∂', nabla: '∇',
        alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', varepsilon: 'ε', zeta: 'ζ', eta: 'η', theta: 'θ',
        iota: 'ι', kappa: 'κ', lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ', pi: 'π', rho: 'ρ', sigma: 'σ', tau: 'τ',
        upsilon: 'υ', phi: 'φ', varphi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω', Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ',
        Lambda: 'Λ', Xi: 'Ξ', Pi: 'Π', Sigma: 'Σ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω', ldots: '…', cdots: '…', dots: '…',
        angle: '∠', perp: '⊥', parallel: '∥', in: '∈', notin: '∉', subset: '⊂', cup: '∪', cap: '∩', emptyset: '∅',
        forall: '∀', exists: '∃', neg: '¬', land: '∧', lor: '∨', prime: '′', propto: '∝', therefore: '∴',
        percent: '%', '%': '%', '$': '$', '&': '&', '#': '#', '_': '_', '{': '{', '}': '}'
    };
    const SUPER = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾', 'n': 'ⁿ', 'i': 'ⁱ', 'x': 'ˣ' };
    const SUB = { '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉', '+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎' };
    const FUNCS = ['sin', 'cos', 'tan', 'log', 'ln', 'exp', 'lim', 'max', 'min', 'sec', 'csc', 'cot', 'arcsin', 'arccos', 'arctan', 'sinh', 'cosh', 'tanh', 'det'];

    // Read a {group} or single token starting at i; returns [content, nextIndex]
    function readArg(s, i) {
        while (s[i] === ' ') i++;
        if (s[i] === '{') {
            let depth = 1, j = i + 1;
            while (j < s.length && depth) { if (s[j] === '{') depth++; else if (s[j] === '}') depth--; j++; }
            return [s.slice(i + 1, j - 1), j];
        }
        if (s[i] === '\\') {
            const m = /^\\[a-zA-Z]+/.exec(s.slice(i));
            if (m) return [m[0], i + m[0].length];
        }
        return [s[i] || '', i + 1];
    }

    const wrapIfComplex = t => /^[\w.]+$/.test(t) ? t : `(${t})`;

    function scriptText(t, table, marker) {
        return [...t].every(ch => table[ch]) ? [...t].map(ch => table[ch]).join('') : `${marker}${wrapIfComplex(t)}`;
    }

    // Convert one LaTeX expression into readable plain text
    function texToText(tex) {
        let s = tex.replace(/\\left|\\right|\\displaystyle|\\limits/g, '')
            .replace(/\\begin\{[pbvB]?matrix\}([\s\S]*?)\\end\{[pbvB]?matrix\}/g, (m, body) =>
                '[' + body.split('\\\\').map(r => r.split('&').map(c => c.trim()).join(' ')).join('; ') + ']');
        let out = '';
        for (let i = 0; i < s.length;) {
            const ch = s[i];
            if (ch === '\\') {
                const m = /^\\([a-zA-Z]+|.)/.exec(s.slice(i));
                const name = m ? m[1] : '';
                i += m ? m[0].length : 1;
                if (name === 'frac' || name === 'dfrac' || name === 'tfrac') {
                    const [a, i2] = readArg(s, i); const [b, i3] = readArg(s, i2); i = i3;
                    out += `${wrapIfComplex(texToText(a))}/${wrapIfComplex(texToText(b))}`;
                } else if (name === 'sqrt') {
                    let root = '';
                    if (s[i] === '[') { const end = s.indexOf(']', i); root = s.slice(i + 1, end); i = end + 1; }
                    const [a, i2] = readArg(s, i); i = i2;
                    // Always bracket the root so "√(16)" still reads well if the font lacks √ ("sqrt(16)")
                    out += `${root ? scriptText(texToText(root), SUPER, '^') : ''}√(${texToText(a)})`;
                } else if (['text', 'mathrm', 'mathbf', 'mathit', 'textbf', 'textit', 'operatorname', 'mbox', 'mathsf', 'boldsymbol', 'vec', 'overline', 'hat', 'bar'].includes(name)) {
                    const [a, i2] = readArg(s, i); i = i2;
                    out += texToText(a) + (name === 'vec' ? '⃗' : '');
                } else if (FUNCS.includes(name)) {
                    out += name + ' ';
                } else if (name === ',' || name === ';' || name === ':' || name === ' ' || name === 'quad' || name === 'qquad') {
                    out += ' ';
                } else if (name === '!') {
                    // negative space
                } else if (SYMBOLS[name] !== undefined) {
                    out += SYMBOLS[name];
                } else {
                    out += name;
                }
            } else if (ch === '^' || ch === '_') {
                const [a, i2] = readArg(s, i + 1); i = i2;
                const t = texToText(a);
                out += t === '°' || t === '∘' ? '°' : scriptText(t, ch === '^' ? SUPER : SUB, ch);
            } else if (ch === '{' || ch === '}') {
                i++;
            } else if (ch === '~') {
                out += ' '; i++;
            } else {
                out += ch; i++;
            }
        }
        return out.replace(/\s{2,}/g, ' ').trim();
    }

    // Replace $...$, $$...$$, \(...\) and \[...\] with readable text
    function latexToText(text) {
        const DOLLAR = '\u0000';   // stands in for an escaped "\$" (a real dollar sign)
        return String(text || '')
            .replace(/\\\$/g, DOLLAR)
            .replace(/\$\$([\s\S]+?)\$\$/g, (m, t) => texToText(t))
            .replace(/\\\[([\s\S]+?)\\\]/g, (m, t) => texToText(t))
            .replace(/\\\(([\s\S]+?)\\\)/g, (m, t) => texToText(t))
            .replace(/\$([^$\n]+?)\$/g, (m, t) => texToText(t))
            .replace(/\u0000/g, '$');
    }

    const plain = html => latexToText(htmlToText(html));

    // App question -> printable item
    function toItem(q) {
        const item = {
            id: q.id || '', type: q.type, marks: q.marks || 0,
            category: q.category || '',
            raw: htmlToText(q.question), text: plain(q.question),
            options: [], correct: '', answer: '', answerRaw: '', unit: q.unit || '',
            explanation: plain(q.explanation), explanationRaw: htmlToText(q.explanation)
        };
        if (q.type === 'mcq') {
            item.options = Object.keys(q.options || {}).sort().map(letter => ({
                letter, text: plain(q.options[letter]), raw: htmlToText(q.options[letter])
            }));
            item.correct = q.correctAnswer || '';
        } else if (q.type === 'true_false') {
            item.options = [{ letter: 'True', text: 'True', raw: 'True' }, { letter: 'False', text: 'False', raw: 'False' }];
            item.correct = q.correctAnswer || '';
        } else {
            item.answerRaw = htmlToText(q.expectedAnswer || q.correctAnswer || '');
            item.answer = latexToText(item.answerRaw);
        }
        return item;
    }

    function shuffle(list) {
        const a = list.slice();
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    // Order questions into sections and number them 1..n
    function arrange(questions, opts) {
        const items = questions.map(toItem);
        let sections;
        if (opts.groupByType) {
            sections = TYPES.map(type => ({ type, items: items.filter(i => i.type === type) })).filter(s => s.items.length);
        } else {
            sections = [{ type: null, items }];
        }
        if (opts.shuffle) sections.forEach(s => { s.items = shuffle(s.items); });
        let n = 1;
        sections.forEach(s => s.items.forEach(i => { i.number = n++; }));
        return sections;
    }

    function answerText(item) {
        if (item.type === 'mcq') {
            const option = item.options.find(o => o.letter === item.correct);
            return option ? `${item.correct}. ${option.text}` : item.correct;
        }
        if (item.type === 'true_false') return item.correct;
        return `${item.answer}${item.unit ? ' ' + item.unit : ''}`;
    }

    function fileName(opts) {
        const base = String(opts.title || 'quiz').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
            .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'quiz';
        const suffix = opts.answers === 'marked' ? '-with-answers' : opts.answers === 'key' ? '-with-answer-key' : '-questions';
        return base + suffix + '.pdf';
    }

    function totalMarks(sections) {
        return sections.reduce((sum, s) => sum + s.items.reduce((a, i) => a + (Number(i.marks) || 0), 0), 0);
    }

    // What to print faintly behind every page: { logo } or { text }, or null for none.
    // "Logo" without a logo falls back to text.
    function watermarkOf(opts) {
        if (!opts.watermark || opts.watermark === 'none') return null;
        if (opts.watermark === 'logo' && opts.logo && opts.logo.data) return { logo: opts.logo };
        const text = String(opts.watermarkText || '').trim() || String(opts.orgName || '').trim() || 'CONFIDENTIAL';
        return { text };
    }

    // Logo size (mm) that fits inside maxW x maxH, keeping its shape
    function fitLogo(logo, maxW, maxH) {
        const ratio = (logo.w || 1) / (logo.h || 1);
        let w = maxW, h = maxW / ratio;
        if (h > maxH) { h = maxH; w = maxH * ratio; }
        return { w, h };
    }

    function today() {
        return new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
    }

    // ---------- PDF (jsPDF) ----------
    // Plain-ASCII stand-ins for characters the font can't draw
    const FALLBACKS = { '√': 'sqrt', '≤': '<=', '≥': '>=', '≠': '!=', '≈': '~', '∞': 'inf', '→': '->', '←': '<-', '⇒': '=>',
        '↔': '<->', '∫': 'integral ', '∂': 'd', '∑': 'Sum', '∇': 'grad', '∈': 'in', '∉': 'not in', '∪': 'U', '∩': 'n',
        '∅': '{}', '∀': 'for all ', '∃': 'exists ', '⊂': 'subset of', '∠': 'angle ', '⊥': 'perp', '∥': '||', '∴': 'so',
        '′': "'", '∝': 'proportional to', '⃗': '', '“': '"', '”': '"', '‘': "'", '’': "'", '–': '-', '—': '-', '…': '...' };

    function createRenderer(doc, opts, useNoto) {
        const page = { w: doc.internal.pageSize.getWidth(), h: doc.internal.pageSize.getHeight() };
        const M = 18;
        const contentW = page.w - M * 2;
        const bottom = page.h - M - 6;   // leave room for the footer
        const base = opts.textSize === 'large' ? 12.5 : 10.5;
        const family = useNoto ? 'NotoSans' : 'helvetica';
        let y = M;
        let measuring = false;
        let missing = 0;

        let glyphCheck = null;
        if (useNoto) {
            try {
                doc.setFont(family, 'normal');
                const meta = doc.getFont().metadata;
                if (meta && typeof meta.characterToGlyph === 'function') glyphCheck = code => meta.characterToGlyph(code) !== 0;
            } catch (e) { glyphCheck = null; }
        }

        // Make text safe for the current font
        function clean(text) {
            let s = String(text || '').replace(/ /g, ' ').replace(/\t/g, '  ');
            if (!useNoto) {
                s = s.normalize('NFKD').replace(/[̀-ͯ]/g, '');
                return [...s].map(ch => ch.charCodeAt(0) < 256 ? ch : (FALLBACKS[ch] !== undefined ? FALLBACKS[ch] : (missing++, '?'))).join('');
            }
            if (!glyphCheck) return s;
            return [...s].map(ch => {
                const code = ch.codePointAt(0);
                if (code < 128 || ch === '\n' || glyphCheck(code)) return ch;
                if (FALLBACKS[ch] !== undefined) return FALLBACKS[ch];
                // try the letter without its accent before giving up
                const plainCh = ch.normalize('NFKD').replace(/[̀-ͯ]/g, '');
                if (plainCh && [...plainCh].every(c => c.charCodeAt(0) < 128 || glyphCheck(c.codePointAt(0)))) return plainCh;
                missing++;
                return '?';
            }).join('');
        }

        const pt2mm = 0.3528;
        const lineH = size => size * pt2mm * 1.38;
        function setFont(style, size, color) {
            doc.setFont(family, useNoto ? style : (style === 'italic' ? 'italic' : style === 'bold' ? 'bold' : 'normal'));
            doc.setFontSize(size);
            doc.setTextColor(...(color || COLORS.text));
        }
        function lines(text, width) {
            return doc.splitTextToSize(clean(text), width);
        }

        // Drawn first on each page so the questions sit on top of it
        const wm = watermarkOf(opts);
        const canFade = typeof doc.GState === 'function';
        function drawWatermark() {
            if (!wm || (wm.logo && !canFade)) return;
            if (canFade) {
                doc.saveGraphicsState();
                doc.setGState(new doc.GState({ opacity: wm.logo ? 0.08 : 0.1 }));
            }
            if (wm.logo) {
                const { w, h } = fitLogo(wm.logo, page.w * 0.6, page.h * 0.5);
                doc.addImage(wm.logo.data, 'PNG', (page.w - w) / 2, (page.h - h) / 2, w, h, 'org-logo', 'FAST');
            } else {
                // Diagonal text, sized to span most of the page and centred on it
                const text = clean(wm.text);
                const angle = 45, rad = angle * Math.PI / 180;
                setFont('bold', 100, canFade ? COLORS.muted : [236, 239, 243]);
                const size = Math.min(90, 100 * Math.hypot(page.w, page.h) * 0.6 / Math.max(1, doc.getTextWidth(text)));
                doc.setFontSize(size);
                const w = doc.getTextWidth(text);
                const capH = size * pt2mm * 0.7;
                doc.text(text,
                    page.w / 2 - (w / 2) * Math.cos(rad) + (capH / 2) * Math.sin(rad),
                    page.h / 2 + (w / 2) * Math.sin(rad) + (capH / 2) * Math.cos(rad),
                    { angle });
            }
            if (canFade) doc.restoreGraphicsState();
        }

        function newPage() {
            doc.addPage();
            drawWatermark();
            y = M;
        }
        // Make sure `h` mm fit on the page (only when drawing)
        function ensure(h) {
            if (!measuring && y + h > bottom) newPage();
        }

        // Run `fn` in measure mode and return the height it would use
        function measure(fn) {
            const saveY = y, saveMeasuring = measuring;
            measuring = true;
            y = 0;
            fn();
            const h = y;
            y = saveY;
            measuring = saveMeasuring;
            return h;
        }

        function textBlock(text, x, width, size, style, color, gapAfter = 0) {
            setFont(style, size, color);
            const ls = lines(text, width);
            const lh = lineH(size);
            ls.forEach(line => {
                ensure(lh);
                if (!measuring) doc.text(line, x, y + size * pt2mm);
                y += lh;
            });
            y += gapAfter;
        }

        function bubble(cx, cy, r, label, filled, size) {
            if (measuring) return;
            doc.setLineWidth(0.3);
            if (filled) {
                doc.setFillColor(...COLORS.correct);
                doc.setDrawColor(...COLORS.correct);
                doc.circle(cx, cy, r, 'FD');
            } else {
                doc.setDrawColor(...COLORS.muted);
                doc.circle(cx, cy, r, 'S');
            }
            setFont('bold', size, filled ? COLORS.white : COLORS.muted);
            doc.text(label, cx, cy + size * pt2mm * 0.35, { align: 'center' });
        }

        function tick(x, cy) {
            if (measuring) return;
            doc.setDrawColor(...COLORS.correct);
            doc.setLineWidth(0.6);
            doc.line(x, cy, x + 1.2, cy + 1.3);
            doc.line(x + 1.2, cy + 1.3, x + 3.6, cy - 1.6);
        }

        // ----- pieces of the paper -----
        // Organization logo and name, centred above the title
        function letterhead() {
            const name = String(opts.orgName || '').trim();
            if (!name && !opts.logo) return;
            if (opts.logo) {
                const { w, h } = fitLogo(opts.logo, 70, 22);
                if (!measuring) doc.addImage(opts.logo.data, 'PNG', (page.w - w) / 2, y, w, h, 'org-logo', 'FAST');
                y += h + 2.5;
            }
            if (name) {
                const size = base + 4;
                setFont('bold', size, COLORS.text);
                lines(name, contentW).forEach(line => {
                    if (!measuring) doc.text(line, page.w / 2, y + size * pt2mm, { align: 'center' });
                    y += lineH(size);
                });
            }
            y += 2;
            if (!measuring) {
                doc.setDrawColor(...COLORS.accent);
                doc.setLineWidth(0.6);
                doc.line(page.w / 2 - 15, y, page.w / 2 + 15, y);
            }
            y += 6;
        }

        function header(sections) {
            const count = sections.reduce((a, s) => a + s.items.length, 0);
            const marks = totalMarks(sections);
            letterhead();
            const titleTop = y;
            textBlock(opts.title || 'Quiz', M, contentW - (opts.answers === 'marked' ? 34 : 0), base + 9, 'bold', COLORS.text, 1.5);
            const meta = [opts.quizName && opts.quizName !== opts.title ? opts.quizName : '', `${count} question${count === 1 ? '' : 's'}`,
                opts.showMarks && marks ? `${marks} marks` : '', today()].filter(Boolean).join('  ·  ');
            textBlock(meta, M, contentW, base - 1.5, 'normal', COLORS.muted, 3);
            if (opts.answers === 'marked' && !measuring) {
                setFont('bold', base - 2, COLORS.correct);
                doc.text('ANSWERS SHOWN', page.w - M, titleTop + (base + 9) * pt2mm, { align: 'right' });
            }
            if (opts.instructions && opts.instructions.trim()) {
                textBlock(opts.instructions.trim(), M, contentW, base - 0.5, 'normal', COLORS.text, 3);
            }
            if (opts.studentFields && opts.answers !== 'marked') {
                const fields = [['Name', 0.42], ['Team / Class', 0.24], ['Date', 0.16], [opts.showMarks && marks ? `Score     / ${marks}` : 'Score', 0.18]];
                setFont('normal', base - 1, COLORS.muted);
                const h = lineH(base) + 3;
                ensure(h);
                let x = M;
                fields.forEach(([label, share]) => {
                    const w = contentW * share - 4;
                    if (!measuring) {
                        doc.text(label, x, y + base * pt2mm);
                        doc.setDrawColor(...COLORS.faint);
                        doc.setLineWidth(0.3);
                        doc.line(x, y + h - 1, x + w, y + h - 1);
                    }
                    x += contentW * share;
                });
                y += h + 3;
            }
            if (!measuring) {
                doc.setDrawColor(...COLORS.rule);
                doc.setLineWidth(0.5);
                doc.line(M, y, page.w - M, y);
            }
            y += 6;
        }

        function sectionHeading(section, index) {
            const marks = section.items.reduce((a, i) => a + (Number(i.marks) || 0), 0);
            const label = `Section ${String.fromCharCode(65 + index)}: ${SECTION_NAMES[section.type]}`;
            const right = `${section.items.length} question${section.items.length === 1 ? '' : 's'}${opts.showMarks && marks ? ` · ${marks} marks` : ''}`;
            setFont('bold', base + 2, COLORS.text);
            const h = lineH(base + 2) + 3;
            ensure(h);
            if (!measuring) {
                doc.text(clean(label), M, y + (base + 2) * pt2mm);
                setFont('normal', base - 1.5, COLORS.muted);
                doc.text(clean(right), page.w - M, y + (base + 2) * pt2mm, { align: 'right' });
                doc.setDrawColor(...COLORS.accent);
                doc.setLineWidth(0.6);
                doc.line(M, y + h - 1.2, M + 18, y + h - 1.2);
            }
            y += h + 3;
        }

        function question(item) {
            const showAnswers = opts.answers === 'marked';
            const numW = 9;
            const textX = M + numW;
            let tag = [opts.showIds ? item.id : '', opts.showMarks && item.marks ? `${item.marks} mark${item.marks == 1 ? '' : 's'}` : ''].filter(Boolean).join(' · ');
            setFont('normal', base - 2);
            const tagW = tag ? doc.getTextWidth(clean(tag)) + 4 : 0;
            const textW = contentW - numW - tagW;

            // number + question text
            setFont('bold', base);
            const qLines = lines(item.text, textW);
            const lh = lineH(base);
            ensure(lh);
            if (!measuring) {
                doc.text(`${item.number}.`, M, y + base * pt2mm);
                if (tag) {
                    setFont('normal', base - 2, COLORS.muted);
                    doc.text(clean(tag), page.w - M, y + base * pt2mm, { align: 'right' });
                }
            }
            setFont('normal', base);
            qLines.forEach((line, i) => {
                if (i) ensure(lh);
                if (!measuring) doc.text(line, textX, y + base * pt2mm);
                y += lh;
            });
            y += 1.8;

            // options
            if (item.options.length) {
                const optSize = base - 0.5;
                const r = 2.5;
                const optX = textX + r + 0.5;
                const labelX = textX + r * 2 + 3;
                const isTf = item.type === 'true_false';
                setFont('normal', optSize);
                const widest = Math.max(...item.options.map(o => doc.getTextWidth(clean(o.text))));
                const colW = (contentW - numW) / 2;
                const twoCols = isTf || widest < colW - r * 2 - 10;
                const optLH = lineH(optSize);

                const drawOption = (o, x, width) => {
                    const correct = showAnswers && o.letter === item.correct;
                    setFont(correct ? 'bold' : 'normal', optSize, correct ? COLORS.correct : COLORS.text);
                    const ls = lines(o.text, width - (labelX - optX) - r - 6);
                    const rowH = Math.max(r * 2 + 1.2, ls.length * optLH + 1.2);
                    return { ls, rowH, draw: (top) => {
                        if (measuring) return;
                        if (correct) {
                            doc.setFillColor(...COLORS.correctBg);
                            doc.roundedRect(x - 1.5, top - 0.6, width - 2, rowH, 1.5, 1.5, 'F');
                        }
                        const cy = top + r + 0.1;
                        bubble(x + r, cy, r, isTf ? o.letter.charAt(0) : o.letter, correct, optSize - 2.5);
                        setFont(correct ? 'bold' : 'normal', optSize, correct ? COLORS.correct : COLORS.text);
                        ls.forEach((line, i) => doc.text(line, x + r * 2 + 3, top + optSize * pt2mm + i * optLH + (optLH < r * 2 ? (r * 2 - optLH) / 2 : 0)));
                        if (correct) {
                            setFont('bold', optSize);
                            const w = Math.max(...ls.map(l => doc.getTextWidth(l)));
                            tick(Math.min(x + r * 2 + 3 + w + 2.5, x + width - 7), cy);
                        }
                    } };
                };

                if (twoCols) {
                    for (let i = 0; i < item.options.length; i += 2) {
                        const pair = [item.options[i], item.options[i + 1]].filter(Boolean)
                            .map((o, k) => ({ o, x: textX + k * colW, built: drawOption(o, textX + k * colW, colW) }));
                        const rowH = Math.max(...pair.map(p => p.built.rowH));
                        ensure(rowH);
                        pair.forEach(p => p.built.draw(y));
                        y += rowH + 1.3;
                    }
                } else {
                    item.options.forEach(o => {
                        const built = drawOption(o, textX, contentW - numW);
                        ensure(built.rowH);
                        built.draw(y);
                        y += built.rowH + 1.3;
                    });
                }
            } else if (showAnswers) {
                // written answer for short-answer / calculation
                setFont('bold', base - 0.5, COLORS.correct);
                const label = 'Answer: ';
                const lw = doc.getTextWidth(label);
                setFont('normal', base - 0.5, COLORS.correct);
                const ls = lines(`${item.answer}${item.unit ? ' ' + item.unit : ''}`, contentW - numW - lw - 4);
                const h = ls.length * lineH(base - 0.5) + 2.4;
                ensure(h);
                if (!measuring) {
                    doc.setFillColor(...COLORS.correctBg);
                    doc.roundedRect(textX - 1.5, y - 0.6, contentW - numW + 1.5, h, 1.5, 1.5, 'F');
                    setFont('bold', base - 0.5, COLORS.correct);
                    doc.text(label, textX + 1, y + (base - 0.5) * pt2mm + 0.6);
                    setFont('normal', base - 0.5, COLORS.correct);
                    ls.forEach((line, i) => doc.text(line, textX + 1 + lw, y + (base - 0.5) * pt2mm + 0.6 + i * lineH(base - 0.5)));
                }
                y += h + 1;
            } else if (opts.answerSpace) {
                // lines to write on
                const rows = item.type === 'calculation' ? 3 : 2;
                const gap = lineH(base) + 2.5;
                for (let i = 0; i < rows; i++) {
                    ensure(gap);
                    y += gap;
                    if (!measuring) {
                        doc.setDrawColor(...COLORS.faint);
                        doc.setLineWidth(0.25);
                        const isLast = i === rows - 1 && item.type === 'calculation';
                        if (isLast) {
                            setFont('normal', base - 1.5, COLORS.muted);
                            doc.text('Answer:', textX, y - 0.8);
                            doc.line(textX + 16, y, page.w - M - (item.unit ? 18 : 0), y);
                            if (item.unit) doc.text(clean(item.unit), page.w - M - 15, y - 0.8);
                        } else {
                            doc.line(textX, y, page.w - M, y);
                        }
                    }
                }
                y += 2;
            }

            if (showAnswers && opts.explanations && item.explanation) {
                y += 0.6;
                textBlock(item.explanation, textX, contentW - numW, base - 1.5, 'italic', COLORS.muted, 0);
            }
            y += base * 0.55;
        }

        function answerKey(sections) {
            newPage();
            textBlock('Answer key', M, contentW, base + 6, 'bold', COLORS.text, 1);
            textBlock(opts.title || '', M, contentW, base - 1.5, 'normal', COLORS.muted, 4);
            const items = sections.flatMap(s => s.items);
            const twoCols = !opts.explanations;
            const colGap = 8;
            const colW = twoCols ? (contentW - colGap) / 2 : contentW;
            const top = y;
            let col = 0;
            const size = base - 0.5;
            const lh = lineH(size);
            items.forEach(item => {
                setFont('normal', size);
                const ls = lines(answerText(item), colW - 10);
                setFont('italic', size - 1.5);
                const ex = opts.explanations && item.explanation ? lines(item.explanation, colW - 10) : [];
                const h = ls.length * lh + ex.length * lineH(size - 1.5) + 2.2;
                if (y + h > bottom) {
                    if (twoCols && col === 0) { col = 1; y = top; }
                    else { newPage(); col = 0; y = M; }
                }
                const cx = M + col * (colW + colGap);
                setFont('bold', size, COLORS.text);
                doc.text(`${item.number}.`, cx, y + size * pt2mm);
                setFont('normal', size, COLORS.text);
                ls.forEach((line, i) => doc.text(line, cx + 10, y + size * pt2mm + i * lh));
                setFont('italic', size - 1.5, COLORS.muted);
                ex.forEach((line, i) => doc.text(line, cx + 10, y + size * pt2mm + ls.length * lh + i * lineH(size - 1.5)));
                y += h;
            });
        }

        function footers() {
            const n = doc.getNumberOfPages();
            for (let i = 1; i <= n; i++) {
                doc.setPage(i);
                setFont('normal', 8, COLORS.muted);
                const left = [String(opts.orgName || '').trim(), opts.title || ''].filter(Boolean).join('  ·  ');
                doc.text(clean(left), M, page.h - 10, { maxWidth: contentW - 30 });
                doc.text(`Page ${i} of ${n}`, page.w - M, page.h - 10, { align: 'right' });
            }
        }

        return {
            render(sections) {
                drawWatermark();
                header(sections);
                sections.forEach((section, index) => {
                    if (section.type) {
                        // keep the heading with its first question
                        const firstH = section.items.length ? measure(() => question(section.items[0])) : 0;
                        const headH = measure(() => sectionHeading(section, index));
                        if (y + headH + Math.min(firstH, 60) > bottom) newPage();
                        sectionHeading(section, index);
                    }
                    section.items.forEach(item => {
                        const h = measure(() => question(item));
                        if (h <= bottom - M && y + h > bottom) newPage();
                        question(item);
                    });
                });
                if (opts.answers === 'key') answerKey(sections);
                footers();
                return { missing };
            }
        };
    }

    async function download(questions, opts) {
        if (!questions.length) throw new Error('Choose at least one question.');
        const jsPDF = await loadJsPdf();
        const doc = new jsPDF({ unit: 'mm', format: opts.paper === 'letter' ? 'letter' : 'a4', compress: true });

        let useNoto = false;
        try {
            const fonts = await loadFonts();
            Object.entries(fonts).forEach(([style, data]) => {
                const file = `NotoSans-${style}.ttf`;
                doc.addFileToVFS(file, data);
                doc.addFont(file, 'NotoSans', style);
            });
            useNoto = true;
        } catch (err) {
            console.warn('Falling back to the built-in PDF font', err);
        }

        doc.setProperties({ title: opts.title || 'Quiz', subject: 'Quiz questions', creator: 'Quizr' });
        const sections = arrange(questions, opts);
        const result = createRenderer(doc, opts, useNoto).render(sections);
        const name = fileName(opts);
        doc.save(name);
        return { fileName: name, pages: doc.getNumberOfPages(), fontFallback: !useNoto, missingCharacters: result.missing };
    }

    // ---------- Print (browser engine) ----------
    function buildHtml(questions, opts) {
        const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        const nl = s => esc(s).replace(/\n/g, '<br>');
        // Text that may hold LaTeX: MathJax typesets it, or the plain-text version is swapped in if MathJax can't load
        const mt = raw => `<span class="mt" data-plain="${esc(latexToText(raw))}">${nl(raw)}</span>`;
        const sections = arrange(questions, opts);
        const count = sections.reduce((a, s) => a + s.items.length, 0);
        const marks = totalMarks(sections);
        const showAnswers = opts.answers === 'marked';

        const optionHtml = (item) => {
            if (!item.options.length) {
                if (showAnswers) return `<div class="answer"><b>Answer:</b> ${mt(item.answerRaw)}${item.unit ? ' ' + esc(item.unit) : ''}</div>`;
                if (opts.answerSpace) return `<div class="lines ${item.type}">${'<span></span>'.repeat(item.type === 'calculation' ? 2 : 2)}${item.type === 'calculation' ? `<div class="final">Answer: <span></span>${esc(item.unit)}</div>` : ''}</div>`;
                return '';
            }
            const twoCols = item.type === 'true_false' || item.options.every(o => o.raw.length < 38);
            return `<ol class="options ${twoCols ? 'two' : ''}">${item.options.map(o => {
                const correct = showAnswers && o.letter === item.correct;
                return `<li class="${correct ? 'correct' : ''}"><span class="bubble">${esc(item.type === 'true_false' ? o.letter.charAt(0) : o.letter)}</span><span>${mt(o.raw)}</span>${correct ? '<span class="tick">✓</span>' : ''}</li>`;
            }).join('')}</ol>`;
        };

        const questionHtml = item => {
            const tag = [opts.showIds ? item.id : '', opts.showMarks && item.marks ? `${item.marks} mark${item.marks == 1 ? '' : 's'}` : ''].filter(Boolean).join(' · ');
            return `<section class="q">
                <div class="q-head"><span class="num">${item.number}.</span><div class="q-text">${mt(item.raw)}</div>${tag ? `<span class="tag">${esc(tag)}</span>` : ''}</div>
                ${optionHtml(item)}
                ${showAnswers && opts.explanations && item.explanation ? `<p class="expl">${mt(item.explanationRaw)}</p>` : ''}
            </section>`;
        };

        const keyHtml = opts.answers !== 'key' ? '' : `
            <section class="key">
                <h2>Answer key</h2>
                <ol class="key-list ${opts.explanations ? '' : 'two'}">
                    ${sections.flatMap(s => s.items).map(item => `<li><b>${item.number}.</b> <span>${item.type === 'mcq' || item.type === 'true_false' ? nl(answerText(item)) : mt(item.answerRaw + (item.unit ? ' ' + item.unit : ''))}${opts.explanations && item.explanation ? `<em>${mt(item.explanationRaw)}</em>` : ''}</span></li>`).join('')}
                </ol>
            </section>`;

        const meta = [opts.quizName && opts.quizName !== opts.title ? opts.quizName : '', `${count} question${count === 1 ? '' : 's'}`,
            opts.showMarks && marks ? `${marks} marks` : '', today()].filter(Boolean).map(esc).join(' · ');

        const orgName = String(opts.orgName || '').trim();
        const brandHtml = !orgName && !opts.logo ? '' : `<div class="brand">
                ${opts.logo ? `<img src="${esc(opts.logo.data)}" alt="">` : ''}
                ${orgName ? `<div class="org">${esc(orgName)}</div>` : ''}
            </div>`;
        // position: fixed repeats the watermark on every printed page
        const wm = watermarkOf(opts);
        const wmHtml = !wm ? '' : wm.logo
            ? `<div class="wm"><img src="${esc(wm.logo.data)}" alt=""></div>`
            : `<div class="wm"><span style="font-size: ${Math.min(32, 190 / Math.max(1, wm.text.length * 0.62)).toFixed(1)}mm">${esc(wm.text)}</span></div>`;

        return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(fileName(opts).replace(/\.pdf$/, ''))}</title>
            <link href="https://fonts.googleapis.com/css2?family=Noto+Sans:ital,wght@0,400;0,700;1,400&display=swap" rel="stylesheet">
            <style>
                @page { size: ${opts.paper === 'letter' ? 'letter' : 'A4'}; margin: 18mm 18mm 20mm; }
                * { box-sizing: border-box; }
                body { font-family: 'Noto Sans', system-ui, sans-serif; font-size: ${opts.textSize === 'large' ? 12.5 : 10.5}pt; color: #111827; margin: 0; line-height: 1.4; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                h1 { font-size: 1.9em; margin: 0 0 2mm; }
                .meta { color: #64748b; font-size: 0.85em; margin-bottom: 3mm; }
                .badge { float: right; color: #15803d; font-weight: 700; font-size: 0.8em; margin-top: 2mm; }
                .instructions { margin: 0 0 3mm; white-space: pre-wrap; }
                .fields { display: flex; gap: 4mm; margin: 2mm 0 4mm; color: #64748b; font-size: 0.9em; }
                .fields span { flex: var(--w); border-bottom: 0.3mm solid #cbd5e1; padding-bottom: 4mm; }
                hr { border: 0; border-top: 0.5mm solid #e2e8f0; margin: 0 0 6mm; }
                h2 { font-size: 1.2em; margin: 6mm 0 3mm; padding-bottom: 1.5mm; border-bottom: 0.6mm solid #d97706; display: flex; justify-content: space-between; align-items: baseline; }
                h2 small { font-size: 0.7em; font-weight: 400; color: #64748b; }
                .q { break-inside: avoid; margin-bottom: 5mm; }
                .q-head { display: flex; gap: 2.5mm; }
                .num { font-weight: 700; min-width: 7mm; }
                .q-text { flex: 1; }
                .tag { color: #64748b; font-size: 0.8em; white-space: nowrap; }
                .options { list-style: none; padding: 0; margin: 2mm 0 0 9.5mm; display: grid; gap: 1.3mm; }
                .options.two { grid-template-columns: 1fr 1fr; }
                .options li { display: flex; align-items: flex-start; gap: 2.5mm; padding: 0.6mm 1.5mm; border-radius: 1.5mm; }
                .bubble { flex: none; width: 5mm; height: 5mm; border: 0.3mm solid #64748b; border-radius: 50%; display: grid; place-items: center; font-size: 0.7em; font-weight: 700; color: #64748b; }
                .correct { background: #dcfce7; color: #15803d; font-weight: 700; }
                .correct .bubble { background: #15803d; border-color: #15803d; color: #fff; }
                .tick { margin-left: 1mm; }
                .answer { margin: 2mm 0 0 9.5mm; padding: 1mm 2mm; border-radius: 1.5mm; background: #dcfce7; color: #15803d; }
                .lines { margin: 1mm 0 0 9.5mm; }
                .lines > span { display: block; height: 7mm; border-bottom: 0.25mm solid #cbd5e1; }
                .final { margin-top: 3mm; color: #64748b; font-size: 0.9em; display: flex; gap: 2mm; align-items: flex-end; }
                .final span { flex: 1; border-bottom: 0.25mm solid #cbd5e1; height: 5mm; }
                .expl { margin: 1.5mm 0 0 9.5mm; color: #64748b; font-style: italic; font-size: 0.88em; }
                .key { break-before: page; }
                .key h2 { display: block; border: 0; font-size: 1.5em; margin-top: 0; }
                .key-list { list-style: none; padding: 0; margin: 0; }
                .key-list.two { columns: 2; column-gap: 8mm; }
                .key-list li { break-inside: avoid; display: flex; gap: 2mm; margin-bottom: 1.5mm; }
                .key-list b { min-width: 8mm; }
                .key-list em { display: block; color: #64748b; font-size: 0.88em; }
                mjx-container { font-size: 105% !important; }
                .brand { text-align: center; margin-bottom: 6mm; }
                .brand img { display: block; max-width: 70mm; max-height: 22mm; margin: 0 auto 2.5mm; }
                .brand .org { font-size: 1.4em; font-weight: 700; }
                .brand::after { content: ''; display: block; width: 30mm; margin: 2mm auto 0; border-top: 0.6mm solid #d97706; }
                .wm { position: fixed; inset: 0; z-index: -1; display: flex; align-items: center; justify-content: center; pointer-events: none; overflow: hidden; }
                .wm span { transform: rotate(-45deg); white-space: nowrap; font-weight: 700; color: #64748b; opacity: 0.1; }
                .wm img { width: 60%; max-height: 50%; object-fit: contain; opacity: 0.08; }
            </style>
            <script>
                window.MathJax = { tex: { inlineMath: [['$', '$'], ['\\\\(', '\\\\)']], displayMath: [['$$', '$$'], ['\\\\[', '\\\\]']] }, svg: { fontCache: 'local' }, startup: { typeset: false } };
            </script>
            <script src="${MATHJAX_URL}" async></script>
            </head><body>
            ${wmHtml}
            ${brandHtml}
            ${showAnswers ?'<span class="badge">ANSWERS SHOWN</span>' : ''}
            <h1>${esc(opts.title || 'Quiz')}</h1>
            <div class="meta">${meta}</div>
            ${opts.instructions && opts.instructions.trim() ? `<p class="instructions">${esc(opts.instructions.trim())}</p>` : ''}
            ${opts.studentFields && !showAnswers ? `<div class="fields"><span style="--w:42">Name</span><span style="--w:24">Team / Class</span><span style="--w:16">Date</span><span style="--w:18">Score${opts.showMarks && marks ? ` &nbsp;&nbsp;&nbsp; / ${marks}` : ''}</span></div>` : ''}
            <hr>
            ${sections.map((s, i) => `${s.type ? `<h2>Section ${String.fromCharCode(65 + i)}: ${SECTION_NAMES[s.type]} <small>${s.items.length} question${s.items.length === 1 ? '' : 's'}${opts.showMarks ? ` · ${s.items.reduce((a, it) => a + (Number(it.marks) || 0), 0)} marks` : ''}</small></h2>` : ''}${s.items.map(questionHtml).join('')}`).join('')}
            ${keyHtml}
            </body></html>`;
    }

    function print(questions, opts) {
        if (!questions.length) throw new Error('Choose at least one question.');
        const old = document.getElementById('print-frame');
        if (old) old.remove();
        const frame = document.createElement('iframe');
        frame.id = 'print-frame';
        frame.setAttribute('aria-hidden', 'true');
        frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
        document.body.appendChild(frame);
        const win = frame.contentWindow;
        win.document.open();
        win.document.write(buildHtml(questions, opts));
        win.document.close();

        return new Promise(resolve => {
            let done = false;
            const plainMaths = () => {
                win.document.querySelectorAll('.mt').forEach(el => {
                    el.innerHTML = el.getAttribute('data-plain').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\n/g, '<br>');
                });
            };
            const go = (typeset) => {
                if (done) return;
                done = true;
                if (!typeset) plainMaths();
                win.focus();
                win.print();
                resolve();
            };
            // Typeset maths when MathJax is available, but never wait more than 5 seconds
            const started = Date.now();
            const poll = setInterval(() => {
                const mj = win.MathJax;
                if (mj && mj.typesetPromise && mj.startup && mj.startup.promise) {
                    clearInterval(poll);
                    mj.startup.promise.then(() => mj.typesetPromise()).then(() => setTimeout(() => go(true), 150), () => go(false));
                } else if (Date.now() - started > 5000) {
                    clearInterval(poll);
                    go(false);
                }
            }, 100);
        });
    }

    window.QuizBowl.Export = window.QuizBowl.Export || {};
    window.QuizBowl.Export.PDF = {
        download: download,
        print: print,
        // exposed for testing
        _latexToText: latexToText,
        _htmlToText: htmlToText,
        _arrange: arrange,
        _buildHtml: buildHtml,
        _fileName: fileName
    };
})();
