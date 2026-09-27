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
        
        addTeam: function(name, color = '#3b82f6') {
            if (!name || name.trim() === '') {
                throw new Error("Team name is required.");
            }
            // Enforce color uniqueness
            const existingTeams = this.getAllTeams();
            if (existingTeams.some(t => t.color === color)) {
                throw new Error("This color is already in use by another team. Please select a unique color.");
            }
            const id = 'T' + Date.now();
            return TeamsDB.add({ id, name, color, score: 0, questionsAnswered: 0 });
        },
        
        deleteTeam: function(id) {
            return TeamsDB.delete(id);
        },
        
        updateScore: function(id, marks) {
            return TeamsDB.updateScore(id, marks);
        },

        resetAllScores: function() {
            let teams = TeamsDB.getAll();
            teams.forEach(t => {
                t.score = 0;
                t.questionsAnswered = 0; 
            });
            return TeamsDB.saveAll(teams);
        }
    };
})();
