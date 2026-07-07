// Learning Hub Tab Controller
import { state, getActiveProfile } from '../../state.js';

let selectedTable = null;
let showHeatmap = false;

export function getSelectedTable() {
    return selectedTable;
}

// Helper to determine aggregate heatmap state for a table card (Green, Yellow, Red)
export function getTableHeatmapStatus(profile, tableNum) {
    let hasAttempts = false;
    let hasRed = false;
    let hasYellow = false;
    let hasGreen = false;
    
    if (!profile.detailed_mistakes || !profile.detailed_mistakes.tables) {
        return "neutral";
    }
    
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

// Render the 1 to 50 mathematical tables selection grid
export function renderTablesGrid() {
    const grid = document.getElementById("tablesGrid");
    if (!grid) return;
    
    grid.innerHTML = "";
    const profile = getActiveProfile();
    
    for (let t = 1; t <= 50; t++) {
        const div = document.createElement("div");
        div.className = "table-cell-card";
        if (selectedTable === t) div.classList.add("active");
        
        const numSpan = document.createElement("span");
        numSpan.style.fontSize = "15px";
        numSpan.style.fontWeight = "800";
        numSpan.textContent = t.toString();
        
        const textSpan = document.createElement("span");
        textSpan.style.fontSize = "8px";
        textSpan.textContent = "Table";
        
        div.appendChild(numSpan);
        div.appendChild(textSpan);
        
        // Evaluate overall heatmap state of this table
        if (showHeatmap && profile) {
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

// Render the 10 rows for a selected table (multiples of 1 to 10)
export function renderTableDetails(tableNum) {
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
        
        const textSpan = document.createElement("span");
        textSpan.innerHTML = `${tableNum} × ${m} = <span class="table-row-val">${product}</span>`;
        div.appendChild(textSpan);
        
        // Heatmap colors logic
        if (showHeatmap && profile && profile.detailed_mistakes && profile.detailed_mistakes.tables) {
            const key = `${tableNum}*${m}`;
            const entry = profile.detailed_mistakes.tables[key];
            
            if (entry && entry.history && entry.history.length > 0) {
                const last = entry.history[entry.history.length - 1];
                const metaSpan = document.createElement("span");
                metaSpan.className = "row-meta";
                
                if (!last.isCorrect) {
                    div.classList.add("heatmap-red");
                    metaSpan.classList.add("text-danger");
                    metaSpan.textContent = `Wrong guess: "${last.userAnswer}"`;
                } else {
                    if (last.timeTaken < 2.0) {
                        div.classList.add("heatmap-green");
                        metaSpan.classList.add("text-green-400");
                        metaSpan.textContent = `Mastered (${last.timeTaken.toFixed(1)}s)`;
                    } else {
                        div.classList.add("heatmap-yellow");
                        metaSpan.classList.add("text-yellow-400");
                        metaSpan.textContent = `Slow (${last.timeTaken.toFixed(1)}s)`;
                    }
                }
                div.appendChild(metaSpan);
            }
        }
        
        container.appendChild(div);
    }
}

// Render squares table 1-30 dynamically
export function buildSquaresTable() {
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
export function buildCubesTable() {
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

export function renderLearningHubState() {
    renderTablesGrid();
    if (selectedTable !== null) {
        renderTableDetails(selectedTable);
    } else {
        selectedTable = 12; // Default select table 12 on start
        renderTablesGrid();
        renderTableDetails(12);
    }
}

export function setupLearningHub(navToTab, startWorkoutRun) {
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
            const targetPanel = document.getElementById(panelId);
            if (targetPanel) targetPanel.classList.add("active");
        });
    });
    
    // Status Heatmap toggle
    if (heatmapToggle) {
        // Set initial UI state
        heatmapToggle.classList.toggle("active", showHeatmap);
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
            
            navToTab("training", () => {
                const modeSelect = document.getElementById("modeSelect");
                const tableStart = document.getElementById("tableStart");
                const tableEnd = document.getElementById("tableEnd");
                const presetBtns = document.querySelectorAll(".preset-btn");
                
                if (modeSelect) {
                    modeSelect.value = "tables";
                    modeSelect.dispatchEvent(new Event('change'));
                }
                if (tableStart) tableStart.value = selectedTable;
                if (tableEnd) tableEnd.value = selectedTable;
                
                presetBtns.forEach(b => b.classList.remove("active"));
                startWorkoutRun();
            });
        });
    }
    
    // Build static reference lists
    buildSquaresTable();
    buildCubesTable();
}
