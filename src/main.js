// Application Entry Point (Main Controller)
import './style.css'; // Load global stylesheet
import './tabs/dashboard/dashboard.css';
import './tabs/training/training.css';
import './tabs/learning/learning.css';
import './tabs/insights/insights.css';
import './tabs/profile/profile.css';

import { supabase } from './supabaseClient.js';
import { 
    state, 
    loadStateFromStorage, 
    saveStateToStorage, 
    getActiveProfile, 
    getAvatarInitials,
    syncActiveProfileToCloud,
    loadActiveProfileFromCloud,
    fetchFeatureFlags
} from './state.js';

// Import Modular Tab Controllers
import { renderDashboardView, initDashboard } from './tabs/dashboard/dashboard.js';
import { initTraining, startWorkoutRun } from './tabs/training/training.js';
import { setupLearningHub, renderLearningHubState } from './tabs/learning/learning.js';
import { initInsights, renderInsightsTabState } from './tabs/insights/insights.js';
import { setupCloudSyncUI, refreshProfilesList, initializeProfilesManager } from './tabs/profile/profile.js';

function renderAvatar(container, profile) {
    if (!container || !profile) return;

    const avatarUrl = typeof profile.avatarUrl === 'string' && profile.avatarUrl.trim()
        ? profile.avatarUrl.trim()
        : null;
    const initials = profile.avatarInitials || getAvatarInitials(profile.name);

    container.innerHTML = "";
    container.classList.toggle("has-image", Boolean(avatarUrl));

    if (avatarUrl) {
        const img = document.createElement("img");
        img.src = avatarUrl;
        img.alt = `${profile.name} avatar`;
        img.loading = "lazy";
        img.referrerPolicy = "no-referrer";
        container.appendChild(img);
        return;
    }

    const fallback = document.createElement("span");
    fallback.className = "avatar-initials";
    fallback.textContent = initials;
    container.appendChild(fallback);
}

function updateProfileCardWidgets() {
    const profile = getActiveProfile();
    if (!profile) return;
    
    // Update Desktop Widget
    const nameEl = document.getElementById("currentProfileName");
    const statsEl = document.getElementById("currentProfileStats");
    const avatarEl = document.getElementById("currentProfileAvatar");
    
    if (nameEl) nameEl.textContent = profile.name;
    renderAvatar(avatarEl, profile);
    
    if (statsEl) {
        if (profile.all_time_total > 0) {
            const accuracy = Math.round((profile.all_time_correct / profile.all_time_total) * 100);
            statsEl.textContent = `Accuracy: ${accuracy}% (${profile.all_time_correct}/${profile.all_time_total})`;
        } else {
            statsEl.textContent = `No sessions yet`;
        }
    }
    
    // Update Mobile Header Widget
    const mobileNameEl = document.getElementById("mobileProfileName");
    const mobileAvatarEl = document.getElementById("mobileProfileAvatar");
    if (mobileNameEl) mobileNameEl.textContent = profile.name;
    renderAvatar(mobileAvatarEl, profile);

    const dockAvatarEl = document.getElementById("dockProfileAvatar");
    renderAvatar(dockAvatarEl, profile);
}

function onActiveProfileChanged() {
    updateProfileCardWidgets();
    
    // Refresh active tab views
    if (state.currentTab === "analytics" || state.currentTab === "insights") {
        renderInsightsTabState();
    } else if (state.currentTab === "learning") {
        renderLearningHubState();
    } else if (state.currentTab === "dashboard" || !state.currentTab) {
        renderDashboardView();
    }
    
    // Auto-sync profile to cloud if authenticated
    if (supabase && state.supabaseUser) {
        syncActiveProfileToCloud();
    }
}

// Router to switch between main sections
function navigateToTab(tabId, customCallback = null) {
    // Prevent leaving tab if workout is actively running
    if (state.currentWorkout.isActive) {
        alert("Please complete or stop the current workout run before changing tabs.");
        return;
    }
    
    // Update Sidebar Navigation buttons
    const navBtns = document.querySelectorAll(".nav-btn");
    navBtns.forEach(btn => {
        if (btn.getAttribute("data-tab") === tabId) {
            btn.classList.add("active");
        } else {
            btn.classList.remove("active");
        }
    });

    // Update Mobile Bottom Dock buttons
    const dockBtns = document.querySelectorAll(".dock-btn");
    dockBtns.forEach(btn => {
        if (btn.getAttribute("data-tab") === tabId) {
            btn.classList.add("active");
        } else {
            btn.classList.remove("active");
        }
    });

    // Toggle Content Sections
    const tabs = document.querySelectorAll(".tab-content");
    tabs.forEach(t => {
        if (t.id === `tab-${tabId}`) {
            t.classList.add("active");
        } else {
            t.classList.remove("active");
        }
    });

    state.currentTab = tabId;

    // Invoke callback if specified
    if (customCallback) customCallback();

    // Trigger tab-specific render actions
    if (tabId === "insights") {
        renderInsightsTabState();
    } else if (tabId === "profile") {
        refreshProfilesList(onActiveProfileChanged);
    } else if (tabId === "learning") {
        renderLearningHubState();
    } else if (tabId === "dashboard") {
        renderDashboardView();
    }
}

// Binds routing triggers
function setupRouting() {
    // Desktop Nav button clicks
    const navBtns = document.querySelectorAll(".nav-btn");
    navBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            const tabId = btn.getAttribute("data-tab");
            navigateToTab(tabId);
        });
    });

    // Mobile Bottom Dock button clicks
    const dockBtns = document.querySelectorAll(".dock-btn");
    dockBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            const tabId = btn.getAttribute("data-tab");
            navigateToTab(tabId);
        });
    });

    // Mobile Top Profile Badge click -> Routes to profile tab
    const mobileProfileWidget = document.getElementById("mobileActiveProfileBadge");
    if (mobileProfileWidget) {
        mobileProfileWidget.addEventListener("click", () => {
            navigateToTab("profile");
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

function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;

    const register = () => {
        navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch((error) => {
            console.warn('Service worker registration failed:', error);
        });
    };

    if (document.readyState === 'complete') {
        register();
    } else {
        window.addEventListener('load', register, { once: true });
    }
}

function updateInstallState() {
    const displayModes = [
        '(display-mode: standalone)',
        '(display-mode: fullscreen)',
        '(display-mode: minimal-ui)'
    ];
    const isStandalone = displayModes.some((query) => window.matchMedia(query).matches) || Boolean(navigator.standalone);
    const root = document.documentElement;

    root.classList.toggle('is-installed-app', isStandalone);
    root.dataset.displayMode = isStandalone ? 'standalone' : 'browser';
    document.body.dataset.displayMode = root.dataset.displayMode;
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
    if (state.currentTab === "insights") {
        renderInsightsTabState();
    }
}

function initApplication() {
    loadStateFromStorage();
    
    // Default tab
    state.currentTab = "dashboard";
    
    setupRouting();
    updateProfileCardWidgets();
    
    // Bootstrap tab modules
    initDashboard(navigateToTab);
    initTraining();
    setupLearningHub(navigateToTab, startWorkoutRun);
    initInsights(onActiveProfileChanged);
    initializeProfilesManager(onActiveProfileChanged);
    setupCloudSyncUI(onActiveProfileChanged);
    setupThemeSwitcher();
    registerServiceWorker();
    updateInstallState();
    updateProfileCardWidgets();

    // Custom event to sync profile changes from training runs securely
    window.addEventListener('active-profile-data-updated', () => {
        updateProfileCardWidgets();
    });

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
    
    // Initial rendering of dashboard
    renderDashboardView();
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
