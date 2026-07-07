# Google Supabase Sync Implementation Plan
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

## Goal

Users can sign in with Google from the Profile section. After sign-in, their active profile data syncs to Supabase and loads again on page refresh, another browser, or another device.

## Grounding

Official docs used:

- Supabase Google login setup: https://supabase.com/docs/guides/auth/social-login/auth-google
- Supabase `signInWithOAuth`: https://supabase.com/docs/reference/javascript/auth-signinwithoauth
- Supabase redirect URLs: https://supabase.com/docs/guides/auth/redirect-urls

Current repo facts:

- Supabase client exists in `src/supabaseClient.js`.
- Auth/session bootstrapping exists in `src/main.js`.
- Profile cloud UI exists in `src/tabs/profile/profile.js`.
- Current Google OAuth code exists, but this plan hardens it and verifies database sync.
- Profile data sync functions live in `src/state.js`: `syncActiveProfileToCloud()` and `loadActiveProfileFromCloud()`.

## Assumptions

- Production host is GitHub Pages for this repo.
- Local dev host is `http://localhost:5173`.
- Google OAuth is the only new social provider for this pass.
- Existing email/password sign-in remains as fallback.
- No user secrets are committed. Supabase URL and anon key stay in env/config only.

## Task 1: Supabase And Google Dashboard Configuration

- External setup. No repo files modified.

- [ ] **Step 1: Configure Google Auth Platform**

In Google Cloud Console:

1. Create or select the app project.
2. Configure OAuth consent screen branding.
3. Add scopes:
   - `openid`
   - email scope
   - profile scope
4. Create OAuth Client ID of type `Web application`.
5. Add Authorized JavaScript origins:
   - `http://localhost:5173`
   - production GitHub Pages origin for this app
6. Add Authorized redirect URI:
   - Supabase Google provider callback URL copied from Supabase dashboard.

- [ ] **Step 2: Configure Supabase Google provider**

In Supabase dashboard:

1. Open Authentication -> Providers -> Google.
2. Enable Google provider.
3. Paste Google OAuth Client ID.
4. Paste Google OAuth Client Secret.
5. Save.

- [ ] **Step 3: Configure Supabase redirect URLs**

In Supabase Authentication -> URL Configuration:

1. Set Site URL to production app URL.
2. Add redirect allow-list entries:
   - `http://localhost:5173`
   - `http://localhost:5173/`
   - production GitHub Pages app URL
   - production GitHub Pages app URL with trailing slash

Worker note: use exact deployed URL visible in GitHub Pages settings. Do not guess if the repo has a custom domain.

## Task 2: Verify Environment And Supabase Client

- Modify only if missing: `.env.example`
- Inspect: `src/supabaseClient.js`
- Test: `tests/static/pwa-foundation.test.mjs`

- [ ] **Step 1: Confirm client reads public Supabase env vars**

Expected `src/supabaseClient.js` shape:

```js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = (supabaseUrl && supabaseAnonKey)
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;
```

- [ ] **Step 2: Add `.env.example` if absent**

Create `.env.example`:

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

Do not add real secrets. The anon key is public-ish but still should come from environment, not hardcoded.

- [ ] **Step 3: Add static regression test**

In `tests/static/pwa-foundation.test.mjs`, add:

```js
test('supabase client uses vite environment variables only', () => {
  const client = readText('src/supabaseClient.js');

  assert.match(client, /VITE_SUPABASE_URL/);
  assert.match(client, /VITE_SUPABASE_ANON_KEY/);
  assert.doesNotMatch(client, /https:\/\/[a-z0-9-]+\.supabase\.co/i);
  assert.doesNotMatch(client, /eyJ[A-Za-z0-9_-]+\./);
});
```

- [ ] **Step 4: Verify**

Run:

```bash
npm test
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add .env.example src/supabaseClient.js tests/static/pwa-foundation.test.mjs
git commit -m "chore: document supabase env configuration"
```

## Task 3: Harden Google Sign-In Button Flow

- Modify: `src/tabs/profile/profile.js`
- Inspect: `index.html`
- Test: `tests/static/pwa-foundation.test.mjs`

- [ ] **Step 1: Ensure Profile has Google button**

