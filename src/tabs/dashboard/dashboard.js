// Dashboard Tab Controller
import { state, getActiveProfile, refreshActiveProfileDailyStats } from '../../state.js';
import { getTableHeatmapStatus } from '../learning/learning.js';

export function renderDashboardView() {
    const profile = getActiveProfile();
    if (!profile) return;
    
    // Refresh daily counts and streak
    refreshActiveProfileDailyStats();
    
    // Update Greeting (Escaped for XSS security)
    const dashWelcomeName = document.getElementById("dashWelcomeName");
    if (dashWelcomeName) dashWelcomeName.textContent = profile.name;
    
    const hours = new Date().getHours();
    let timeGreeting = "Good Morning";
    if (hours >= 12 && hours < 17) timeGreeting = "Good Afternoon";
    else if (hours >= 17) timeGreeting = "Good Evening";
    
    const greetingTextHeader = document.querySelector(".greeting-text h2");
    if (greetingTextHeader) {
        greetingTextHeader.innerHTML = `${timeGreeting}, <span id="dashWelcomeName"></span>! 👋`;
        const welcomeSpan = document.getElementById("dashWelcomeName");
        if (welcomeSpan) welcomeSpan.textContent = profile.name;
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
        
        // Render Strong Zones (limit to 4) - Using textContent for security
        if (strongItems.length > 0) {
            strongItems.slice(0, 4).forEach(item => {
                const div = document.createElement("div");
                div.className = "zone-item";
                div.textContent = item;
                dashStrongList.appendChild(div);
            });
        } else {
            const emptyDiv = document.createElement("div");
            emptyDiv.className = "zone-empty";
            emptyDiv.textContent = "No mastered zones yet. Keep practicing!";
            dashStrongList.appendChild(emptyDiv);
        }
        
        // Render Weak Zones (limit to 4) - Using textContent for security
        if (weakItems.length > 0) {
            weakItems.slice(0, 4).forEach(item => {
                const div = document.createElement("div");
                div.className = "zone-item text-danger";
                div.textContent = item;
                dashWeakList.appendChild(div);
            });
        } else {
            const emptyDiv = document.createElement("div");
            emptyDiv.className = "zone-empty";
            emptyDiv.textContent = "No high error zones detected!";
            dashWeakList.appendChild(emptyDiv);
        }
    }
}

export function initDashboard(navToTab) {
    // Setup Dashboard action button routing
    const dashStartCombined = document.getElementById("dashActionStartCombined");
    const dashTables = document.getElementById("dashActionTables");
    const dashAlpha = document.getElementById("dashActionAlpha");
    
    if (dashStartCombined) {
        dashStartCombined.addEventListener("click", () => {
            navToTab("training", () => {
                // Switch mode select to custom combined
                const modeSelect = document.getElementById("modeSelect");
                if (modeSelect) {
                    modeSelect.value = "custom";
                    modeSelect.dispatchEvent(new Event('change'));
                }
            });
        });
    }
    
    if (dashTables) {
        dashTables.addEventListener("click", () => {
            navToTab("learning", () => {
                const tablesSubTabBtn = document.querySelector('.l-tab-btn[data-l-tab="math-tables"]');
                if (tablesSubTabBtn) tablesSubTabBtn.click();
            });
        });
    }
    
    if (dashAlpha) {
        dashAlpha.addEventListener("click", () => {
            navToTab("learning", () => {
                const alphaSubTabBtn = document.querySelector('.l-tab-btn[data-l-tab="alpha-mnemonics"]');
                if (alphaSubTabBtn) alphaSubTabBtn.click();
            });
        });
    }
}
