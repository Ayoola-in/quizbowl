/**
 * js/data/seed-data.js
 * Sample general-knowledge questions and teams for a first-time install,
 * one or more of each question type so every feature can be tried out.
 */
(function () {
    window.QuizBowl.Data.Seed = {
        questions: [
            {
                id: "MCQ001", type: "mcq", category: "Science",
                question: "Which planet is known as the Red Planet?",
                options: { A: "Venus", B: "Mars", C: "Jupiter", D: "Mercury" },
                correctAnswer: "B", marks: 2, status: "available"
            },
            {
                id: "MCQ002", type: "mcq", category: "Geography",
                question: "What is the largest ocean on Earth?",
                options: { A: "Atlantic Ocean", B: "Indian Ocean", C: "Arctic Ocean", D: "Pacific Ocean" },
                correctAnswer: "D", marks: 2, status: "available"
            },
            {
                id: "MCQ003", type: "mcq", category: "Arts",
                question: "Who painted the Mona Lisa?",
                options: { A: "Michelangelo", B: "Raphael", C: "Leonardo da Vinci", D: "Rembrandt" },
                correctAnswer: "C", marks: 2, status: "available"
            },
            {
                id: "MCQ004", type: "mcq", category: "Geography",
                question: "How many continents are there?",
                options: { A: "5", B: "6", C: "7", D: "8" },
                correctAnswer: "C", marks: 2, status: "available"
            },
            {
                id: "MCQ005", type: "mcq", category: "Science",
                question: "Which gas do plants take in from the air to make their food?",
                options: { A: "Oxygen", B: "Nitrogen", C: "Carbon dioxide", D: "Hydrogen" },
                correctAnswer: "C", marks: 2, status: "available"
            },
            {
                id: "TF001", type: "true_false", category: "Science",
                question: "At sea level, water boils at 100 °C.",
                correctAnswer: "True", marks: 1, status: "available"
            },
            {
                id: "TF002", type: "true_false", category: "Nature",
                question: "A spider is an insect.",
                correctAnswer: "False", marks: 1, status: "available"
            },
            {
                id: "TF003", type: "true_false", category: "History",
                question: "The Great Wall of China can be seen from the Moon with the naked eye.",
                correctAnswer: "False", marks: 1, status: "available"
            },
            {
                id: "THRY001", type: "theory", category: "Geography",
                question: "What is the capital city of Japan?",
                correctAnswer: "Tokyo", marks: 5, status: "available"
            },
            {
                id: "THRY002", type: "theory", category: "Literature",
                question: "Who wrote the play <em>Romeo and Juliet</em>?",
                correctAnswer: "William Shakespeare", marks: 5, status: "available"
            },
            {
                id: "THRY003", type: "theory", category: "Science",
                question: "What is the chemical symbol for gold?",
                correctAnswer: "Au", marks: 5, status: "available"
            },
            {
                id: "CALC001", type: "calculation", category: "Maths",
                question: "What is 15% of 240?",
                correctAnswer: "36", marks: 10, status: "available"
            },
            {
                id: "CALC002", type: "calculation", category: "Maths",
                question: "A car travels at 60 km/h for 2.5 hours. How far does it travel?",
                correctAnswer: "150", unit: "km", marks: 10, status: "available"
            },
            {
                id: "CALC003", type: "calculation", category: "Maths",
                question: "Solve for $x$:<br><br>$$ 2x + 6 = 20 $$",
                correctAnswer: "x = 7", marks: 10, status: "available"
            }
        ],
        teams: [
            { id: "T1", name: "Team Alpha", score: 0, questionsAnswered: 0, color: "#ef4444" },
            { id: "T2", name: "Team Beta", score: 0, questionsAnswered: 0, color: "#3b82f6" },
            { id: "T3", name: "Team Gamma", score: 0, questionsAnswered: 0, color: "#22c55e" }
        ]
    };


    // Initialize database
    window.QuizBowl.Data.initializeSeedData = function () {
        const QuestionsDB = window.QuizBowl.Data.QuestionsDB;
        const TeamsDB = window.QuizBowl.Data.TeamsDB;

        const existingQuestions = QuestionsDB.getAll();
        const existingQIds = new Set(existingQuestions.map(q => q.id));
        let addedQuestions = 0;

        window.QuizBowl.Data.Seed.questions.forEach(q => {
            if (!existingQIds.has(q.id)) {
                QuestionsDB.add(q);
                addedQuestions++;
            }
        });

        if (addedQuestions > 0) {
            console.log(`Added ${addedQuestions} new seed questions...`);
        }

        const existingTeams = TeamsDB.getAll();
        const existingTIds = new Set(existingTeams.map(t => t.id));
        let addedTeams = 0;

        window.QuizBowl.Data.Seed.teams.forEach(t => {
            if (!existingTIds.has(t.id)) {
                TeamsDB.add(t);
                addedTeams++;
            }
        });

        if (addedTeams > 0) {
            console.log(`Added ${addedTeams} new seed teams...`);
        }
    };
})();
