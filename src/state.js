// State Management Module

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

// Centralized state container
export const state = {
    profiles: {},
    activeProfileId: "guest",
    currentWorkout: {
        isActive: false,
        mode: "alphaToNum",
        duration: 60,
        timeLeft: 0,
        timerInterval: null,
        correct: 0,
        total: 0,
        currentQuestion: "",
        currentAnswer: "",
        currentLetter: null,
        currentTable: null,
        currentMultiplier: null
    },
    analytics: {
        activeSubTab: "alpha"
    }
};

// Load profiles from browser local storage
export function loadStateFromStorage() {
    const saved = localStorage.getItem("trainer_profiles");
    const activeId = localStorage.getItem("trainer_active_profile");
    
    if (saved) {
        try {
            state.profiles = JSON.parse(saved);
        } catch (e) {
            console.error("Failed to parse saved profiles, resetting storage.", e);
            state.profiles = {};
        }
    }
    
    // Create default profile if none exists
    if (Object.keys(state.profiles).length === 0) {
        createProfile("Guest Ninja", "guest");
    }
    
    // Ensure all profiles have detailed mistakes tracking and daily stats
    for (const pid in state.profiles) {
        if (!state.profiles[pid].detailed_mistakes) {
            state.profiles[pid].detailed_mistakes = { tables: {}, alpha: {} };
        }
        if (!state.profiles[pid].detailed_mistakes.tables) {
            state.profiles[pid].detailed_mistakes.tables = {};
        }
        if (!state.profiles[pid].detailed_mistakes.alpha) {
            state.profiles[pid].detailed_mistakes.alpha = {};
        }
        if (state.profiles[pid].streak === undefined) {
            state.profiles[pid].streak = 0;
        }
        if (state.profiles[pid].today_count === undefined) {
            state.profiles[pid].today_count = 0;
        }
        if (state.profiles[pid].last_active_date === undefined) {
            state.profiles[pid].last_active_date = "";
        }
    }

    // Set active profile
    if (activeId && state.profiles[activeId]) {
        state.activeProfileId = activeId;
    } else {
        state.activeProfileId = Object.keys(state.profiles)[0];
    }
}

// Save profiles to browser local storage
export function saveStateToStorage() {
    localStorage.setItem("trainer_profiles", JSON.stringify(state.profiles));
    localStorage.setItem("trainer_active_profile", state.activeProfileId);
}

// Create a new user profile
export function createProfile(name, customId = null) {
    const profileId = customId || "user_" + Date.now();
    
    const wrong_counts = {};
    for (let i = 0; i < ALPHABET.length; i++) {
        wrong_counts[ALPHABET[i]] = 0;
    }
    
    const table_wrong_counts = {};
    for (let t = 1; t <= 50; t++) {
        table_wrong_counts[`Table ${t}`] = 0;
    }
    
    state.profiles[profileId] = {
        name: name,
        all_time_correct: 0,
        all_time_total: 0,
        wrong_counts: wrong_counts,
        table_wrong_counts: table_wrong_counts,
        detailed_mistakes: { tables: {}, alpha: {} },
        streak: 0,
        today_count: 0,
        last_active_date: ""
    };
    
    saveStateToStorage();
    return profileId;
}

// Delete user profile
export function deleteProfile(id) {
    if (Object.keys(state.profiles).length <= 1) {
        return false; // Cannot delete last profile
    }
    
    delete state.profiles[id];
    
    // Reassign active profile if the active one was deleted
    if (state.activeProfileId === id) {
        state.activeProfileId = Object.keys(state.profiles)[0];
    }
    
    saveStateToStorage();
    return true;
}

// Get reference to the currently active profile
export function getActiveProfile() {
    return state.profiles[state.activeProfileId];
}

// Reset stats for the active profile
export function resetActiveProfileStats() {
    const profile = getActiveProfile();
    if (!profile) return;
    
    profile.all_time_correct = 0;
    profile.all_time_total = 0;
    
    for (let i = 0; i < ALPHABET.length; i++) {
        profile.wrong_counts[ALPHABET[i]] = 0;
    }
    
    for (let t = 1; t <= 50; t++) {
        profile.table_wrong_counts[`Table ${t}`] = 0;
    }
    profile.detailed_mistakes = { tables: {}, alpha: {} };
    profile.streak = 0;
    profile.today_count = 0;
    profile.last_active_date = "";
    
    saveStateToStorage();
}

// Refresh active profile's streak/daily stats based on current date
export function refreshActiveProfileDailyStats() {
    const profile = getActiveProfile();
    if (!profile) return;
    
    const todayStr = new Date().toDateString();
    if (profile.last_active_date !== todayStr) {
        if (profile.last_active_date) {
            const lastDate = new Date(profile.last_active_date);
            const currentDate = new Date(todayStr);
            const diffTime = currentDate - lastDate;
            const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
            
            if (diffDays === 1) {
                profile.streak = (profile.streak || 0) + 1;
            } else if (diffDays > 1) {
                profile.streak = 1;
            }
        } else {
            profile.streak = 1;
        }
        profile.today_count = 0;
        profile.last_active_date = todayStr;
        saveStateToStorage();
    }
}