`index.html` must contain:

```html
<button id="cloudGoogleSignInBtn" class="btn btn-secondary cloud-google-btn" type="button">
    <i class="fa-brands fa-google"></i>
    Continue with Google
</button>
```

- [ ] **Step 2: Centralize OAuth redirect URL**

In `src/tabs/profile/profile.js`, add helper near the top:

```js
function getOAuthRedirectUrl() {
    const url = new URL(window.location.href);
    url.hash = "";
    url.search = "";
    return url.toString();
}
```

- [ ] **Step 3: Use Supabase OAuth correctly**

In `setupCloudSyncUI`, ensure the Google click handler uses:

```js
const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
        redirectTo: getOAuthRedirectUrl()
    }
});
```

Rules:

- Disable button while redirect starts.
- Restore button text only if Supabase returns an error before redirect.
- Do not manually store Google tokens.
- Do not call Google SDK directly in this pass.

- [ ] **Step 4: Add static tests**

```js
test('google sign-in uses supabase oauth redirect helper', () => {
  const profile = readText('src/tabs/profile/profile.js');

  assert.match(profile, /function getOAuthRedirectUrl\(\)/);
  assert.match(profile, /signInWithOAuth\(\{\s*provider:\s*["']google["']/);
  assert.match(profile, /redirectTo:\s*getOAuthRedirectUrl\(\)/);
  assert.doesNotMatch(profile, /accounts\.google\.com\/gsi/);
});
```

- [ ] **Step 5: Verify**

```bash
npm test
npm run build
```

- [ ] **Step 6: Commit**

```bash
git add index.html src/tabs/profile/profile.js tests/static/pwa-foundation.test.mjs
git commit -m "fix: harden google oauth redirect flow"
```

## Task 4: Make Session Restore Drive Cloud UI And Sync

- Modify: `src/main.js`
- Modify: `src/tabs/profile/profile.js`
- Test: `tests/static/pwa-foundation.test.mjs`

- [ ] **Step 1: Keep one render function for cloud auth UI**

`src/tabs/profile/profile.js` must export:

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
        return;
    }

    statusBadge.innerHTML = '<i class="fa-solid fa-cloud"></i> Not synced';
    statusBadge.className = "cloud-badge warning";
    if (authForm) authForm.style.display = "block";
    if (userDetails) userDetails.style.display = "none";
}
```

- [ ] **Step 2: Ensure startup loads existing session**

In `src/main.js`, `initApplication()` must:

1. Call `supabase.auth.getSession()`.
2. If session exists, set:
   - `state.supabaseUser`
   - `state.supabaseSession`
3. Dispatch `cloud-sync-changed`.
4. Call `loadActiveProfileFromCloud()`.
5. Call `onActiveProfileChanged()`.

- [ ] **Step 3: Ensure auth state changes load/sync**

In `src/main.js`, `onAuthStateChange` must:

- On `SIGNED_IN`:
  - set session/user state
  - dispatch `cloud-sync-changed`
  - fetch feature flags
  - load active profile from cloud
  - refresh visible UI
- On `SIGNED_OUT`:
  - clear session/user state
  - dispatch `cloud-sync-changed`
  - call `renderCloudAuthState()`

- [ ] **Step 4: Add static test**

```js
test('auth session restore loads cloud profile and refreshes profile UI', () => {
  const main = readText('src/main.js');
  const profile = readText('src/tabs/profile/profile.js');

  assert.match(main, /auth\.getSession\(\)/);
  assert.match(main, /onAuthStateChange/);
  assert.match(main, /loadActiveProfileFromCloud\(\)\.then/);
  assert.match(main, /cloud-sync-changed/);
  assert.match(profile, /export function renderCloudAuthState\(\)/);
});
```

- [ ] **Step 5: Verify**

```bash
npm test
npm run build
```

- [ ] **Step 6: Commit**

```bash
git add src/main.js src/tabs/profile/profile.js tests/static/pwa-foundation.test.mjs
git commit -m "fix: restore cloud session on startup"
```

## Task 5: Verify Supabase Profile Persistence Contract

- Inspect: `src/state.js`
- Optional modify: `src/state.js`
- Test: `tests/static/pwa-foundation.test.mjs`

- [ ] **Step 1: Confirm cloud table contract**

`syncActiveProfileToCloud()` and `loadActiveProfileFromCloud()` must use one user-owned row keyed by authenticated user ID.

Required behavior:

- Save active profile fields after workout end or manual sync.
- Load existing cloud profile after Google sign-in.
- If no cloud profile exists, create/sync current local profile.
- Never read or write another user's data.

- [ ] **Step 2: Confirm required synced fields**

The cloud row should include:

- `user_id`
- `profile_name`
- `all_time_correct`
- `all_time_total`
- `wrong_counts`
- `table_wrong_counts`
- `detailed_mistakes`
- `streak`
- `today_count`
- `last_active_date`
- `avatar_url`
- `avatar_initials`
- `updated_at`

If current code uses different names, update either the Supabase schema or code so names match exactly.

- [ ] **Step 3: Supabase SQL migration/checklist**

Run in Supabase SQL editor if table does not already match:

```sql
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  profile_name text not null default 'Guest Ninja',
  all_time_correct integer not null default 0,
  all_time_total integer not null default 0,
  wrong_counts jsonb not null default '{}'::jsonb,
  table_wrong_counts jsonb not null default '{}'::jsonb,
  detailed_mistakes jsonb not null default '{"tables":{},"alpha":{}}'::jsonb,
  streak integer not null default 0,
  today_count integer not null default 0,
  last_active_date text not null default '',
  avatar_url text,
  avatar_initials text,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles for select
