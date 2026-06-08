import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsPage } from './SettingsPage.js';
import { useConnectionStore } from '../store/connectionStore.js';
import { useThemeStore } from './theme.js';
import { useMotionStore } from './motionStore.js';
import type { EntityState } from '@aspect/shared';

const base = {
  link: 'connected' as const, serverStatus: 'online' as const, haConnected: true,
  entities: {} as Record<string, EntityState>, areas: [] as never[], devices: [] as never[],
  registry: [] as never[], favorites: [] as string[],
};

describe('SettingsPage', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('data-motion');
    useThemeStore.setState({ theme: 'auto' });
    useMotionStore.setState({ motion: 'on' });
    useConnectionStore.setState({ ...base });
  });

  it('switches the theme', async () => {
    render(<SettingsPage />);
    await userEvent.click(screen.getByRole('button', { name: /dark/i }));
    expect(useThemeStore.getState().theme).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('shows the connected status', () => {
    render(<SettingsPage />);
    expect(screen.getByText(/connected to home assistant/i)).toBeInTheDocument();
  });

  it('shows a disconnected status', () => {
    useConnectionStore.setState({ ...base, link: 'disconnected', haConnected: false });
    render(<SettingsPage />);
    expect(screen.getByText(/^disconnected$/i)).toBeInTheDocument();
  });

  it('toggles motion to reduced', async () => {
    render(<SettingsPage />);
    await userEvent.click(screen.getByRole('button', { name: /reduced/i }));
    expect(useMotionStore.getState().motion).toBe('off');
    expect(document.documentElement.getAttribute('data-motion')).toBe('reduced');
  });

  it('shows the startup tab picker', () => {
    render(<SettingsPage />);
    expect(screen.getByText(/tab shown when you open aspect/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /rooms/i })).toBeInTheDocument();
  });
});
