// Application Entry Point (Main Controller)
import './style.css'; // Load stylesheet
import { supabase } from './supabaseClient.js';
import { 
    state, 
    loadStateFromStorage, 
    saveStateToStorage, 
    getActiveProfile, 
    resetActiveProfileStats,
    refreshActiveProfileDailyStats,
    syncActiveProfileToCloud,
    loadActiveProfileFromCloud,
    logDrillSession,
    fetchFeatureFlags,
    canAccess,
    autoCaptureToBankIfFailed,
    getQuestionBank,
    addManualQuestion,
    deleteQuestionFromBank
} from './state.js';
import { generateQuestion, recordAttempt } from './trainer/engine.js';
import { initializeKeypad, updateKeypadVisibility } from './trainer/keypad.js';
import { initializeAnalyticsDashboard, renderAnalyticsView } from './analytics/dashboard.js';
import { initializeProfilesManager, refreshProfilesList } from './profiles/manager.js';

// Elements references mapping
let elements = {};
let currentQuestionStartTime = null;
let selectedTable = null;
let showHeatmap = false;
let instantSubmit = false;

function mapElements() {
    elements = {
        // Navigation Tabs
        navBtns: document.querySelectorAll(".nav-btn"),
        tabs: document.querySelectorAll(".tab-content"),
        
        // Active Profile Displays
        currentProfileName: document.getElementById("currentProfileName"),
        currentProfileStats: document.getElementById("currentProfileStats"),

        // Configuration Form
        setupForm: document.getElementById("setupForm"),
        modeSelect: document.getElementById("modeSelect"),
        tablesConfig: document.getElementById("tablesConfig"),
        presetBtns: document.querySelectorAll(".preset-btn"),
        tableStart: document.getElementById("tableStart"),
        tableEnd: document.getElementById("tableEnd"),
        timerSelect: document.getElementById("timerSelect"),
        startWorkoutBtn: document.getElementById("startWorkoutBtn"),

        // Active Arena
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

        // Analytics
        resetStatsBtn: document.getElementById("resetStatsBtn"),

        // Summary Modal
        summaryModal: document.getElementById("summaryModal"),
        modalCorrect: document.getElementById("modalCorrect"),
        modalTotal: document.getElementById("modalTotal"),
        modalAccuracy: document.getElementById("modalAccuracy"),
        closeModalBtn: document.getElementById("closeModalBtn"),
        
        // Prompt Card wrapper
        promptCard: document.querySelector(".prompt-card"),

        // Visual Answer Display Elements
        visualAnswerContainer: document.getElementById("visualAnswerContainer"),
        visualAnswerPlaceholder: document.getElementById("visualAnswerPlaceholder"),
        visualAnswerText: document.getElementById("visualAnswerText"),

        // Question Bank UI Elements
        qbankCloudNotice: document.getElementById("qbankCloudNotice"),
        qbankMainContent: document.getElementById("qbankMainContent"),
        qbankAddDiscipline: document.getElementById("qbankAddDiscipline"),
        qbankAddTopic: document.getElementById("qbankAddTopic"),
        qbankAddQuestion: document.getElementById("qbankAddQuestion"),
        qbankAddAnswer: document.getElementById("qbankAddAnswer"),
        qbankAddNotes: document.getElementById("qbankAddNotes"),
        qbankAddSubmitBtn: document.getElementById("qbankAddSubmitBtn"),
        qbankFilterAll: document.getElementById("qbankFilterAll"),
        qbankFilterStuck: document.getElementById("qbankFilterStuck"),
        qbankFilterMastered: document.getElementById("qbankFilterMastered"),
        qbankListContainer: document.getElementById("qbankListContainer")
    };
}

function updateVisualAnswer() {
    if (!elements.visualAnswerText || !elements.visualAnswerPlaceholder) return;
    const val = elements.answerInput.value;
    elements.visualAnswerText.textContent = val;
    if (val.length > 0) {
        elements.visualAnswerPlaceholder.style.display = "none";
    } else {
        elements.visualAnswerPlaceholder.style.display = "inline";
    }
}

function onWorkoutStart() {
    document.body.classList.add("workout-running");
    elements.answerInput.classList.add("hidden-capture-input");
    updateVisualAnswer();
}

function onWorkoutEnd() {
    document.body.classList.remove("workout-running");
    elements.answerInput.classList.remove("hidden-capture-input");
    updateVisualAnswer();
}

// Bind tabs switching navigation
function setupNavigation() {
    elements.navBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            const tabId = btn.getAttribute("data-tab");
            
            // Prevent leaving tab if workout is actively running
            if (state.currentWorkout.isActive) {
                alert("Please complete or stop the current workout run before changing tabs.");
                return;
            }
            
            elements.navBtns.forEach(b => b.classList.remove("active"));
            elements.tabs.forEach(t => t.classList.remove("active"));
            
            btn.classList.add("active");
            document.getElementById(`tab-${tabId}`).classList.add("active");
            
            state.currentTab = tabId;
            
            if (tabId === "analytics") {
                renderAnalyticsView();
            } else if (tabId === "accounts") {
                refreshProfilesList(onActiveProfileChanged);
            } else if (tabId === "learning") {
                renderLearningHubState();
            } else if (tabId === "dashboard") {
                renderDashboardView();
            } else if (tabId === "qbank") {
                renderQBankView();
            }
        });
    });
}

// Update text in top profile card widget
function updateProfileCardWidget() {
    const profile = getActiveProfile();
    if (!profile) return;
    
    elements.currentProfileName.textContent = profile.name;
    
    if (profile.all_time_total > 0) {
        const accuracy = Math.round((profile.all_time_correct / profile.all_time_total) * 100);
        elements.currentProfileStats.textContent = `Accuracy: ${accuracy}% (${profile.all_time_correct}/${profile.all_time_total})`;
    } else {
        elements.currentProfileStats.textContent = `No sessions yet`;
    }
}

