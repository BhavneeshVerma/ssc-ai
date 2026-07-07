// Training Engine Module (Alphabet & Multiplication Tables Logic)
import { state, getActiveProfile } from '../state.js';

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

// Choose an item from list based on weights
function weightedRandomPick(items, weights) {
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    let rand = Math.random() * totalWeight;
    
    for (let i = 0; i < items.length; i++) {
        if (rand < weights[i]) {
            return items[i];
        }
        rand -= weights[i];
    }
    return items[items.length - 1];
}

// Generate the next prompt based on selected mode and configuration
export function generateQuestion(mode, config = { tableStart: 1, tableEnd: 50 }) {
    const profile = getActiveProfile();
    
    let result = {
        question: "",
        answer: "",
        hint: "",
        currentLetter: null,
        currentTable: null,
        currentMultiplier: null,
        generatedMode: mode
    };
    
    let activeMode = mode;
    let start = parseInt(config.tableStart) || 1;
    let end = parseInt(config.tableEnd) || 50;
    
    if (mode === "custom") {
        const modes = config.customModes && config.customModes.length > 0 ? config.customModes : ["alphaToNum"];
        activeMode = modes[Math.floor(Math.random() * modes.length)];
        result.generatedMode = activeMode;
        
        if (activeMode === "tables") {
            const customTables = config.customTables && config.customTables.length > 0 ? config.customTables : [12];
            const randTable = customTables[Math.floor(Math.random() * customTables.length)];
            start = randTable;
            end = randTable;
        }
    }
    
    if (activeMode === "qbank") {
        // --- PERSONAL QUESTION BANK ---
        const pool = state.currentWorkout.qbankPool || [];
        if (pool.length === 0) {
            result.question = "No unmastered questions in bank";
            result.answer = "0";
            result.hint = "Add questions in the Question Bank tab first!";
        } else {
            // Pick a question using error-biased weights
            const weights = pool.map(q => {
                const incorrectCount = Math.max(0, q.times_shown - q.times_correct);
                return 1 + 3 * incorrectCount; // Error bias factor
            });
            const pickedQuestion = weightedRandomPick(pool, weights);
            
            result.question = pickedQuestion.question_text;
            result.answer = pickedQuestion.correct_answer;
            result.hint = pickedQuestion.notes || `Topic: ${pickedQuestion.topic}`;
            result.qbankQuestionId = pickedQuestion.id;
            result.qbankQuestionData = pickedQuestion;
        }
    } else if (activeMode === "tables") {
        // --- MULTIPLICATION TABLES ---
        // Compile subset of tables
        const activeTables = [];
        for (let t = start; t <= end; t++) {
            activeTables.push(`Table ${t}`);
        }
        
        // Calculate weights from active errors
        const weights = activeTables.map(t_str => {
            const wrongCount = profile.table_wrong_counts[t_str] || 0;
            return 1 + 3 * wrongCount; // Error bias factor
        });
        
        const chosenTableStr = weightedRandomPick(activeTables, weights);
        const tableNum = parseInt(chosenTableStr.split(" ")[1]);
        const multiplier = Math.floor(Math.random() * 10) + 1; // Multiplier 1 to 10
        
        result.currentTable = chosenTableStr;
        result.currentMultiplier = multiplier;
        result.question = `${tableNum} × ${multiplier}`;
        result.answer = (tableNum * multiplier).toString();
        result.hint = "Solve the multiplication:";
        
    } else {
        // --- ALPHABET MODES ---
        const letters = ALPHABET.split("");
        const weights = letters.map(char => {
            const wrongCount = profile.wrong_counts[char] || 0;
            return 1 + 3 * wrongCount; // Error bias factor
        });
        
        const chosenLetter = weightedRandomPick(letters, weights);
        result.currentLetter = chosenLetter;
        
        const code = chosenLetter.charCodeAt(0) - 64; // A=1, B=2...
        
        if (activeMode === "alphaToNum") {
            result.question = chosenLetter;
            result.answer = code.toString();
            result.hint = "What is the numeric position of the letter?";
        } else if (activeMode === "numToAlpha") {
            result.question = code.toString();
            result.answer = chosenLetter;
            result.hint = "What letter is at this numeric position?";
        } else if (activeMode === "alphaOpposite") {
            result.question = chosenLetter;
            const oppositeChar = String.fromCharCode(90 - (chosenLetter.charCodeAt(0) - 65));
            result.answer = oppositeChar;
            result.hint = "What is the opposite letter?";
        }
    }
    
    return result;
}

