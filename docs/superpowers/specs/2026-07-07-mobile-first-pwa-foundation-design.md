# Mobile-First PWA Foundation Design

Date: 2026-07-07
Project: DRILL / SSC AI trainer

## Decision

Build this as a production-grade responsive web app first, then make it installable, then package it for iOS and Android.

Do not start with native store wrappers. A wrapper around a weak mobile web UI would produce a weak app. The foundation must be a clean app shell that works on mobile browsers, desktop browsers, GitHub Pages, and later Capacitor.

## Grounding

- Chrome installability expects a valid web manifest, 192x192 and 512x512 icons, `start_url`, standalone display, and service-worker control.
- Android Trusted Web Activity expects the web content to already be useful in the browser first.
- Capacitor is designed to be added to an existing modern web app with `package.json`, built web assets, and `index.html`.
- Apple App Review expects apps to feel useful and app-like, not just a repackaged website.

References:

- https://developer.chrome.com/docs/lighthouse/pwa/installable-manifest
- https://developer.chrome.com/docs/android/trusted-web-activity/
- https://capacitorjs.com/docs/getting-started
- https://developer.apple.com/app-store/review/guidelines/

## Current Problems

The current app builds, but it is browser-site shaped, not app-shell shaped.

- Mobile navigation is a full-width fixed bar, not a floating minimal dock.
- Profile UI hardcodes an icon and has no real avatar/profile-photo field.
- Dashboard and profile screens are desktop-first and become cramped on mobile.
- Several mobile rules are partial overrides layered over desktop rules.
- `100vh` and `overflow: hidden` on the app shell can cause mobile clipping.
- Safe-area handling is partial; bottom dock has some inset handling, top and side areas do not.
- No manifest, service worker, app icon set, Apple touch icon, install-state handling, or offline shell exists.
- `index.html` has many inline styles, making responsive behavior hard to reason about.

## Product Goal

Make the app feel like a serious standalone training app on:

- mobile browser
- desktop browser
- installed PWA
- later iOS App Store build
- later Android Play Store build

The theme system must remain intact. Theme redesign is out of scope for this pass.

## Approach

### Phase 1: Mobile-First App Shell

Replace the current desktop-first shell with a stable app layout.

Mobile:

- top compact header with brand and active profile
- floating bottom dock centered above the safe area
- dock uses icons first, minimal labels only when useful
- profile tab uses the user avatar/photo as the final dock item
- content scrolls vertically only
- no horizontal page scroll
- no fixed-width content that can exceed the viewport

Desktop:

- keep a left rail or desktop navigation, but make it calmer and more app-like
- preserve the same route/tab model
- dashboard/profile/training screens use wider layouts only when space allows

CSS direction:

- use mobile-first rules
- use `minmax(0, 1fr)` where grid columns can shrink
- use `min()` / `max-width` / container constraints instead of hard viewport assumptions
- use `100dvh` only where a true viewport-height app surface is required
- avoid global `overflow: hidden` except during workout mode
- add consistent safe-area variables for top, bottom, left, and right

### Phase 2: Dashboard And Profile Cleanup

Dashboard:

- make stats a single-column or compact two-column layout based on available width
- reduce tiny uppercase labels and excessive letter spacing
- separate primary action from secondary actions
- stack strong/weak zones cleanly on mobile
- keep card content from overflowing by wrapping or truncating intentionally

Profile:

- add a profile avatar model field, for example `avatarUrl` plus fallback initials
- render actual image/avatar consistently in header, dock, profile list, and profile detail
- make profile cards single-column on mobile
- avoid action buttons forcing horizontal width
- keep cloud sync controls below profile management on narrow screens

### Phase 3: PWA Readiness

Add installability and app metadata.

- `public/manifest.webmanifest`
- app icons: 192, 512, maskable icon, Apple touch icon
- theme color metadata
- `viewport-fit=cover`
- service worker using Vite-friendly tooling or a small explicit service worker
- app shell cache for static assets
- offline fallback screen for the app shell
- install-state detection where useful, without noisy prompts

### Phase 4: Store Readiness

After the web app passes mobile QA:

- add Capacitor
- configure iOS and Android projects
- keep `dist` as the web output
- confirm safe areas inside WebView
- add platform icons/splash assets
- test auth/storage behavior inside iOS and Android shells
- prepare App Store / Play Store metadata later

Android Trusted Web Activity remains an option, but Capacitor is the preferred default because it gives one consistent iOS + Android path.

## Data Model

Profiles should include avatar metadata without breaking existing local profiles.

Proposed profile fields:

```js
{
  name: string,
  avatarUrl: string | null,
  avatarInitials: string,
  // existing training/stat fields remain unchanged
}
```

Migration rule:

- existing profiles get `avatarUrl: null`
- initials are derived from `name`
- UI uses image when present, initials fallback otherwise

## Boundaries

In scope:

- app shell layout
- dashboard/profile responsive cleanup
- avatar model/rendering
- PWA installability foundation
- safe-area support
- build verification

Out of scope:

- deep theme redesign
- App Store / Play Store submission
- native-only features
- payments
- push notifications
- major Supabase schema changes unless required by avatar sync later

## Testing

Minimum verification before calling the implementation complete:

- `npm run build`
- mobile viewport smoke checks at 360, 390, 430 px widths
- desktop viewport smoke checks at 1024 and 1440 px widths
- confirm no horizontal scroll on dashboard/profile/training
- confirm dock does not overlap content
- confirm profile avatar fallback works
- confirm existing profile stats still load from local storage
- PWA metadata validation after Phase 3

## Risks

- Existing inline styles may fight responsive CSS. Prefer moving only touched inline styles into CSS classes.
- Current global `100vh` app shell may need careful replacement to avoid breaking workout mode.
- Profile avatar uploads should not be added until storage/auth expectations are clear.
- Apple store approval is not guaranteed for a simple wrapper; the app must provide a polished app-like experience first.

## Approval Status

Approved direction: web-app-first, PWA-ready next, store-wrapper later.

Implementation should begin with Phase 1 and Phase 2 before any native packaging work.