// Triggered when user loads/deletes profiles
function onActiveProfileChanged() {
    updateProfileCardWidget();
    renderAnalyticsView();
    if (state.currentTab === "learning") {
        renderLearningHubState();
    } else if (state.currentTab === "dashboard" || !state.currentTab) {
        renderDashboardView();
    }
    
    // Auto-sync profile to cloud if authenticated
    if (supabase && state.supabaseUser) {
        syncActiveProfileToCloud();
    }
}

// Setup configuration settings handlers
function setupWorkoutConfig() {
    const customConfig = document.getElementById("customWorkoutConfig");
    
    elements.modeSelect.addEventListener("change", (e) => {
        const mode = e.target.value;
        if (mode === "tables") {
            elements.tablesConfig.style.display = "block";
            if (customConfig) customConfig.style.display = "none";
        } else if (mode === "custom") {
            elements.tablesConfig.style.display = "none";
            if (customConfig) customConfig.style.display = "block";
        } else {
            elements.tablesConfig.style.display = "none";
            if (customConfig) customConfig.style.display = "none";
        }
        updateKeypadVisibility(mode);
    });

    // Preset Range shortcuts
    elements.presetBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            elements.presetBtns.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            
            const range = btn.getAttribute("data-range");
            const [start, end] = range.split("-").map(Number);
            
            elements.tableStart.value = start;
            elements.tableEnd.value = end;
        });
    });
    
    // Bounds inputs validation
    const rangeValidate = () => {
        elements.presetBtns.forEach(b => b.classList.remove("active"));
        
        let start = parseInt(elements.tableStart.value) || 1;
        let end = parseInt(elements.tableEnd.value) || 50;
        
        if (start < 1) start = 1;
        if (start > 50) start = 50;
        if (end < 1) end = 1;
        if (end > 50) end = 50;
        if (start > end) {
            let temp = start;
            start = end;
            end = temp;
        }
        
        elements.tableStart.value = start;
        elements.tableEnd.value = end;
        
        const match = `${start}-${end}`;
        elements.presetBtns.forEach(b => {
            if (b.getAttribute("data-range") === match) {
                b.classList.add("active");
            }
        });
    };
    
    elements.tableStart.addEventListener("change", rangeValidate);
    elements.tableEnd.addEventListener("change", rangeValidate);
    
    // Instant Submit Toggle Listener
    const instantSubmitToggle = document.getElementById("instantSubmitToggle");
    if (instantSubmitToggle) {
        instantSubmitToggle.addEventListener("click", () => {
            instantSubmit = !instantSubmit;
            instantSubmitToggle.classList.toggle("active", instantSubmit);
        });
    }
}

// Theme Switcher Widget Logic
function setupThemeSwitcher() {
    const themeSwitcher = document.getElementById("themeSwitcher");
    if (!themeSwitcher) return;
    
    const savedTheme = localStorage.getItem("trainer_theme") || "dark";
    applyTheme(savedTheme);
    
    themeSwitcher.querySelectorAll(".theme-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const theme = btn.getAttribute("data-theme");
            applyTheme(theme);
        });
    });
}

function applyTheme(theme) {
    const themeSwitcher = document.getElementById("themeSwitcher");
    if (themeSwitcher) {
        themeSwitcher.querySelectorAll(".theme-btn").forEach(btn => {
            if (btn.getAttribute("data-theme") === theme) {
                btn.classList.add("active");
            } else {
                btn.classList.remove("active");
            }
        });
    }
    
    // Switch CSS class on document body
    document.body.classList.remove("theme-light", "theme-dark", "theme-sepia", "theme-neon");
    document.body.classList.add(`theme-${theme}`);
    localStorage.setItem("trainer_theme", theme);
    
    // Redraw analytics chart if active to match theme colors
    if (state.currentTab === "analytics") {
        renderAnalyticsView();
    }
}

// Workout Action methods
function startWorkoutRun() {
    const workout = state.currentWorkout;
    workout.mode = elements.modeSelect.value;
    
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
        
        elements.startWorkoutBtn.disabled = true;
        elements.startWorkoutBtn.textContent = "Loading Questions...";
        
        supabase
            .from('question_bank')
            .select('*')
            .eq('user_id', state.supabaseUser.id)
            .eq('is_mastered', false)
            .then(({ data, error }) => {
                elements.startWorkoutBtn.disabled = false;
                elements.startWorkoutBtn.textContent = "Start Workout";
                if (error) {
                    alert("Failed to load question bank: " + error.message);
                } else {
                    workout.qbankPool = data || [];
                    if (workout.qbankPool.length === 0) {
                        alert("Your Question Bank is currently empty or all questions are mastered! Add some questions or make mistakes in other drills to populate it.");
                    } else {
                        // Start qbank drill
                        workout.isActive = true;
                        workout.duration = parseInt(elements.timerSelect.value) || 60;
                        workout.timeLeft = workout.duration;
                        workout.correct = 0;
                        workout.total = 0;
                        workout.sessionLog = [];
                        
                        elements.setupForm.style.display = "none";
                        elements.workoutArena.style.display = "flex";
                        elements.answerInput.disabled = false;
                        elements.submitBtn.disabled = false;
                        elements.answerInput.value = "";
                        onWorkoutStart();
                        elements.feedbackDisplay.textContent = "";
                        elements.feedbackDisplay.className = "feedback-msg";
                        elements.scoreDisplay.textContent = "SCORE: 0 / 0";
                        
                        tickTimerText();
                        promptNextQuestion();
                        
                        workout.timerInterval = setInterval(() => {
                            workout.timeLeft--;
                            tickTimerText();
                            if (workout.timeLeft <= 0) {
                                endWorkoutRun();
                            }
                        }, 1000);
                    }
                }
            });
        return; // Early return because Supabase fetch is asynchronous
    }
    
    // Check feature access based on feature flags
    if (workout.mode === "tables") {
        const startVal = parseInt(elements.tableStart.value) || 1;
        const endVal = parseInt(elements.tableEnd.value) || 50;
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

    workout.isActive = true;
    workout.duration = parseInt(elements.timerSelect.value) || 60;
    workout.timeLeft = workout.duration;
    workout.correct = 0;
    workout.total = 0;
    workout.sessionLog = []; // Reset question-by-question session log
    
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
    
    elements.setupForm.style.display = "none";
    elements.workoutArena.style.display = "flex";
    elements.answerInput.disabled = false;
    elements.submitBtn.disabled = false;
    elements.answerInput.value = "";
    onWorkoutStart();
    elements.feedbackDisplay.textContent = "";
    elements.feedbackDisplay.className = "feedback-msg";
    elements.scoreDisplay.textContent = "SCORE: 0 / 0";
    
    tickTimerText();
    promptNextQuestion();
    
    workout.timerInterval = setInterval(() => {
        workout.timeLeft--;
        tickTimerText();
        
        if (workout.timeLeft <= 0) {
            endWorkoutRun();
        }
    }, 1000);
}

