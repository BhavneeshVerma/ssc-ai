# Graph Report - C:\Users\bhavn\OneDrive\Desktop\ssc ai  (2026-07-07)

## Corpus Check
- Corpus is ~9,358 words - fits in a single context window. You may not need a graph.

## Summary
- 83 nodes · 138 edges · 16 communities detected
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]

## God Nodes (most connected - your core abstractions)
1. `AdvancedAlphabetTrainer` - 18 edges
2. `initApplication()` - 9 edges
3. `updateProfileCardWidget()` - 6 edges
4. `saveStateToStorage()` - 5 edges
5. `onActiveProfileChanged()` - 4 edges
6. `promptNextQuestion()` - 4 edges
7. `setupLearningHub()` - 4 edges
8. `renderLearningHubState()` - 4 edges
9. `renderDashboardView()` - 4 edges
10. `setupThemeSwitcher()` - 3 edges

## Surprising Connections (you probably didn't know these)
- `onActiveProfileChanged()` --calls--> `updateProfileCardWidget()`  [EXTRACTED]
  C:\Users\bhavn\OneDrive\Desktop\ssc ai\src\main.js → C:\Users\bhavn\OneDrive\Desktop\ssc ai\src\main.js  _Bridges community 5 → community 6_
- `initApplication()` --calls--> `updateProfileCardWidget()`  [EXTRACTED]
  C:\Users\bhavn\OneDrive\Desktop\ssc ai\src\main.js → C:\Users\bhavn\OneDrive\Desktop\ssc ai\src\main.js  _Bridges community 5 → community 1_
- `startWorkoutRun()` --calls--> `promptNextQuestion()`  [EXTRACTED]
  C:\Users\bhavn\OneDrive\Desktop\ssc ai\src\main.js → C:\Users\bhavn\OneDrive\Desktop\ssc ai\src\main.js  _Bridges community 13 → community 5_
- `initApplication()` --calls--> `renderDashboardView()`  [EXTRACTED]
  C:\Users\bhavn\OneDrive\Desktop\ssc ai\src\main.js → C:\Users\bhavn\OneDrive\Desktop\ssc ai\src\main.js  _Bridges community 6 → community 1_

## Communities

### Community 0 - "Community 0"
Cohesion: 0.33
Nodes (4): AdvancedAlphabetTrainer, Displays top critical mistakes in the sidebar text widget., Plots the mistake count in a matplotlib chart based on current mode., Updates analytics display when tab is focused.

### Community 1 - "Community 1"
Cohesion: 0.35
Nodes (10): applyTheme(), buildCubesTable(), buildSquaresTable(), initApplication(), mapElements(), safeInit(), setupLearningHub(), setupNavigation() (+2 more)

### Community 2 - "Community 2"
Cohesion: 0.25
Nodes (4): Generates the next question, biasing toward letters/tables with high mistake cou, Checks the user's answer and updates scoreboard and feed feedback., Skips the current question, marking it as incorrect to train weak areas., Prompts to reset all permanent stats history.

### Community 3 - "Community 3"
Cohesion: 0.5
Nodes (7): createProfile(), deleteProfile(), getActiveProfile(), loadStateFromStorage(), refreshActiveProfileDailyStats(), resetActiveProfileStats(), saveStateToStorage()

### Community 4 - "Community 4"
Cohesion: 0.4
Nodes (3): Starts a new countdown training session., Timer countdown loop., Wraps up the active session and saves stats.

### Community 5 - "Community 5"
Cohesion: 0.4
Nodes (6): checkUserAnswer(), endWorkoutRun(), promptNextQuestion(), skipQuestion(), stopWorkoutRun(), updateProfileCardWidget()

### Community 6 - "Community 6"
Cohesion: 0.4
Nodes (6): getTableHeatmapStatus(), onActiveProfileChanged(), renderDashboardView(), renderLearningHubState(), renderTableDetails(), renderTablesGrid()

### Community 7 - "Community 7"
Cohesion: 0.4
Nodes (2): Loads historical progress from a local JSON text file., Saves historical progress to a local JSON text file permanently.

### Community 8 - "Community 8"
Cohesion: 0.6
Nodes (4): generateQuestion(), recordAttempt(), recordMistake(), weightedRandomPick()

### Community 9 - "Community 9"
Cohesion: 0.67
Nodes (0): 

### Community 10 - "Community 10"
Cohesion: 0.67
Nodes (0): 

### Community 11 - "Community 11"
Cohesion: 0.67
Nodes (0): 

### Community 12 - "Community 12"
Cohesion: 1.0
Nodes (0): 

### Community 13 - "Community 13"
Cohesion: 1.0
Nodes (2): startWorkoutRun(), tickTimerText()

### Community 14 - "Community 14"
Cohesion: 1.0
Nodes (0): 

### Community 15 - "Community 15"
Cohesion: 1.0
Nodes (0): 

## Knowledge Gaps
- **12 isolated node(s):** `Loads historical progress from a local JSON text file.`, `Saves historical progress to a local JSON text file permanently.`, `Starts a new countdown training session.`, `Timer countdown loop.`, `Wraps up the active session and saves stats.` (+7 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 12`** (2 nodes): `counter.js`, `setupCounter()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 13`** (2 nodes): `startWorkoutRun()`, `tickTimerText()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 14`** (2 nodes): `chart.js`, `drawMistakeChart()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 15`** (1 nodes): `vite.config.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `AdvancedAlphabetTrainer` connect `Community 0` to `Community 2`, `Community 4`, `Community 7`?**
  _High betweenness centrality (0.075) - this node is a cross-community bridge._
- **Why does `initApplication()` connect `Community 1` to `Community 5`, `Community 6`?**
  _High betweenness centrality (0.004) - this node is a cross-community bridge._
- **Why does `updateProfileCardWidget()` connect `Community 5` to `Community 1`, `Community 6`?**
  _High betweenness centrality (0.001) - this node is a cross-community bridge._
- **What connects `Loads historical progress from a local JSON text file.`, `Saves historical progress to a local JSON text file permanently.`, `Starts a new countdown training session.` to the rest of the system?**
  _12 weakly-connected nodes found - possible documentation gaps or missing edges._