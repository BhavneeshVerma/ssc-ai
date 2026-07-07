// Training Arena Tab Controller
import { 
    state, 
    getActiveProfile, 
    saveStateToStorage, 
    syncActiveProfileToCloud, 
    logDrillSession, 
    autoCaptureToBankIfFailed, 
    canAccess 
} from '../../state.js';
import { supabase } from '../../supabaseClient.js';
import { generateQuestion, recordAttempt } from '../../trainer/engine.js';
import { initializeKeypad, updateKeypadVisibility } from '../../trainer/keypad.js';

let currentQuestionStartTime = null;
let instantSubmit = false;
let activeQuestionData = {};

function getElements() {
    return {
        setupForm: document.getElementById("setupForm"),
        modeSelect: document.getElementById("modeSelect"),
        tablesConfig: document.getElementById("tablesConfig"),
        presetBtns: document.querySelectorAll(".preset-btn"),
        tableStart: document.getElementById("tableStart"),
        tableEnd: document.getElementById("tableEnd"),
        timerSelect: document.getElementById("timerSelect"),
        startWorkoutBtn: document.getElementById("startWorkoutBtn"),

        workoutArena: document.getElementById("workoutArena"),
        timerDisplay: document.getElementById("timerDisplay"),
        scoreDisplay: document.getElementById("scoreDisplay"),
        promptHint: document.getElementById("promptHint"),
        promptQuestion: document.getElementById("promptQuestion"),
        answerInput: document.getElementById("answerInput"),
        submitBtn: document.getElementById("submitBtn"),
        feedbackDisplay: document.getElementById("feedbackDisplay"),
        skipBtn: document.getElementById("skipBtn"),
        stopWorkoutBtn: document.getElementById("stopWorkoutBtn"),

        summaryModal: document.getElementById("summaryModal"),
        modalCorrect: document.getElementById("modalCorrect"),
        modalTotal: document.getElementById("modalTotal"),
        modalAccuracy: document.getElementById("modalAccuracy"),
        closeModalBtn: document.getElementById("closeModalBtn"),
        
        promptCard: document.querySelector(".prompt-card"),

        visualAnswerContainer: document.getElementById("visualAnswerContainer"),
        visualAnswerPlaceholder: document.getElementById("visualAnswerPlaceholder"),
        visualAnswerText: document.getElementById("visualAnswerText")
    };
}

function setWorkoutUiActive(isActive) {
    const el = getElements();

    if (el.setupForm) {
        el.setupForm.classList.toggle("is-hidden", isActive);
        el.setupForm.setAttribute("aria-hidden", String(isActive));
    }

    if (el.workoutArena) {
        el.workoutArena.classList.toggle("is-active", isActive);
        el.workoutArena.setAttribute("aria-hidden", String(!isActive));
    }

    if (el.answerInput) el.answerInput.disabled = !isActive;
    if (el.submitBtn) el.submitBtn.disabled = !isActive;
}

function ensureTrainingTabVisible() {
    const trainingTab = document.getElementById("tab-training");
    if (!trainingTab) return;

    document.querySelectorAll(".tab-content").forEach(tab => {
        tab.classList.toggle("active", tab.id === "tab-training");
    });

    document.querySelectorAll(".nav-btn, .dock-btn").forEach(btn => {
        btn.classList.toggle("active", btn.getAttribute("data-tab") === "training");
    });

    state.currentTab = "training";
    document.body.classList.remove("dock-hidden");

    const scrollRoot = document.querySelector(".app-main");
    if (scrollRoot) scrollRoot.scrollTop = 0;
    window.scrollTo(0, 0);
}

export function updateVisualAnswer() {
    const el = getElements();
    if (!el.visualAnswerText || !el.visualAnswerPlaceholder || !el.answerInput) return;
    const val = el.answerInput.value;
    el.visualAnswerText.textContent = val;
    if (val.length > 0) {
        el.visualAnswerPlaceholder.style.display = "none";
    } else {
        el.visualAnswerPlaceholder.style.display = "inline";
    }
}

function onWorkoutStart() {
    document.body.classList.add("workout-running");
    const el = getElements();
    if (el.answerInput) el.answerInput.classList.add("hidden-capture-input");
    updateVisualAnswer();
}

function onWorkoutEnd() {
    document.body.classList.remove("workout-running");
    document.body.classList.remove("dock-hidden");
    const el = getElements();
    if (el.answerInput) el.answerInput.classList.remove("hidden-capture-input");
    updateVisualAnswer();
}

