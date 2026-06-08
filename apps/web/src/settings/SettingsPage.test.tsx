import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsPage } from './SettingsPage.js';
import { useConnectionStore } from '../store/connectionStore.js';
import { useThemeStore } from './theme.js';
import type { EntityState } from '@aspect/shared';

const sent: unknown[] = [];
vi.mock('../server-client/commands.js', () => ({
  callService: () => {},
  setFavorite: (...a: unknown[]) => sent.push(a),
}));

const e = (id: string, state = 'on'): EntityState => ({ entityId: id, state, attributes: {}, lastChanged: 't', lastUpdated: 't' });
const base = {
  link: 'connected' as const, serverStatus: 'online' as const, haConnected: true,
  entities: {} as Record<string, EntityState>, areas: [] as never[], devices: [] as never[],
  registry: [] as never[], favorites: [] as string[],
};

describe('SettingsPage', () => {
  beforeEach(() => {
    sent.length = 0;
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    useThemeStore.setState({ theme: 'auto' });
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

  it('lists favorites and removes one', async () => {
    useConnectionStore.setState({
      ...base,
      entities: { 'light.kitchen_lamp': e('light.kitchen_lamp') },
      favorites: ['light.kitchen_lamp'],
    });
    render(<SettingsPage />);
    expect(screen.getByText('Kitchen Lamp')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /remove kitchen lamp/i }));
    expect(sent[0]).toEqual(['light.kitchen_lamp', false]);
  });

  it('shows an empty favorites state', () => {
    render(<SettingsPage />);
    expect(screen.getByText(/no favorites yet/i)).toBeInTheDocument();
  });
});
