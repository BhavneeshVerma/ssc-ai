// Neutral appearance settings manager
// ------------------------------------------------------------
// This file is intentionally not a theme design.
// It only gives the app a stable API for changing background,
// blur, dim, transparency, radius, and theme class.

export const APPEARANCE_STORAGE_KEY = "ssc_ai_appearance_settings";

export const DEFAULT_APPEARANCE_SETTINGS = {
    theme: "dark",
    backgroundImage: "",
    backgroundOpacity: 0,
    backgroundBlurPx: 0,
    backgroundDim: 0,
    backgroundDimColor: "0, 0, 0",
    mainSurfaceOpacity: 1,
    sidebarSurfaceOpacity: 1,
    cardSurfaceOpacity: 1,
    surfaceBlurPx: 0,
    radiusPx: 0,
    cardBorderWidthPx: 2
};

function clampNumber(value, min, max, fallback) {
    const parsed = Number(value);
    if (Number.isNaN(parsed)) return fallback;
    return Math.min(max, Math.max(min, parsed));
}

function normalizeSettings(settings = {}) {
    return {
        ...DEFAULT_APPEARANCE_SETTINGS,
        ...settings,
        backgroundOpacity: clampNumber(settings.backgroundOpacity, 0, 1, DEFAULT_APPEARANCE_SETTINGS.backgroundOpacity),
        backgroundBlurPx: clampNumber(settings.backgroundBlurPx, 0, 40, DEFAULT_APPEARANCE_SETTINGS.backgroundBlurPx),
        backgroundDim: clampNumber(settings.backgroundDim, 0, 1, DEFAULT_APPEARANCE_SETTINGS.backgroundDim),
        mainSurfaceOpacity: clampNumber(settings.mainSurfaceOpacity, 0, 1, DEFAULT_APPEARANCE_SETTINGS.mainSurfaceOpacity),
        sidebarSurfaceOpacity: clampNumber(settings.sidebarSurfaceOpacity, 0, 1, DEFAULT_APPEARANCE_SETTINGS.sidebarSurfaceOpacity),
        cardSurfaceOpacity: clampNumber(settings.cardSurfaceOpacity, 0, 1, DEFAULT_APPEARANCE_SETTINGS.cardSurfaceOpacity),
        surfaceBlurPx: clampNumber(settings.surfaceBlurPx, 0, 40, DEFAULT_APPEARANCE_SETTINGS.surfaceBlurPx),
        radiusPx: clampNumber(settings.radiusPx, 0, 48, DEFAULT_APPEARANCE_SETTINGS.radiusPx),
        cardBorderWidthPx: clampNumber(settings.cardBorderWidthPx, 0, 6, DEFAULT_APPEARANCE_SETTINGS.cardBorderWidthPx)
    };
}

export function loadAppearanceSettings() {
    const raw = localStorage.getItem(APPEARANCE_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_APPEARANCE_SETTINGS };

    try {
        return normalizeSettings(JSON.parse(raw));
    } catch (error) {
        console.warn("Invalid appearance settings found. Resetting to defaults.", error);
        return { ...DEFAULT_APPEARANCE_SETTINGS };
    }
}

export function saveAppearanceSettings(settings) {
    const normalized = normalizeSettings(settings);
    localStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify(normalized));
    applyAppearanceSettings(normalized);
    return normalized;
}

export function resetAppearanceSettings() {
    localStorage.removeItem(APPEARANCE_STORAGE_KEY);
    applyAppearanceSettings(DEFAULT_APPEARANCE_SETTINGS);
    return { ...DEFAULT_APPEARANCE_SETTINGS };
}

export function applyAppearanceSettings(settings = loadAppearanceSettings()) {
    const normalized = normalizeSettings(settings);
    const root = document.documentElement;
    const body = document.body;

    body.classList.remove("theme-light", "theme-dark", "theme-sepia", "theme-neon");
    body.classList.add(`theme-${normalized.theme}`);

    root.style.setProperty("--custom-bg-image", normalized.backgroundImage ? `url("${normalized.backgroundImage}")` : "none");
    root.style.setProperty("--custom-bg-opacity", normalized.backgroundOpacity);
    root.style.setProperty("--custom-bg-blur", `${normalized.backgroundBlurPx}px`);
    root.style.setProperty("--custom-bg-dim", normalized.backgroundDim);
    root.style.setProperty("--custom-bg-dim-color", normalized.backgroundDimColor);
    root.style.setProperty("--main-surface-opacity", normalized.mainSurfaceOpacity);
    root.style.setProperty("--sidebar-surface-opacity", normalized.sidebarSurfaceOpacity);
    root.style.setProperty("--card-surface-opacity", normalized.cardSurfaceOpacity);
    root.style.setProperty("--surface-blur", `${normalized.surfaceBlurPx}px`);
    root.style.setProperty("--theme-radius", `${normalized.radiusPx}px`);
    root.style.setProperty("--theme-card-border-width", `${normalized.cardBorderWidthPx}px`);

    localStorage.setItem("trainer_theme", normalized.theme);
    return normalized;
}

export function updateAppearanceSetting(key, value) {
    const current = loadAppearanceSettings();
    return saveAppearanceSettings({ ...current, [key]: value });
}
