import { describe, it, expect, beforeEach } from 'vitest';
import { loadTheme, applyTheme, initTheme, useThemeStore } from './theme.js';

describe('theme', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    useThemeStore.setState({ theme: 'auto' });
  });

  it('defaults to auto when nothing is stored', () => {
    expect(loadTheme()).toBe('auto');
  });

  it('reads a stored choice', () => {
    localStorage.setItem('aspect:theme', 'dark');
    expect(loadTheme()).toBe('dark');
  });

  it('ignores an invalid stored value', () => {
    localStorage.setItem('aspect:theme', 'banana');
    expect(loadTheme()).toBe('auto');
  });

  it('applyTheme sets the attribute for explicit themes', () => {
    applyTheme('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('applyTheme clears the attribute for auto', () => {
    document.documentElement.setAttribute('data-theme', 'dark');
    applyTheme('auto');
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });

  it('setTheme persists and applies', () => {
    useThemeStore.getState().setTheme('dark');
    expect(useThemeStore.getState().theme).toBe('dark');
    expect(localStorage.getItem('aspect:theme')).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('initTheme applies the persisted choice', () => {
    localStorage.setItem('aspect:theme', 'light');
    initTheme();
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });
});