function tickTimerText() {
    const el = getElements();
    if (!el.timerDisplay) return;
    const mins = Math.floor(state.currentWorkout.timeLeft / 60);
    const secs = state.currentWorkout.timeLeft % 60;
    el.timerDisplay.innerHTML = `<i class="fa-regular fa-clock"></i> ${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function promptNextQuestion() {
    const workout = state.currentWorkout;
    const el = getElements();
    if (!el.answerInput) return;
    
    el.answerInput.value = "";
    updateVisualAnswer();
    
    let config = {
        tableStart: el.tableStart ? el.tableStart.value : 1,
        tableEnd: el.tableEnd ? el.tableEnd.value : 50
    };
    
    if (workout.mode === "custom") {
        config = workout.customConfig;
    }
    
    activeQuestionData = generateQuestion(workout.mode, config);
    
    workout.currentQuestion = activeQuestionData.question;
    workout.currentAnswer = activeQuestionData.answer;
    
    if (el.promptHint) el.promptHint.textContent = activeQuestionData.hint;
    if (el.promptQuestion) el.promptQuestion.textContent = activeQuestionData.question;
    
    // Update virtual keypad dynamically based on the active question's details
    const activeMode = activeQuestionData.generatedMode || workout.mode;
    updateKeypadVisibility(activeMode, activeQuestionData.answer);
    
    currentQuestionStartTime = Date.now();
    el.answerInput.focus({ preventScroll: true });
}

export function checkUserAnswer() {
    const workout = state.currentWorkout;
    if (!workout.isActive) return;
    
    const el = getElements();
    if (!el.answerInput) return;
    
    const val = el.answerInput.value.trim().toUpperCase();
    if (val === "") return;
    
    workout.total++;
    const profile = getActiveProfile();
    const isCorrect = (val === workout.currentAnswer.toUpperCase());
    
    const timeTaken = currentQuestionStartTime ? (Date.now() - currentQuestionStartTime) / 1000 : 0;
    
    // Save detailed results under the specific sub-generated mode
    const activeMode = activeQuestionData.generatedMode || workout.mode;
    recordAttempt(activeMode, activeQuestionData, isCorrect, val, timeTaken);
    
    // Update question bank stats on Supabase if practicing in qbank mode
    if (workout.mode === "qbank" && activeQuestionData.qbankQuestionId) {
        const qData = activeQuestionData.qbankQuestionData;
        const newTimesCorrect = qData.times_correct + (isCorrect ? 1 : 0);
        const newTimesShown = qData.times_shown + 1;
        const isMasteredNow = isCorrect && (newTimesCorrect >= 3);
        
        supabase
            .from('question_bank')
            .update({
                times_shown: newTimesShown,
                times_correct: newTimesCorrect,
                is_mastered: isMasteredNow,
                last_shown_at: new Date().toISOString()
            })
            .eq('id', qData.id)
            .then(({ error }) => {
                if (error) console.error("Failed to update QBank stats:", error);
            });
    }
    
    // Add to session log
    workout.sessionLog.push({
        question: workout.currentQuestion,
        correctAnswer: workout.currentAnswer,
        userAnswer: val,
        isCorrect: isCorrect,
        timeTaken: parseFloat(timeTaken.toFixed(2)),
        timestamp: new Date().toISOString()
    });
    
    // Auto-capture failed questions to Supabase Question Bank
    if (!isCorrect) {
        autoCaptureToBankIfFailed(activeMode, activeQuestionData, val);
    }
    
    if (isCorrect) {
        workout.correct++;
        profile.all_time_correct++;
        
        if (el.feedbackDisplay) {
            el.feedbackDisplay.textContent = `✓ Correct! (${workout.currentQuestion} = ${workout.currentAnswer}) in ${timeTaken.toFixed(1)}s`;
            el.feedbackDisplay.className = "feedback-msg correct";
        }
    } else {
        if (el.feedbackDisplay) {
            el.feedbackDisplay.textContent = `✗ Incorrect. Correct: ${workout.currentAnswer}`;
            el.feedbackDisplay.className = "feedback-msg incorrect";
        }
    }
    
    // Dopamine / Brutalist feedback pop animation
    if (el.promptCard) {
        el.promptCard.classList.remove("pop-correct", "pop-wrong");
        void el.promptCard.offsetWidth;
        el.promptCard.classList.add(isCorrect ? "pop-correct" : "pop-wrong");
        setTimeout(() => {
            el.promptCard.classList.remove("pop-correct", "pop-wrong");
        }, 300);
    }
    
    profile.all_time_total++;
    if (el.scoreDisplay) el.scoreDisplay.textContent = `SCORE: ${workout.correct} / ${workout.total}`;
    
    saveStateToStorage();
    
    // Notify app entry point to update widgets
    window.dispatchEvent(new CustomEvent('active-profile-data-updated'));
    
    promptNextQuestion();
}

export function skipQuestion() {
    const workout = state.currentWorkout;
    if (!workout.isActive) return;
    
    const el = getElements();
    
    workout.total++;
    const profile = getActiveProfile();
    
    const timeTaken = currentQuestionStartTime ? (Date.now() - currentQuestionStartTime) / 1000 : 0;
    const activeMode = activeQuestionData.generatedMode || workout.mode;
    recordAttempt(activeMode, activeQuestionData, false, "SKIPPED", timeTaken);
    profile.all_time_total++;
    
    // Update question bank stats on Supabase if practicing in qbank mode
    if (workout.mode === "qbank" && activeQuestionData.qbankQuestionId) {
        const qData = activeQuestionData.qbankQuestionData;
        const newTimesShown = qData.times_shown + 1;
        
        supabase
            .from('question_bank')
            .update({
                times_shown: newTimesShown,
                is_mastered: false,
                last_shown_at: new Date().toISOString()
            })
            .eq('id', qData.id)
            .then(({ error }) => {
                if (error) console.error("Failed to update QBank stats:", error);
            });
    }
    
    // Add to session log
    workout.sessionLog.push({
        question: workout.currentQuestion,
        correctAnswer: workout.currentAnswer,
        userAnswer: "SKIPPED",
        isCorrect: false,
        timeTaken: parseFloat(timeTaken.toFixed(2)),
        timestamp: new Date().toISOString()
    });
    
    // Auto-capture skipped questions to Supabase Question Bank
    autoCaptureToBankIfFailed(activeMode, activeQuestionData, "SKIPPED");
    
    if (el.feedbackDisplay) {
        el.feedbackDisplay.textContent = `Skipped. Correct answer was: ${workout.currentAnswer}`;
        el.feedbackDisplay.className = "feedback-msg skipped";
    }
    if (el.scoreDisplay) el.scoreDisplay.textContent = `SCORE: ${workout.correct} / ${workout.total}`;
    
    // Trigger wrong/shake animation on skip
    if (el.promptCard) {
        el.promptCard.classList.remove("pop-correct", "pop-wrong");
        void el.promptCard.offsetWidth;
        el.promptCard.classList.add("pop-wrong");
        setTimeout(() => {
            el.promptCard.classList.remove("pop-correct", "pop-wrong");
        }, 300);
    }
    
    saveStateToStorage();
    
    // Notify app entry point to update widgets
    window.dispatchEvent(new CustomEvent('active-profile-data-updated'));
    
    promptNextQuestion();
}

export function stopWorkoutRun(interrupted = false) {
    const workout = state.currentWorkout;
    if (!workout.isActive) return;
    
    workout.isActive = false;
    clearInterval(workout.timerInterval);
    
    const el = getElements();
    setWorkoutUiActive(false);
    onWorkoutEnd();
    
    // Make sure keypad is set to configuration mode default state
    updateKeypadVisibility(el.modeSelect.value);
    
    if (workout.total > 0 && !interrupted) {
        const acc = Math.round((workout.correct / workout.total) * 100);
        if (el.modalCorrect) el.modalCorrect.textContent = workout.correct;
        if (el.modalTotal) el.modalTotal.textContent = workout.total;
        if (el.modalAccuracy) el.modalAccuracy.textContent = `${acc}%`;
        if (el.summaryModal) el.summaryModal.style.display = "flex";
        
        // Log drill session to Supabase
        const durationSec = workout.duration - workout.timeLeft;
        const config = workout.mode === "custom" ? workout.customConfig : { tableStart: el.tableStart.value, tableEnd: el.tableEnd.value };
        logDrillSession(workout.mode, durationSec, workout.correct, workout.total, workout.sessionLog, config);
        
        // Sync aggregate statistics to cloud
        if (supabase && state.supabaseUser) {
            syncActiveProfileToCloud();
        }
    }
    
    saveStateToStorage();
    
    // Notify app entry point to update widgets
    window.dispatchEvent(new CustomEvent('active-profile-data-updated'));
}

export function startWorkoutRun() {
    const workout = state.currentWorkout;
    const el = getElements();
    workout.mode = el.modeSelect.value;
    
    // Check feature access based on feature flags
    if (workout.mode === "qbank") {
        if (!supabase || !state.supabaseUser) {
            alert("Cloud Sign-in Required to practice questions from your Question Bank.");
            return;
        }
        if (!canAccess("question_bank")) {
            alert("Personal Question Bank is a Premium feature. Please sign in with a paid account.");
            return;
        }
        
        el.startWorkoutBtn.disabled = true;
        el.startWorkoutBtn.textContent = "Loading Questions...";
        
        supabase
            .from('question_bank')
            .select('*')
            .eq('user_id', state.supabaseUser.id)
            .eq('is_mastered', false)
            .then(({ data, error }) => {
                el.startWorkoutBtn.disabled = false;
                el.startWorkoutBtn.textContent = "Start Workout";
                if (error) {
                    alert("Failed to load question bank: " + error.message);
                } else {
                    workout.qbankPool = data || [];
                    if (workout.qbankPool.length === 0) {
                        alert("Your Question Bank is currently empty or all questions are mastered! Add some questions or make mistakes in other drills to populate it.");
                    } else {
                        // Start qbank drill
                        ensureTrainingTabVisible();
                        workout.isActive = true;
                        workout.duration = parseInt(el.timerSelect.value) || 60;
                        workout.timeLeft = workout.duration;
                        workout.correct = 0;
                        workout.total = 0;
                        workout.sessionLog = [];
                        
                        setWorkoutUiActive(true);
                        el.answerInput.value = "";
                        onWorkoutStart();
                        el.feedbackDisplay.textContent = "";
                        el.feedbackDisplay.className = "feedback-msg";
                        el.scoreDisplay.textContent = "SCORE: 0 / 0";
                        
                        tickTimerText();
                        promptNextQuestion();
                        
                        workout.timerInterval = setInterval(() => {
                            workout.timeLeft--;
                            tickTimerText();
                            if (workout.timeLeft <= 0) {
                                stopWorkoutRun(false);
                            }
                        }, 1000);
                    }
                }
            });
        return; // Early return because Supabase fetch is asynchronous
    }
    
    // Check feature access based on feature flags
    if (workout.mode === "tables") {
        const startVal = parseInt(el.tableStart.value) || 1;
        const endVal = parseInt(el.tableEnd.value) || 50;
        if (startVal > 20 || endVal > 20) {
            if (!canAccess("tables.range_21_50")) {
                alert("Multiplication tables between 21 and 50 is a Premium feature. Please sign in with a paid account.");
                return;
            }
        }
    } else if (workout.mode === "alphaOpposite") {
        if (!canAccess("alpha.opposite")) {
            alert("Alphabet Opposite Letters matching is a Premium feature. Please sign in with a paid account.");
            return;
        }
    } else if (workout.mode === "custom") {
        const customOptAlphaOpposite = document.getElementById("customOptAlphaOpposite").checked;
        const rawTables = document.getElementById("customTablesList").value;
        const customTables = rawTables.split(",")
            .map(s => parseInt(s.trim()))
            .filter(n => !isNaN(n) && n >= 1 && n <= 50);
        
        if (customOptAlphaOpposite && !canAccess("alpha.opposite")) {
            alert("Opposite Letters training is a Premium feature. Please deselect it or sign in with a paid account.");
            return;
        }
        
        const hasHardTables = customTables.some(n => n > 20) || (customTables.length === 0);
        const customOptTables = document.getElementById("customOptTables").checked;
        if (customOptTables && hasHardTables && !canAccess("tables.range_21_50")) {
            alert("Multiplication tables above 20 is a Premium feature. Please specify tables 1-20 or sign in with a paid account.");
            return;
        }
    }

    ensureTrainingTabVisible();
    workout.isActive = true;
    workout.duration = parseInt(el.timerSelect.value) || 60;
    workout.timeLeft = workout.duration;
    workout.correct = 0;
    workout.total = 0;
    workout.sessionLog = [];
    
    // Set custom configurations if combined training is selected
    if (workout.mode === "custom") {
        const customModes = [];
        if (document.getElementById("customOptAlphaToNum").checked) customModes.push("alphaToNum");
        if (document.getElementById("customOptNumToAlpha").checked) customModes.push("numToAlpha");
        if (document.getElementById("customOptAlphaOpposite").checked) customModes.push("alphaOpposite");
        if (document.getElementById("customOptTables").checked) customModes.push("tables");
        
        const rawTables = document.getElementById("customTablesList").value;
        const customTables = rawTables.split(",")
            .map(s => parseInt(s.trim()))
            .filter(n => !isNaN(n) && n >= 1 && n <= 50);
            
        workout.customConfig = {
            customModes: customModes.length > 0 ? customModes : ["alphaToNum"],
            customTables: customTables
        };
    }
    
    setWorkoutUiActive(true);
    el.answerInput.value = "";
    onWorkoutStart();
    el.feedbackDisplay.textContent = "";
    el.feedbackDisplay.className = "feedback-msg";
    el.scoreDisplay.textContent = "SCORE: 0 / 0";
    
    tickTimerText();
    promptNextQuestion();
    
    workout.timerInterval = setInterval(() => {
        workout.timeLeft--;
        tickTimerText();
        
        if (workout.timeLeft <= 0) {
            stopWorkoutRun(false);
        }
    }, 1000);
}

export function setupWorkoutConfig() {
    const el = getElements();
    const customConfig = document.getElementById("customWorkoutConfig");
    if (!el.modeSelect) return;
    
    el.modeSelect.addEventListener("change", (e) => {
        const mode = e.target.value;
        if (mode === "tables") {
            if (el.tablesConfig) el.tablesConfig.style.display = "block";
            if (customConfig) customConfig.style.display = "none";
        } else if (mode === "custom") {
            if (el.tablesConfig) el.tablesConfig.style.display = "none";
            if (customConfig) customConfig.style.display = "block";
        } else {
            if (el.tablesConfig) el.tablesConfig.style.display = "none";
            if (customConfig) customConfig.style.display = "none";
        }
        updateKeypadVisibility(mode);
    });

    // Preset Range shortcuts
    el.presetBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            el.presetBtns.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            
            const range = btn.getAttribute("data-range");
            const [start, end] = range.split("-").map(Number);
            
            if (el.tableStart) el.tableStart.value = start;
            if (el.tableEnd) el.tableEnd.value = end;
        });
    });
    
    // Bounds inputs validation
    const rangeValidate = () => {
        el.presetBtns.forEach(b => b.classList.remove("active"));
        
        let start = parseInt(el.tableStart.value) || 1;
        let end = parseInt(el.tableEnd.value) || 50;
        
        if (start < 1) start = 1;
        if (start > 50) start = 50;
        if (end < 1) end = 1;
        if (end > 50) end = 50;
        if (start > end) {
            let temp = start;
            start = end;
            end = temp;
        }
        
        if (el.tableStart) el.tableStart.value = start;
        if (el.tableEnd) el.tableEnd.value = end;
        
        const match = `${start}-${end}`;
        el.presetBtns.forEach(b => {
            if (b.getAttribute("data-range") === match) {
                b.classList.add("active");
            }
        });
    };
    
    if (el.tableStart) el.tableStart.addEventListener("change", rangeValidate);
    if (el.tableEnd) el.tableEnd.addEventListener("change", rangeValidate);
    
    // Instant Submit Toggle Listener
    const instantSubmitToggle = document.getElementById("instantSubmitToggle");
    if (instantSubmitToggle) {
        instantSubmitToggle.addEventListener("click", () => {
            instantSubmit = !instantSubmit;
            instantSubmitToggle.classList.toggle("active", instantSubmit);
        });
    }
}

export function initTraining() {
    const el = getElements();
    setupWorkoutConfig();

    // Bind keypad
    initializeKeypad(el.answerInput, checkUserAnswer);

    // Bind action buttons
    if (el.startWorkoutBtn) el.startWorkoutBtn.addEventListener("click", () => startWorkoutRun());
    if (el.stopWorkoutBtn) el.stopWorkoutBtn.addEventListener("click", () => stopWorkoutRun(true));
    if (el.skipBtn) el.skipBtn.addEventListener("click", skipQuestion);
    if (el.submitBtn) el.submitBtn.addEventListener("click", checkUserAnswer);
    if (el.answerInput) {
        el.answerInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") checkUserAnswer();
        });

        // Instant Submit input checker listener
        el.answerInput.addEventListener("input", () => {
            updateVisualAnswer();
            if (instantSubmit && state.currentWorkout.isActive) {
                const val = el.answerInput.value.trim().toUpperCase();
                const answer = state.currentWorkout.currentAnswer.toUpperCase();
                if (val.length >= answer.length) {
                    checkUserAnswer();
                }
            }
        });

        el.answerInput.addEventListener("focus", () => {
            if (el.visualAnswerContainer) {
                el.visualAnswerContainer.classList.add("focused");
            }
        });
        
        el.answerInput.addEventListener("blur", () => {
            if (el.visualAnswerContainer) {
                el.visualAnswerContainer.classList.remove("focused");
            }
        });
    }
    
    // Visual answer container focus click behavior
    if (el.visualAnswerContainer) {
        el.visualAnswerContainer.addEventListener("click", () => {
            if (state.currentWorkout.isActive && el.answerInput) {
                el.answerInput.focus({ preventScroll: true });
            }
        });
    }
    
    if (el.closeModalBtn) {
        el.closeModalBtn.addEventListener("click", () => {
            if (el.summaryModal) el.summaryModal.style.display = "none";
        });
    }
}
