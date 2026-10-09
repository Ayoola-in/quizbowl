/**
 * js/services/host-service.js
 * Hosted quizzes: a host picks questions and rules, gets a join code, and
 * people take the quiz one question at a time against a timer. Attempts are
 * marked automatically and kept as scores for the host.
 *
 * This is the on-device version, used when the site has no cloud accounts
 * (app-wide storage keys, not tied to the active quiz). With accounts, hosted
 * quizzes live in the cloud instead (js/cloud/host-cloud.js), and both are
 * reached through js/services/hosting.js. The rules here match the cloud's
 * (supabase/schema.sql). Sessions keep a frozen copy of their questions, so
 * later edits in the question bank never change how an attempt is marked.
 *
 * Session: { id, code, title, quizId, quizName, createdAt, open, settings, questions: [snapshot] }
 *   settings: { timerMode: 'question'|'total', times: { mcq, true_false, theory, calculation } (seconds),
 *               totalSeconds, groupByCategory, shuffleQuestions, shuffleOptions, showReview, allowRetake }
 * Attempt: { id, sessionId, name, userId, email, startedAt, status: 'in_progress'|'submitted', settings (rules it started with),
 *            order: [questionId], optionOrder: { questionId: [letter] }, answers: { questionId: value },
 *            current, questionDeadline (per-question mode), deadline (total mode), view,
 *            submittedAt, endedBy: 'finished'|'ended'|'timeout', results, score, maxScore, pending,
 *            away: [{ at, back, reason: 'left'|'reload' }] (times out of full screen) }
 *   results: { questionId: { status: 'correct'|'wrong'|'pending'|'marked'|'unanswered', awarded, marks } }
 */
