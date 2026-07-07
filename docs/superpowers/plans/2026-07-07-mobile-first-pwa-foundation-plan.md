# Mobile-First PWA Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the hosted Vite site into a mobile-first, installable-ready app foundation that can later be wrapped for iOS and Android.

**Architecture:** Keep the current Vite/tab architecture. Improve the shared app shell and affected screens in place, add a small PWA asset layer, and add static verification scripts using Node's built-in test runner.

**Tech Stack:** Vite, vanilla JavaScript modules, CSS, localStorage profile state, public static assets, Node `node:test`.

---

## File Map

- `index.html`: App metadata, viewport, manifest link, Apple touch icon, shell markup.
- `src/style.css`: Global app shell, mobile dock, safe-area, typography guardrails.
- `src/tabs/dashboard/dashboard.css`: Dashboard responsive layout.
- `src/tabs/profile/profile.css`: Profile responsive layout.
- `src/state.js`: Profile avatar fields and migration.
- `src/tabs/profile/profile.js`: Profile card avatar rendering.
- `src/main.js`: Active profile avatar rendering.
- `public/manifest.webmanifest`: PWA metadata.
- `public/sw.js`: Static app shell service worker.
- `public/app-icon.svg`: Source icon.
- `public/icon-192.png`, `public/icon-512.png`, `public/apple-touch-icon.png`: Install icons.
- `scripts/generate-icons.mjs`: Deterministic icon generation.
- `tests/static/pwa-foundation.test.mjs`: Static checks for PWA and responsive foundation.
- `package.json`: Add `test` script.

## Task 1: Static PWA Foundation Tests

**Files:**
- Create: `tests/static/pwa-foundation.test.mjs`
- Modify: `package.json`

- [ ] Add tests that fail before implementation:
  - `index.html` has `viewport-fit=cover`
  - `index.html` links `/manifest.webmanifest`
  - `index.html` references `/sw.js` registration through source code
  - `public/manifest.webmanifest` exists with `name`, `short_name`, `start_url`, `display`, 192 and 512 icons
  - `src/style.css` has safe-area variables
  - `src/state.js` includes `avatarUrl` migration/default

- [ ] Add package script:

```json
"test": "node --test tests/static/*.test.mjs"
```

- [ ] Run `npm test`; expected before implementation: fail because manifest/service worker/avatar fields do not exist.

## Task 2: PWA Metadata, Icons, And Service Worker

**Files:**
- Modify: `index.html`
- Modify: `src/main.js`
- Create: `public/manifest.webmanifest`
- Create: `public/sw.js`
- Create: `public/app-icon.svg`
- Create: `scripts/generate-icons.mjs`
- Generate: `public/icon-192.png`, `public/icon-512.png`, `public/apple-touch-icon.png`

- [ ] Add manifest/iOS metadata and `viewport-fit=cover`.
- [ ] Register `/sw.js` from `src/main.js` only when `serviceWorker` exists.
- [ ] Create manifest with standalone display, relative GitHub Pages-safe start URL, theme color, and icons.
- [ ] Create service worker that caches the app shell and falls back to `/index.html` for navigation.
- [ ] Generate PNG icons deterministically from SVG using local tooling or a small script.
- [ ] Run `npm test`; expected: PWA metadata tests pass.

## Task 3: Profile Avatar Data And Rendering

**Files:**
- Modify: `src/state.js`
- Modify: `src/main.js`
- Modify: `src/tabs/profile/profile.js`
- Modify: `src/tabs/profile/profile.css`

- [ ] Add `avatarUrl: null` and `avatarInitials` to new profiles.
- [ ] Migrate existing profiles on load.
- [ ] Render avatar image when `avatarUrl` exists; otherwise render initials.
- [ ] Use the same avatar rendering in desktop sidebar, mobile header, dock profile tab, and profile list.
- [ ] Ensure profile cards wrap actions on narrow screens.
- [ ] Run `npm test`; expected: avatar static checks pass.

## Task 4: Mobile-First Layout Cleanup

**Files:**
- Modify: `src/style.css`
- Modify: `src/tabs/dashboard/dashboard.css`
- Modify: `src/tabs/profile/profile.css`
- Modify: `index.html` only if needed to remove inline styles from touched surfaces

- [ ] Replace global mobile-hostile `100vh` assumptions with `100dvh`/auto behavior where appropriate.
- [ ] Add root safe-area variables and use them for header, dock, and main content.
- [ ] Make bottom navigation a floating centered dock with profile avatar as the final item.
- [ ] Keep theme variables intact.
- [ ] Make dashboard stats use `repeat(auto-fit, minmax(...))` and one-column fallback on small screens.
- [ ] Make profile layout one column on mobile and non-overflowing on desktop.
- [ ] Run `npm test` and `npm run build`; expected: both pass.

## Task 5: Final Verification And Commit

**Files:**
- All touched implementation files.

- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Run a static horizontal-overflow risk check for `min-width`, fixed grid columns, and `100vh`.
- [ ] Commit all implementation changes with message:

```bash
git commit -m "feat: add mobile-first PWA foundation"
```

- [ ] Push `main` to `origin`.
