(function() {
    window.QuizBowl.Views.Settings = {
        render: function(container) {
            const SettingsDB = window.QuizBowl.Data.SettingsDB;
            const UI = window.QuizBowl.Utils.UI;
            const settings = SettingsDB.getSettings();

            const row = (id, label, value, min, unit, type) => `
                <div class="settings-row">
                    <label for="${id}">${type ? UI.typeChip(type) : UI.icon('zap')} ${label}</label>
                    <div class="input-group">
                        <input type="number" id="${id}" class="form-control" value="${value}" min="${min}">
                        <span class="input-addon">${unit}</span>
                    </div>
                </div>
            `;

            container.innerHTML = `
                <div class="settings-view">
                    <div class="page-header">
                        <div>
                            <h1>Quiz Settings</h1>
                            <p>Configure countdown timers and default marks for each question type.</p>
                        </div>
                    </div>

                    <form id="settings-form">
                        <div class="settings-grid">
                            <section class="card">
                                <div class="card-header">
                                    <div>
                                        <h2>Timers</h2>
                                        <p>Countdown shown on the public display</p>
                                    </div>
                                    <span class="stat-icon info" style="width: 36px; height: 36px;">${UI.icon('timer')}</span>
                                </div>
                                ${row('setting-theory', 'Theory', settings.theoryTime, 0, 'sec', 'theory')}
                                ${row('setting-calculation', 'Calculation', settings.calculationTime, 0, 'sec', 'calculation')}
                                ${row('setting-mcq', 'Multiple Choice', settings.mcqTime, 0, 'sec', 'mcq')}
                                ${row('setting-true_false', 'True / False', settings.true_falseTime, 0, 'sec', 'true_false')}
                                ${row('setting-bonus', 'Bonus time', settings.bonusTime, 0, 'sec')}
                            </section>

                            <section class="card">
                                <div class="card-header">
                                    <div>
                                        <h2>Default Marks</h2>
                                        <p>Points awarded per question type</p>
                                    </div>
                                    <span class="stat-icon accent" style="width: 36px; height: 36px;">${UI.icon('award')}</span>
                                </div>
                                ${row('setting-theory-marks', 'Theory', settings.theoryMarks, 1, 'pts', 'theory')}
                                ${row('setting-calculation-marks', 'Calculation', settings.calculationMarks, 1, 'pts', 'calculation')}
                                ${row('setting-mcq-marks', 'Multiple Choice', settings.mcqMarks, 1, 'pts', 'mcq')}
                                ${row('setting-tf-marks', 'True / False', settings.true_falseMarks, 1, 'pts', 'true_false')}
                                <div class="callout callout-info" style="margin-top: var(--spacing-md);">
                                    ${UI.icon('info')}
                                    <span>Saving applies these marks to <strong style="display: inline;">all existing questions</strong> of each type.</span>
                                </div>
                            </section>
                        </div>

                        <div class="settings-actions">
                            <span class="form-hint" id="settings-status">No unsaved changes</span>
                            <button type="button" class="btn btn-secondary" id="btn-settings-discard" disabled>Discard</button>
                            <button type="submit" class="btn btn-primary" id="btn-settings-save" disabled>${UI.icon('check')} Save Settings</button>
                        </div>
                    </form>
                </div>
            `;

            const form = document.getElementById('settings-form');
            const btnSave = document.getElementById('btn-settings-save');
            const btnDiscard = document.getElementById('btn-settings-discard');
            const status = document.getElementById('settings-status');

            // Enable save/discard only once something has changed
            const initialValues = [...form.querySelectorAll('input')].map(i => i.value).join('|');
            form.addEventListener('input', () => {
                const dirty = [...form.querySelectorAll('input')].map(i => i.value).join('|') !== initialValues;
                btnSave.disabled = !dirty;
                btnDiscard.disabled = !dirty;
                status.textContent = dirty ? 'You have unsaved changes' : 'No unsaved changes';
                status.style.color = dirty ? 'var(--color-warning)' : '';
            });
            btnDiscard.addEventListener('click', () => this.render(container));

            form.addEventListener('submit', (e) => {
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
                let updatedCount = 0;
                if (QuestionsDB) {
                    const questions = QuestionsDB.getAll();

                    questions.forEach(q => {
                        if (q.type === 'theory' && q.marks !== newSettings.theoryMarks) {
                            q.marks = newSettings.theoryMarks;
                            updatedCount++;
                        } else if (q.type === 'calculation' && q.marks !== newSettings.calculationMarks) {
                            q.marks = newSettings.calculationMarks;
                            updatedCount++;
                        } else if (q.type === 'mcq' && q.marks !== newSettings.mcqMarks) {
                            q.marks = newSettings.mcqMarks;
                            updatedCount++;
                        } else if (q.type === 'true_false' && q.marks !== newSettings.true_falseMarks) {
                            q.marks = newSettings.true_falseMarks;
                            updatedCount++;
                        }
                    });

                    if (updatedCount > 0) {
                        QuestionsDB.saveAll(questions);
                    }
                }

                window.QuizBowl.Components.Toast.show(
                    updatedCount > 0 ? `Settings saved. Marks updated on ${updatedCount} question${updatedCount === 1 ? '' : 's'}.` : 'Settings saved.',
                    'success'
                );
                this.render(container);
            });
        }
    };
})();
