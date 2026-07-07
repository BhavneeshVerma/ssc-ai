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
  assert.match(state, /avatarUrl:\s*data\.avatarUrl\s*\?\?/);
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
