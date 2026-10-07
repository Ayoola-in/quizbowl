/**
 * js/data/quizzes-db.js
 * Repository for Quizzes. Each quiz owns its own questions, teams,
 * history and settings (see the quiz scoping in storage.js).
 */
(function() {
    const Storage = window.QuizBowl.Data.Storage;
    const QUIZZES_KEY = 'quizzes';
    // Keys used before quizzes existed; moved into the first quiz on upgrade
    const LEGACY_KEYS = ['questions', 'teams', 'history', 'settings'];
    const DEFAULT_QUIZ_NAME = 'Engineering Quiz';

    function newId() {
        return 'QZ' + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36);
    }

    window.QuizBowl.Data.QuizzesDB = {
        getAll: function() {
            return Storage.getGlobal(QUIZZES_KEY, []);
        },

        getById: function(id) {
            return this.getAll().find(q => q.id === id) || null;
        },

        getActiveId: function() {
            return Storage.getGlobal(Storage.ACTIVE_QUIZ_KEY, null);
        },

        getActive: function() {
            return this.getById(this.getActiveId());
        },

        setActive: function(id) {
            if (!this.getById(id)) throw new Error('Quiz not found.');
            return Storage.setGlobal(Storage.ACTIVE_QUIZ_KEY, id);
        },

        create: function(name) {
            const trimmed = String(name || '').trim();
            if (!trimmed) throw new Error('Please enter a quiz name.');
            const quizzes = this.getAll();
            if (quizzes.some(q => q.name.toLowerCase() === trimmed.toLowerCase())) {
                throw new Error('A quiz with this name already exists.');
            }
            const quiz = { id: newId(), name: trimmed, createdAt: Date.now() };
            quizzes.push(quiz);
            Storage.setGlobal(QUIZZES_KEY, quizzes);
            return quiz;
        },

        rename: function(id, name) {
            const trimmed = String(name || '').trim();
            if (!trimmed) throw new Error('Please enter a quiz name.');
            const quizzes = this.getAll();
            const quiz = quizzes.find(q => q.id === id);
            if (!quiz) throw new Error('Quiz not found.');
            if (quizzes.some(q => q.id !== id && q.name.toLowerCase() === trimmed.toLowerCase())) {
                throw new Error('A quiz with this name already exists.');
            }
            quiz.name = trimmed;
            return Storage.setGlobal(QUIZZES_KEY, quizzes);
        },

        delete: function(id) {
            const quizzes = this.getAll();
            if (quizzes.length <= 1) throw new Error('You need at least one quiz.');
            const remaining = quizzes.filter(q => q.id !== id);
            Storage.setGlobal(QUIZZES_KEY, remaining);
            Storage.removeQuizData(id);
            if (this.getActiveId() === id) this.setActive(remaining[0].id);
            return true;
        },

        // Summary numbers for the quiz list, read without switching quizzes
        getStats: function(id) {
            const questions = Storage.getForQuiz(id, 'questions', []);
            const teams = Storage.getForQuiz(id, 'teams', []);
            return {
                questions: questions.length,
                answered: questions.filter(q => q.status === 'answered').length,
                teams: teams.length
            };
        },

        /**
         * Make sure at least one quiz exists and one is active.
         * On first run after upgrading, existing data moves into a default quiz;
         * on a fresh install, the default quiz gets the sample questions and teams.
         */
        ensureInitialized: function() {
            let quizzes = this.getAll();

            if (quizzes.length === 0) {
                const quiz = this.create(DEFAULT_QUIZ_NAME);
                const hadLegacyData = Storage.getGlobal('questions', null) !== null;

                LEGACY_KEYS.forEach(key => {
                    const value = Storage.getGlobal(key, null);
                    if (value !== null) {
                        Storage.setForQuiz(quiz.id, key, value);
                        Storage.removeGlobal(key);
                    }
                });

                this.setActive(quiz.id);
                if (!hadLegacyData && window.QuizBowl.Data.initializeSeedData) {
                    window.QuizBowl.Data.initializeSeedData();
                }
                return;
            }

            if (!this.getActive()) this.setActive(quizzes[0].id);
        }
    };
})();
