/**
 * js/data/seed-data.js
 * Initial sample engineering questions
 */
(function() {
    window.QuizBowl.Data.Seed = {
        questions: [
            {
                "id": "Q001",
                "type": "mcq",
                "category": "Circuit Theory",
                "topic": "Ohm's Law",
                "difficulty": "easy",
                "marks": 5,
                "question": "Which expression mathematically represents Ohm's Law?",
                "options": {
                    "A": "$$ V = IR $$",
                    "B": "$$ P = VI $$",
                    "C": "$$ Q = CV $$",
                    "D": "$$ E = mc^2 $$"
                },
                "correctAnswer": "A",
                "explanation": "Ohm's Law states that the voltage (V) across a conductor is directly proportional to the current (I) flowing through it, provided the temperature remains constant. The constant of proportionality is the resistance (R).",
                "keywords": ["ohm", "resistance", "voltage", "current"],
                "image": null,
                "status": "available",
                "answeredBy": null,
                "answeredAt": null
            },
            {
                "id": "Q002",
                "type": "calculation",
                "category": "Circuit Theory",
                "topic": "Resonance",
                "difficulty": "medium",
                "marks": 10,
                "question": "Calculate the resonant frequency ($f_0$) of a series RLC circuit where $L = 100 \\text{ mH}$ and $C = 10 \\text{ \\mu F}$.",
                "expectedAnswer": "159.15",
                "unit": "Hz",
                "explanation": "Using the formula $$f_0 = \\frac{1}{2\\pi\\sqrt{LC}}$$ Substitute the values: $L = 0.1 \\text{ H}$, $C = 10 \\times 10^{-6} \\text{ F}$. $$f_0 = \\frac{1}{2\\pi\\sqrt{0.1 \\times 10^{-5}}} \\approx 159.15 \\text{ Hz}$$",
                "keywords": ["resonance", "rlc", "frequency", "inductor", "capacitor"],
                "status": "available"
            },
            {
                "id": "Q003",
                "type": "theory",
                "category": "Electromagnetism",
                "topic": "Faraday's Law",
                "difficulty": "medium",
                "marks": 10,
                "question": "State Faraday's Law of Electromagnetic Induction.",
                "expectedAnswer": "The induced electromotive force (EMF) in any closed circuit is equal to the negative of the time rate of change of the magnetic flux enclosed by the circuit.",
                "explanation": "$$ \\varepsilon = -N \\frac{d\\Phi_B}{dt} $$",
                "keywords": ["faraday", "induction", "flux", "emf", "magnetic"],
                "status": "available"
            },
            {
                "id": "Q004",
                "type": "true_false",
                "category": "Electronics",
                "topic": "Semiconductors",
                "difficulty": "easy",
                "marks": 5,
                "question": "At absolute zero temperature ($0\\text{ K}$), an intrinsic semiconductor behaves as a perfect insulator.",
                "correctAnswer": "True",
                "explanation": "At 0 K, all electrons are tightly bound in covalent bonds (valence band is full, conduction band is empty), so there are no free charge carriers available for conduction.",
                "keywords": ["semiconductor", "temperature", "insulator"],
                "status": "available"
            },
            {
                "id": "Q005",
                "type": "mcq",
                "category": "Electrical Machines",
                "topic": "Transformers",
                "difficulty": "medium",
                "marks": 5,
                "question": "Why is the core of a transformer laminated?",
                "options": {
                    "A": "To reduce copper losses",
                    "B": "To reduce eddy current losses",
                    "C": "To reduce hysteresis losses",
                    "D": "To increase magnetic flux"
                },
                "correctAnswer": "B",
                "explanation": "Laminating the core breaks the path of eddy currents, significantly increasing the resistance to their flow and thus reducing the $I^2R$ (eddy current) losses in the core.",
                "keywords": ["transformer", "core", "laminated", "eddy current", "losses"],
                "status": "available"
            }
        ],
        teams: [
            { id: "T1", name: "Team Alpha", score: 0, questionsAnswered: 0 },
            { id: "T2", name: "Team Beta", score: 0, questionsAnswered: 0 },
            { id: "T3", name: "Team Gamma", score: 0, questionsAnswered: 0 }
        ]
    };

    // Initialize database if empty
    window.QuizBowl.Data.initializeSeedData = function() {
        const QuestionsDB = window.QuizBowl.Data.QuestionsDB;
        const TeamsDB = window.QuizBowl.Data.TeamsDB;
        
        if (QuestionsDB.getAll().length === 0) {
            console.log("Initializing seed questions...");
            window.QuizBowl.Data.Seed.questions.forEach(q => QuestionsDB.add(q));
        }
        
        if (TeamsDB.getAll().length === 0) {
            console.log("Initializing seed teams...");
            window.QuizBowl.Data.Seed.teams.forEach(t => TeamsDB.add(t));
        }
    };
})();
