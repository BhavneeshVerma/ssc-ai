import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';

const root = process.cwd();
const readText = (relativePath) => readFileSync(resolve(root, relativePath), 'utf8');
const readJson = (relativePath) => JSON.parse(readText(relativePath));

test('index.html declares PWA metadata and service worker support', () => {
  const html = readFileSync(resolve(root, 'index.html'), 'utf8');

  assert.match(html, /viewport-fit=cover/);
  assert.match(html, /rel=["']manifest["']\s+href=["'](?:\.\/)?manifest\.webmanifest["']/);
  assert.match(html, /rel=["']apple-touch-icon["']\s+href=["'](?:\.\/)?apple-touch-icon\.png["']/);
  assert.match(html, /theme-color/);
  const mainJs = readText('src/main.js');
  assert.match(mainJs, /serviceWorker/);
  assert.match(mainJs, /sw\.js/);
  assert.match(mainJs, /display-mode/);
  assert.match(mainJs, /is-installed-app/);
  assert.match(mainJs, /dataset\.displayMode/);
});

test('public manifest exists with installability fields', () => {
  assert.ok(existsSync(resolve(root, 'public/manifest.webmanifest')));

  const manifest = readJson('public/manifest.webmanifest');
  assert.equal(typeof manifest.name, 'string');
  assert.equal(typeof manifest.short_name, 'string');
  assert.equal(typeof manifest.start_url, 'string');
  assert.equal(manifest.display, 'standalone');

  const iconSizes = (manifest.icons || []).map((icon) => icon.sizes).sort();
  assert.deepEqual(iconSizes, ['192x192', '512x512']);
  assert.ok((manifest.icons || []).some((icon) => String(icon.purpose || '').includes('maskable')));
});

test('service worker and icon source assets are present', () => {
  assert.ok(existsSync(resolve(root, 'public/sw.js')));
  assert.ok(existsSync(resolve(root, 'public/app-icon.svg')));
  assert.ok(existsSync(resolve(root, 'public/icon-192.png')));
  assert.ok(existsSync(resolve(root, 'public/icon-512.png')));
  assert.ok(existsSync(resolve(root, 'public/apple-touch-icon.png')));
});

test('global CSS declares safe-area variables', () => {
  const css = readText('src/style.css');
  assert.match(css, /--safe-area-top/);
  assert.match(css, /--safe-area-bottom/);
  assert.match(css, /--safe-area-left/);
  assert.match(css, /--safe-area-right/);
  assert.match(css, /\.app-main/);
});

test('state migration and new profiles include avatar fields', () => {
  const state = readText('src/state.js');
  assert.match(state, /avatarUrl/);
  assert.match(state, /avatarInitials/);
  assert.match(state, /createProfile\([^)]*\)[\s\S]*avatarUrl/);
  assert.match(state, /loadStateFromStorage\([\s\S]*avatarUrl/);
  assert.match(state, /normalizeProfileRecord/);
  assert.match(state, /avatarUrl:\s*data\.avatar_url\s*\?\?/);
  assert.match(state, /wrong_counts:\s*data\.wrong_counts\s*\?\?/);
  assert.match(state, /table_wrong_counts:\s*data\.table_wrong_counts\s*\?\?/);
  assert.match(state, /detailed_mistakes:\s*data\.detailed_mistakes\s*\?\?/);
  assert.match(state, /streak:\s*data\.streak\s*\?\?/);
  assert.doesNotMatch(state, /upload/i);
});

test('shell styles avoid global overflow clipping outside workout mode', () => {
  const css = readText('src/style.css');
  const nonWorkoutCss = css.split('body.workout-running')[0];
  assert.match(css, /body\s*\{/);
  assert.match(css, /\.app-container\s*\{/);
  assert.match(css, /\.app-main\s*\{/);
  assert.match(css, /overflow-y:\s*auto/);
  assert.doesNotMatch(nonWorkoutCss, /body\s*\{[^}]*overflow:\s*hidden/);
  assert.doesNotMatch(nonWorkoutCss, /\.app-container\s*\{[^}]*overflow:\s*hidden/);
});

test('training run toggles a visible active workout surface', () => {
  const html = readText('index.html');
  const training = readText('src/tabs/training/training.js');
  const trainingCss = readText('src/tabs/training/training.css');

  assert.match(training, /function setWorkoutUiActive\(isActive\)/);
  assert.match(training, /function ensureTrainingTabVisible\(\)/);
  assert.match(training, /ensureTrainingTabVisible\(\);[\s\S]{0,120}workout\.isActive\s*=\s*true/);
  assert.match(training, /state\.currentTab\s*=\s*["']training["']/);
  assert.match(training, /setWorkoutUiActive\(true\)/);
  assert.match(training, /setWorkoutUiActive\(false\)/);
  assert.match(trainingCss, /\.workout-arena\.is-active\s*\{[\s\S]*display:\s*flex/);
  assert.match(trainingCss, /\.workout-setup\.is-hidden\s*\{[\s\S]*display:\s*none/);
  assert.doesNotMatch(html, /id=["']workoutArena["'][^>]*style=["'][^"']*display:\s*none/);
  assert.doesNotMatch(training, /workoutArena\.style\.display\s*=\s*["']flex["']/);
  assert.doesNotMatch(training, /setupForm\.style\.display\s*=\s*["']none["']/);
});

test('mobile dock is compact, glassy, and auto-hides while scrolling', () => {
  const main = readText('src/main.js');
  const css = readText('src/style.css');

  assert.match(main, /function setupDockAutoHide\(\)/);
  assert.match(main, /document\.body\.classList\.toggle\(["']dock-hidden["']/);
  assert.match(main, /document\.querySelector\(["']\.app-main["']\)/);
  assert.match(main, /window\.addEventListener\(["']scroll["'],\s*handleScroll/);
  assert.match(css, /\.app-bottom-dock\s*\{[\s\S]*backdrop-filter:\s*blur/);
  assert.match(css, /\.app-bottom-dock\s*\{[\s\S]*-webkit-backdrop-filter:\s*blur/);
  assert.match(css, /body\.dock-hidden\s+\.app-bottom-dock/);
  assert.match(css, /transform:\s*translate\(-50%,\s*calc\(100% \+ 24px\)\)/);
});

test('profile cloud layout stacks on mobile', () => {
  const css = readText('src/tabs/profile/profile.css');
  assert.match(css, /@media \(max-width: 768px\)[\s\S]*display:\s*flex/);
  assert.match(css, /@media \(max-width: 768px\)[\s\S]*\.cloud-card\s*\{\s*order:\s*3;/);
  assert.match(css, /@media \(max-width: 768px\)[\s\S]*flex-direction:\s*column/);
});

test('service worker provides offline fallback response', () => {
  const sw = readText('public/sw.js');
  assert.match(sw, /OFFLINE_HTML/);
  assert.match(sw, /new Response\(OFFLINE_HTML/);
  assert.match(sw, /mode === 'navigate'/);
  assert.match(sw, /response\.ok/);
  assert.match(sw, /cache\.put\(event\.request, response\.clone\(\)\)/);
});

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

test('learning tab has mobile-safe readable layouts', () => {
  const html = readText('index.html');
  const css = readText('src/tabs/learning/learning.css');

  assert.match(css, /@media \(max-width: 768px\)[\s\S]*\.learning-tabs/);
  assert.match(css, /@media \(max-width: 768px\)[\s\S]*overflow-x:\s*hidden/);
  assert.match(css, /@media \(max-width: 768px\)[\s\S]*\.az-position-grid/);
  assert.match(css, /@media \(max-width: 768px\)[\s\S]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(css, /@media \(max-width: 768px\)[\s\S]*\.mnemonic-table-list/);
  assert.doesNotMatch(html, /class=["'][^"']*mnemonic-table-list[^"']*["'][^>]*style=["'][^"']*grid-template-columns/);
});

test('insights separates analytics and question bank on mobile', () => {
  const html = readText('index.html');
  const css = readText('src/tabs/insights/insights.css');
  const js = readText('src/tabs/insights/insights.js');

  assert.match(html, /data-i-tab=["']analytics["']/);
  assert.match(html, /data-i-tab=["']qbank["']/);
  assert.match(css, /@media \(max-width: 768px\)[\s\S]*\.insights-tab-bar/);
  assert.match(css, /@media \(max-width: 768px\)[\s\S]*\.qbank-list-container/);
  assert.doesNotMatch(js, /style\.display\s*=\s*activeInsightsSubTab === "analytics" \? "block" : "grid"/);
  assert.doesNotMatch(html, /id=["']i-panel-qbank["'][^>]*style=["'][^"']*display:\s*none/);
});

test('profile cloud sync exposes Google OAuth sign-in', () => {
  const html = readText('index.html');
  const profile = readText('src/tabs/profile/profile.js');

  assert.match(html, /id=["']cloudGoogleSignInBtn["']/);
  assert.match(profile, /signInWithOAuth\(\{\s*provider:\s*["']google["']/);
  assert.match(profile, /redirectTo:\s*getOAuthRedirectUrl\(\)/);
});

test('google sign-in uses supabase oauth redirect helper', () => {
  const profile = readText('src/tabs/profile/profile.js');

  assert.match(profile, /function getOAuthRedirectUrl\(\)/);
  assert.match(profile, /signInWithOAuth\(\{\s*provider:\s*["']google["']/);
  assert.match(profile, /redirectTo:\s*getOAuthRedirectUrl\(\)/);
  assert.doesNotMatch(profile, /accounts\.google\.com\/gsi/);
});

test('supabase client uses vite environment variables only', () => {
  const client = readText('src/supabaseClient.js');

  assert.match(client, /VITE_SUPABASE_URL/);
  assert.match(client, /VITE_SUPABASE_ANON_KEY/);
  assert.doesNotMatch(client, /https:\/\/[a-z0-9-]+\.supabase\.co/i);
  assert.doesNotMatch(client, /eyJ[A-Za-z0-9_-]+\./);
});

test('auth session restore loads cloud profile and refreshes profile UI', () => {
  const main = readText('src/main.js');
  const profile = readText('src/tabs/profile/profile.js');

  assert.match(main, /auth\.getSession\(\)/);
  assert.match(main, /onAuthStateChange/);
  assert.match(main, /loadActiveProfileFromCloud\(\)\.then/);
  assert.match(main, /cloud-sync-changed/);
  assert.match(profile, /export function renderCloudAuthState\(\)/);
});

test('cloud profile sync is scoped by authenticated user id', () => {
  const state = readText('src/state.js');

  assert.match(state, /state\.supabaseUser/);
  assert.match(state, /user_id/);
  assert.match(state, /\.eq\(["']user_id["'],\s*state\.supabaseUser\.id\)/);
  assert.match(state, /upsert/);
  assert.match(state, /avatar_url:\s*profile\.avatarUrl/);
  assert.match(state, /avatarUrl:\s*data\.avatar_url/);
  assert.match(state, /data\.all_time_total\s*===\s*0/);
});
