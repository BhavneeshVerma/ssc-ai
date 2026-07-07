# Profile Theme, Mobile UX, and Google Auth Implementation Plan
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

## Context

`cloud.md` was requested, but no `cloud.md`, `CLOUD.md`, `claude.md`, or similar guidance file was found in the readable project paths. Current repo state is `07bbe90 fix: stabilize workout start and mobile dock`.

The app is a Vite single-page trainer with these relevant files:

- `index.html`: app shell, mobile dock, profile tab markup, learning markup, insights/qbank markup.
- `src/main.js`: app routing, theme switcher, service worker, profile widget updates.
- `src/style.css`: global layout, mobile dock, responsive shell, shared cards/buttons.
- `src/themes.css`: existing theme variables. Preserve this system.
- `src/tabs/profile/profile.js`: local profiles and Supabase email/password cloud sync UI.
- `src/tabs/profile/profile.css`: profile/cloud layout.
- `src/tabs/learning/learning.css`: learning tabs, tables grid, alphabet/mnemonic grids.
- `src/tabs/insights/insights.js`: analytics/qbank sub-tab behavior.
- `src/tabs/insights/insights.css`: insights/qbank layout.
- `src/supabaseClient.js`: Supabase browser client from `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- `tests/static/pwa-foundation.test.mjs`: existing static regression suite.

Supabase reference:

- Google OAuth setup: https://supabase.com/docs/guides/auth/social-login/auth-google
- Browser OAuth call: `supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo } })`

Assumptions:

- Keep existing four themes: `dark`, `light`, `sepia`, `neon`.
- Move theme controls from sidebar-only location into Profile. Desktop sidebar theme control may be removed or kept hidden, but Profile must be canonical.
- First auth upgrade is Google OAuth plus existing email/password fallback. Do not add Apple/Microsoft now.
- No database schema changes for this pass.

## Task 1: Add Regression Tests First

- Modify: `tests/static/pwa-foundation.test.mjs`

- [ ] **Step 1: Add theme relocation static test**

Add this test near the existing PWA/layout tests:

```js
test('profile tab owns theme selection controls', () => {
  const html = readText('index.html');
  const main = readText('src/main.js');
  const profileCss = readText('src/tabs/profile/profile.css');

  assert.match(html, /id=["']profileThemeSwitcher["']/);
  assert.match(html, /data-theme=["']dark["']/);
  assert.match(html, /data-theme=["']light["']/);
  assert.match(html, /data-theme=["']sepia["']/);
  assert.match(html, /data-theme=["']neon["']/);
  assert.match(main, /setupThemeSwitcher\([\s\S]*profileThemeSwitcher/);
  assert.match(profileCss, /\.profile-theme-card/);
});
```

- [ ] **Step 2: Add mobile learning overflow/readability static test**

```js
test('learning tab has mobile-safe readable layouts', () => {
  const css = readText('src/tabs/learning/learning.css');

  assert.match(css, /@media \(max-width: 768px\)[\s\S]*\.learning-tabs/);
  assert.match(css, /@media \(max-width: 768px\)[\s\S]*overflow-x:\s*hidden/);
  assert.match(css, /@media \(max-width: 768px\)[\s\S]*\.az-position-grid/);
  assert.match(css, /@media \(max-width: 768px\)[\s\S]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(css, /@media \(max-width: 768px\)[\s\S]*\.mnemonic-table-list/);
});
```

- [ ] **Step 3: Add Insights/QBank declutter static test**

```js
test('insights separates analytics and question bank on mobile', () => {
  const html = readText('index.html');
  const css = readText('src/tabs/insights/insights.css');
  const js = readText('src/tabs/insights/insights.js');

  assert.match(html, /data-i-tab=["']analytics["']/);
  assert.match(html, /data-i-tab=["']qbank["']/);
  assert.match(css, /@media \(max-width: 768px\)[\s\S]*\.insights-tab-bar/);
  assert.match(css, /@media \(max-width: 768px\)[\s\S]*\.qbank-list-container/);
  assert.doesNotMatch(js, /style\.display\s*=\s*activeInsightsSubTab === "analytics" \? "block" : "grid"/);
});
```

- [ ] **Step 4: Add Google OAuth static test**

```js
test('profile cloud sync exposes Google OAuth sign-in', () => {
  const html = readText('index.html');
  const profile = readText('src/tabs/profile/profile.js');

  assert.match(html, /id=["']cloudGoogleSignInBtn["']/);
  assert.match(profile, /signInWithOAuth\(\{\s*provider:\s*["']google["']/);
  assert.match(profile, /redirectTo:\s*window\.location\.origin/);
});
```

- [ ] **Step 5: Run tests and confirm they fail before implementation**

Run:

```bash
npm test
```

Expected: new tests fail because controls/layout/auth are not implemented yet.

## Task 2: Relocate Theme Controls Into Profile

- Modify: `index.html`
- Modify: `src/main.js`
- Modify: `src/tabs/profile/profile.css`
- Test: `tests/static/pwa-foundation.test.mjs`

- [ ] **Step 1: Add Profile theme card markup**

In `index.html`, inside the Profile tab layout, add a card with this exact control. Place it near account/profile settings, before cloud sync if possible:

```html
<div class="card profile-theme-card">
    <h3 class="panel-title"><i class="fa-solid fa-palette"></i> Select Theme</h3>
    <p class="panel-description">Choose the app look for this device.</p>
    <div class="profile-theme-grid" id="profileThemeSwitcher">
        <button class="theme-btn" data-theme="dark" title="Dark / Void"><i class="fa-solid fa-moon"></i><span>Dark</span></button>
        <button class="theme-btn" data-theme="light" title="Light / Cream"><i class="fa-solid fa-sun"></i><span>Light</span></button>
        <button class="theme-btn" data-theme="sepia" title="Sepia / Archive"><i class="fa-solid fa-book-open"></i><span>Sepia</span></button>
        <button class="theme-btn" data-theme="neon" title="Electric / Neon"><i class="fa-solid fa-bolt"></i><span>Neon</span></button>
    </div>
</div>
```

If keeping the old sidebar switcher, keep its `id="themeSwitcher"` for backward compatibility. If removing the old sidebar switcher, update JS in the next step to support only `profileThemeSwitcher`.

- [ ] **Step 2: Update theme switcher JS to support multiple containers**

In `src/main.js`, replace the current single-element theme switcher logic with shared helpers:

```js
function getThemeSwitchers() {
    return Array.from(document.querySelectorAll("#themeSwitcher, #profileThemeSwitcher"));
}

function setupThemeSwitcher() {
    const switchers = getThemeSwitchers();
    if (switchers.length === 0) return;

    const savedTheme = localStorage.getItem("trainer_theme") || "dark";
    applyTheme(savedTheme);

    switchers.forEach(switcher => {
        switcher.querySelectorAll(".theme-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                const theme = btn.getAttribute("data-theme");
                applyTheme(theme);
            });
        });
    });
}

function applyTheme(theme) {
    getThemeSwitchers().forEach(switcher => {
        switcher.querySelectorAll(".theme-btn").forEach(btn => {
            btn.classList.toggle("active", btn.getAttribute("data-theme") === theme);
        });
    });

    document.body.classList.remove("theme-light", "theme-dark", "theme-sepia", "theme-neon");
    document.body.classList.add(`theme-${theme}`);
    localStorage.setItem("trainer_theme", theme);

    if (state.currentTab === "insights") {
        renderInsightsTabState();
    }
}
```

- [ ] **Step 3: Add profile theme styles**

In `src/tabs/profile/profile.css`, add:

```css
.profile-theme-card {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.profile-theme-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 8px;
}

.profile-theme-grid .theme-btn {
    min-height: 48px;
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 5px;
    border-radius: 8px;
}

.profile-theme-grid .theme-btn span {
    font-size: 10px;
    line-height: 1;
}

@media (max-width: 480px) {
    .profile-theme-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }
}
```

- [ ] **Step 4: Verify**

Run:

```bash
npm test
npm run build
```

Expected: theme test passes, build passes.

- [ ] **Step 5: Commit**

```bash
git add index.html src/main.js src/tabs/profile/profile.css tests/static/pwa-foundation.test.mjs
git commit -m "feat: move theme selection to profile"
```

## Task 3: Fix Mobile Learning Horizontal Overflow And Readability

- Modify: `src/tabs/learning/learning.css`
- Optional modify: `index.html` only if markup needs class hooks.
- Test: `tests/static/pwa-foundation.test.mjs`

- [ ] **Step 1: Add mobile containment**

In `src/tabs/learning/learning.css`, add a mobile block:

```css
@media (max-width: 768px) {
    #tab-learning,
    #tab-learning * {
        min-width: 0;
    }

    #tab-learning {
        overflow-x: hidden;
    }

    #tab-learning .learning-tabs {
        display: grid;
        grid-template-columns: 1fr;
        gap: 8px;
        overflow-x: hidden;
    }

    #tab-learning .l-tab-btn {
        width: 100%;
        min-height: 44px;
        justify-content: center;
        white-space: normal;
        text-align: center;
        font-size: 11px;
        line-height: 1.2;
        padding: 10px 12px;
    }
}
```

- [ ] **Step 2: Make alphabet grids readable**

In the same mobile block:

```css
@media (max-width: 768px) {
    #tab-learning .az-position-grid {
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 8px;
    }

    #tab-learning .az-cell {
        min-height: 54px;
        padding: 8px 4px;
    }

    #tab-learning .az-letter {
        font-size: 16px;
    }

    #tab-learning .az-num {
        font-size: 13px;
    }

    #tab-learning .opposite-grid {
        grid-template-columns: 1fr;
        gap: 10px;
    }

    #tab-learning .mnemonic-table-list {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
    }

    #tab-learning .mnemonic-card,
    #tab-learning .table-details-panel,
    #tab-learning .tables-grid-container {
        overflow-x: hidden;
    }
}
```

- [ ] **Step 3: Fix tiny text in weak/high-error learning zones**

Audit small text in `src/tabs/learning/learning.css`. For mobile, set minimum readable sizes:

```css
@media (max-width: 768px) {
    #tab-learning .panel-description,
    #tab-learning .mnemonic-card-content,
    #tab-learning .table-row,
    #tab-learning .empty-state {
        font-size: 13px;
        line-height: 1.45;
    }
}
```

- [ ] **Step 4: Verify no horizontal page scroll**

Run local dev server:

```bash
npm run dev
```

Manual mobile check at ~390px width:

- Learning tab opens without horizontal page scroll.
- Alphabet Mnemonics tab does not create horizontal scroll.
- A-Z cells are readable.
- Opposite letters and mnemonic cards stack cleanly.

- [ ] **Step 5: Verify automated checks**

```bash
npm test
npm run build
```

- [ ] **Step 6: Commit**

```bash
git add src/tabs/learning/learning.css tests/static/pwa-foundation.test.mjs
git commit -m "fix: improve mobile learning layouts"
```

## Task 4: Declutter Insights And QBank

- Modify: `index.html`
- Modify: `src/tabs/insights/insights.js`
- Modify: `src/tabs/insights/insights.css`
- Test: `tests/static/pwa-foundation.test.mjs`

- [ ] **Step 1: Make sub-tabs visually first-class**

In `index.html`, make sure the Insights tab has an explicit tab bar wrapper:

```html
<div class="insights-tab-bar" role="tablist" aria-label="Insights sections">
    <button class="insights-tab-btn active" data-i-tab="analytics" role="tab" aria-selected="true">Performance Analytics</button>
    <button class="insights-tab-btn" data-i-tab="qbank" role="tab" aria-selected="false">Question Bank</button>
</div>
```

Keep existing panel IDs:

```html
<div class="insights-panel" id="i-panel-analytics">...</div>
<div class="insights-panel" id="i-panel-qbank">...</div>
```

- [ ] **Step 2: Replace inline display switching with classes**

In `src/tabs/insights/insights.js`, replace direct `style.display` panel toggles with:

```js
function setInsightsSubTab(tabId) {
    activeInsightsSubTab = tabId;

    document.querySelectorAll(".insights-tab-btn").forEach(btn => {
        const isActive = btn.getAttribute("data-i-tab") === tabId;
        btn.classList.toggle("active", isActive);
        btn.setAttribute("aria-selected", String(isActive));
    });

    document.querySelectorAll(".insights-panel").forEach(panel => {
        panel.classList.toggle("active", panel.id === `i-panel-${tabId}`);
    });

    renderInsightsTabState();
}
```

Then in `initInsights`, wire buttons to call:

```js
insightsTabBtns.forEach(btn => {
    btn.addEventListener("click", () => {
        setInsightsSubTab(btn.getAttribute("data-i-tab"));
    });
});
```

- [ ] **Step 3: Add clean panel CSS**

In `src/tabs/insights/insights.css`:

```css
.insights-tab-bar {
    display: inline-grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6px;
    margin-bottom: 18px;
    padding: 4px;
    background: var(--bg-input);
    border: 1px solid var(--border-soft);
    border-radius: 8px;
}

.insights-tab-btn {
    min-height: 40px;
    padding: 8px 14px;
    border-radius: 6px;
}

.insights-panel {
    display: none;
}

.insights-panel.active {
    display: block;
}

#i-panel-qbank.active {
    display: grid;
    grid-template-columns: minmax(280px, 360px) minmax(0, 1fr);
    gap: 20px;
}

@media (max-width: 768px) {
    .insights-tab-bar {
        display: grid;
        width: 100%;
    }

    #i-panel-qbank.active {
        grid-template-columns: 1fr;
    }

    .qbank-list-container {
        max-height: none;
        overflow: visible;
    }
}
```

- [ ] **Step 4: Improve QBank cards**

In `src/tabs/insights/insights.css`, ensure qbank cards do not use absolute-position buttons on mobile:

```css
@media (max-width: 768px) {
    .qbank-card {
        display: flex;
        flex-direction: column;
        gap: 10px;
        min-width: 0;
    }

    .delete-qbank-btn {
        position: static !important;
        align-self: flex-end;
    }
}
```

- [ ] **Step 5: Verify**

Manual checks:

- Insights opens to Performance Analytics.
- Question Bank is a distinct panel, not visually merged with analytics.
- On mobile, QBank add form and list stack.
- Delete button remains tappable and does not overlap text.

Automated:

```bash
npm test
npm run build
```

- [ ] **Step 6: Commit**

```bash
git add index.html src/tabs/insights/insights.js src/tabs/insights/insights.css tests/static/pwa-foundation.test.mjs
git commit -m "fix: separate insights and question bank panels"
```

## Task 5: Add Google Sign-In To Profile Cloud Sync

- Modify: `index.html`
- Modify: `src/tabs/profile/profile.js`
- Modify: `src/tabs/profile/profile.css`
- Test: `tests/static/pwa-foundation.test.mjs`

- [ ] **Step 1: Add Google sign-in button**

In the Profile cloud sync card in `index.html`, add above email/password inputs:

```html
<button id="cloudGoogleSignInBtn" class="btn btn-secondary cloud-google-btn" type="button">
    <i class="fa-brands fa-google"></i>
    Continue with Google
</button>
```

Keep existing email/password fields as fallback. Do not remove existing sign-in/sign-up yet.

- [ ] **Step 2: Wire OAuth in profile controller**

In `src/tabs/profile/profile.js`, inside `setupCloudSyncUI`, add:

```js
const googleSignInBtn = document.getElementById("cloudGoogleSignInBtn");
```

After the `!supabase` guard:

```js
if (googleSignInBtn) {
    googleSignInBtn.addEventListener("click", async () => {
        googleSignInBtn.disabled = true;
        googleSignInBtn.innerHTML = '<i class="fa-brands fa-google"></i> Opening Google...';

        const { error } = await supabase.auth.signInWithOAuth({
            provider: "google",
            options: {
                redirectTo: window.location.origin + window.location.pathname
            }
        });

        if (error) {
            googleSignInBtn.disabled = false;
            googleSignInBtn.innerHTML = '<i class="fa-brands fa-google"></i> Continue with Google';
            alert("Google sign-in failed: " + error.message);
        }
    });
}
```

- [ ] **Step 3: Make auth state update profile UI after OAuth redirect**

Verify existing `supabase.auth.getSession()` and `onAuthStateChange` in `src/main.js` loads active profile from cloud. If user is signed in after redirect, `cloudStatusBadge`, `cloudUserDetails`, and profile widgets must update.

If `setupCloudSyncUI` currently only updates status from email/password paths, add a small exported function in `profile.js`:

```js
export function renderCloudAuthState() {
    const statusBadge = document.getElementById("cloudStatusBadge");
    const authForm = document.getElementById("cloudAuthForm");
    const userDetails = document.getElementById("cloudUserDetails");
    const userEmailDisplay = document.getElementById("cloudUserEmail");

    if (!statusBadge) return;

    if (state.supabaseUser) {
        statusBadge.innerHTML = '<i class="fa-solid fa-circle-check"></i> Synced';
        statusBadge.className = "cloud-badge success";
        if (authForm) authForm.style.display = "none";
        if (userDetails) userDetails.style.display = "block";
        if (userEmailDisplay) userEmailDisplay.textContent = state.supabaseUser.email || "Google account";
    } else {
        statusBadge.innerHTML = '<i class="fa-solid fa-cloud"></i> Not synced';
        statusBadge.className = "cloud-badge warning";
        if (authForm) authForm.style.display = "block";
        if (userDetails) userDetails.style.display = "none";
    }
}
```

Call it from `setupCloudSyncUI`, after email/password sign-in, after sign-out, and from `src/main.js` when auth state changes.

- [ ] **Step 4: Style Google button**

In `src/tabs/profile/profile.css`:

```css
.cloud-google-btn {
    background: #ffffff;
    color: #111111;
    border-color: var(--border);
    margin-bottom: 12px;
}

.cloud-google-btn:hover {
    background: #f5f5f5;
}
```

- [ ] **Step 5: Supabase dashboard configuration checklist**

The implementing agent must not fake this in code. Configure outside repo:

- Enable Google provider in Supabase Auth providers.
- Add Google OAuth Client ID and Client Secret.
- Add GitHub Pages URL to Supabase redirect allow list.
- Add local dev URL, for example `http://localhost:5173`, during development.
- In Google Cloud OAuth client, add authorized JavaScript origin for GitHub Pages origin.
- In Google Cloud OAuth client, add Supabase callback URL from Supabase Google provider page.

- [ ] **Step 6: Verify**

Automated:

```bash
npm test
npm run build
```

Manual:

- With Supabase env vars present, Profile shows "Continue with Google".
- Click opens Google OAuth.
- Redirect returns to app.
- Profile tab shows synced state and user email.
- Sign out returns to local/offline state without breaking local profiles.

- [ ] **Step 7: Commit**

```bash
git add index.html src/tabs/profile/profile.js src/tabs/profile/profile.css src/main.js tests/static/pwa-foundation.test.mjs
git commit -m "feat: add google cloud sign in"
```

## Task 6: Final Mobile QA Pass

- Modify only files required by findings.

- [ ] **Step 1: Run full checks**

```bash
npm test
npm run build
```

- [ ] **Step 2: Manual mobile viewport checklist**

Use browser responsive mode at 390x844 and 430x932:

- Dashboard does not horizontally scroll.
- Learning -> Alphabet Mnemonics does not horizontally scroll.
- High error / weak zone content readable without zoom.
- Insights tab shows clear two-option section switcher.
- QBank form/list stack vertically.
- Profile contains theme picker.
- Profile contains Google sign-in.
- Floating dock still auto-hides on scroll and does not cover primary buttons.
- Workout start still shows active workout screen.

- [ ] **Step 3: Commit final polish if needed**

```bash
git add <changed-files>
git commit -m "fix: polish mobile app layouts"
```

## Review Checklist For Codex Later

- Theme state is still stored in `localStorage` under `trainer_theme`.
- Existing theme class names are preserved: `theme-light`, `theme-dark`, `theme-sepia`, `theme-neon`.
- No new horizontal scroll on `body`, `.app-main`, `#tab-learning`, or `#tab-profile`.
- Insights and QBank state uses classes, not inline display toggles.
- Google OAuth uses Supabase `signInWithOAuth`, not raw Google token code.
- Supabase credentials remain in env vars only.
- Tests prove the major regressions: theme placement, mobile learning layout, insights split, Google auth button.
