/**
 * js/data/storage.js
 * LocalStorage wrapper that implements the repository abstraction.
 * This can be swapped out later for a Supabase or Vercel backend.
 */

(function() {
    const PREFIX = 'quizbowl_';

    window.QuizBowl.Data.Storage = {
        get: function(key, defaultValue = null) {
            try {
                const item = localStorage.getItem(PREFIX + key);
                return item ? JSON.parse(item) : defaultValue;
            } catch (error) {
                console.error(`Error reading ${key} from storage:`, error);
                return defaultValue;
            }
        },

        set: function(key, value) {
            try {
                localStorage.setItem(PREFIX + key, JSON.stringify(value));
                return true;
            } catch (error) {
                console.error(`Error writing ${key} to storage:`, error);
                return false;
            }
        },

        remove: function(key) {
            try {
                localStorage.removeItem(PREFIX + key);
                return true;
            } catch (error) {
                console.error(`Error removing ${key} from storage:`, error);
                return false;
            }
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
