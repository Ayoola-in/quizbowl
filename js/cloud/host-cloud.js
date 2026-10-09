/**
 * js/cloud/host-cloud.js
 * Hosted quizzes in the cloud (Supabase; tables and functions in supabase/schema.sql).
 *
 * Hosts read and manage their own hosted_quizzes / hosted_attempts rows.
 * People taking a quiz only call the hosted_* functions, which keep time with
 * the server's clock, send just the questions they may see (no answers until
 * they submit) and do the marking on the server.
 */
(function() {
    const Cloud = window.QuizBowl.Cloud;

    const ms = v => v == null ? null : (typeof v === 'number' ? v : Date.parse(v));
    const num = v => v == null ? null : Number(v);

    // Messages from our own database functions are written for people; others get translated
    function friendly(error) {
        const msg = (error && (error.message || error.error_description)) || String(error || '');
        if (/failed to fetch|network|load failed|fetch failed/i.test(msg)) return new Error('Can\'t reach the server. Check your internet connection and try again.');
        if (/jwt|token|not authenticated/i.test(msg)) return new Error('Your sign-in has expired. Please sign in again.');
        if (/could not find the (function|table)|relation .* does not exist|schema cache/i.test(msg)) {
            return new Error('Hosting isn\'t set up in the cloud database yet. Run supabase/schema.sql again in your Supabase project (see SETUP-CLOUD.md).');
        }
        if (/permission denied|row-level security/i.test(msg)) return new Error('You don\'t have permission to do that.');
        return new Error(msg || 'Something went wrong. Please try again.');
    }

    async function db() {
        if (!Cloud || !Cloud.configured) throw new Error('Accounts aren\'t set up on this site.');
        if (!Cloud.user()) throw new Error('Please sign in first.');
        return Cloud.connect();
    }

    async function rpc(name, args) {
        const client = await db();
        const { data, error } = await client.rpc(name, args);
        if (error) throw friendly(error);
        return data;
    }

    function sessionFromRow(row) {
        return {
            source: 'cloud',
            id: row.id,
            code: row.code,
            title: row.title,
            quizName: row.quiz_name || '',
            createdAt: ms(row.created_at),
            open: row.is_open,
            settings: row.settings || {},
            questions: row.questions || null,
            questionCount: row.question_count,
            totalMarks: num(row.total_marks)
        };
    }

    function attemptFromRow(row) {
        return {
            id: row.id,
            sessionId: row.quiz_id,
            userId: row.user_id,
            name: row.name,
            email: row.email || '',
            status: row.status,
            order: row.question_order || [],
            optionOrder: row.option_order || {},
            answers: row.answers || {},
            current: row.current_index,
            view: row.view_index,
            questionDeadline: ms(row.question_deadline),
            deadline: ms(row.deadline),
            startedAt: ms(row.started_at),
            submittedAt: ms(row.submitted_at),
            endedBy: row.ended_by,
            results: row.results || {},
            score: num(row.score),
            maxScore: num(row.max_score),
            pending: row.pending || 0,
            away: row.away_events || [],
            markedAt: ms(row.marked_at)
        };
    }

    // Numbers arrive as JSON numbers from the functions, but keep them tidy
    function cleanState(state) {
        if (!state) return state;
        const a = state.attempt;
        a.score = num(a.score);
        a.maxScore = num(a.maxScore);
        a.results = a.results || null;
        state.session.totalMarks = num(state.session.totalMarks);
        state.source = 'cloud';
        return state;
    }

    const SESSION_COLUMNS = 'id, code, title, quiz_name, settings, question_count, total_marks, is_open, created_at';

    window.QuizBowl.HostCloud = {
        // ---------- host ----------
        async listSessions() {
            const client = await db();
            const [{ data: rows, error }, { data: attempts, error: error2 }] = await Promise.all([
                client.from('hosted_quizzes').select(SESSION_COLUMNS).order('created_at', { ascending: false }),
                client.from('hosted_attempts').select('quiz_id, status, pending')
            ]);
            if (error) throw friendly(error);
            if (error2) throw friendly(error2);
            return rows.map(row => {
                const s = sessionFromRow(row);
                const mine = (attempts || []).filter(a => a.quiz_id === row.id);
                const done = mine.filter(a => a.status === 'submitted');
                s.stats = { submitted: done.length, running: mine.length - done.length, pending: done.reduce((n, a) => n + (a.pending || 0), 0) };
                return s;
            });
        },

        async getSession(id) {
            const client = await db();
            const { data, error } = await client.from('hosted_quizzes').select('*').eq('id', id).maybeSingle();
            if (error) throw friendly(error);
            return data ? sessionFromRow(data) : null;
        },

        async createSession({ title, quizName, questions, settings }) {
            const client = await db();
            const row = { title, quiz_name: quizName || '', settings, questions };
            for (let tries = 0; tries < 3; tries++) {
                const { data, error } = await client.from('hosted_quizzes').insert(row).select('*').single();
                if (!error) return sessionFromRow(data);
                // A brand-new code collided with one made at the same moment: try again
                if (error.code === '23505' && tries < 2) continue;
                throw friendly(error);
            }
            return null;
        },

        async updateSession(id, { title, quizName, settings, questions } = {}) {
            const client = await db();
            const row = {};
            if (title !== undefined) row.title = title;
            if (settings !== undefined) row.settings = settings;
            if (questions !== undefined) { row.questions = questions; row.quiz_name = quizName || ''; }
            const { data, error } = await client.from('hosted_quizzes').update(row).eq('id', id).select('*').single();
            if (error) throw friendly(error);
            return sessionFromRow(data);
        },

        async setOpen(id, open) {
            const client = await db();
            const { error } = await client.from('hosted_quizzes').update({ is_open: !!open }).eq('id', id);
            if (error) throw friendly(error);
        },

        async deleteSession(id) {
            const client = await db();
            const { error } = await client.from('hosted_quizzes').delete().eq('id', id);
            if (error) throw friendly(error);
        },

        async listAttempts(sessionId) {
            await rpc('hosted_refresh', { p_quiz: sessionId });
            const client = await db();
            const { data, error } = await client.from('hosted_attempts').select('*').eq('quiz_id', sessionId);
            if (error) throw friendly(error);
            return data.map(attemptFromRow);
        },

        async getAttempt(id) {
            const client = await db();
            const { data, error } = await client.from('hosted_attempts').select('*').eq('id', id).maybeSingle();
            if (error) throw friendly(error);
            return data ? attemptFromRow(data) : null;
        },

        async setMark(attemptId, questionId, marks) {
            const value = Number(marks);
            if (marks === '' || !Number.isFinite(value)) throw new Error('Enter a number of marks.');
            await rpc('hosted_set_mark', { p_attempt: attemptId, p_question: questionId, p_awarded: value });
        },

        async clearMark(attemptId, questionId) {
            await rpc('hosted_set_mark', { p_attempt: attemptId, p_question: questionId, p_awarded: null });
        },

        async deleteAttempt(id) {
            const client = await db();
            const { error } = await client.from('hosted_attempts').delete().eq('id', id);
            if (error) throw friendly(error);
        },

        // ---------- the signed-in person's own results ----------
        async myAttempts() {
            const rows = await rpc('hosted_my_attempts', {});
            return (rows || []).map(r => ({ ...r, source: 'cloud', score: num(r.score), maxScore: num(r.maxScore), totalMarks: num(r.totalMarks) }));
        },

        // ---------- taking a quiz ----------
        async join(code) {
            const data = await rpc('hosted_join', { p_code: code });
            data.session.totalMarks = num(data.session.totalMarks);
            return { source: 'cloud', session: data.session, latest: cleanState(data.latest) };
        },

        async start(code, name) {
            return cleanState(await rpc('hosted_start', { p_code: code, p_name: name }));
        },

        async state(attemptId) {
            return cleanState(await rpc('hosted_state', { p_attempt: attemptId }));
        },

        async answer(attemptId, questionId, value) {
            const data = await rpc('hosted_answer', { p_attempt: attemptId, p_question: questionId, p_value: value == null ? '' : String(value) });
            return { saved: data.saved, state: cleanState(data.state) };
        },

        async away(attemptId, event) {
            await rpc('hosted_away', { p_attempt: attemptId, p_event: event });
        },

        async view(attemptId, index) {
            await rpc('hosted_view', { p_attempt: attemptId, p_index: index });
        },

        async next(attemptId, from) {
            return cleanState(await rpc('hosted_next', { p_attempt: attemptId, p_from: from }));
        },

        async submit(attemptId, endedBy) {
            return cleanState(await rpc('hosted_submit', { p_attempt: attemptId, p_ended_by: endedBy }));
        }
    };
})();
