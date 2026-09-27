(function() {
    const Storage = window.QuizBowl.Data.Storage;
    const SETTINGS_KEY = 'settings';

    const defaultSettings = {
        theoryTime: 15,
        calculationTime: 45,
        mcqTime: 20,
        true_falseTime: 10,
        bonusTime: 10,
        theoryMarks: 5,
        calculationMarks: 10,
        mcqMarks: 2,
        true_falseMarks: 1
    };

    window.QuizBowl.Data.SettingsDB = {
        getSettings: function() {
            // Merge defaults in case of missing keys
            const stored = Storage.get(SETTINGS_KEY, defaultSettings);
            return { ...defaultSettings, ...stored };
        },

        saveSettings: function(settingsObj) {
            return Storage.set(SETTINGS_KEY, settingsObj);
        }
    };
})();
