// Analytics Dashboard Controller Module
import { getActiveProfile, state } from '../state.js';
import { drawMistakeChart } from './chart.js';

export function renderAnalyticsView() {
    const profile = getActiveProfile();
    if (!profile) return;
    
    const isAlpha = (state.analytics.activeSubTab === "alpha");
    const container = document.getElementById("mistakesListContainer");
    const canvas = document.getElementById("mistakeChart");
    
    if (!container || !canvas) return;
    
    container.innerHTML = "";
    
    const detailedWrongs = [];
    
    if (!profile.detailed_mistakes) {
        profile.detailed_mistakes = { tables: {}, alpha: {} };
    }
    
    if (isAlpha) {
        // Collect detailed alphabet errors
        for (const key in profile.detailed_mistakes.alpha) {
            const entry = profile.detailed_mistakes.alpha[key];
            if (entry.incorrect > 0) {
                // Formatting display key
                let label = entry.letter;
                if (entry.mode === "alphaToNum") label = `${entry.letter} ➔ #`;
                else if (entry.mode === "numToAlpha") label = `# ➔ ${entry.letter}`;
                else if (entry.mode === "alphaOpposite") label = `Opposite ${entry.letter}`;
                
                detailedWrongs.push({
                    key: label,
                    count: entry.incorrect,
                    correct: entry.correct,
                    best_time: entry.best_time,
                    history: entry.history || []
                });
            }
        }
    } else {
        // Collect detailed tables errors
        for (const key in profile.detailed_mistakes.tables) {
            const entry = profile.detailed_mistakes.tables[key];
            if (entry.incorrect > 0) {
                detailedWrongs.push({
                    key: `${entry.table} × ${entry.multiplier}`,
                    count: entry.incorrect,
                    correct: entry.correct,
                    best_time: entry.best_time,
                    history: entry.history || []
                });
            }
        }
    }
    
    // Sort errors descending by failure count
    detailedWrongs.sort((a, b) => b.count - a.count);
    
    if (detailedWrongs.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-face-laugh-beam" style="font-size: 28px; margin-bottom: 10px; color: var(--primary);"></i>
                No mistakes registered yet!<br>Keep up the perfect runs.
            </div>
        `;
    } else {
        detailedWrongs.forEach(item => {
            const totalAttempts = item.count + item.correct;
            const accuracy = totalAttempts > 0 ? Math.round((item.correct / totalAttempts) * 100) : 0;
            
            const card = document.createElement("div");
            card.className = "detailed-mistake-card";
            
            // Build recent history HTML
            let historyHtml = "";
            if (item.history.length > 0) {
                const logs = [...item.history].reverse(); // Show newest first
                historyHtml = `
                    <div class="detailed-mistake-history">
                        ${logs.slice(0, 3).map(log => {
                            const icon = log.isCorrect ? '<i class="fa-solid fa-circle-check text-green-400"></i>' : '<i class="fa-solid fa-circle-xmark text-rose-500"></i>';
                            const timeStr = log.timeTaken ? ` in ${log.timeTaken.toFixed(1)}s` : '';
                            const detailStr = log.isCorrect 
                                ? `Correct answer "${log.userAnswer}"${timeStr}`
                                : `Guessed "${log.userAnswer}" (Expected "${log.correctAnswer}")${timeStr}`;
                            
                            return `
                                <div class="detailed-mistake-guess">
                                    ${icon} <span>${detailStr}</span>
                                </div>
                            `;
                        }).join("")}
                    </div>
                `;
            }
            
            const bestTimeStr = item.best_time !== null ? ` | Best: ${item.best_time.toFixed(1)}s` : "";
            
            card.innerHTML = `
                <div class="detailed-mistake-header">
                    <span class="detailed-mistake-eqn">${item.key}</span>
                    <span class="mistake-count">${item.count} mistakes</span>
                </div>
                <div class="detailed-mistake-ratio">
                    Accuracy: ${accuracy}% (${item.correct}/${totalAttempts} runs)${bestTimeStr}
                </div>
                ${historyHtml}
            `;
            container.appendChild(card);
        });
    }
    
    // Compile data for chart plotting
    const chartData = detailedWrongs.map(d => ({
        key: d.key,
        count: d.count
    }));
    
    // Redraw the Canvas bar chart with actual detailed items
    drawMistakeChart(canvas, chartData, isAlpha ? "Alphabet Item" : "Equation");
}

export function initializeAnalyticsDashboard() {
    const mTabBtns = document.querySelectorAll(".m-tab-btn");
    
    mTabBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            mTabBtns.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            state.analytics.activeSubTab = btn.getAttribute("data-m-tab");
            
            renderAnalyticsView();
        });
    });
}
