/**
 * js/services/question-service.js
 * Business logic layer for questions
 */
(function() {
    const QuestionsDB = window.QuizBowl.Data.QuestionsDB;
    
    window.QuizBowl.Services.QuestionService = {
        getAllQuestions: function() {
            return QuestionsDB.getAll();
        },
        
        getQuestion: function(id) {
            return QuestionsDB.getById(id);
        },
        
        getDashboardStats: function() {
            const questions = this.getAllQuestions();
            return {
                total: questions.length,
                available: questions.filter(q => q.status === 'available').length,
                answered: questions.filter(q => q.status === 'answered').length,
                disabled: questions.filter(q => q.status === 'disabled').length
            };
        },
        
        addQuestion: function(questionData) {
            // Validate required fields
            if (!questionData.id || !questionData.question || !questionData.type) {
                throw new Error("Missing required question fields.");
            }
            questionData.status = 'available';
            return QuestionsDB.add(questionData);
        },
        
        updateQuestion: function(questionData) {
            return QuestionsDB.update(questionData);
        },
        
        deleteQuestion: function(id) {
            return QuestionsDB.delete(id);
        }
    };
})();
