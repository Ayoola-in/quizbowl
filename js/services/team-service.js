/**
 * js/services/team-service.js
 * Business logic layer for teams
 */
(function() {
    const TeamsDB = window.QuizBowl.Data.TeamsDB;
    
    window.QuizBowl.Services.TeamService = {
        getAllTeams: function() {
            return TeamsDB.getAll().sort((a, b) => b.score - a.score);
        },
        
        getTeam: function(id) {
            return TeamsDB.getById(id);
        },
        
        addTeam: function(name) {
            if (!name || name.trim() === '') {
                throw new Error("Team name is required.");
            }
            const id = 'T' + Date.now();
            return TeamsDB.add({ id, name, score: 0, questionsAnswered: 0 });
        },
        
        deleteTeam: function(id) {
            return TeamsDB.delete(id);
        }
    };
})();
