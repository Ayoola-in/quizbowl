(function() {
    window.QuizBowl.Views.Settings = {
        render: function(container) {
            const SettingsDB = window.QuizBowl.Data.SettingsDB;
            const settings = SettingsDB.getSettings();

            container.innerHTML = `
                <div class="header" style="margin-bottom: 2rem;">
                    <h2>Quiz Settings</h2>
                    <p class="subtitle" style="color: var(--text-secondary);">Configure global timers and application behavior</p>
                </div>

                <div class="content-section" style="max-width: 600px; background: var(--bg-surface); padding: var(--spacing-xl); border-radius: var(--border-radius-lg); border: 1px solid var(--border-color);">
                    <form id="settings-form">
                        <div class="form-group" style="margin-bottom: 1.5rem;">
                            <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Theory Questions Time (seconds)</label>
                            <input type="number" id="setting-theory" class="form-control" value="${settings.theoryTime}" min="0" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border-color); border-radius: var(--border-radius);">
                        </div>
                        <div class="form-group" style="margin-bottom: 1.5rem;">
                            <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Calculation Questions Time (seconds)</label>
                            <input type="number" id="setting-calculation" class="form-control" value="${settings.calculationTime}" min="0" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border-color); border-radius: var(--border-radius);">
                        </div>
                        <div class="form-group" style="margin-bottom: 1.5rem;">
                            <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Multiple Choice Time (seconds)</label>
                            <input type="number" id="setting-mcq" class="form-control" value="${settings.mcqTime}" min="0" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border-color); border-radius: var(--border-radius);">
                        </div>
                        <div class="form-group" style="margin-bottom: 1.5rem;">
                            <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">True/False Time (seconds)</label>
                            <input type="number" id="setting-true_false" class="form-control" value="${settings.true_falseTime}" min="0" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border-color); border-radius: var(--border-radius);">
                        </div>
                        <div class="form-group" style="margin-bottom: 2rem;">
                            <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Bonus Time (seconds)</label>
                            <input type="number" id="setting-bonus" class="form-control" value="${settings.bonusTime}" min="0" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border-color); border-radius: var(--border-radius);">
                        </div>
                        
                        <h3 style="margin-top: 2rem; margin-bottom: 1rem;">Default Marks</h3>
                        
                        <div class="form-group" style="margin-bottom: 1.5rem;">
                            <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Theory Questions Default Marks</label>
                            <input type="number" id="setting-theory-marks" class="form-control" value="${settings.theoryMarks}" min="1" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border-color); border-radius: var(--border-radius);">
                        </div>
                        <div class="form-group" style="margin-bottom: 1.5rem;">
                            <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Calculation Questions Default Marks</label>
                            <input type="number" id="setting-calculation-marks" class="form-control" value="${settings.calculationMarks}" min="1" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border-color); border-radius: var(--border-radius);">
                        </div>
                        <div class="form-group" style="margin-bottom: 1.5rem;">
                            <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Multiple Choice Default Marks</label>
                            <input type="number" id="setting-mcq-marks" class="form-control" value="${settings.mcqMarks}" min="1" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border-color); border-radius: var(--border-radius);">
                        </div>
                        <div class="form-group" style="margin-bottom: 2rem;">
                            <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">True/False Default Marks</label>
                            <input type="number" id="setting-tf-marks" class="form-control" value="${settings.true_falseMarks}" min="1" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border-color); border-radius: var(--border-radius);">
                        </div>

                        <button type="submit" class="btn btn-primary" style="padding: 0.75rem 2rem; font-size: 1rem;">Save Settings</button>
                        <span id="settings-saved-msg" style="color: var(--color-success); margin-left: 1rem; display: none; font-weight: bold;">Settings Saved!</span>
                    </form>
                </div>
            `;

            document.getElementById('settings-form').addEventListener('submit', (e) => {
                e.preventDefault();
                
                const newSettings = {
                    theoryTime: parseInt(document.getElementById('setting-theory').value) || 0,
                    calculationTime: parseInt(document.getElementById('setting-calculation').value) || 0,
                    mcqTime: parseInt(document.getElementById('setting-mcq').value) || 0,
                    true_falseTime: parseInt(document.getElementById('setting-true_false').value) || 0,
                    bonusTime: parseInt(document.getElementById('setting-bonus').value) || 0,
                    theoryMarks: parseInt(document.getElementById('setting-theory-marks').value) || 5,
                    calculationMarks: parseInt(document.getElementById('setting-calculation-marks').value) || 10,
                    mcqMarks: parseInt(document.getElementById('setting-mcq-marks').value) || 2,
                    true_falseMarks: parseInt(document.getElementById('setting-tf-marks').value) || 1
                };
                
                SettingsDB.saveSettings(newSettings);
                
                // Update marks for all existing questions based on type
                const QuestionsDB = window.QuizBowl.Data.QuestionsDB;
                if (QuestionsDB) {
                    const questions = QuestionsDB.getAll();
                    let updated = false;
                    
                    questions.forEach(q => {
                        if (q.type === 'theory' && q.marks !== newSettings.theoryMarks) {
                            q.marks = newSettings.theoryMarks;
                            updated = true;
                        } else if (q.type === 'calculation' && q.marks !== newSettings.calculationMarks) {
                            q.marks = newSettings.calculationMarks;
                            updated = true;
                        } else if (q.type === 'mcq' && q.marks !== newSettings.mcqMarks) {
                            q.marks = newSettings.mcqMarks;
                            updated = true;
                        } else if (q.type === 'true_false' && q.marks !== newSettings.true_falseMarks) {
                            q.marks = newSettings.true_falseMarks;
                            updated = true;
                        }
                    });
                    
                    if (updated) {
                        QuestionsDB.saveAll(questions);
                    }
                }
                
                const msg = document.getElementById('settings-saved-msg');
                msg.style.display = 'inline-block';
                setTimeout(() => msg.style.display = 'none', 3000);
            });
        }
    };
})();
