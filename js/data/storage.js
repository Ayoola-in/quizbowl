/**
 * js/data/storage.js
 * LocalStorage wrapper that implements the repository abstraction.
 * This can be swapped out later for a Supabase or Vercel backend.
 *
 * get/set/remove are scoped to the active quiz, so every repository
 * (questions, teams, history, settings) automatically keeps separate data
 * per quiz. The *Global variants read app-wide keys such as the quiz list.
 */

(function() {
    const PREFIX = 'quizbowl_';
    const ACTIVE_QUIZ_KEY = 'active_quiz';

    function read(fullKey, defaultValue) {
        try {
            const item = localStorage.getItem(fullKey);
            return item ? JSON.parse(item) : defaultValue;
        } catch (error) {
            console.error(`Error reading ${fullKey} from storage:`, error);
            return defaultValue;
        }
    }

    function write(fullKey, value) {
        try {
            localStorage.setItem(fullKey, JSON.stringify(value));
            return true;
        } catch (error) {
            console.error(`Error writing ${fullKey} to storage:`, error);
            return false;
        }
    }

    function erase(fullKey) {
        try {
            localStorage.removeItem(fullKey);
            return true;
        } catch (error) {
            console.error(`Error removing ${fullKey} from storage:`, error);
            return false;
        }
    }

    function quizKey(quizId, key) {
        return `${PREFIX}quiz_${quizId}_${key}`;
    }

    function activeKey(key) {
        const quizId = read(PREFIX + ACTIVE_QUIZ_KEY, null);
        if (!quizId) throw new Error('No active quiz selected.');
        return quizKey(quizId, key);
    }

    window.QuizBowl.Data.Storage = {
        PREFIX: PREFIX,
        ACTIVE_QUIZ_KEY: ACTIVE_QUIZ_KEY,

        // ----- Scoped to the active quiz -----
        get: function(key, defaultValue = null) {
            return read(activeKey(key), defaultValue);
        },

        set: function(key, value) {
            return write(activeKey(key), value);
        },

        remove: function(key) {
            return erase(activeKey(key));
        },

        // ----- Scoped to a specific quiz -----
        getForQuiz: function(quizId, key, defaultValue = null) {
            return read(quizKey(quizId, key), defaultValue);
        },

        setForQuiz: function(quizId, key, value) {
            return write(quizKey(quizId, key), value);
        },

        removeQuizData: function(quizId) {
            const scope = quizKey(quizId, '');
            try {
                const keysToRemove = [];
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key.startsWith(scope)) keysToRemove.push(key);
                }
                keysToRemove.forEach(k => localStorage.removeItem(k));
                return true;
            } catch (error) {
                console.error(`Error removing data for quiz ${quizId}:`, error);
                return false;
            }
        },

        // ----- App-wide (not tied to a quiz) -----
        getGlobal: function(key, defaultValue = null) {
            return read(PREFIX + key, defaultValue);
        },

        setGlobal: function(key, value) {
            return write(PREFIX + key, value);
        },

        removeGlobal: function(key) {
            return erase(PREFIX + key);
        },

        clearAll: function() {
            try {
                const keysToRemove = [];
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key.startsWith(PREFIX)) {
                        keysToRemove.push(key);
                    }
                }
                keysToRemove.forEach(k => localStorage.removeItem(k));
                return true;
            } catch (error) {
                console.error('Error clearing storage:', error);
                return false;
            }
        }
    };
})();
