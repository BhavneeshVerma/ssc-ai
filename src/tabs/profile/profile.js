// Profile & Cloud Synchronization Tab Controller
import { 
    state, 
    createProfile, 
    deleteProfile, 
    saveStateToStorage,
    getAvatarInitials,
    syncActiveProfileToCloud,
    loadActiveProfileFromCloud
} from '../../state.js';
import { supabase } from '../../supabaseClient.js';

function escapeHTML(str) {
    if (!str) return '';
    return str.toString()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function renderAvatarMarkup(profile) {
    const avatarUrl = typeof profile.avatarUrl === "string" && profile.avatarUrl.trim()
        ? profile.avatarUrl.trim()
        : null;
    const initials = profile.avatarInitials || getAvatarInitials(profile.name);

    if (avatarUrl) {
        return `
            <div class="profile-avatar profile-avatar--card has-image">
                <img src="${escapeHTML(avatarUrl)}" alt="${escapeHTML(profile.name)} avatar" loading="lazy" referrerpolicy="no-referrer">
            </div>
        `;
    }

    return `
        <div class="profile-avatar profile-avatar--card">
            <span class="avatar-initials">${escapeHTML(initials)}</span>
        </div>
    `;
}

export function refreshProfilesList(onActiveProfileChanged) {
    const grid = document.getElementById("profilesListGrid");
    if (!grid) return;
    
    grid.innerHTML = "";
    
    for (const id in state.profiles) {
        const profile = state.profiles[id];
        const isActive = (id === state.activeProfileId);
        
        const accuracy = profile.all_time_total > 0 
            ? `${Math.round((profile.all_time_correct / profile.all_time_total) * 100)}%` 
            : "--";
            
        const div = document.createElement("div");
        div.className = `profile-card ${isActive ? 'active-profile' : ''}`;
        
        div.innerHTML = `
            <div class="profile-card-main">
                ${renderAvatarMarkup(profile)}
                <div class="profile-card-copy">
                    <div class="profile-card-name">${escapeHTML(profile.name)} ${isActive ? '<span style="color: var(--primary); font-size:10px; font-weight: bold;">(Active)</span>' : ''}</div>
                    <div class="profile-card-stats">Accuracy: ${accuracy} | Total Attempts: ${profile.all_time_total}</div>
                </div>
            </div>
            <div class="profile-card-actions">
                ${!isActive ? `<button class="btn btn-secondary btn-small action-load" data-pid="${id}">Load</button>` : ''}
                <button class="btn btn-danger btn-small action-delete" data-pid="${id}"><i class="fa-solid fa-trash-can"></i></button>
            </div>
        `;
        
        grid.appendChild(div);
    }
    
    // Bind click events inside profile list
    grid.querySelectorAll(".action-load").forEach(btn => {
        btn.addEventListener("click", () => {
            const pid = btn.getAttribute("data-pid");
            state.activeProfileId = pid;
            
            saveStateToStorage();
            refreshProfilesList(onActiveProfileChanged);
            if (onActiveProfileChanged) onActiveProfileChanged();
        });
    });
    
    grid.querySelectorAll(".action-delete").forEach(btn => {
        btn.addEventListener("click", () => {
            const pid = btn.getAttribute("data-pid");
            
            if (Object.keys(state.profiles).length <= 1) {
                alert("Cannot delete the last remaining profile! Create another profile first.");
                return;
            }
            
            const profileToDelete = state.profiles[pid];
            const confirmDelete = confirm(`Are you sure you want to delete profile "${profileToDelete.name}"? All stats will be permanently wiped.`);
            
            if (confirmDelete) {
                deleteProfile(pid);
                refreshProfilesList(onActiveProfileChanged);
                if (onActiveProfileChanged) onActiveProfileChanged();
            }
        });
    });
}

export function initializeProfilesManager(onActiveProfileChanged) {
    const createBtn = document.getElementById("createProfileBtn");
    const nameInput = document.getElementById("newProfileName");
    
    if (!createBtn || !nameInput) return;
    
    createBtn.addEventListener("click", () => {
        const nameVal = nameInput.value.trim();
        if (nameVal === "") {
            alert("Please enter a valid profile name.");
            return;
        }
        
        const newId = createProfile(nameVal);
        state.activeProfileId = newId;
        nameInput.value = "";
        
        saveStateToStorage();
        refreshProfilesList(onActiveProfileChanged);
        if (onActiveProfileChanged) onActiveProfileChanged();
        
        alert(`Profile "${nameVal}" created and loaded successfully.`);
    });
}

// Supabase Cloud Sync UI binding and management
export function setupCloudSyncUI(onActiveProfileChanged) {
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
