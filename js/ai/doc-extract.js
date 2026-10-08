/**
 * js/ai/doc-extract.js
 * Reads uploaded files in the browser and turns them into source material
 * for the question generator: plain text, page images and (for PDFs) the
 * original file so AI services that understand PDFs can read it directly.
 *
 * The readers (pdf.js, mammoth, JSZip) are loaded from the CDN only when a
 * file that needs them is added.
 */
(function() {
    const CDN = 'https://cdnjs.cloudflare.com/ajax/libs';
    const LIBS = {
        pdfjs: { src: `${CDN}/pdf.js/3.11.174/pdf.min.js`, global: 'pdfjsLib' },
        mammoth: { src: `${CDN}/mammoth/1.8.0/mammoth.browser.min.js`, global: 'mammoth' },
        jszip: { src: `${CDN}/jszip/3.10.1/jszip.min.js`, global: 'JSZip' }
    };
    const PDF_WORKER = `${CDN}/pdf.js/3.11.174/pdf.worker.min.js`;

    const MAX_FILE_BYTES = 40 * 1024 * 1024;
    const MAX_IMAGE_SIDE = 1568;        // long edge in px; larger images cost more without helping
    const MAX_SCANNED_PAGES = 12;       // pages rendered as images when a PDF has no text layer

    const loading = {};
    function loadLib(name) {
        const lib = LIBS[name];
        if (window[lib.global]) return Promise.resolve(window[lib.global]);
        if (!loading[name]) {
            loading[name] = new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = lib.src;
                script.onload = () => resolve(window[lib.global]);
                script.onerror = () => {
                    delete loading[name];
                    reject(new Error('Could not load the file reader. Check your internet connection and try again.'));
                };
                document.head.appendChild(script);
            });
        }
        return loading[name];
    }

    function extOf(name) {
        const m = /\.([a-z0-9]+)$/i.exec(name || '');
        return m ? m[1].toLowerCase() : '';
    }

    const KINDS = {
        pdf: ['pdf'],
        docx: ['docx', 'docm', 'dotx'],
        pptx: ['pptx', 'pptm', 'ppsx'],
        odf: ['odt', 'odp', 'ods'],
        text: ['txt', 'md', 'markdown', 'csv', 'tsv', 'json', 'xml', 'srt', 'vtt', 'log', 'tex', 'rtf'],
        html: ['html', 'htm'],
        image: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'heic', 'heif', 'avif']
    };
    const LEGACY = { doc: 'Word', ppt: 'PowerPoint', xls: 'Excel', xlsx: 'Excel', pages: 'Pages', key: 'Keynote' };

    function kindOf(file) {
        const ext = extOf(file.name);
        for (const [kind, exts] of Object.entries(KINDS)) if (exts.includes(ext)) return kind;
        if (file.type === 'application/pdf') return 'pdf';
        if (file.type.startsWith('image/')) return 'image';
        if (file.type.startsWith('text/')) return 'text';
        return null;
    }

    const ACCEPT = Object.values(KINDS).flat().map(e => '.' + e).join(',');

    function cleanText(text) {
        return String(text || '')
            .replace(/\r\n?/g, '\n')
            .replace(/[ \t\f\v]+/g, ' ')
            .replace(/ *\n */g, '\n')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    }

    function arrayBufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        const chunk = 0x8000;
        for (let i = 0; i < bytes.length; i += chunk) {
            binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
        }
        return btoa(binary);
    }

    function canvasToJpeg(canvas) {
        return canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
    }

    async function readImage(file) {
        let bitmap;
        try {
            bitmap = await createImageBitmap(file);
        } catch (e) {
            throw new Error(/heic|heif/i.test(extOf(file.name))
                ? 'This browser can\'t open HEIC photos. Export it as JPG first (on iPhone: Settings → Camera → Formats → Most Compatible).'
                : 'This image could not be opened.');
        }
        const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(bitmap.width * scale);
        canvas.height = Math.round(bitmap.height * scale);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff'; // transparent areas would otherwise turn black in JPEG
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        bitmap.close && bitmap.close();
        return { mime: 'image/jpeg', data: canvasToJpeg(canvas) };
    }

    async function readPdf(buffer, doc) {
        const pdfjs = await loadLib('pdfjs');
        pdfjs.GlobalWorkerOptions.workerSrc = PDF_WORKER;
        // pdf.js takes ownership of the buffer it is given, so hand it a copy
        const pdf = await pdfjs.getDocument({ data: buffer.slice(0) }).promise;
        doc.pages = pdf.numPages;

        const pageTexts = [];
        for (let n = 1; n <= pdf.numPages; n++) {
            const page = await pdf.getPage(n);
            const content = await page.getTextContent();
            let line = '';
            content.items.forEach(item => {
                line += item.str + (item.hasEOL ? '\n' : ' ');
            });
            pageTexts.push(cleanText(line));
        }
        doc.text = pageTexts.map((t, i) => t ? `[Page ${i + 1}]\n${t}` : '').filter(Boolean).join('\n\n');

        // Scanned PDFs have (almost) no text layer: keep page pictures instead
        const textChars = pageTexts.join('').length;
        if (textChars < 40 * pdf.numPages) {
            const count = Math.min(pdf.numPages, MAX_SCANNED_PAGES);
            for (let n = 1; n <= count; n++) {
                const page = await pdf.getPage(n);
                const base = page.getViewport({ scale: 1 });
                const scale = Math.min(2, MAX_IMAGE_SIDE / Math.max(base.width, base.height));
                const viewport = page.getViewport({ scale });
                const canvas = document.createElement('canvas');
                canvas.width = Math.round(viewport.width);
                canvas.height = Math.round(viewport.height);
                await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
                doc.images.push({ mime: 'image/jpeg', data: canvasToJpeg(canvas) });
            }
            doc.scanned = true;
            doc.notes.push(pdf.numPages > count
                ? `Scanned PDF: the first ${count} of ${pdf.numPages} pages will be read as pictures.`
                : 'Scanned PDF: pages will be read as pictures.');
        }
        await pdf.destroy();
    }

    async function readZipXml(buffer, pattern, pick) {
        const JSZip = await loadLib('jszip');
        const zip = await JSZip.loadAsync(buffer);
        const names = Object.keys(zip.files).filter(n => pattern.test(n))
            .sort((a, b) => (parseInt(a.replace(/\D+/g, ''), 10) || 0) - (parseInt(b.replace(/\D+/g, ''), 10) || 0));
        const parts = [];
        for (const name of names) {
            const xml = await zip.files[name].async('string');
            parts.push(pick(name, new DOMParser().parseFromString(xml, 'application/xml')));
        }
        return parts.filter(Boolean);
    }

    async function readPptx(buffer, doc) {
        const slides = await readZipXml(buffer, /^ppt\/slides\/slide\d+\.xml$/, (name, xml) => {
            const paragraphs = [...xml.getElementsByTagName('a:p')]
                .map(p => [...p.getElementsByTagName('a:t')].map(t => t.textContent).join(''))
                .filter(t => t.trim());
            return paragraphs.length ? `[Slide ${name.replace(/\D+/g, '')}]\n${paragraphs.join('\n')}` : '';
        });
        doc.pages = slides.length;
        doc.text = slides.join('\n\n');
    }

    async function readOdf(buffer, doc) {
        const parts = await readZipXml(buffer, /^content\.xml$/, (name, xml) => {
            const blocks = [...xml.getElementsByTagName('text:p'), ...xml.getElementsByTagName('text:h')];
            return blocks.map(b => b.textContent).filter(t => t.trim()).join('\n');
        });
        doc.text = parts.join('\n\n');
    }

    function stripRtf(rtf) {
        return rtf
            .replace(/\\par[d]?/g, '\n')
            .replace(/\{\\\*[^{}]*\}/g, '')
            .replace(/\\'[0-9a-f]{2}/gi, '')
            .replace(/\\[a-z]+-?\d* ?/gi, '')
            .replace(/[{}]/g, '');
    }

    /**
     * Read one file. Resolves to a source document:
     * { id, name, size, kind, text, images, pdfData, pages, scanned, notes, error }
     */
    async function readFile(file) {
        const doc = {
            id: 'F' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
            name: file.name, size: file.size, kind: kindOf(file),
            text: '', images: [], pdfData: null, pdfBytes: 0, pages: 0, scanned: false, notes: [], error: ''
        };

        const ext = extOf(file.name);
        if (!doc.kind) {
            doc.kind = 'unknown';
            doc.error = LEGACY[ext]
                ? `Old or unsupported ${LEGACY[ext]} format. Save it as PDF${ext === 'doc' ? ' or .docx' : ext === 'ppt' ? ' or .pptx' : ''} and upload that instead.`
                : 'This file type isn\'t supported. Use PDF, Word (.docx), PowerPoint (.pptx), text or image files.';
            return doc;
        }
        if (file.size > MAX_FILE_BYTES) {
            doc.error = `File is too large (${(file.size / 1048576).toFixed(0)} MB). The limit is 40 MB.`;
            return doc;
        }

        try {
            if (doc.kind === 'image') {
                doc.images.push(await readImage(file));
            } else {
                const buffer = await file.arrayBuffer();
                if (doc.kind === 'pdf') {
                    doc.pdfData = arrayBufferToBase64(buffer);
                    doc.pdfBytes = file.size;
                    await readPdf(buffer, doc);
                } else if (doc.kind === 'docx') {
                    const mammoth = await loadLib('mammoth');
                    const result = await mammoth.extractRawText({ arrayBuffer: buffer });
                    doc.text = result.value;
                } else if (doc.kind === 'pptx') {
                    await readPptx(buffer, doc);
                } else if (doc.kind === 'odf') {
                    await readOdf(buffer, doc);
                } else if (doc.kind === 'html') {
                    const html = new TextDecoder().decode(buffer);
                    const parsed = new DOMParser().parseFromString(html, 'text/html');
                    parsed.querySelectorAll('script, style, noscript').forEach(el => el.remove());
                    doc.text = parsed.body ? parsed.body.innerText || parsed.body.textContent : '';
                } else {
                    const text = new TextDecoder().decode(buffer);
                    doc.text = ext === 'rtf' ? stripRtf(text) : text;
                }
                doc.text = cleanText(doc.text);
            }

            if (!doc.text && !doc.images.length) {
                doc.error = 'No readable text was found in this file.';
            }
        } catch (err) {
            console.error('Failed to read', file.name, err);
            if (err && err.name === 'PasswordException') {
                doc.error = 'This PDF is password-protected. Remove the password and upload it again.';
                return doc;
            }
            doc.error = err && err.message && /could not load/i.test(err.message)
                ? err.message
                : 'This file could not be read. It may be damaged or password-protected.';
        }
        return doc;
    }

    window.QuizBowl.AI = window.QuizBowl.AI || {};
    window.QuizBowl.AI.DocExtract = {
        ACCEPT: ACCEPT,
        readFile: readFile
    };
})();
