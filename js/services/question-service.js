/**
 * js/services/question-service.js
 * Business logic layer for questions
 */
(function() {
    const QuestionsDB = window.QuizBowl.Data.QuestionsDB;
    
    const TYPE_PREFIXES = {
        'theory': 'THRY',
        'calculation': 'CALC',
        'mcq': 'MCQ',
        'true_false': 'TF'
    };
    
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
        
        generateIdForType: function(type) {
            const prefix = TYPE_PREFIXES[type] || 'Q';
            const questionsOfType = QuestionsDB.getAll().filter(q => q.type === type);
            return prefix + String(questionsOfType.length + 1).padStart(3, '0');
        },
        
        addQuestion: function(questionData) {
            // Validate required fields
            if (!questionData.question || !questionData.type) {
                throw new Error("Missing required question fields.");
            }
            questionData.id = this.generateIdForType(questionData.type);
            questionData.status = 'available';
            return QuestionsDB.add(questionData);
        },
        
        updateQuestion: function(questionData) {
            return QuestionsDB.update(questionData);
        },
        
        deleteQuestion: function(id) {
            return QuestionsDB.delete(id);
        },
        
        deleteAndRenumber: function(id) {
            const questionToDelete = QuestionsDB.getById(id);
            if (!questionToDelete) return;
            
            const typeToRenumber = questionToDelete.type;
            QuestionsDB.delete(id);
            
            let questions = QuestionsDB.getAll();
            const HistoryDB = window.QuizBowl.Data.HistoryDB;
            let updatedQuestions = [];
            
            const prefix = TYPE_PREFIXES[typeToRenumber] || 'Q';
            let typeIndex = 1;
            
            questions.forEach((q) => {
                if (q.type === typeToRenumber) {
                    const newId = prefix + String(typeIndex).padStart(3, '0');
                    if (q.id !== newId) {
                        HistoryDB.updateQuestionId(q.id, newId);
                        q.id = newId;
                    }
                    typeIndex++;
                }
                updatedQuestions.push(q);
            });
            
            QuestionsDB.saveAll(updatedQuestions);
        },

        migrateIds: function() {
            let questions = QuestionsDB.getAll();
            const HistoryDB = window.QuizBowl.Data.HistoryDB;
            let updatedQuestions = [];
            
            const typeIndices = {
                'theory': 1,
                'calculation': 1,
                'mcq': 1,
                'true_false': 1
            };
            
            questions.forEach((q) => {
                const prefix = TYPE_PREFIXES[q.type] || 'Q';
                const index = typeIndices[q.type] || 1;
                const newId = prefix + String(index).padStart(3, '0');
                
                if (q.id !== newId) {
                    HistoryDB.updateQuestionId(q.id, newId);
                    q.id = newId;
                }
                
                if (typeIndices[q.type] !== undefined) typeIndices[q.type]++;
                updatedQuestions.push(q);
            });
            
            QuestionsDB.saveAll(updatedQuestions);
            console.log("Migration complete!");
        }
    };
})();
