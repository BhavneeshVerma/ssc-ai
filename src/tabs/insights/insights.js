// Insights & Question Bank Tab Controller
import { 
    state, 
    getActiveProfile, 
    resetActiveProfileStats,
    getQuestionBank,
    addManualQuestion,
    deleteQuestionFromBank
} from '../../state.js';
import { supabase } from '../../supabaseClient.js';
import { drawMistakeChart } from '../../analytics/chart.js';

let qbankCachedList = [];
let qbankFilterState = "all";
let activeInsightsSubTab = "analytics"; // "analytics" or "qbank"

function escapeHTML(str) {
    if (!str) return '';
    return str.toString()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

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
            
            // Build recent history HTML (using safe text escaping)
            let historyHtml = "";
            if (item.history.length > 0) {
                const logs = [...item.history].reverse(); // Show newest first
                historyHtml = `
                    <div class="detailed-mistake-history">
                        ${logs.slice(0, 3).map(log => {
                            const icon = log.isCorrect ? '<i class="fa-solid fa-circle-check text-green-400"></i>' : '<i class="fa-solid fa-circle-xmark text-rose-500"></i>';
                            const timeStr = log.timeTaken ? ` in ${log.timeTaken.toFixed(1)}s` : '';
                            const detailStr = log.isCorrect 
                                ? `Correct answer "${escapeHTML(log.userAnswer)}"${timeStr}`
                                : `Guessed "${escapeHTML(log.userAnswer)}" (Expected "${escapeHTML(log.correctAnswer)}")${timeStr}`;
                            
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
                    <span class="detailed-mistake-eqn">${escapeHTML(item.key)}</span>
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

export function renderQBankView() {
    const qbankCloudNotice = document.getElementById("qbankCloudNotice");
    const qbankMainContent = document.getElementById("qbankMainContent");
    const qbankListContainer = document.getElementById("qbankListContainer");
    
    if (!qbankCloudNotice || !qbankMainContent) return;
    
    if (!supabase || !state.supabaseUser) {
        qbankCloudNotice.style.display = "block";
        qbankMainContent.style.display = "none";
        return;
    }
    
    qbankCloudNotice.style.display = "none";
    qbankMainContent.style.display = "grid";
    
    qbankListContainer.innerHTML = `
        <div class="empty-state">
            <i class="fa-solid fa-rotate spin"></i> Loading your saved questions...
        </div>
    `;
    
    getQuestionBank().then(data => {
        qbankCachedList = data || [];
        displayQBankList();
    }).catch(err => {
        console.error("Failed to load QBank:", err);
        qbankListContainer.innerHTML = `<div class="empty-state">Failed to load question bank.</div>`;
    });
}

function displayQBankList() {
    const container = document.getElementById("qbankListContainer");
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
                Question: <span style="font-family: 'JetBrains Mono', monospace; font-weight: 500; font-size:13px; background: var(--bg-dark); padding: 2px 6px; border-radius: 4px; border: 1px solid var(--border);">${escapeHTML(q.question_text)}</span>
            </div>
            <div style="font-family: 'Space Grotesk', sans-serif; font-size: 14px; font-weight: 700; color: var(--text-main);">
                Answer: <span style="font-family: 'JetBrains Mono', monospace; font-weight: 500; font-size:13px; color: var(--success);">${escapeHTML(q.correct_answer)}</span>
            </div>
            ${q.notes ? `<div style="font-size:11px; color: var(--text-muted); background: var(--bg-dark); padding: 8px; border-radius:4px; border: 1px solid var(--border); font-style: italic;">"${escapeHTML(q.notes)}"</div>` : ''}
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
                        deleteBtn.disabled = false;
                        deleteBtn.innerHTML = `<i class="fa-solid fa-trash"></i> Delete`;
                    }
                }
            });
        }
        
        container.appendChild(card);
    });
}

export function renderInsightsTabState() {
    if (activeInsightsSubTab === "analytics") {
        renderAnalyticsView();
    } else {
        renderQBankView();
    }
}

export function initInsights(onActiveProfileChanged) {
    const insightsTabBtns = document.querySelectorAll(".insights-tab-btn");
    const insightsPanels = document.querySelectorAll(".insights-panel");
    const mTabBtns = document.querySelectorAll(".m-tab-btn");
    const resetStatsBtn = document.getElementById("resetStatsBtn");
    
    // Wire sub-tab buttons (Analytics vs QBank)
    insightsTabBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            insightsTabBtns.forEach(b => b.classList.remove("active"));
            insightsPanels.forEach(p => p.style.display = "none");
            
            btn.classList.add("active");
            activeInsightsSubTab = btn.getAttribute("data-i-tab");
            
            const targetPanel = document.getElementById(`i-panel-${activeInsightsSubTab}`);
            if (targetPanel) {
                targetPanel.style.display = activeInsightsSubTab === "analytics" ? "block" : "grid";
            }
            
            renderInsightsTabState();
        });
    });

    // Wire Analytics sub-tab selectors (Alphabet vs Tables mistakes)
    mTabBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            mTabBtns.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            state.analytics.activeSubTab = btn.getAttribute("data-m-tab");
            renderAnalyticsView();
        });
    });

    // Wire QBank Add Form Discipline / Topic sync
    const addDiscipline = document.getElementById("qbankAddDiscipline");
    const addTopic = document.getElementById("qbankAddTopic");
    if (addDiscipline && addTopic) {
        addDiscipline.addEventListener("change", (e) => {
            const disc = e.target.value;
            addTopic.innerHTML = "";
            if (disc === "tables") {
                addTopic.innerHTML = `<option value="multiplication">Multiplication Equation</option>`;
            } else {
                addTopic.innerHTML = `
                    <option value="alphaToNum">Alphabet ➔ Number</option>
                    <option value="numToAlpha">Number ➔ Alphabet</option>
                    <option value="alphaOpposite">Opposite Letters</option>
                `;
            }
        });
    }

    // Wire QBank Add Submit Action
    const addSubmitBtn = document.getElementById("qbankAddSubmitBtn");
    const addQuestion = document.getElementById("qbankAddQuestion");
    const addAnswer = document.getElementById("qbankAddAnswer");
    const addNotes = document.getElementById("qbankAddNotes");
    
    if (addSubmitBtn && addQuestion && addAnswer && addNotes && addDiscipline && addTopic) {
        addSubmitBtn.addEventListener("click", async () => {
            const disc = addDiscipline.value;
            const topic = addTopic.value;
            const question = addQuestion.value.trim();
            const answer = addAnswer.value.trim();
            const notes = addNotes.value.trim();
            
            if (!question || !answer) {
                alert("Please enter both the Question and Correct Answer.");
                return;
            }
            
            addSubmitBtn.disabled = true;
            addSubmitBtn.textContent = "Saving...";
            
            try {
                await addManualQuestion(disc, topic, question, answer, notes);
                addQuestion.value = "";
                addAnswer.value = "";
                addNotes.value = "";
                alert("Question successfully saved to your bank!");
                renderQBankView();
            } catch (err) {
                alert("Failed to save question: " + err.message);
            } finally {
                addSubmitBtn.disabled = false;
                addSubmitBtn.textContent = "Save to Question Bank";
            }
        });
    }

    // Wire QBank list filters
    const filterAll = document.getElementById("qbankFilterAll");
    const filterStuck = document.getElementById("qbankFilterStuck");
    const filterMastered = document.getElementById("qbankFilterMastered");
    
    const setQbankFilter = (filter) => {
        qbankFilterState = filter;
        [filterAll, filterStuck, filterMastered].forEach(btn => {
            if (btn) btn.classList.remove("active");
        });
        if (filter === "all" && filterAll) filterAll.classList.add("active");
        if (filter === "stuck" && filterStuck) filterStuck.classList.add("active");
        if (filter === "mastered" && filterMastered) filterMastered.classList.add("active");
        
        displayQBankList();
    };
    
    if (filterAll) filterAll.addEventListener("click", () => setQbankFilter("all"));
    if (filterStuck) filterStuck.addEventListener("click", () => setQbankFilter("stuck"));
    if (filterMastered) filterMastered.addEventListener("click", () => setQbankFilter("mastered"));

    // Wire reset stats button
    if (resetStatsBtn) {
        resetStatsBtn.addEventListener("click", () => {
            const wipe = confirm("Wipe all performance stats and mistakes for this profile permanently?");
            if (wipe) {
                resetActiveProfileStats();
                onActiveProfileChanged();
            }
        });
    }
}
