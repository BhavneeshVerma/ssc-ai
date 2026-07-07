# SSC AI Theme Modularity

This folder is for **theme control**, not for forcing one visual style.

The app already has base themes in `src/themes.css`:

- `theme-light`
- `theme-dark`
- `theme-sepia`
- `theme-neon`

The new layer adds customization variables that every future theme can use.

## What is customizable from day one

The neutral appearance layer supports:

- custom background image
- background opacity
- background blur
- background dimming
- background dim color
- main app surface opacity
- sidebar opacity
- card opacity
- surface blur
- border radius
- card border width

These controls are defined in `src/themes.css` under:

```css
/* NEUTRAL APPEARANCE CUSTOMIZATION LAYER */
```

The JS API is in:

```txt
src/theme/appearance-settings.js
```

## Runtime usage

```js
import {
  applyAppearanceSettings,
  updateAppearanceSetting,
  saveAppearanceSettings,
  resetAppearanceSettings
} from './theme/appearance-settings.js';

applyAppearanceSettings();

updateAppearanceSetting('backgroundImage', 'https://example.com/background.jpg');
updateAppearanceSetting('backgroundOpacity', 0.45);
updateAppearanceSetting('backgroundBlurPx', 12);
updateAppearanceSetting('backgroundDim', 0.35);
updateAppearanceSetting('cardSurfaceOpacity', 0.82);
updateAppearanceSetting('surfaceBlurPx', 10);
updateAppearanceSetting('radiusPx', 24);
```

## Adding a future custom theme

Do not edit component CSS first. Add a new theme class in `src/themes.css`:

```css
.theme-my-custom-theme {
    --bg-dark: #000000;
    --bg-panel: #111111;
    --bg-input: #181818;
    --text-main: #ffffff;
    --text-muted: #999999;
    --primary: #ff66aa;
    --primary-hover: #ff3388;
    --primary-text: #000000;
    --border: #333333;
    --border-soft: #222222;
    --sidebar-bg: #000000;
    --sidebar-text: #ffffff;
    --sidebar-muted: #777777;
    --sidebar-active: #ff66aa;
    --sidebar-active-text: #000000;
    --chart-accent: #ff66aa;

    /* Required RGB channels for opacity controls */
    --bg-dark-rgb: 0, 0, 0;
    --bg-panel-rgb: 17, 17, 17;
    --sidebar-bg-rgb: 0, 0, 0;
}
```

Then allow it in the UI/theme selector later.

## Important principle

Themes should change the app's **mood**, not the learning architecture.

The product loop remains:

Dashboard → Practice → Mistakes → Learn → Mock Exam → Account

The theme system only controls presentation.
