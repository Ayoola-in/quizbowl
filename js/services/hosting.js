/**
 * js/services/hosting.js
 * One async interface for hosted quizzes, whether they live in the cloud
 * (sites with accounts: anyone signed in can join with the code) or only on
 * this device (sites without accounts, and quizzes hosted here before
 * sharing existed). The pages use only this.
 *
 * Taking a quiz works on "states": { source, attempt, session, questions,
 * review, serverNow }, where `questions` holds only what the person may see
 * (without answers in the cloud) and `review` the full questions once the
 * attempt is submitted, if the host allows it.
 */
(function() {
    const Local = () => window.QuizBowl.Services.HostLocal;
    const CloudHost = () => window.QuizBowl.HostCloud;
    const Cloud = () => window.QuizBowl.Cloud;

    // Cloud ids are UUIDs; on-device ones start with HS (sessions) or AT (attempts)
    const isCloudId = id => /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(String(id || ''));
    const cleanCode = code => String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

    function publicSession(s) {
        return {
            id: s.id, code: s.code, title: s.title, quizName: s.quizName || '', settings: s.settings,
            questionCount: s.questions.length, totalMarks: Local().totalMarks(s), open: s.open, createdAt: s.createdAt
        };
    }

    function localSession(s) {
        if (!s) return null;
        const attempts = Local().listAttempts(s.id);
        const done = attempts.filter(a => a.status === 'submitted');
        return {
            ...s, source: 'local', questionCount: s.questions.length, totalMarks: Local().totalMarks(s),
            stats: { submitted: done.length, running: attempts.length - done.length, pending: done.reduce((n, a) => n + (a.pending || 0), 0) }
        };
    }

    // Same shape as the cloud's attempt state
    function localState(attempt) {
        const L = Local();
        const live = L.getSession(attempt.sessionId);
        const s = L.forAttempt(live, attempt);   // the timer and order this attempt started with
        const map = L.questionMap(s);
        const running = attempt.status === 'in_progress';
        const perQuestion = s.settings.timerMode !== 'total';
        const questions = {};
        attempt.order.forEach((id, i) => {
            if (running && perQuestion && i > attempt.current) return;
            if (map[id]) questions[id] = map[id];
        });
        let review = null;
        if (!running && s.settings.showReview) {
            review = {};
            attempt.order.forEach(id => { if (map[id]) review[id] = map[id]; });
        }
        return {
            source: 'local',
            attempt: { ...attempt, results: running ? null : attempt.results },
            session: publicSession(s),
            questions, review,
            serverNow: Date.now()
        };
    }

    function localTick(attemptId) {
        const { attempt } = Local().checkTime(attemptId);
        if (!attempt) throw new Error('This attempt no longer exists.');
        return attempt;
    }

    const Hosting = {
        isCloudId,

        /**
         * Where new hosted quizzes go: 'cloud' (signed in), 'signin' (accounts exist but
         * nobody is signed in), 'loading' (still checking the account) or 'local' (no accounts).
         */
        hostMode() {
            const c = Cloud();
            if (!c || !c.configured) return 'local';
            if (!c.isReady()) return 'loading';
            return c.user() ? 'cloud' : 'signin';
        },

        // ---------------- host ----------------
        async listSessions() {
            const local = Local().listSessions().map(localSession);
            if (this.hostMode() !== 'cloud') return { cloud: [], local };
            try {
                return { cloud: await CloudHost().listSessions(), local };
            } catch (err) {
                // Still show what's on this device
                return { cloud: [], local, cloudError: err.message };
            }
        },

        async getSession(id) {
            if (isCloudId(id)) return CloudHost().getSession(id);
            return localSession(Local().getSession(id));
        },

        async createSession(data) {
            const mode = this.hostMode();
            if (mode === 'cloud') return CloudHost().createSession(data);
            if (mode === 'local') return localSession(Local().createSession(data));
            throw new Error('Please sign in to host a quiz.');
        },

        // Change the title, settings, or (until someone starts) the questions of a hosted quiz
        async updateSession(id, patch) {
            if (isCloudId(id)) return CloudHost().updateSession(id, patch);
            return localSession(Local().updateSession(id, patch));
        },

        async setOpen(id, open) {
            if (isCloudId(id)) return CloudHost().setOpen(id, open);
            Local().setOpen(id, open);
        },

        async deleteSession(id) {
            if (isCloudId(id)) return CloudHost().deleteSession(id);
            Local().deleteSession(id);
        },

        async listAttempts(sessionId) {
            if (isCloudId(sessionId)) return CloudHost().listAttempts(sessionId);
            const L = Local();
            L.listAttempts(sessionId).filter(a => a.status === 'in_progress').forEach(a => L.checkTime(a.id));
            return L.listAttempts(sessionId);
        },

        async getAttempt(id) {
            if (isCloudId(id)) return CloudHost().getAttempt(id);
            const a = Local().getAttempt(id);
            if (a && a.status === 'in_progress') return localTick(id);
            return a;
        },

        async setMark(attemptId, questionId, marks) {
            if (isCloudId(attemptId)) return CloudHost().setMark(attemptId, questionId, marks);
            if (marks === '' || !Number.isFinite(Number(marks))) throw new Error('Enter a number of marks.');
            Local().setMark(attemptId, questionId, marks);
        },

        async clearMark(attemptId, questionId) {
            if (isCloudId(attemptId)) return CloudHost().clearMark(attemptId, questionId);
            Local().clearMark(attemptId, questionId);
        },

        async deleteAttempt(id) {
            if (isCloudId(id)) return CloudHost().deleteAttempt(id);
            Local().deleteAttempt(id);
        },

        // ---------------- taking a quiz ----------------
        /**
         * Find a quiz by code: on this device first, then in the cloud.
         * `who` is { userId } when signed in, or { localAttemptId } for on-device quizzes without accounts.
         * Returns { source, session, latest } where latest is this person's most recent attempt state.
         */
        async join(code, who = {}) {
            const clean = cleanCode(code);
            const s = Local().getSessionByCode(clean);
            if (s) {
                let latest = null;
                if (who.userId) latest = Local().latestAttempt(s.id, { userId: who.userId });
                else if (who.localAttemptId) {
                    const a = Local().getAttempt(who.localAttemptId);
                    latest = a && a.sessionId === s.id ? a : null;
                }
                if (latest && latest.status === 'in_progress') latest = localTick(latest.id);
                return { source: 'local', session: publicSession(Local().getSession(s.id)), latest: latest ? localState(latest) : null };
            }
            if (this.hostMode() !== 'cloud') {
                throw new Error(this.hostMode() === 'local' ? 'There\'s no quiz with that code on this device.' : 'Please sign in first.');
            }
            return CloudHost().join(clean);
        },

        async start(source, code, name, who = {}) {
            if (source === 'cloud') return CloudHost().start(cleanCode(code), name);
            const s = Local().getSessionByCode(cleanCode(code));
            if (!s) throw new Error('There\'s no quiz with that code on this device.');
            if (who.userId) {
                const running = Local().latestAttempt(s.id, { userId: who.userId });
                if (running && running.status === 'in_progress') return localState(localTick(running.id));
                if (running && !s.settings.allowRetake && running.status === 'submitted') throw new Error('You\'ve already taken this quiz.');
            }
            return localState(Local().startAttempt(s, { name, userId: who.userId || null, email: who.email || '' }));
        },

        async state(source, attemptId) {
            if (source === 'cloud') return CloudHost().state(attemptId);
            return localState(localTick(attemptId));
        },

        async answer(source, attemptId, questionId, value) {
            if (source === 'cloud') return CloudHost().answer(attemptId, questionId, value);
            const L = Local();
            const before = localTick(attemptId);
            const s = L.getSession(before.sessionId);
            const index = before.order.indexOf(questionId);
            const saved = index !== -1 && L.canAnswer(s, before, index);
            if (saved) L.saveAnswer(attemptId, questionId, value);
            return { saved, state: localState(L.getAttempt(attemptId)) };
        },

        // Someone taking the quiz left full screen ('left' / 'reload') or came back ('back')
        async away(source, attemptId, event) {
            if (source === 'cloud') return CloudHost().away(attemptId, event);
            Local().recordAway(attemptId, event);
        },

        async view(source, attemptId, index) {
            if (source === 'cloud') return CloudHost().view(attemptId, index);
            Local().setView(attemptId, index);
        },

        async next(source, attemptId, from) {
            if (source === 'cloud') return CloudHost().next(attemptId, from);
            const a = localTick(attemptId);
            if (a.status === 'in_progress' && a.current === from) Local().nextQuestion(attemptId);
            return localState(Local().getAttempt(attemptId));
        },

        async submit(source, attemptId, endedBy) {
            if (source === 'cloud') return CloudHost().submit(attemptId, endedBy);
            const a = localTick(attemptId);
            if (a.status === 'in_progress') Local().submit(attemptId, endedBy === 'finished' ? 'finished' : 'ended');
            return localState(Local().getAttempt(attemptId));
        }
    };

    window.QuizBowl.Services.Hosting = Hosting;
})();