(function() {
    const Storage = window.QuizBowl.Data.Storage;
    const SESSIONS_KEY = 'host_sessions';
    const ATTEMPTS_KEY = 'host_attempts';
    const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';   // no 0/O, 1/I/L
    const TYPES = ['mcq', 'true_false', 'theory', 'calculation'];
    const DEFAULT_TIMES = { mcq: 20, true_false: 10, theory: 30, calculation: 60 };
    const UNCATEGORISED = 'Uncategorised';

    const DEFAULT_SETTINGS = {
        timerMode: 'question',
        times: { ...DEFAULT_TIMES },
        totalSeconds: 600,
        groupByCategory: false,
        shuffleQuestions: false,
        shuffleOptions: false,
        showReview: true,
        allowRetake: false
    };

    // ---------- helpers ----------
    function newId(prefix) {
        return prefix + Date.now().toString(36) + Math.floor(Math.random() * 46656).toString(36);
    }

    function shuffle(list) {
        const a = list.slice();
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    function toText(html) {
        return String(html == null ? '' : html).replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ' ')
            .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"').replace(/&#39;/g, "'");
    }

    // Lower case, no accents, punctuation and maths delimiters reduced to single spaces
    function normalise(value) {
        return toText(value).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
            .replace(/[^\p{L}\p{N}.]+/gu, ' ').replace(/(^|\s)\.+|\.+(\s|$)/g, ' ').replace(/\s+/g, ' ').trim();
    }

    // The last number written in a value ("x = 7" -> 7, "1,500 km" -> 1500), with its decimal places
    function lastNumber(value) {
        const text = toText(value).replace(/(\d),(?=\d{3}\b)/g, '$1').replace(/[−–]/g, '-');
        const matches = text.match(/-?\d+(?:\.\d+)?/g);
        if (!matches) return null;
        const raw = matches[matches.length - 1];
        return { value: parseFloat(raw), decimals: (raw.split('.')[1] || '').length };
    }

    function expectedAnswer(q) {
        return q.type === 'theory' || q.type === 'calculation' ? (q.expectedAnswer || q.correctAnswer || '') : (q.correctAnswer || '');
    }

    /**
     * Mark one answer. Multiple choice and true/false are exact. Calculation compares the
     * numbers (the answer counts when it rounds to the expected value at the expected
     * number of decimal places). Short answers count when they match the expected text;
     * anything else is left for the host to mark.
     */
    function gradeAnswer(q, given) {
        const marks = Number(q.marks) || 0;
        const empty = given == null || String(given).trim() === '';
        if (empty) return { status: 'unanswered', awarded: 0, marks };
        const right = { status: 'correct', awarded: marks, marks };
        const wrong = { status: 'wrong', awarded: 0, marks };
        const pending = { status: 'pending', awarded: 0, marks };

        if (q.type === 'mcq') return String(given) === String(q.correctAnswer) ? right : wrong;
        if (q.type === 'true_false') return String(given).toLowerCase() === String(q.correctAnswer).toLowerCase() ? right : wrong;

        const expected = expectedAnswer(q);
        if (normalise(given) === normalise(expected) && normalise(expected)) return right;
        if (q.type === 'calculation') {
            const want = lastNumber(expected);
            if (want) {
                const got = lastNumber(given);
                if (!got) return wrong;
                const tolerance = 0.5 * Math.pow(10, -want.decimals) + 1e-9;
                return Math.abs(got.value - want.value) <= tolerance ? right : wrong;
            }
        }
        return pending;
    }

    // ---------- storage ----------
    const readSessions = () => Storage.getGlobal(SESSIONS_KEY, []) || [];
    const writeSessions = list => {
        if (!Storage.setGlobal(SESSIONS_KEY, list)) throw new Error('Couldn\'t save. This device\'s storage may be full.');
    };
    const readAttempts = () => Storage.getGlobal(ATTEMPTS_KEY, []) || [];
    const writeAttempts = list => {
        if (!Storage.setGlobal(ATTEMPTS_KEY, list)) throw new Error('Couldn\'t save your answers. This device\'s storage may be full.');
    };

    function newCode(existing) {
        for (let tries = 0; tries < 50; tries++) {
            let code = '';
            const bytes = new Uint32Array(6);
            (window.crypto || window.msCrypto).getRandomValues(bytes);
            bytes.forEach(b => { code += CODE_CHARS[b % CODE_CHARS.length]; });
            if (!existing.some(s => s.code === code)) return code;
        }
        throw new Error('Couldn\'t make a unique code. Please try again.');
    }

    function snapshot(q) {
        const copy = {
            id: q.id, type: q.type, category: (q.category || '').trim() || UNCATEGORISED,
            question: q.question || '', marks: Number(q.marks) || 0, explanation: q.explanation || ''
        };
        if (q.type === 'mcq') { copy.options = { ...(q.options || {}) }; copy.correctAnswer = q.correctAnswer || ''; }
        else if (q.type === 'true_false') copy.correctAnswer = q.correctAnswer || '';
        else {
            copy.expectedAnswer = q.expectedAnswer || q.correctAnswer || '';
            if (q.unit) copy.unit = q.unit;
        }
        return copy;
    }

    // Question order for one attempt: optionally shuffled, optionally grouped by category (A–Z)
    function buildOrder(session) {
        let list = session.questions.slice();
        if (session.settings.shuffleQuestions) list = shuffle(list);
        if (session.settings.groupByCategory) {
            const cats = [...new Set(list.map(q => q.category))].sort((a, b) =>
                (a === UNCATEGORISED) - (b === UNCATEGORISED) || a.localeCompare(b));
            list = cats.flatMap(c => list.filter(q => q.category === c));
        }
        return list.map(q => q.id);
    }

    function questionTime(session, q) {
        const t = Number(session.settings.times[q.type]);
        return Math.max(5, Number.isFinite(t) ? t : DEFAULT_TIMES[q.type] || 30);
    }

    function questionMap(session) {
        const map = {};
        session.questions.forEach(q => { map[q.id] = q; });
        return map;
    }

    // Editing a hosted quiz doesn't change running attempts: they keep the timer and order they started with
    const ATTEMPT_RULES = ['timerMode', 'times', 'totalSeconds', 'groupByCategory', 'shuffleQuestions', 'shuffleOptions'];
    function forAttempt(session, attempt) {
        if (!session || !attempt || !attempt.settings) return session;
        const rules = {};
        ATTEMPT_RULES.forEach(k => { if (attempt.settings[k] !== undefined) rules[k] = attempt.settings[k]; });
        return { ...session, settings: { ...session.settings, ...rules } };
    }

    function cleanSettings(settings) {
        const merged = { ...DEFAULT_SETTINGS, ...settings, times: { ...DEFAULT_TIMES, ...(settings && settings.times) } };
        merged.timerMode = merged.timerMode === 'total' ? 'total' : 'question';
        Object.keys(DEFAULT_TIMES).forEach(t => {
            const v = Math.round(Number(merged.times[t]));
            merged.times[t] = Math.min(3600, Math.max(5, Number.isFinite(v) ? v : DEFAULT_TIMES[t]));
        });
        return merged;
    }

    function score(session, attempt) {
        const map = questionMap(session);
        const results = {};
        let total = 0, max = 0, pending = 0;
        attempt.order.forEach(id => {
            const q = map[id];
            if (!q) return;
            const previous = attempt.results && attempt.results[id];
            const r = previous && previous.status === 'marked' ? previous : gradeAnswer(q, attempt.answers[id]);
            results[id] = r;
            total += r.awarded;
            max += r.marks;
            if (r.status === 'pending') pending++;
        });
        return { results, score: total, maxScore: max, pending };
    }

    const Service = {
        TYPES,
        DEFAULT_TIMES,
        DEFAULT_SETTINGS,
        UNCATEGORISED,

        // ---------- sessions ----------
        listSessions() {
            return readSessions().slice().sort((a, b) => b.createdAt - a.createdAt);
        },

        getSession(id) {
            return readSessions().find(s => s.id === id) || null;
        },

        getSessionByCode(code) {
            const clean = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
            return readSessions().find(s => s.code === clean) || null;
        },

        createSession({ title, quizId, quizName, questions, settings }) {
            if (!questions || !questions.length) throw new Error('Choose at least one question.');
            const merged = cleanSettings(settings);
            if (merged.timerMode === 'total' && !(merged.totalSeconds >= 30)) throw new Error('Give the quiz at least 30 seconds in total.');
            const sessions = readSessions();
            const session = {
                id: newId('HS'),
                code: newCode(sessions),
                title: String(title || quizName || 'Quiz').trim().slice(0, 120) || 'Quiz',
                quizId, quizName: quizName || '',
                createdAt: Date.now(),
                open: true,
                settings: merged,
                questions: questions.map(snapshot)
            };
            sessions.push(session);
            writeSessions(sessions);
            return session;
        },

        /**
         * Change a hosted quiz: title and settings at any time (running attempts keep the
         * rules they started with); questions only until someone has started.
         */
        updateSession(id, { title, quizName, settings, questions } = {}) {
            const sessions = readSessions();
            const s = sessions.find(x => x.id === id);
            if (!s) throw new Error('Hosted quiz not found.');
            if (title !== undefined) {
                const clean = String(title || '').trim().slice(0, 120);
                if (!clean) throw new Error('Please enter a title.');
                s.title = clean;
            }
            if (settings !== undefined) {
                const merged = cleanSettings(settings);
                if (merged.timerMode === 'total' && !(merged.totalSeconds >= 30)) throw new Error('Give the quiz at least 30 seconds in total.');
                s.settings = merged;
            }
            if (questions !== undefined) {
                if (!questions || !questions.length) throw new Error('Choose at least one question.');
                if (readAttempts().some(a => a.sessionId === id)) {
                    throw new Error('People have already started this quiz, so its questions can\'t change. Host it again as a new quiz to use different questions.');
                }
                s.questions = questions.map(snapshot);
                if (quizName !== undefined) s.quizName = quizName || '';
            }
            writeSessions(sessions);
            return s;
        },

        setOpen(id, open) {
            const sessions = readSessions();
            const s = sessions.find(x => x.id === id);
            if (!s) throw new Error('Hosted quiz not found.');
            s.open = !!open;
            writeSessions(sessions);
            return s;
        },

        deleteSession(id) {
            writeSessions(readSessions().filter(s => s.id !== id));
            writeAttempts(readAttempts().filter(a => a.sessionId !== id));
        },

        // Total time a question-by-question attempt can take, in seconds
        sessionDuration(session) {
            if (session.settings.timerMode === 'total') return session.settings.totalSeconds;
            return session.questions.reduce((sum, q) => sum + questionTime(session, q), 0);
        },

        totalMarks(session) {
            return session.questions.reduce((sum, q) => sum + (Number(q.marks) || 0), 0);
        },

        questionTime,
        questionMap,
        forAttempt,

        // ---------- attempts ----------
        listAttempts(sessionId) {
            return readAttempts().filter(a => a.sessionId === sessionId);
        },

        getAttempt(id) {
            return readAttempts().find(a => a.id === id) || null;
        },

        // The most recent attempt by this person (signed-in user id, or name when there are no accounts)
        latestAttempt(sessionId, identity) {
            const mine = readAttempts().filter(a => a.sessionId === sessionId && (identity.userId
                ? a.userId === identity.userId
                : !a.userId && a.name.toLowerCase() === String(identity.name || '').trim().toLowerCase()));
            return mine.sort((a, b) => b.startedAt - a.startedAt)[0] || null;
        },

        startAttempt(session, { name, userId = null, email = '' }) {
            const cleanName = String(name || '').trim().replace(/\s+/g, ' ').slice(0, 80);
            if (!cleanName) throw new Error('Please enter your name.');
            if (!session.open) throw new Error('This quiz is closed.');
            const order = buildOrder(session);
            const map = questionMap(session);
            const optionOrder = {};
            order.forEach(id => {
                const q = map[id];
                if (q.type === 'mcq') {
                    const letters = Object.keys(q.options || {}).sort();
                    optionOrder[id] = session.settings.shuffleOptions ? shuffle(letters) : letters;
                }
            });
            const now = Date.now();
            const attempt = {
                id: newId('AT'),
                sessionId: session.id,
                name: cleanName, userId, email: email || '',
                startedAt: now,
                status: 'in_progress',
                settings: { ...session.settings },
                order, optionOrder,
                answers: {},
                current: 0,
                view: 0
            };
            if (session.settings.timerMode === 'total') attempt.deadline = now + session.settings.totalSeconds * 1000;
            else attempt.questionDeadline = now + questionTime(session, map[order[0]]) * 1000;
            const all = readAttempts();
            all.push(attempt);
            writeAttempts(all);
            return attempt;
        },

        // Read-modify-write one attempt
        _update(attemptId, fn) {
            const all = readAttempts();
            const attempt = all.find(a => a.id === attemptId);
            if (!attempt) throw new Error('This attempt no longer exists.');
            const result = fn(attempt);
            writeAttempts(all);
            return result === undefined ? attempt : result;
        },

        // Answers can only change while the question is open (any question in total-time mode)
        canAnswer(session, attempt, index) {
            if (attempt.status !== 'in_progress') return false;
            return forAttempt(session, attempt).settings.timerMode === 'total' ? true : index === attempt.current;
        },

        saveAnswer(attemptId, questionId, value) {
            const session = this.getSession((this.getAttempt(attemptId) || {}).sessionId);
            return this._update(attemptId, a => {
                const index = a.order.indexOf(questionId);
                if (index === -1 || !session || !this.canAnswer(session, a, index)) return a;
                if (value == null || value === '') delete a.answers[questionId];
                else a.answers[questionId] = String(value).slice(0, 5000);
            });
        },

        setView(attemptId, index) {
            return this._update(attemptId, a => {
                a.view = Math.max(0, Math.min(a.order.length - 1, index | 0));
            });
        },

        /**
         * Per-question mode: close the open question and open the next one.
         * Returns the attempt; it is submitted when the last question closes.
         */
        nextQuestion(attemptId) {
            const attempt = this.getAttempt(attemptId);
            const session = attempt && forAttempt(this.getSession(attempt.sessionId), attempt);
            if (!attempt || !session || attempt.status !== 'in_progress' || session.settings.timerMode === 'total') return attempt;
            if (attempt.current >= attempt.order.length - 1) return this.submit(attemptId, 'finished');
            const map = questionMap(session);
            return this._update(attemptId, a => {
                a.current += 1;
                a.view = a.current;
                a.questionDeadline = Date.now() + questionTime(session, map[a.order[a.current]]) * 1000;
            });
        },

        /**
         * Apply the clock. Per question: each expired question closes and the next opens
         * with its own time, counted from when the previous one closed (so time keeps
         * running while someone is away). Total time: submit when time is up.
         * Returns { attempt, changed }.
         */
        checkTime(attemptId, now = Date.now()) {
            const attempt = this.getAttempt(attemptId);
            if (!attempt || attempt.status !== 'in_progress') return { attempt, changed: false };
            const session = forAttempt(this.getSession(attempt.sessionId), attempt);
            if (!session) return { attempt, changed: false };
            if (session.settings.timerMode === 'total') {
                if (now >= attempt.deadline) return { attempt: this.submit(attemptId, 'timeout', attempt.deadline), changed: 'timeout' };
                return { attempt, changed: false };
            }
            if (now < attempt.questionDeadline) return { attempt, changed: false };
            const map = questionMap(session);
            let current = attempt.current, deadline = attempt.questionDeadline;
            while (now >= deadline) {
                if (current >= attempt.order.length - 1) return { attempt: this.submit(attemptId, 'finished', deadline), changed: 'finished' };
                current += 1;
                deadline += questionTime(session, map[attempt.order[current]]) * 1000;
            }
            return {
                attempt: this._update(attemptId, a => { a.current = current; a.view = current; a.questionDeadline = deadline; }),
                changed: 'question'
            };
        },

        submit(attemptId, endedBy = 'finished', at = Date.now()) {
            const attempt = this.getAttempt(attemptId);
            const session = attempt && this.getSession(attempt.sessionId);
            if (!attempt || !session) throw new Error('This attempt no longer exists.');
            if (attempt.status === 'submitted') return attempt;
            return this._update(attemptId, a => {
                const marked = score(session, a);
                a.status = 'submitted';
                a.endedBy = endedBy;
                a.submittedAt = Math.min(Date.now(), Math.max(a.startedAt, at));
                Object.assign(a, marked);
                delete a.questionDeadline;
            });
        },

        // Host marking for written answers (also lets the host override any automatic mark)
        setMark(attemptId, questionId, awarded) {
            const attempt = this.getAttempt(attemptId);
            const session = attempt && this.getSession(attempt.sessionId);
            if (!attempt || !session || attempt.status !== 'submitted') throw new Error('Only submitted attempts can be marked.');
            const q = questionMap(session)[questionId];
            if (!q) throw new Error('Question not found.');
            const value = Math.max(0, Math.min(Number(q.marks) || 0, Number(awarded)));
            if (!Number.isFinite(value)) throw new Error('Enter a number of marks.');
            return this._update(attemptId, a => {
                a.results[questionId] = { status: 'marked', awarded: value, marks: Number(q.marks) || 0 };
                Object.assign(a, score(session, a));
            });
        },

        // Put a host-marked question back to its automatic mark
        clearMark(attemptId, questionId) {
            const attempt = this.getAttempt(attemptId);
            const session = attempt && this.getSession(attempt.sessionId);
            if (!attempt || !session) return attempt;
            return this._update(attemptId, a => {
                delete a.results[questionId];
                Object.assign(a, score(session, a));
            });
        },

        // Leaving full screen ('left', or 'reload' when the page was reopened) and coming back ('back')
        recordAway(attemptId, event, now = Date.now()) {
            const attempt = this.getAttempt(attemptId);
            if (!attempt || attempt.status !== 'in_progress') return attempt;
            return this._update(attemptId, a => {
                const events = a.away || (a.away = []);
                const last = events[events.length - 1];
                if (event === 'left' || event === 'reload') {
                    // Full screen often ends while a page reloads; the reopened page then says why
                    if (last && last.back == null && event === 'reload') { last.reason = 'reload'; return; }
                    if ((last && last.back == null) || events.length >= 200) return;
                    events.push({ at: now, back: null, reason: event });
                } else if (event === 'back' && last && last.back == null) {
                    last.back = now;
                }
            });
        },

        deleteAttempt(attemptId) {
            writeAttempts(readAttempts().filter(a => a.id !== attemptId));
        },

        // exposed for testing
        _gradeAnswer: gradeAnswer,
        _normalise: normalise,
        _lastNumber: lastNumber,
        _buildOrder: buildOrder
    };

    window.QuizBowl.Services.HostLocal = Service;
})();