using (auth.uid() = user_id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles for insert
with check (auth.uid() = user_id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
```

- [ ] **Step 4: Add code contract test**

```js
test('cloud profile sync is scoped by authenticated user id', () => {
  const state = readText('src/state.js');

  assert.match(state, /state\.supabaseUser/);
  assert.match(state, /user_id/);
  assert.match(state, /\.eq\(["']user_id["'],\s*state\.supabaseUser\.id\)/);
  assert.match(state, /upsert/);
});
```

- [ ] **Step 5: Verify**

```bash
npm test
npm run build
```

- [ ] **Step 6: Commit**

```bash
git add src/state.js tests/static/pwa-foundation.test.mjs
git commit -m "fix: enforce user-scoped cloud profile sync"
```

## Task 6: Manual End-To-End Verification

- No code files modified unless a failure is found.

- [ ] **Step 1: Local env setup**

Create local `.env` from `.env.example`:

```env
VITE_SUPABASE_URL=<real project url>
VITE_SUPABASE_ANON_KEY=<real anon key>
```

- [ ] **Step 2: Run local app**

```bash
npm run dev
```

- [ ] **Step 3: Test Google sign-in**

Manual flow:

1. Open Profile.
2. Click Continue with Google.
3. Complete Google consent.
4. Confirm redirect returns to app.
5. Confirm Profile shows Synced and Google email.

- [ ] **Step 4: Test data sync**

Manual flow:

1. Start a workout.
2. Answer at least one question.
3. Stop workout.
4. Click Sync Now if automatic sync has not fired.
5. Open Supabase table editor.
6. Confirm `profiles` row exists for current `auth.users.id`.
7. Refresh browser.
8. Confirm stats are restored.
9. Open app in another browser/private window.
10. Sign in with same Google account.
11. Confirm same stats load.

- [ ] **Step 5: Test sign-out isolation**

Manual flow:

1. Sign out.
2. Confirm cloud state shows Not synced.
3. Confirm local guest profile still works.
4. Sign in again.
5. Confirm cloud profile returns.

- [ ] **Step 6: Final verification**

```bash
npm test
npm run build
git status --short
```

- [ ] **Step 7: Final commit if fixes were needed**

```bash
git add <changed-files>
git commit -m "fix: complete google supabase sync"
```

## Review Checklist

- Google sign-in uses Supabase OAuth, not raw Google token handling.
- Redirect URL is in Supabase allow list.
- Supabase Google provider is enabled.
- Google OAuth client has the Supabase callback URL.
- Session restore works after refresh.
- Sync writes one row per authenticated user.
- RLS prevents cross-user reads/writes.
- Existing local profile behavior still works offline.
- `npm test` and `npm run build` pass.
