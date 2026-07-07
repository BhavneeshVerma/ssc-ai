// State Management Module
import { supabase } from './supabaseClient.js';

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export function getAvatarInitials(name) {
    const value = (name || "").trim();
    if (!value) return "??";

    const parts = value
        .replace(/[^a-zA-Z0-9\s]/g, " ")
        .split(/\s+/)
        .filter(Boolean);

    if (parts.length === 0) return "??";
    if (parts.length === 1) {
        const word = parts[0].slice(0, 2).toUpperCase();
        return word.length === 1 ? `${word}${word}` : word;
    }

    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function createWrongCounts() {
    const counts = {};
    for (let i = 0; i < ALPHABET.length; i++) {
        counts[ALPHABET[i]] = 0;
    }
    return counts;
}

function createTableWrongCounts() {
    const counts = {};
    for (let t = 1; t <= 50; t++) {
        counts[`Table ${t}`] = 0;
    }
    return counts;
}

function normalizeProfileRecord(profile, fallbackName = "") {
    const normalized = profile && typeof profile === "object" ? profile : {};
    const resolvedName = normalized.name || fallbackName || "Guest Ninja";
    const wrongCounts = normalized.wrong_counts && typeof normalized.wrong_counts === "object"
        ? normalized.wrong_counts
        : {};
    const tableWrongCounts = normalized.table_wrong_counts && typeof normalized.table_wrong_counts === "object"
        ? normalized.table_wrong_counts
        : {};
    const detailedMistakes = normalized.detailed_mistakes && typeof normalized.detailed_mistakes === "object"
        ? normalized.detailed_mistakes
        : {};

    normalized.name = resolvedName;
    normalized.avatarUrl = typeof normalized.avatarUrl === "string" && normalized.avatarUrl.trim()
        ? normalized.avatarUrl.trim()
        : null;
    normalized.avatarInitials = typeof normalized.avatarInitials === "string" && normalized.avatarInitials.trim()
        ? normalized.avatarInitials.trim().toUpperCase()
        : getAvatarInitials(resolvedName);
    normalized.wrong_counts = { ...createWrongCounts(), ...wrongCounts };
    normalized.table_wrong_counts = { ...createTableWrongCounts(), ...tableWrongCounts };
    normalized.detailed_mistakes = {
        tables: { ...(detailedMistakes.tables && typeof detailedMistakes.tables === "object" ? detailedMistakes.tables : {}) },
        alpha: { ...(detailedMistakes.alpha && typeof detailedMistakes.alpha === "object" ? detailedMistakes.alpha : {}) }
    };
    normalized.streak = Number.isFinite(normalized.streak) ? normalized.streak : 0;
    normalized.today_count = Number.isFinite(normalized.today_count) ? normalized.today_count : 0;
    normalized.last_active_date = typeof normalized.last_active_date === "string" ? normalized.last_active_date : "";

    return normalized;
}

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
        state.profiles[pid] = normalizeProfileRecord(state.profiles[pid], state.profiles[pid]?.name);
    }

    // Set active profile
    if (activeId && state.profiles[activeId]) {
        state.activeProfileId = activeId;
    } else {
        state.activeProfileId = Object.keys(state.profiles)[0];
    }

    saveStateToStorage();
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
    
    state.profiles[profileId] = {
        name: name,
        avatarUrl: null,
        avatarInitials: getAvatarInitials(name),
        all_time_correct: 0,
        all_time_total: 0,
        wrong_counts: createWrongCounts(),
        table_wrong_counts: createTableWrongCounts(),
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
                avatar_url: profile.avatarUrl || null,
                avatar_initials: profile.avatarInitials || null,
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
            .eq('user_id', state.supabaseUser.id)
            .maybeSingle();
            
        if (error) throw error;
        
        if (data) {
            const profileId = user.id;
            const localProfile = state.profiles[profileId] || state.profiles[state.activeProfileId] || {};
            
            // Merge check: If the cloud profile is empty (all_time_total is 0) but the local profile
            // has progress (all_time_total > 0), sync the local profile to the cloud first.
            // This prevents a trigger-created blank database row from overwriting local stats on first login.
            const cloudIsEmpty = (data.all_time_total === 0 && data.all_time_correct === 0);
            const localHasProgress = (localProfile.all_time_total > 0);

            if (cloudIsEmpty && localHasProgress) {
                console.log("Empty cloud profile detected with local progress. Syncing local profile first...");
                state.profiles[profileId] = {
                    ...normalizeProfileRecord(localProfile),
                    all_time_correct: localProfile.all_time_correct || 0,
                    all_time_total: localProfile.all_time_total || 0
                };
                state.activeProfileId = profileId;
                await syncActiveProfileToCloud();
                return;
            }

            const mergedProfile = normalizeProfileRecord({
                ...localProfile,
                ...data,
                name: data.display_name || data.profile_name || localProfile.name || "Guest Ninja",
                avatarUrl: data.avatar_url ?? localProfile.avatarUrl ?? null,
                avatarInitials: data.avatar_initials ?? localProfile.avatarInitials ?? getAvatarInitials(data.display_name || data.profile_name || localProfile.name || "Guest Ninja"),
                wrong_counts: data.wrong_counts ?? localProfile.wrong_counts ?? {},
                table_wrong_counts: data.table_wrong_counts ?? localProfile.table_wrong_counts ?? {},
                detailed_mistakes: data.detailed_mistakes ?? localProfile.detailed_mistakes ?? {},
                streak: data.streak ?? localProfile.streak ?? 0,
                today_count: data.today_count ?? localProfile.today_count ?? 0,
                last_active_date: data.last_active_date ?? localProfile.last_active_date ?? ""
            }, data.display_name || data.profile_name || localProfile.name || "Guest Ninja");
            state.profiles[profileId] = {
                ...mergedProfile,
                all_time_correct: Number.isFinite(data.all_time_correct) ? data.all_time_correct : localProfile.all_time_correct || 0,
                all_time_total: Number.isFinite(data.all_time_total) ? data.all_time_total : localProfile.all_time_total || 0
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

export async function getQuestionBank() {
    if (!supabase || !state.supabaseUser) return [];
    try {
        const { data, error } = await supabase
            .from('question_bank')
            .select('*')
            .eq('user_id', state.supabaseUser.id)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data || [];
    } catch (err) {
        console.error("Failed to fetch question bank:", err);
        return [];
    }
}

export async function addManualQuestion(discipline, topic, questionText, correctAnswer, notes = "") {
    if (!supabase || !state.supabaseUser) return;
    try {
        const { error } = await supabase
            .from('question_bank')
            .insert({
                user_id: state.supabaseUser.id,
                source: 'manual',
                discipline,
                topic,
                question_text: questionText,
                correct_answer: correctAnswer,
                notes: notes
            });
        if (error) throw error;
    } catch (err) {
        console.error("Failed to add manual question:", err);
        throw err;
    }
}

export async function deleteQuestionFromBank(questionId) {
    if (!supabase || !state.supabaseUser) return;
    try {
        const { error } = await supabase
            .from('question_bank')
            .delete()
            .eq('id', questionId)
            .eq('user_id', state.supabaseUser.id);
        if (error) throw error;
    } catch (err) {
        console.error("Failed to delete question from bank:", err);
        throw err;
    }
}
