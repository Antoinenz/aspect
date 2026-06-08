import { create } from 'zustand';

/** Theme preference. `auto` follows the OS `prefers-color-scheme`. */
export type ThemeChoice = 'light' | 'dark' | 'auto';

const STORAGE_KEY = 'aspect:theme';

function isThemeChoice(value: unknown): value is ThemeChoice {
  return value === 'light' || value === 'dark' || value === 'auto';
}

/** Reads the persisted choice, defaulting to `auto`. */
export function loadTheme(): ThemeChoice {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isThemeChoice(stored)) return stored;
  } catch {
    /* localStorage may be unavailable (private mode, SSR) */
  }
  return 'auto';
}

/**
 * Reflects the choice onto `<html data-theme>`. `auto` clears the attribute so
 * the `prefers-color-scheme` defaults in theme.css take over.
 */
export function applyTheme(choice: ThemeChoice): void {
  const root = document.documentElement;
  if (choice === 'auto') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', choice);
}

/** Applies the persisted theme. Call before React renders to avoid a flash. */
export function initTheme(): void {
  applyTheme(loadTheme());
}

interface ThemeState {
  theme: ThemeChoice;
  setTheme: (theme: ThemeChoice) => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: loadTheme(),
  setTheme: (theme) => {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* ignore persistence failures */
    }
    applyTheme(theme);
    set({ theme });
  },
}));
