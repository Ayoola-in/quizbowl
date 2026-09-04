/**
 * js/data/teams-db.js
 * Repository for Teams
 */
(function() {
    const Storage = window.QuizBowl.Data.Storage;
    const STORAGE_KEY = 'teams';

    window.QuizBowl.Data.TeamsDB = {
        getAll: function() {
            return Storage.get(STORAGE_KEY, []);
        },

        getById: function(id) {
            const teams = this.getAll();
            return teams.find(t => t.id === id) || null;
        },

        add: function(team) {
            const teams = this.getAll();
            if (teams.find(t => t.id === team.id)) {
                throw new Error(`Team with ID ${team.id} already exists.`);
            }
            team.score = 0;
            team.questionsAnswered = 0;
            teams.push(team);
            return Storage.set(STORAGE_KEY, teams);
        },

        update: function(team) {
            let teams = this.getAll();
            const index = teams.findIndex(t => t.id === team.id);
            if (index === -1) {
                throw new Error(`Team with ID ${team.id} not found.`);
            }
            teams[index] = team;
            return Storage.set(STORAGE_KEY, teams);
        },

        delete: function(id) {
            let teams = this.getAll();
            teams = teams.filter(t => t.id !== id);
            return Storage.set(STORAGE_KEY, teams);
        },

        updateScore: function(id, marksAdded) {
            let team = this.getById(id);
            if (!team) return false;
            
            team.score += marksAdded;
            team.questionsAnswered += 1;
            
            return this.update(team);
        },

        saveAll: function(teams) {
            return Storage.set(STORAGE_KEY, teams);
        }
    };
})();
