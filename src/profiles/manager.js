// User Profiles UI Manager Module
import { state, createProfile, deleteProfile, saveStateToStorage } from '../state.js';

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
        div.className = `profile-card-item ${isActive ? 'active' : ''}`;
        div.innerHTML = `
            <div class="profile-card-info">
                <div class="profile-card-avatar"><i class="fa-solid fa-user-ninja"></i></div>
                <div class="profile-card-details">
                    <div class="name">${profile.name} ${isActive ? '<span style="color: var(--primary); font-size:11px;">(Active)</span>' : ''}</div>
                    <div class="stats">Accuracy: ${accuracy} | Total Attempts: ${profile.all_time_total}</div>
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
export { deleteProfile };