function tickTimerText() {
    const mins = Math.floor(state.currentWorkout.timeLeft / 60);
    const secs = state.currentWorkout.timeLeft % 60;
    elements.timerDisplay.innerHTML = `<i class="fa-regular fa-clock"></i> ${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

let activeQuestionData = {};

function promptNextQuestion() {
    const workout = state.currentWorkout;
    elements.answerInput.value = "";
    updateVisualAnswer();
    
    let config = {
        tableStart: elements.tableStart.value,
        tableEnd: elements.tableEnd.value
    };
    
    if (workout.mode === "custom") {
        config = workout.customConfig;
    }
    
    activeQuestionData = generateQuestion(workout.mode, config);
    
    workout.currentQuestion = activeQuestionData.question;
    workout.currentAnswer = activeQuestionData.answer;
    
    elements.promptHint.textContent = activeQuestionData.hint;
    elements.promptQuestion.textContent = activeQuestionData.question;
    
    // Update virtual keypad dynamically in custom run
    if (workout.mode === "custom") {
        updateKeypadVisibility(activeQuestionData.generatedMode);
    } else {
        updateKeypadVisibility(workout.mode);
    }
    
    currentQuestionStartTime = Date.now();
    elements.answerInput.focus({ preventScroll: true });
}

function checkUserAnswer() {
    const workout = state.currentWorkout;
    if (!workout.isActive) return;
    
    const val = elements.answerInput.value.trim().toUpperCase();
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
        
        elements.feedbackDisplay.textContent = `✓ Correct! (${workout.currentQuestion} = ${workout.currentAnswer}) in ${timeTaken.toFixed(1)}s`;
        elements.feedbackDisplay.className = "feedback-msg correct";
    } else {
        elements.feedbackDisplay.textContent = `✗ Incorrect. Correct: ${workout.currentAnswer}`;
        elements.feedbackDisplay.className = "feedback-msg incorrect";
    }
    
    // Dopamine / Brutalist feedback pop animation
    if (elements.promptCard) {
        elements.promptCard.classList.remove("pop-correct", "pop-wrong");
        // Force DOM reflow to restart CSS animation
        void elements.promptCard.offsetWidth;
        elements.promptCard.classList.add(isCorrect ? "pop-correct" : "pop-wrong");
        setTimeout(() => {
            elements.promptCard.classList.remove("pop-correct", "pop-wrong");
        }, 300);
    }
    
    profile.all_time_total++;
    elements.scoreDisplay.textContent = `SCORE: ${workout.correct} / ${workout.total}`;
    
    saveStateToStorage();
    updateProfileCardWidget();
    promptNextQuestion();
}

function skipQuestion() {
    const workout = state.currentWorkout;
    if (!workout.isActive) return;
    
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
    
    elements.feedbackDisplay.textContent = `Skipped. Correct answer was: ${workout.currentAnswer}`;
    elements.feedbackDisplay.className = "feedback-msg skipped";
    elements.scoreDisplay.textContent = `SCORE: ${workout.correct} / ${workout.total}`;
    
    // Trigger wrong/shake animation on skip
    if (elements.promptCard) {
        elements.promptCard.classList.remove("pop-correct", "pop-wrong");
        void elements.promptCard.offsetWidth;
        elements.promptCard.classList.add("pop-wrong");
        setTimeout(() => {
            elements.promptCard.classList.remove("pop-correct", "pop-wrong");
        }, 300);
    }
    
    saveStateToStorage();
    updateProfileCardWidget();
    promptNextQuestion();
}

function endWorkoutRun() {
    stopWorkoutRun(false);
}

function stopWorkoutRun(interrupted = false) {
    const workout = state.currentWorkout;
    if (!workout.isActive) return;
    
    workout.isActive = false;
    clearInterval(workout.timerInterval);
    
    elements.workoutArena.style.display = "none";
    elements.setupForm.style.display = "block";
    elements.answerInput.disabled = true;
    elements.submitBtn.disabled = true;
    onWorkoutEnd();
    
    // Make sure keypad is set to configuration mode default state
    updateKeypadVisibility(elements.modeSelect.value);
    
    if (workout.total > 0 && !interrupted) {
        const acc = Math.round((workout.correct / workout.total) * 100);
        elements.modalCorrect.textContent = workout.correct;
        elements.modalTotal.textContent = workout.total;
        elements.modalAccuracy.textContent = `${acc}%`;
        elements.summaryModal.style.display = "flex";
        
        // Log drill session to Supabase
        const durationSec = workout.duration - workout.timeLeft;
        const config = workout.mode === "custom" ? workout.customConfig : { tableStart: elements.tableStart.value, tableEnd: elements.tableEnd.value };
        logDrillSession(workout.mode, durationSec, workout.correct, workout.total, workout.sessionLog, config);
        
        // Sync aggregate statistics to cloud
        if (supabase && state.supabaseUser) {
            syncActiveProfileToCloud();
        }
    }
    
    saveStateToStorage();
    updateProfileCardWidget();
}

// Learning Hub UI logic
function setupLearningHub() {
    const lTabBtns = document.querySelectorAll(".l-tab-btn");
    const lPanels = document.querySelectorAll(".learning-panel");
    const heatmapToggle = document.getElementById("heatmapToggle");
    const practiceTableBtn = document.getElementById("practiceTableBtn");

    // -- Font Size Controls --
    const fontSizes = { small: '12px', medium: '14px', large: '17px', xl: '20px' };
    const fontSizeBtnIds = { fontSizeSmall: 'small', fontSizeMedium: 'medium', fontSizeLarge: 'large', fontSizeXL: 'xl' };
    
    function applyHubFontSize(sizeKey) {
        document.documentElement.style.setProperty('--hub-font-size', fontSizes[sizeKey] || '14px');
        localStorage.setItem('hub_font_size', sizeKey);
        Object.keys(fontSizeBtnIds).forEach(id => {
            const btn = document.getElementById(id);
            if (btn) btn.classList.toggle('active', fontSizeBtnIds[id] === sizeKey);
        });
    }

    Object.keys(fontSizeBtnIds).forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.addEventListener('click', () => applyHubFontSize(fontSizeBtnIds[id]));
    });

    // -- Font Face Controls --
    const fontFaceSelect = document.getElementById('fontFaceSelect');
    function applyHubFontFace(face) {
        document.documentElement.style.setProperty('--hub-font-family', `'${face}', sans-serif`);
        localStorage.setItem('hub_font_face', face);
        if (fontFaceSelect) fontFaceSelect.value = face;
    }
    if (fontFaceSelect) {
        fontFaceSelect.addEventListener('change', (e) => applyHubFontFace(e.target.value));
    }

    // Restore saved preferences
    const savedSize = localStorage.getItem('hub_font_size') || 'medium';
    const savedFace = localStorage.getItem('hub_font_face') || 'Outfit';
    applyHubFontSize(savedSize);
    applyHubFontFace(savedFace);


    lTabBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            lTabBtns.forEach(b => b.classList.remove("active"));
            lPanels.forEach(p => p.classList.remove("active"));
            
            btn.classList.add("active");
            const panelId = `l-panel-${btn.getAttribute("data-l-tab")}`;
            document.getElementById(panelId).classList.add("active");
        });
    });
    
    // Status Heatmap toggle
    if (heatmapToggle) {
        heatmapToggle.addEventListener("click", () => {
            showHeatmap = !showHeatmap;
            heatmapToggle.classList.toggle("active", showHeatmap);
            renderTablesGrid();
            if (selectedTable !== null) {
                renderTableDetails(selectedTable);
            }
        });
    }
    
    // Practice Table button
    if (practiceTableBtn) {
        practiceTableBtn.addEventListener("click", () => {
            if (selectedTable === null) return;
            
            // Switch training mode
            elements.modeSelect.value = "tables";
            // Trigger change event to show range inputs
            const event = new Event('change');
            elements.modeSelect.dispatchEvent(event);
            
            // Set range
            elements.tableStart.value = selectedTable;
            elements.tableEnd.value = selectedTable;
            
            // Highlight All preset button bounds
            elements.presetBtns.forEach(b => b.classList.remove("active"));
            
            // Switch main navigation tab to Training
            elements.navBtns.forEach(b => {
                if (b.getAttribute("data-tab") === "training") {
                    b.click();
                }
            });
            
            // Start session immediately
            startWorkoutRun();
        });
    }
    
    // Build static reference lists
    buildSquaresTable();
    buildCubesTable();
}

// Render the 1 to 50 mathematical tables selection grid
function renderTablesGrid() {
    const grid = document.getElementById("tablesGrid");
    if (!grid) return;
    
    grid.innerHTML = "";
    const profile = getActiveProfile();
    
    for (let t = 1; t <= 50; t++) {
        const div = document.createElement("div");
        div.className = "table-cell-card";
        if (selectedTable === t) div.classList.add("active");
        div.innerHTML = `${t} <span>Table</span>`;
        
        // Evaluate overall heatmap state of this table
        if (showHeatmap && profile && profile.detailed_mistakes && profile.detailed_mistakes.tables) {
            const cellStatus = getTableHeatmapStatus(profile, t);
            if (cellStatus === "red") div.classList.add("heatmap-red");
            else if (cellStatus === "yellow") div.classList.add("heatmap-yellow");
            else if (cellStatus === "green") div.classList.add("heatmap-green");
        }
        
        div.addEventListener("click", () => {
            selectedTable = t;
            grid.querySelectorAll(".table-cell-card").forEach(c => c.classList.remove("active"));
            div.classList.add("active");
            renderTableDetails(t);
        });
        
        grid.appendChild(div);
    }
}

// Helper to determine aggregate heatmap state for a table card (Green, Yellow, Red)
function getTableHeatmapStatus(profile, tableNum) {
    let hasAttempts = false;
    let hasRed = false;
    let hasYellow = false;
    let hasGreen = false;
    
    for (let m = 1; m <= 10; m++) {
        const key = `${tableNum}*${m}`;
        const entry = profile.detailed_mistakes.tables[key];
        
        if (entry && entry.history && entry.history.length > 0) {
            hasAttempts = true;
            const last = entry.history[entry.history.length - 1];
            if (!last.isCorrect) {
                hasRed = true;
            } else {
                if (last.timeTaken >= 2.0) {
                    hasYellow = true;
                } else {
                    hasGreen = true;
                }
            }
        }
    }
    
    if (!hasAttempts) return "neutral";
    if (hasRed) return "red";
    if (hasYellow) return "yellow";
    if (hasGreen) return "green";
    return "neutral";
}

// Render the 10 rows for a selected table (multiples of 1 to 10)
function renderTableDetails(tableNum) {
    const title = document.getElementById("selectedTableTitle");
    const container = document.getElementById("tableRowsContainer");
    
    if (!title || !container) return;
    
    title.textContent = `Table of ${tableNum}`;
    container.innerHTML = "";
    
    const profile = getActiveProfile();
    
    for (let m = 1; m <= 10; m++) {
        const product = tableNum * m;
        const div = document.createElement("div");
        div.className = "table-row-item";
        
        let rowMeta = "";
        
        // Heatmap colors logic
        if (showHeatmap && profile && profile.detailed_mistakes && profile.detailed_mistakes.tables) {
            const key = `${tableNum}*${m}`;
            const entry = profile.detailed_mistakes.tables[key];
            
            if (entry && entry.history && entry.history.length > 0) {
                const last = entry.history[entry.history.length - 1];
                if (!last.isCorrect) {
                    div.classList.add("heatmap-red");
                    rowMeta = `<span class="table-row-meta text-danger">Wrong guess: "${last.userAnswer}"</span>`;
                } else {
                    if (last.timeTaken < 2.0) {
                        div.classList.add("heatmap-green");
                        rowMeta = `<span class="table-row-meta text-green-400">Mastered (${last.timeTaken.toFixed(1)}s)</span>`;
                    } else {
                        div.classList.add("heatmap-yellow");
                        rowMeta = `<span class="table-row-meta text-yellow-400">Slow (${last.timeTaken.toFixed(1)}s)</span>`;
                    }
                }
            }
        }
        
        div.innerHTML = `
            <span>${tableNum} × ${m} = <span class="table-row-val">${product}</span></span>
            ${rowMeta}
        `;
        container.appendChild(div);
    }
}

// Render squares table 1-30 dynamically
function buildSquaresTable() {
    const tbody = document.getElementById("squaresTableBody");
    if (!tbody) return;
    tbody.innerHTML = "";
    
    for (let i = 1; i <= 15; i++) {
        const j = i + 15;
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${i}</td>
            <td>${i * i}</td>
            <td>${j}</td>
            <td>${j * j}</td>
        `;
        tbody.appendChild(tr);
    }
}

