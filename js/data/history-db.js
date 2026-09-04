/**
 * js/data/history-db.js
 * Repository for Quiz History Events
 */
(function() {
    const Storage = window.QuizBowl.Data.Storage;
    const STORAGE_KEY = 'history';

    window.QuizBowl.Data.HistoryDB = {
        getAll: function() {
            return Storage.get(STORAGE_KEY, []);
        },

        add: function(event) {
            const events = this.getAll();
            // Assign unique ID to event
            event.id = 'EVT_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
            event.timestamp = event.timestamp || Date.now();
            events.unshift(event); // Add to beginning
            return Storage.set(STORAGE_KEY, events);
        },

        clear: function() {
            return Storage.set(STORAGE_KEY, []);
        },

        saveAll: function(history) {
            return Storage.set(STORAGE_KEY, history);
        }
    };
})();
