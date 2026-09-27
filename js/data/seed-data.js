/**
 * js/data/seed-data.js
 * Initial sample engineering questions
 */
(function () {
    window.QuizBowl.Data.Seed = {
        questions: [
            {
                id: "MCQ001", type: "mcq", category: "Electronics",
                question: "Which logic gate produces a HIGH output only when all of its inputs are HIGH?",
                options: { A: "OR", B: "NAND", C: "AND", D: "NOR", E: "XOR" },
                correctAnswer: "C", marks: 5, status: "available"
            },
            {
                id: "MCQ002", type: "mcq", category: "Electronics",
                question: "In circuit analysis, Kirchhoff’s Current Law (KCL) is based fundamentally on the conservation of:",
                options: { A: "Energy", B: "Charge", C: "Power", D: "Magnetic flux", E: "Momentum" },
                correctAnswer: "B", marks: 5, status: "available"
            },
            {
                id: "MCQ003", type: "mcq", category: "Electronics",
                question: "Which semiconductor device is primarily used for amplification and switching in many analog electronic circuits?",
                options: { A: "Diode", B: "Transistor", C: "Transformer", D: "Capacitor", E: "Inductor" },
                correctAnswer: "B", marks: 5, status: "available"
            },
            {
                id: "MCQ004", type: "mcq", category: "Electronics",
                question: "Which of the following is a universal logic gate?",
                options: { A: "AND", B: "OR", C: "XOR", D: "NAND", E: "XNOR" },
                correctAnswer: "D", marks: 5, status: "available"
            },
            {
                id: "MCQ005", type: "mcq", category: "Electronics",
                question: "The primary function of modulation in a communication system is to:",
                options: { A: "Eliminate all noise from a signal", B: "Increase the resistance of the transmission medium", C: "Make transmission of information over a channel more practical", D: "Convert AC to DC", E: "Store information permanently" },
                correctAnswer: "C", marks: 5, status: "available"
            },
            {
                id: "MCQ006", type: "mcq", category: "Electronics",
                question: "A signal that repeats itself after a fixed interval of time is known as a:",
                options: { A: "Random signal", B: "Periodic signal", C: "Transient signal", D: "Impulse signal", E: "Non-causal signal" },
                correctAnswer: "B", marks: 5, status: "available"
            },
            {
                id: "MCQ007", type: "mcq", category: "Electronics",
                question: "In a transformer, electrical energy is transferred from the primary winding to the secondary winding mainly through:",
                options: { A: "Mechanical coupling", B: "Electrostatic coupling", C: "Electromagnetic induction", D: "Thermal conduction", E: "Chemical reaction" },
                correctAnswer: "C", marks: 5, status: "available"
            },
            {
                id: "MCQ008", type: "mcq", category: "Electronics",
                question: "Which component is primarily responsible for stepping up or stepping down AC voltage in a power system?",
                options: { A: "Rectifier", B: "Transformer", C: "Inverter", D: "Alternator", E: "Induction motor" },
                correctAnswer: "B", marks: 5, status: "available"
            },
            {
                id: "MCQ009", type: "mcq", category: "Electronics",
                question: "An ideal operational amplifier is assumed to have:",
                options: { A: "Zero input impedance and infinite output impedance", B: "Infinite input impedance and zero output impedance", C: "Infinite input and output impedance", D: "Zero input and output impedance", E: "Unity input and output impedance" },
                correctAnswer: "B", marks: 5, status: "available"
            },
            {
                id: "MCQ010", type: "mcq", category: "Electronics",
                question: "A system in which the output is not compared with the desired input is called a:",
                options: { A: "Closed-loop system", B: "Feedback system", C: "Open-loop system", D: "Servo system", E: "Adaptive system" },
                correctAnswer: "C", marks: 5, status: "available"
            },
            {
                id: "MCQ011", type: "mcq", category: "Electronics",
                question: "Which device is commonly used to convert a physical quantity such as temperature, pressure, or displacement into an electrical signal?",
                options: { A: "Transformer", B: "Transducer", C: "Oscillator", D: "Rectifier", E: "Amplifier" },
                correctAnswer: "B", marks: 5, status: "available"
            },
            {
                id: "MCQ012", type: "mcq", category: "Electronics",
                question: "What does PLC stand for in industrial automation?",
                options: { A: "Programmable Logic Controller", B: "Programmable Linear Circuit", C: "Power Logic Controller", D: "Process Level Computer", E: "Programmable Load Converter" },
                correctAnswer: "A", marks: 5, status: "available"
            },
            {
                id: "MCQ013", type: "mcq", category: "Electronics",
                question: "In PLC ladder logic, a normally open contact is TRUE when its associated input is:",
                options: { A: "OFF", B: "Disconnected", C: "ON", D: "Short-circuited", E: "Grounded" },
                correctAnswer: "C", marks: 5, status: "available"
            },
            {
                id: "MCQ014", type: "mcq", category: "Electronics",
                question: "A servo system is primarily designed for:",
                options: { A: "Random motion", B: "Precise control of position, velocity, or torque", C: "Increasing electrical resistance", D: "Converting DC to AC only", E: "Eliminating feedback" },
                correctAnswer: "B", marks: 5, status: "available"
            },
            {
                id: "MCQ015", type: "mcq", category: "Electronics",
                question: "Which of the following best describes a digital signal?",
                options: { A: "A signal that can only exist as a sine wave", B: "A signal with continuously varying amplitude only", C: "A signal represented using discrete levels", D: "A signal that contains no information", E: "A signal that cannot be transmitted" },
                correctAnswer: "C", marks: 5, status: "available"
            },
            {
                id: "MCQ016", type: "mcq", category: "Electronics",
                question: "The superposition theorem can be applied to:",
                options: { A: "Nonlinear circuits only", B: "Linear circuits with multiple independent sources", C: "Magnetic circuits only", D: "Digital circuits only", E: "Mechanical systems only" },
                correctAnswer: "B", marks: 5, status: "available"
            },
            {
                id: "MCQ017", type: "mcq", category: "Electronics",
                question: "In an AM communication system, the information signal primarily affects the:",
                options: { A: "Frequency of the carrier", B: "Phase of the carrier only", C: "Amplitude of the carrier", D: "Speed of propagation", E: "Wavelength of the antenna" },
                correctAnswer: "C", marks: 5, status: "available"
            },
            {
                id: "MCQ018", type: "mcq", category: "Electronics",
                question: "A diode is primarily designed to allow current to flow:",
                options: { A: "Equally in both directions", B: "Only when there is no voltage", C: "Preferentially in one direction", D: "Only under AC conditions", E: "Only through its gate terminal" },
                correctAnswer: "C", marks: 5, status: "available"
            },
            {
                id: "MCQ019", type: "mcq", category: "Electronics",
                question: "Which transform is particularly useful for analyzing continuous-time linear systems and differential equations?",
                options: { A: "Fourier transform", B: "Laplace transform", C: "Z-transform only", D: "Boolean transform", E: "Gray transform" },
                correctAnswer: "B", marks: 5, status: "available"
            },
            {
                id: "MCQ020", type: "mcq", category: "Electronics",
                question: "Which type of motor is commonly known for its ability to operate at approximately constant speed under varying load conditions?",
                options: { A: "DC series motor", B: "Synchronous motor", C: "Universal motor", D: "Stepper motor", E: "Reluctance motor" },
                correctAnswer: "B", marks: 5, status: "available"
            },
            {
                id: "MCQ021", type: "mcq", category: "Electronics",
                question: "In an ideal inverting op-amp configuration, the output signal is:",
                options: { A: "In phase with the input", B: "180° out of phase with the input", C: "Always zero", D: "Always positive", E: "Independent of the input" },
                correctAnswer: "B", marks: 5, status: "available"
            },
            {
                id: "CALC001", type: "calculation", category: "Calculations",
                question: "Evaluate the expression below and provide the final answer in simplest rectangular or polar form:<br><br>$$ (1 + i\\sqrt{3})^6 $$",
                correctAnswer: "64", marks: 10, status: "available"
            },
            {
                id: "CALC002", type: "calculation", category: "Calculations",
                question: "Calculate the eigenvalues of the 2x2 matrix A:<br><br>$$ A = \\begin{pmatrix} 4 & 1 \\\\ 2 & 3 \\end{pmatrix} $$",
                correctAnswer: "λ = 5 and λ = 2", marks: 10, status: "available"
            },
            {
                id: "CALC003", type: "calculation", category: "Calculations",
                question: "Solve the initial value problem for a second-order linear homogeneous differential equation:<br><br>$$ y'' + 4y = 0 $$<br><br>Given the initial conditions $y(0) = 4$ and $y'(0) = 4$, find the exact value of $y(\\pi/4)$.",
                correctAnswer: "2", marks: 10, status: "available"
            },
            {
                id: "CALC004", type: "calculation", category: "Calculations",
                question: "A factory produces precision resistors for EEE labs. Machine A produces 60% of the resistors with a 2% defect rate. Machine B produces 40% of the resistors with a 3% defect rate.<br><br>If a resistor selected at random is found to be defective, what is the probability that it was manufactured by Machine B?",
                correctAnswer: "0.5 or 50%", marks: 10, status: "available"
            },
            {
                id: "CALC005", type: "calculation", category: "Calculations",
                question: "Find the maximum possible volume of a right circular cylinder that can be inscribed inside a sphere of radius $R = 3\\text{ cm}$.<br><br>Provide your answer in terms of $\\pi$ and radicals if necessary.",
                correctAnswer: "12π√3 cm³", marks: 10, status: "available"
            },
            {
                id: "CALC006", type: "calculation", category: "Calculations",
                question: "Evaluate the following improper integral, commonly used in engineering transform analysis, where $s > 0$:<br><br>$$ \\int_{0}^{\\infty} e^{-st} \\cos(\\omega t) \\,dt $$",
                correctAnswer: "s / (s² + ω²)", marks: 10, status: "available"
            },
            {
                id: "CALC007", type: "calculation", category: "Calculations",
                question: "Solve the following logarithmic equation for the real number $x$:<br><br>$$ \\log_2(x) + \\log_2(x - 3) = 2 $$",
                correctAnswer: "x = 4", marks: 10, status: "available"
            },
            {
                id: "CALC008", type: "calculation", category: "Calculations",
                question: "Simplify the trigonometric expression below entirely so that it is expressed as a single trigonometric function of a multiple angle:<br><br>$$ \\sin^4(\\theta) - \\cos^4(\\theta) $$",
                correctAnswer: "-cos(2θ)", marks: 10, status: "available"
            },
            {
                id: "CALC009", type: "calculation", category: "Calculations",
                question: "Determine the integrating factor, $I(x)$, required to solve the following first-order linear differential equation:<br><br>$$ \\frac{dy}{dx} + \\frac{2}{x}y = \\sin(x) $$",
                correctAnswer: "x²", marks: 10, status: "available"
            },
            {
                id: "CALC010", type: "calculation", category: "Calculations",
                question: "The lifespan of a specific batch of capacitors is normally distributed with a mean ($\\mu$) of 5000 hours and a standard deviation ($\\sigma$) of 200 hours.<br><br>Calculate the exact Z-score for a capacitor that fails after 4700 hours.",
                correctAnswer: "-1.5", marks: 10, status: "available"
            },
            {
                id: "CALC011", type: "calculation", category: "Calculations",
                question: "Convert the following complex fraction into standard rectangular form $a + bi$:<br><br>$$ \\frac{3 + 4i}{1 - 2i} $$",
                correctAnswer: "-1 + 2i", marks: 10, status: "available"
            },
            {
                id: "CALC012", type: "calculation", category: "Calculations",
                question: "Calculate the determinant of the 3x3 matrix B:<br><br>$$ B = \\begin{pmatrix} 1 & 2 & -1 \\\\ 3 & 0 & 2 \\\\ -1 & 1 & 1 \\end{pmatrix} $$",
                correctAnswer: "-15", marks: 10, status: "available"
            },
            {
                id: "CALC013", type: "calculation", category: "Calculations",
                question: "Find the first derivative of the function below and evaluate it at $x = e$.<br><br>$$ f(x) = x^x $$",
                correctAnswer: "2e^e", marks: 10, status: "available"
            },
            {
                id: "CALC014", type: "calculation", category: "Calculations",
                question: "Evaluate the following definite integral using integration by parts:<br><br>$$ \\int_{0}^{\\pi/2} x \\sin(x) \\,dx $$",
                correctAnswer: "1", marks: 10, status: "available"
            },
            {
                id: "CALC015", type: "calculation", category: "Calculations",
                question: "Tests on a linear circuit reveal an open-circuit voltage of 12V and a short-circuit current of 3A at the output terminals.<br><br>Calculate the maximum power that this circuit can deliver to a load resistor $R_L$.",
                correctAnswer: "9 W", marks: 10, status: "available"
            },
            {
                id: "CALC016", type: "calculation", category: "Calculations",
                question: "A series RLC circuit has a resistance $R = 10\\Omega$, an inductance $L = 0.1\\text{ H}$, and a capacitance $C = 10\\text{ \\mu F}$.<br><br>Calculate the resonant frequency in Hertz (leave in terms of $\\pi$) and determine the Quality Factor (Q) of the circuit.",
                correctAnswer: "Frequency = 500/π Hz, Q = 10", marks: 10, status: "available"
            },
            {
                id: "CALC017", type: "calculation", category: "Calculations",
                question: "Find the total current supplied by the 10V DC voltage source in this circuit configuration.<br><br>(A 10V DC source in series with a $2\\Omega$ resistor, leading into a parallel node with a $3\\Omega$ and a $6\\Omega$ resistor returning to ground).",
                correctAnswer: "2.5 A", marks: 10, status: "available"
            },
            {
                id: "CALC018", type: "calculation", category: "Calculations",
                question: "The voltage across an AC load is given by:<br><br>$$ v(t) = 100\\cos(100t + 30^\\circ) \\text{ V} $$<br><br>and the current drawn by the load is:<br><br>$$ i(t) = 5\\cos(100t - 15^\\circ) \\text{ A} $$<br><br>Calculate the real (average) power consumed by the load.",
                correctAnswer: "125√2 W (or ≈ 176.78 W)", marks: 10, status: "available"
            },
            {
                id: "CALC019", type: "calculation", category: "Calculations",
                question: "Simplify the following Boolean expression to its absolute minimum sum-of-products (SOP) form:<br><br>$$ F = AB + A(B + C) + B(B + C) $$",
                correctAnswer: "B + AC", marks: 10, status: "available"
            },
            {
                id: "CALC020", type: "calculation", category: "Calculations",
                question: "Using only 2-input NAND gates, what is the absolute minimum number of gates required to implement the logic of a single 2-input XOR gate?",
                correctAnswer: "4", marks: 10, status: "available"
            },
            {
                id: "CALC021", type: "calculation", category: "Calculations",
                question: "Apply De Morgan's theorem to completely simplify the complement ($\\bar{F}$) of the following expression:<br><br>$$ F = (A + \\bar{B})(C + D) $$",
                correctAnswer: "A̅B + C̅D̅", marks: 10, status: "available"
            },
            {
                id: "CALC022", type: "calculation", category: "Calculations",
                question: "In a PLC ladder logic program, a Timer On Delay (TON) is configured with a preset value of 50. If the processor's time base for this timer is 0.1 seconds, exactly how long must the input rung remain continuously true for the timer's Done (DN) bit to energize?",
                correctAnswer: "5.0 seconds", marks: 10, status: "available"
            },
            {
                id: "CALC023", type: "calculation", category: "Calculations",
                question: "A standard PLC operates on a continuous, repeating cycle.<br><br>Name the three primary phases of a standard PLC scan cycle in their correct sequential operating order.",
                correctAnswer: "1. Input Scan, 2. Logic Execution, 3. Output Scan", marks: 10, status: "available"
            },
            {
                id: "CALC024", type: "calculation", category: "Calculations",
                question: "What is the primary electrical/engineering function of the opto-isolator (optocoupler) circuit found within the input and output modules of a PLC?",
                correctAnswer: "To provide galvanic/electrical isolation.", marks: 10, status: "available"
            },
            {
                id: "CALC025", type: "calculation", category: "Calculations",
                question: "An ideal inverting summing amplifier has two inputs: V1 = 2V passing through a 10k$\\Omega$ resistor, and V2 = -1V passing through a 20k$\\Omega$ resistor. Both feed into the inverting terminal. The feedback resistor is 40k$\\Omega$.<br><br>Calculate the final output voltage, $V_{out}$.",
                correctAnswer: "-6 V", marks: 10, status: "available"
            },
            {
                id: "CALC026", type: "calculation", category: "Calculations",
                question: "You must design an ideal non-inverting operational amplifier circuit with a closed-loop voltage gain of 15.<br><br>If the input resistor to ground ($R_1$) is fixed at 2k$\\Omega$, what exact resistance value is required for the feedback resistor ($R_f$)?",
                correctAnswer: "28 kΩ", marks: 10, status: "available"
            },
            {
                id: "CALC027", type: "calculation", category: "Calculations",
                question: "An ideal op-amp integrator has $R = 100\\text{ k}\\Omega$ and $C = 1\\text{ \\mu F}$. A constant DC step voltage of 2V is applied to the input at t=0.<br><br>Assuming the initial voltage across the capacitor is 0V, calculate the exact output voltage at t = 0.5 seconds.",
                correctAnswer: "-10 V", marks: 10, status: "available"
            },
            {
                id: "CALC028", type: "calculation", category: "Calculations",
                question: "An LTI system is described by the following second-order differential equation:<br><br>$$ 2\\frac{d^2y}{dt^2} + 5\\frac{dy}{dt} + 3y(t) = x(t) $$<br><br>Assuming zero initial conditions, derive the Laplace transfer function $H(s) = \\frac{Y(s)}{X(s)}$.",
                correctAnswer: "H(s) = 1 / (2s² + 5s + 3)", marks: 10, status: "available"
            },
            {
                id: "CALC029", type: "calculation", category: "Calculations",
                question: "A closed-loop control system has a forward path transfer function $G(s) = \\frac{K}{s(s+2)}$ and a unity negative feedback path $H(s) = 1$.<br><br>Determine the characteristic equation of this closed-loop system.",
                correctAnswer: "s² + 2s + K = 0", marks: 10, status: "available"
            },
            {
                id: "CALC030", type: "calculation", category: "Calculations",
                question: "In the context of robust control engineering, explain the primary mathematical advantage that negative closed-loop feedback provides regarding a system's sensitivity to plant parameter variations (e.g., component aging), compared to an open-loop configuration.",
                correctAnswer: "It divides the system sensitivity by a factor of (1 + GH).", marks: 10, status: "available"
            },
            {
                id: "THRY001", type: "theory", category: "Theory",
                question: "The process of converting a low-frequency signal to a higher frequency for transmission is called __________.",
                correctAnswer: "Modulation", marks: 5, status: "available"
            },
            {
                id: "THRY002", type: "theory", category: "Theory",
                question: "The parameter that defines the maximum rate of data transmission over a channel is channel __________.",
                correctAnswer: "Capacity", marks: 5, status: "available"
            },
            {
                id: "THRY003", type: "theory", category: "Theory",
                question: "Kirchhoff’s Voltage Law (KVL) is based on the law of conservation of __________.",
                correctAnswer: "Energy", marks: 5, status: "available"
            },
            {
                id: "THRY004", type: "theory", category: "Theory",
                question: "Kirchhoff’s Current Law (KCL) is based on the law of conservation of __________.",
                correctAnswer: "Charge", marks: 5, status: "available"
            },
            {
                id: "THRY005", type: "theory", category: "Theory",
                question: "Distortion caused by undersampling a high-frequency signal is called __________.",
                correctAnswer: "Aliasing", marks: 5, status: "available"
            },
            {
                id: "THRY006", type: "theory", category: "Theory",
                question: "Analog and Digital Signal: An anti-aliasing filter is placed __________ the analog-to-digital converter.",
                correctAnswer: "Before", marks: 5, status: "available"
            },
            {
                id: "THRY007", type: "theory", category: "Theory",
                question: "DC motors convert electrical energy into __________ energy.",
                correctAnswer: "Mechanical", marks: 5, status: "available"
            },
            {
                id: "THRY008", type: "theory", category: "Theory",
                question: "The difference between synchronous speed and rotor speed in an induction motor is called __________.",
                correctAnswer: "Slip", marks: 5, status: "available"
            },
            {
                id: "THRY009", type: "theory", category: "Theory",
                question: "Electricity is transmitted at very high voltages to reduce __________ losses.",
                correctAnswer: "Transmission", marks: 5, status: "available"
            },
            {
                id: "THRY010", type: "theory", category: "Theory",
                question: "Power factor is the cosine of the phase angle between voltage and __________.",
                correctAnswer: "Current", marks: 5, status: "available"
            },
            {
                id: "THRY011", type: "theory", category: "Theory",
                question: "A AND gate output is HIGH only when all inputs are __________.",
                correctAnswer: "HIGH", marks: 5, status: "available"
            },
            {
                id: "THRY012", type: "theory", category: "Theory",
                question: "The universal logic gates are NAND and __________.",
                correctAnswer: "NOR", marks: 5, status: "available"
            },
            {
                id: "THRY013", type: "theory", category: "Theory",
                question: "The execution sequence of reading inputs, executing logic, and updating outputs is called a scan __________.",
                correctAnswer: "Cycle", marks: 5, status: "available"
            },
            {
                id: "THRY014", type: "theory", category: "Theory",
                question: "Actuators like motor starters are connected to the PLC's __________ modules.",
                correctAnswer: "Output", marks: 5, status: "available"
            },
            {
                id: "THRY015", type: "theory", category: "Theory",
                question: "Ladder logic visual structure resembles the rungs and rails of a __________.",
                correctAnswer: "Ladder", marks: 5, status: "available"
            },
            {
                id: "THRY016", type: "theory", category: "Theory",
                question: "Contacts placed in series perform a logical __________ operation.",
                correctAnswer: "AND", marks: 5, status: "available"
            },
            {
                id: "THRY017", type: "theory", category: "Theory",
                question: "An ideal op-amp has an infinite input __________ and zero output impedance.",
                correctAnswer: "Impedance", marks: 5, status: "available"
            },
            {
                id: "THRY018", type: "theory", category: "Theory",
                question: "Slew rate defines the maximum rate of change of output __________ per unit time.",
                correctAnswer: "Voltage", marks: 5, status: "available"
            },
            {
                id: "THRY019", type: "theory", category: "Theory",
                question: "The key component that provides feedback in a servo system is a position __________.",
                correctAnswer: "Sensor", marks: 5, status: "available"
            },
            {
                id: "THRY020", type: "theory", category: "Theory",
                question: "A closed-loop system uses feedback to reduce system __________.",
                correctAnswer: "Error", marks: 5, status: "available"
            },
            {
                id: "THRY021", type: "theory", category: "Theory",
                question: "In a PID controller, 'P' stands for __________.",
                correctAnswer: "Proportional", marks: 5, status: "available"
            }
        ],
        teams: [
            { id: "T1", name: "Team Alpha", score: 0, questionsAnswered: 0 },
            { id: "T2", name: "Team Beta", score: 0, questionsAnswered: 0 },
            { id: "T3", name: "Team Gamma", score: 0, questionsAnswered: 0 }
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