// Render cubes table 1-20 dynamically
function buildCubesTable() {
    const tbody = document.getElementById("cubesTableBody");
    if (!tbody) return;
    tbody.innerHTML = "";
    
    for (let i = 1; i <= 10; i++) {
        const j = i + 10;
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${i}</td>
            <td>${i * i * i}</td>
            <td>${j}</td>
            <td>${j * j * j}</td>
        `;
        tbody.appendChild(tr);
    }
}

function renderLearningHubState() {
    renderTablesGrid();
    if (selectedTable !== null) {
        renderTableDetails(selectedTable);
    } else {
        selectedTable = 12; // Default select table 12 on start
        renderTablesGrid();
        renderTableDetails(12);
    }
}

// Render Dashboard Tab View
function renderDashboardView() {
    const profile = getActiveProfile();
    if (!profile) return;
    
    // Refresh daily counts and streak
    refreshActiveProfileDailyStats();
    
    // Update Greeting
    const dashWelcomeName = document.getElementById("dashWelcomeName");
    if (dashWelcomeName) dashWelcomeName.textContent = profile.name;
    
    const hours = new Date().getHours();
    let timeGreeting = "Good Morning";
    if (hours >= 12 && hours < 17) timeGreeting = "Good Afternoon";
    else if (hours >= 17) timeGreeting = "Good Evening";
    
    const greetingTextHeader = document.querySelector(".greeting-text h2");
    if (greetingTextHeader) {
        greetingTextHeader.innerHTML = `${timeGreeting}, <span id="dashWelcomeName">${profile.name}</span>! 👋`;
    }
    
    // Update Date
    const dashDateDisplay = document.getElementById("dashDateDisplay");
    if (dashDateDisplay) {
        const options = { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' };
        dashDateDisplay.textContent = new Date().toLocaleDateString('en-US', options);
    }
    
    // Accuracy
    const dashStatAccuracy = document.getElementById("dashStatAccuracy");
    const dashStatAccuracySub = document.getElementById("dashStatAccuracySub");
    if (dashStatAccuracy) {
        if (profile.all_time_total > 0) {
            const acc = Math.round((profile.all_time_correct / profile.all_time_total) * 100);
            dashStatAccuracy.textContent = `${acc}%`;
            if (dashStatAccuracySub) {
                dashStatAccuracySub.textContent = `${profile.all_time_correct} / ${profile.all_time_total} correct`;
            }
        } else {
            dashStatAccuracy.textContent = "0%";
            if (dashStatAccuracySub) dashStatAccuracySub.textContent = "0 / 0 correct";
        }
    }
    
    // Streak
    const dashStatStreak = document.getElementById("dashStatStreak");
    if (dashStatStreak) {
        dashStatStreak.textContent = profile.streak || 0;
    }
    
    // Today's Drills
    const dashStatToday = document.getElementById("dashStatToday");
    if (dashStatToday) {
        dashStatToday.textContent = profile.today_count || 0;
    }
    
    // All-time Drills
    const dashStatTotal = document.getElementById("dashStatTotal");
    if (dashStatTotal) {
        dashStatTotal.textContent = profile.all_time_total || 0;
    }
    
    // Mastered / Weak Zones Lists
    const dashStrongList = document.getElementById("dashStrongList");
    const dashWeakList = document.getElementById("dashWeakList");
    
    if (dashStrongList && dashWeakList) {
        dashStrongList.innerHTML = "";
        dashWeakList.innerHTML = "";
        
        let strongItems = [];
        let weakItems = [];
        
        // Scan tables
        for (let t = 1; t <= 50; t++) {
            const status = getTableHeatmapStatus(profile, t);
            if (status === "green") {
                strongItems.push(`Table ${t}`);
            } else if (status === "red") {
                weakItems.push(`Table ${t}`);
            }
        }
        
        // Scan alphabet
        if (profile.detailed_mistakes && profile.detailed_mistakes.alpha) {
            const modes = {
                alphaToNum: "Alpha ➔ Num",
                numToAlpha: "Num ➔ Alpha",
                alphaOpposite: "Opposite Letters"
            };
            
            for (const key in profile.detailed_mistakes.alpha) {
                const entry = profile.detailed_mistakes.alpha[key];
                if (entry.history && entry.history.length > 0) {
                    const last = entry.history[entry.history.length - 1];
                    const modeLabel = modes[entry.mode] || entry.mode;
                    const letterLabel = entry.letter;
                    if (last.isCorrect && last.timeTaken < 2) {
                        strongItems.push(`${modeLabel} (${letterLabel})`);
                    } else if (!last.isCorrect) {
                        weakItems.push(`${modeLabel} (${letterLabel})`);
                    }
                }
            }
        }
        
        // Render Strong Zones (limit to 4)
        if (strongItems.length > 0) {
            strongItems.slice(0, 4).forEach(item => {
                const div = document.createElement("div");
                div.className = "zone-item";
                div.textContent = `${item}`;
                dashStrongList.appendChild(div);
            });
        } else {
            dashStrongList.innerHTML = '<div class="zone-empty">No mastered zones yet. Keep practicing!</div>';
        }
        
        // Render Weak Zones (limit to 4)
        if (weakItems.length > 0) {
            weakItems.slice(0, 4).forEach(item => {
                const div = document.createElement("div");
                div.className = "zone-item text-danger";
                div.textContent = `${item}`;
                dashWeakList.appendChild(div);
            });
        } else {
            dashWeakList.innerHTML = '<div class="zone-empty">No high error zones detected!</div>';
        }
    }
}

function initApplication() {
    loadStateFromStorage();
    mapElements();
    
    // Set default tab to dashboard
    state.currentTab = "dashboard";
    
    setupNavigation();
    setupWorkoutConfig();
    updateProfileCardWidget();
    
    // Check active cloud session on startup
    if (supabase) {
        fetchFeatureFlags(); // Load and cache feature flags on startup
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session && session.user) {
                state.supabaseUser = session.user;
                state.supabaseSession = session;
                window.dispatchEvent(new CustomEvent('cloud-sync-changed', {
                    detail: { status: 'synced', user: session.user }
                }));
                loadActiveProfileFromCloud().then(() => {
                    onActiveProfileChanged();
                });
            }
        });
        
        supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN' && session) {
                state.supabaseUser = session.user;
                state.supabaseSession = session;
                window.dispatchEvent(new CustomEvent('cloud-sync-changed', {
                    detail: { status: 'synced', user: session.user }
                }));
                fetchFeatureFlags(); // Re-fetch features on sign in to update custom tiers
                loadActiveProfileFromCloud().then(() => {
                    onActiveProfileChanged();
                });
            } else if (event === 'SIGNED_OUT') {
                state.supabaseUser = null;
                state.supabaseSession = null;
                window.dispatchEvent(new CustomEvent('cloud-sync-changed', {
                    detail: { status: 'disconnected', user: null }
                }));
            }
        });
    }
    
    // Wire submodules controllers
    initializeKeypad(elements.answerInput, checkUserAnswer);
    initializeAnalyticsDashboard();
    initializeProfilesManager(onActiveProfileChanged);
    
    // Setup theme switcher and Learning Hub
    setupThemeSwitcher();
    setupLearningHub();
    setupCloudSyncUI();
    setupQBankHandlers();
    
    // Set default keypad layout
    updateKeypadVisibility(elements.modeSelect.value);
    
    // Initial rendering of dashboard
    renderDashboardView();
    
    // Bind main action buttons
    elements.startWorkoutBtn.addEventListener("click", () => startWorkoutRun());
    elements.stopWorkoutBtn.addEventListener("click", () => stopWorkoutRun(true));
    elements.skipBtn.addEventListener("click", skipQuestion);
    elements.submitBtn.addEventListener("click", checkUserAnswer);
    elements.answerInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") checkUserAnswer();
    });
    
    // Visual answer container focus click behavior
    if (elements.visualAnswerContainer) {
        elements.visualAnswerContainer.addEventListener("click", () => {
            if (state.currentWorkout.isActive) {
                elements.answerInput.focus({ preventScroll: true });
            }
        });
    }
    
    elements.answerInput.addEventListener("focus", () => {
        if (elements.visualAnswerContainer) {
            elements.visualAnswerContainer.classList.add("focused");
        }
    });
    
    elements.answerInput.addEventListener("blur", () => {
        if (elements.visualAnswerContainer) {
            elements.visualAnswerContainer.classList.remove("focused");
        }
    });
    
    // Instant Submit input checker listener
    elements.answerInput.addEventListener("input", () => {
        updateVisualAnswer();
        if (instantSubmit && state.currentWorkout.isActive) {
            const val = elements.answerInput.value.trim().toUpperCase();
            const answer = state.currentWorkout.currentAnswer.toUpperCase();
            if (val.length >= answer.length) {
                checkUserAnswer();
            }
        }
    });
    
    elements.closeModalBtn.addEventListener("click", () => {
        elements.summaryModal.style.display = "none";
    });
    
    elements.resetStatsBtn.addEventListener("click", () => {
        const wipe = confirm("Wipe all performance stats and mistakes for this profile permanently?");
        if (wipe) {
            resetActiveProfileStats();
            onActiveProfileChanged();
        }
    });
    
    // Setup Dashboard action button routing
    const dashStartCombined = document.getElementById("dashActionStartCombined");
    const dashTables = document.getElementById("dashActionTables");
    const dashAlpha = document.getElementById("dashActionAlpha");
    
    if (dashStartCombined) {
        dashStartCombined.addEventListener("click", () => {
            const trainingNavBtn = document.querySelector('.nav-btn[data-tab="training"]');
            if (trainingNavBtn) {
                // Switch mode select to custom combined
                elements.modeSelect.value = "custom";
                // Trigger change to update config layout
                const event = new Event('change');
                elements.modeSelect.dispatchEvent(event);
                
                trainingNavBtn.click();
            }
        });
    }
    
    if (dashTables) {
        dashTables.addEventListener("click", () => {
            const learningNavBtn = document.querySelector('.nav-btn[data-tab="learning"]');
            if (learningNavBtn) {
                learningNavBtn.click();
                // Select math tables sub-tab
                const tablesSubTabBtn = document.querySelector('.l-tab-btn[data-l-tab="math-tables"]');
                if (tablesSubTabBtn) tablesSubTabBtn.click();
            }
        });
    }
    
    if (dashAlpha) {
        dashAlpha.addEventListener("click", () => {
            const learningNavBtn = document.querySelector('.nav-btn[data-tab="learning"]');
            if (learningNavBtn) {
                learningNavBtn.click();
                // Select alpha sub-tab
                const alphaSubTabBtn = document.querySelector('.l-tab-btn[data-l-tab="alpha-mnemonics"]');
                if (alphaSubTabBtn) alphaSubTabBtn.click();
            }
        });
    }
}

// Supabase Cloud Sync UI binding and management
function setupCloudSyncUI() {
    const emailInput = document.getElementById("cloudEmail");
    const passwordInput = document.getElementById("cloudPassword");
    const signInBtn = document.getElementById("cloudSignInBtn");
    const signUpBtn = document.getElementById("cloudSignUpBtn");
    const signOutBtn = document.getElementById("cloudSignOutBtn");
    const syncBtn = document.getElementById("cloudSyncBtn");
    
    const authForm = document.getElementById("cloudAuthForm");
    const userDetails = document.getElementById("cloudUserDetails");
    const userEmailDisplay = document.getElementById("cloudUserEmail");
    const statusBadge = document.getElementById("cloudStatusBadge");
    
    if (!supabase) {
        if (statusBadge) {
            statusBadge.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Offline Mode`;
            statusBadge.className = "cloud-badge warning";
        }
        if (authForm) authForm.style.display = "none";
        return;
    }
    
    // Wire click events
    if (signInBtn) {
        signInBtn.addEventListener("click", async () => {
            const email = emailInput.value.trim();
            const password = passwordInput.value;
            if (!email || !password) {
                alert("Please enter both email and password.");
                return;
            }
            signInBtn.disabled = true;
            signInBtn.textContent = "Signing In...";
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            signInBtn.disabled = false;
            signInBtn.textContent = "Sign In";
            if (error) {
                alert("Sign In failed: " + error.message);
            } else {
                emailInput.value = "";
                passwordInput.value = "";
                await loadActiveProfileFromCloud();
                onActiveProfileChanged();
            }
        });
    }
    
    if (signUpBtn) {
        signUpBtn.addEventListener("click", async () => {
            const email = emailInput.value.trim();
            const password = passwordInput.value;
            if (!email || !password) {
                alert("Please enter both email and password.");
                return;
            }
            signUpBtn.disabled = true;
            signUpBtn.textContent = "Signing Up...";
            const { error } = await supabase.auth.signUp({ email, password });
            signUpBtn.disabled = false;
            signUpBtn.textContent = "Sign Up";
            if (error) {
                alert("Sign Up failed: " + error.message);
            } else {
                alert("Sign Up successful! If email confirmation is enabled, check your email. Otherwise, you can now log in.");
                emailInput.value = "";
                passwordInput.value = "";
            }
        });
    }
    
    if (signOutBtn) {
        signOutBtn.addEventListener("click", async () => {
            signOutBtn.disabled = true;
            const { error } = await supabase.auth.signOut();
            signOutBtn.disabled = false;
            if (error) {
                alert("Sign Out failed: " + error.message);
            } else {
                state.supabaseUser = null;
                window.dispatchEvent(new CustomEvent('cloud-sync-changed', {
                    detail: { status: 'disconnected', user: null }
                }));
                alert("Logged out successfully.");
            }
        });
    }
    
    if (syncBtn) {
        syncBtn.addEventListener("click", async () => {
            syncBtn.disabled = true;
            syncBtn.innerHTML = `<i class="fa-solid fa-rotate spin"></i> Syncing...`;
            await syncActiveProfileToCloud();
            syncBtn.disabled = false;
            syncBtn.innerHTML = `<i class="fa-solid fa-rotate"></i> Sync Now`;
        });
    }
    
    // Status event handler
    window.addEventListener('cloud-sync-changed', (e) => {
        const { status, user } = e.detail;
        
        if (user) {
            if (authForm) authForm.style.display = "none";
            if (userDetails) userDetails.style.display = "block";
            if (userEmailDisplay) userEmailDisplay.textContent = user.email;
            
            if (statusBadge) {
                if (status === 'syncing') {
                    statusBadge.innerHTML = `<i class="fa-solid fa-rotate spin"></i> Syncing...`;
                    statusBadge.className = "cloud-badge active";
                } else if (status === 'synced') {
                    statusBadge.innerHTML = `<i class="fa-solid fa-circle-check"></i> Synced to Cloud`;
                    statusBadge.className = "cloud-badge success";
                } else if (status === 'error') {
                    statusBadge.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Sync Error`;
                    statusBadge.className = "cloud-badge danger";
                }
            }
        } else {
            if (authForm) authForm.style.display = "block";
            if (userDetails) userDetails.style.display = "none";
            if (statusBadge) {
                statusBadge.innerHTML = `<i class="fa-solid fa-circle-nodes"></i> Ready to Connect`;
                statusBadge.className = "cloud-badge";
            }
        }
    });
}

// ==========================================
// Question Bank UI & Logic Handlers
// ==========================================

let qbankCachedList = [];
let qbankFilterState = "all";

function setupQBankHandlers() {
    if (!elements.qbankAddDiscipline) return;
    
    // Topic dropdown sync
    elements.qbankAddDiscipline.addEventListener("change", (e) => {
        const disc = e.target.value;
        elements.qbankAddTopic.innerHTML = "";
        if (disc === "tables") {
            elements.qbankAddTopic.innerHTML = `<option value="multiplication">Multiplication Equation</option>`;
        } else {
            elements.qbankAddTopic.innerHTML = `
                <option value="alphaToNum">Alphabet ➔ Number</option>
                <option value="numToAlpha">Number ➔ Alphabet</option>
                <option value="alphaOpposite">Opposite Letters</option>
            `;
        }
    });

    // Form submit action
    elements.qbankAddSubmitBtn.addEventListener("click", async () => {
        const disc = elements.qbankAddDiscipline.value;
        const topic = elements.qbankAddTopic.value;
        const question = elements.qbankAddQuestion.value.trim();
        const answer = elements.qbankAddAnswer.value.trim();
        const notes = elements.qbankAddNotes.value.trim();
        
        if (!question || !answer) {
            alert("Please enter both the Question and Correct Answer.");
            return;
        }
        
        elements.qbankAddSubmitBtn.disabled = true;
        elements.qbankAddSubmitBtn.textContent = "Saving...";
        
        try {
            await addManualQuestion(disc, topic, question, answer, notes);
            elements.qbankAddQuestion.value = "";
            elements.qbankAddAnswer.value = "";
            elements.qbankAddNotes.value = "";
            alert("Question successfully saved to your bank!");
            await renderQBankView();
        } catch (err) {
            alert("Failed to save question: " + err.message);
        } finally {
            elements.qbankAddSubmitBtn.disabled = false;
            elements.qbankAddSubmitBtn.textContent = "Save to Question Bank";
        }
    });

    // Filter tabs
    const setFilter = (filter) => {
        qbankFilterState = filter;
        [elements.qbankFilterAll, elements.qbankFilterStuck, elements.qbankFilterMastered].forEach(btn => {
            if (btn) btn.classList.remove("active");
        });
        if (filter === "all" && elements.qbankFilterAll) elements.qbankFilterAll.classList.add("active");
        if (filter === "stuck" && elements.qbankFilterStuck) elements.qbankFilterStuck.classList.add("active");
        if (filter === "mastered" && elements.qbankFilterMastered) elements.qbankFilterMastered.classList.add("active");
        
        displayQBankList();
    };
    
    if (elements.qbankFilterAll) elements.qbankFilterAll.addEventListener("click", () => setFilter("all"));
    if (elements.qbankFilterStuck) elements.qbankFilterStuck.addEventListener("click", () => setFilter("stuck"));
    if (elements.qbankFilterMastered) elements.qbankFilterMastered.addEventListener("click", () => setFilter("mastered"));
}

export async function renderQBankView() {
    if (!elements.qbankCloudNotice || !elements.qbankMainContent) return;
    
    if (!supabase || !state.supabaseUser) {
        elements.qbankCloudNotice.style.display = "block";
        elements.qbankMainContent.style.display = "none";
        return;
    }
    
    elements.qbankCloudNotice.style.display = "none";
    elements.qbankMainContent.style.display = "grid";
    
    elements.qbankListContainer.innerHTML = `
        <div class="empty-state">
            <i class="fa-solid fa-rotate spin"></i> Loading your saved questions...
        </div>
    `;
    
    qbankCachedList = await getQuestionBank();
    displayQBankList();
}

function displayQBankList() {
    const container = elements.qbankListContainer;
    if (!container) return;
    container.innerHTML = "";
    
    const filtered = qbankCachedList.filter(q => {
        if (qbankFilterState === "stuck") return !q.is_mastered;
        if (qbankFilterState === "mastered") return q.is_mastered;
        return true;
    });
    
    if (filtered.length === 0) {
        container.innerHTML = `<div class="empty-state">No questions found matching filter.</div>`;
        return;
    }
    
    filtered.forEach(q => {
        const card = document.createElement("div");
        card.className = "card";
        card.style.borderWidth = "2px";
        card.style.borderColor = "var(--border)";
        card.style.marginBottom = "10px";
        card.style.padding = "15px";
        card.style.display = "flex";
        card.style.flexDirection = "column";
        card.style.gap = "8px";
        card.style.position = "relative";
        
        const tagClass = q.source === "auto_capture" ? "cloud-badge active" : "cloud-badge success";
        const sourceLabel = q.source === "auto_capture" ? "Auto-Captured" : "Manual Entry";
        
        const statusClass = q.is_mastered ? "cloud-badge success" : "cloud-badge danger";
        const statusLabel = q.is_mastered ? "Mastered" : "Stuck";
        
        const accuracy = q.times_shown > 0 ? Math.round((q.times_correct / q.times_shown) * 100) : 0;
        
        card.innerHTML = `
            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                <span class="${tagClass}" style="margin:0; font-size:8px; padding:2px 6px;">${sourceLabel}</span>
                <span class="${statusClass}" style="margin:0; font-size:8px; padding:2px 6px;">${statusLabel}</span>
            </div>
            <div style="font-family: 'Space Grotesk', sans-serif; font-size: 14px; font-weight: 700; color: var(--text-main); margin-top: 5px;">
                Question: <span style="font-family: 'JetBrains Mono', monospace; font-weight: 500; font-size:13px; background: var(--bg-dark); padding: 2px 6px; border-radius: 4px; border: 1px solid var(--border);">${q.question_text}</span>
            </div>
            <div style="font-family: 'Space Grotesk', sans-serif; font-size: 14px; font-weight: 700; color: var(--text-main);">
                Answer: <span style="font-family: 'JetBrains Mono', monospace; font-weight: 500; font-size:13px; color: var(--success);">${q.correct_answer}</span>
            </div>
            ${q.notes ? `<div style="font-size:11px; color: var(--text-muted); background: var(--bg-dark); padding: 8px; border-radius:4px; border: 1px solid var(--border); font-style: italic;">"${q.notes}"</div>` : ''}
            <div style="font-size: 11px; color: var(--text-muted); display:flex; justify-content: space-between; align-items: center; margin-top: 5px;">
                <span>Accuracy: ${accuracy}% (Shown ${q.times_shown} times)</span>
                <button class="btn btn-danger btn-small delete-qbank-btn" data-id="${q.id}" style="padding: 4px 8px; font-size: 11px; display:inline-flex; align-items:center; gap:4px; position:absolute; bottom: 12px; right: 12px;">
                    <i class="fa-solid fa-trash"></i> Delete
                </button>
            </div>
        `;
        
        // Bind delete action
        const deleteBtn = card.querySelector(".delete-qbank-btn");
        if (deleteBtn) {
            deleteBtn.addEventListener("click", async () => {
                const wipe = confirm("Remove this question from your Question Bank permanently?");
                if (wipe) {
                    deleteBtn.disabled = true;
                    deleteBtn.innerHTML = `<i class="fa-solid fa-rotate spin"></i> Removing...`;
                    try {
                        await deleteQuestionFromBank(q.id);
                        qbankCachedList = qbankCachedList.filter(item => item.id !== q.id);
                        displayQBankList();
                    } catch (err) {
                        alert("Failed to delete question: " + err.message);
                    }
                }
            });
        }
        
        container.appendChild(card);
    });
}

// Run initializer — guard against double-invocation
let _appInitialized = false;
function safeInit() {
    if (_appInitialized) return;
    _appInitialized = true;
    initApplication();
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", safeInit);
} else {
    safeInit();
}
export { initApplication };