// Log attempt to profile detailed tracking (JSONB-like structure)
export function recordAttempt(mode, questionData, isCorrect, userAnswer, timeTaken) {
    const profile = getActiveProfile();
    if (!profile) return;
    
    // Increment daily count
    profile.today_count = (profile.today_count || 0) + 1;
    
    if (!profile.detailed_mistakes) {
        profile.detailed_mistakes = { tables: {}, alpha: {} };
    }
    if (!profile.detailed_mistakes.tables) profile.detailed_mistakes.tables = {};
    if (!profile.detailed_mistakes.alpha) profile.detailed_mistakes.alpha = {};
    
    const timestamp = new Date().toISOString();
    
    if (mode === "tables") {
        // Normalize table details
        const tableNum = questionData.currentTable ? parseInt(questionData.currentTable.split(" ")[1]) : parseInt(questionData.question.split(" ")[0]);
        const multiplier = questionData.currentMultiplier || parseInt(questionData.question.split(" ")[2]);
        const equationKey = `${tableNum}*${multiplier}`;
        
        if (!profile.detailed_mistakes.tables[equationKey]) {
            profile.detailed_mistakes.tables[equationKey] = {
                table: tableNum,
                multiplier: multiplier,
                incorrect: 0,
                correct: 0,
                best_time: null,
                last_time: null,
                history: []
            };
        }
        
        const entry = profile.detailed_mistakes.tables[equationKey];
        if (isCorrect) {
            entry.correct++;
            entry.last_time = timeTaken;
            if (entry.best_time === null || timeTaken < entry.best_time) {
                entry.best_time = timeTaken;
            }
        } else {
            entry.incorrect++;
            entry.last_failed = timestamp;
        }
        
        entry.history.push({
            timestamp,
            isCorrect,
            userAnswer,
            correctAnswer: questionData.answer,
            timeTaken
        });
        
        // Keep last 5 entries to preserve storage
        if (entry.history.length > 5) entry.history.shift();
        
        // Backward compatibility counters for weights
        if (questionData.currentTable && !isCorrect) {
            profile.table_wrong_counts[questionData.currentTable] = (profile.table_wrong_counts[questionData.currentTable] || 0) + 1;
        }
        
    } else {
        const letter = questionData.currentLetter || questionData.question;
        const alphaKey = `${mode}_${letter}`;
        
        if (!profile.detailed_mistakes.alpha[alphaKey]) {
            profile.detailed_mistakes.alpha[alphaKey] = {
                mode: mode,
                letter: letter,
                incorrect: 0,
                correct: 0,
                best_time: null,
                last_time: null,
                history: []
            };
        }
        
        const entry = profile.detailed_mistakes.alpha[alphaKey];
        if (isCorrect) {
            entry.correct++;
            entry.last_time = timeTaken;
            if (entry.best_time === null || timeTaken < entry.best_time) {
                entry.best_time = timeTaken;
            }
        } else {
            entry.incorrect++;
            entry.last_failed = timestamp;
        }
        
        entry.history.push({
            timestamp,
            isCorrect,
            userAnswer,
            correctAnswer: questionData.answer,
            timeTaken
        });
        
        if (entry.history.length > 5) entry.history.shift();
        
        // Backward compatibility counters for weights
        if (questionData.currentLetter && !isCorrect) {
            profile.wrong_counts[questionData.currentLetter] = (profile.wrong_counts[questionData.currentLetter] || 0) + 1;
        }
    }
}

// Legacy compatibility wrapper
export function recordMistake(mode, questionData) {
    recordAttempt(mode, questionData, false, "", null);
}
