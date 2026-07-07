// State Management Module
import { supabase } from './supabaseClient.js';

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

// Centralized state container
export const state = {
    profiles: {},
    activeProfileId: "guest",
    supabaseUser: null,
    cloudSyncStatus: 'disconnected',
    featureFlags: [],        // Cached feature_flags rows from Supabase
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
        currentMultiplier: null,
        sessionLog: []       // Per-question log for this workout
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
// NOTE: Does NOT trigger cloud sync — sync happens only at workout end
// to avoid 60+ API calls during a single drill session.
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

// ==========================================
// Supabase Cloud Syncing Logic
// ==========================================

export async function syncActiveProfileToCloud() {
    if (!supabase) return;
    
    // Retrieve current session/user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        state.supabaseUser = null;
        state.cloudSyncStatus = 'disconnected';
        dispatchSyncEvent();
        return;
    }
    
    state.supabaseUser = user;
    state.cloudSyncStatus = 'syncing';
    dispatchSyncEvent();
    
    const profile = getActiveProfile();
    if (!profile) return;
    
    try {
        const { error } = await supabase
            .from('profiles')
            .upsert({
                user_id: user.id,
                display_name: profile.name,
                all_time_correct: profile.all_time_correct,
                all_time_total: profile.all_time_total,
                streak: profile.streak || 0,
                today_count: profile.today_count || 0,
                last_active_date: profile.last_active_date || '',
                wrong_counts: profile.wrong_counts || {},
                table_wrong_counts: profile.table_wrong_counts || {},
                detailed_mistakes: profile.detailed_mistakes || { tables: {}, alpha: {} },
                discipline_metrics: profile.discipline_metrics || {},
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id' });
            
        if (error) throw error;
        state.cloudSyncStatus = 'synced';
    } catch (err) {
        console.error("Cloud sync failed:", err);
        state.cloudSyncStatus = 'error';
    }
    dispatchSyncEvent();
}

export async function loadActiveProfileFromCloud() {
    if (!supabase) return;
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    state.supabaseUser = user;
    state.cloudSyncStatus = 'syncing';
    dispatchSyncEvent();
    
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', user.id)
            .maybeSingle();
            
        if (error) throw error;
        
        if (data) {
            const profileId = user.id;
            state.profiles[profileId] = {
                name: data.display_name,
                all_time_correct: data.all_time_correct,
                all_time_total: data.all_time_total,
                streak: data.streak,
                today_count: data.today_count,
                last_active_date: data.last_active_date,
                wrong_counts: data.wrong_counts,
                table_wrong_counts: data.table_wrong_counts,
                detailed_mistakes: data.detailed_mistakes
            };
            state.activeProfileId = profileId;
            localStorage.setItem("trainer_active_profile", profileId);
            
            // Bypass saveStateToStorage to avoid loop
            localStorage.setItem("trainer_profiles", JSON.stringify(state.profiles));
            state.cloudSyncStatus = 'synced';
        } else {
            // First time cloud user: sync their currently active local profile to create the row
            await syncActiveProfileToCloud();
        }
    } catch (err) {
        console.error("Failed to load profile from cloud:", err);
        state.cloudSyncStatus = 'error';
    }
    dispatchSyncEvent();
}

function dispatchSyncEvent() {
    const event = new CustomEvent('cloud-sync-changed', {
        detail: {
            status: state.cloudSyncStatus,
            user: state.supabaseUser
        }
    });
    window.dispatchEvent(event);
}

// ==========================================
// Drill Session Logging
// ==========================================

export async function logDrillSession(mode, durationSec, correct, total, sessionLog, config) {
    if (!supabase) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const accuracy = total > 0 ? parseFloat(((correct / total) * 100).toFixed(2)) : 0;

    try {
        const { error } = await supabase
            .from('drill_sessions')
            .insert({
                user_id: user.id,
                mode: mode,
                duration_sec: durationSec,
                correct: correct,
                total: total,
                accuracy: accuracy,
                session_log: sessionLog || [],
                config: config || {}
            });
        if (error) throw error;
        console.log('Drill session logged to cloud.');
    } catch (err) {
        console.error('Failed to log drill session:', err);
    }
}

// ==========================================
// Feature Flags (Dynamic Paid/Free Gating)
// ==========================================

export async function fetchFeatureFlags() {
    if (!supabase) return;

    try {
        const { data, error } = await supabase
            .from('feature_flags')
            .select('feature_key, is_free, display_name, category');
        if (error) throw error;
        state.featureFlags = data || [];
        console.log(`Loaded ${state.featureFlags.length} feature flags.`);
    } catch (err) {
        console.error('Failed to fetch feature flags:', err);
        state.featureFlags = [];
    }
}

/**
 * Check if the current user can access a feature.
 * Returns true if:
 *   - The feature key is unknown (unregistered features are allowed by default)
 *   - The feature is marked is_free=true
 *   - The user is a paid subscriber (is_paid on their profile)
 */
export function canAccess(featureKey) {
    const flag = state.featureFlags.find(f => f.feature_key === featureKey);
    if (!flag) return true;          // Unknown feature = allowed
    if (flag.is_free) return true;   // Free for everyone

    // Check if current user is paid
    const profile = getActiveProfile();
    if (profile && profile.is_paid) return true;

    return false;
}

// ==========================================
// Question Bank Auto-Capture
// ==========================================

export async function autoCaptureToBankIfFailed(mode, questionData, userAnswer) {
    if (!supabase) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    let discipline = 'tables';
    let topic = 'multiplication';
    let questionText = questionData.question;
    let correctAnswer = questionData.answer;

    if (mode !== 'tables') {
        discipline = 'alpha';
        topic = mode; // alphaToNum, numToAlpha, alphaOpposite
    }

    try {
        // Check if this exact question already exists for this user
        const { data: existing } = await supabase
            .from('question_bank')
            .select('id, times_shown')
            .eq('user_id', user.id)
            .eq('question_text', questionText)
            .maybeSingle();

        if (existing) {
            // Increment times_shown instead of inserting a duplicate
            await supabase
                .from('question_bank')
                .update({ times_shown: existing.times_shown + 1, last_shown_at: new Date().toISOString() })
                .eq('id', existing.id);
        } else {
            await supabase
                .from('question_bank')
                .insert({
                    user_id: user.id,
                    source: 'auto_capture',
                    discipline: discipline,
                    topic: topic,
                    question_text: questionText,
                    correct_answer: correctAnswer,
                    user_answer: userAnswer,
                    drill_metadata: {
                        mode: mode,
                        table: questionData.currentTable || null,
                        multiplier: questionData.currentMultiplier || null,
                        letter: questionData.currentLetter || null
                    }
                });
        }
    } catch (err) {
        console.error('Auto-capture to question bank failed:', err);
    }
}

