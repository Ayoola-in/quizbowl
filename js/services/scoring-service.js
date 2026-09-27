/**
 * js/services/scoring-service.js
 * Logic for awarding points and recording history
 */
(function() {
    const QuestionDB = window.QuizBowl.Data.QuestionsDB;
    const TeamDB = window.QuizBowl.Data.TeamsDB;
    const HistoryDB = window.QuizBowl.Data.HistoryDB;
    
    window.QuizBowl.Services.ScoringService = {
        awardMarks: function(questionId, teamId, marksAwarded, resultStatus) {
            const question = QuestionDB.getById(questionId);
            const team = TeamDB.getById(teamId);
            
            if (!question) throw new Error("Question not found.");
            if (!team) throw new Error("Team not found.");
            if (question.status === 'answered') throw new Error("Question already answered!");
            
            // 1. Update Team Score
            TeamDB.updateScore(teamId, marksAwarded);
            
            // 2. Mark Question Answered
            const timestamp = Date.now();
            QuestionDB.markAnswered(questionId, teamId, timestamp);
            
            // 3. Record in History
            HistoryDB.add({
                questionId: question.id,
                questionText: question.question,
                teamId: team.id,
                teamName: team.name,
                result: resultStatus, // 'correct', 'wrong', 'partial'
                marksAwarded: marksAwarded,
                timestamp: timestamp
            });
            
            return true;
        },

        resetScoreAndStatus: function(questionId) {
            const question = QuestionDB.getById(questionId);
            if (!question || question.status !== 'answered') return false;
            
            // Find history record for this question to know the exact marks awarded
            const historyEvents = HistoryDB.getAll();
            const eventIndex = historyEvents.findIndex(e => e.questionId === questionId);
            
            if (eventIndex !== -1) {
                const event = historyEvents[eventIndex];
                
                // 1. Deduct the previously awarded marks from the team
                if (event.teamId && event.marksAwarded) {
                    TeamDB.updateScore(event.teamId, -event.marksAwarded);
                }
                
                // 2. Remove history record
                historyEvents.splice(eventIndex, 1);
                HistoryDB.saveAll(historyEvents);
            }
            
            // 3. Mark question as available
            QuestionDB.resetStatus(questionId);
            
            return true;
        }
    };
})();
