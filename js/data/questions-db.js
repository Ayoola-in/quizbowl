/**
 * js/data/questions-db.js
 * Repository for Questions
 */
(function() {
    const Storage = window.QuizBowl.Data.Storage;
    const STORAGE_KEY = 'questions';

    window.QuizBowl.Data.QuestionsDB = {
        getAll: function() {
            return Storage.get(STORAGE_KEY, []);
        },

        getById: function(id) {
            const questions = this.getAll();
            return questions.find(q => q.id === id) || null;
        },

        add: function(question) {
            const questions = this.getAll();
            if (questions.find(q => q.id === question.id)) {
                throw new Error(`Question with ID ${question.id} already exists.`);
            }
            questions.push(question);
            return Storage.set(STORAGE_KEY, questions);
        },

        update: function(question) {
            let questions = this.getAll();
            const index = questions.findIndex(q => q.id === question.id);
            if (index === -1) {
                throw new Error(`Question with ID ${question.id} not found.`);
            }
            questions[index] = question;
            return Storage.set(STORAGE_KEY, questions);
        },

        delete: function(id) {
            let questions = this.getAll();
            questions = questions.filter(q => q.id !== id);
            return Storage.set(STORAGE_KEY, questions);
        },

        markAnswered: function(id, teamId, timestamp = Date.now()) {
            let question = this.getById(id);
            if (!question) return false;
            
            question.status = 'answered';
            question.answeredBy = teamId;
            question.answeredAt = timestamp;
            
            return this.update(question);
        },

        resetStatus: function(id) {
            let question = this.getById(id);
            if (!question) return false;
            
            question.status = 'available';
            question.answeredBy = null;
            question.answeredAt = null;
            
            return this.update(question);
        },

        saveAll: function(questions) {
            return Storage.set(STORAGE_KEY, questions);
        }
    };
})();
