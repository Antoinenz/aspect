import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QuickAccessTab } from './QuickAccessTab.js';
import { useConnectionStore } from '../store/connectionStore.js';
import type { EntityState } from '@aspect/shared';

const sent: unknown[] = [];
vi.mock('../server-client/commands.js', () => ({
  callService: () => {},
  setFavorite: (...a: unknown[]) => sent.push(['setFavorite', ...a]),
  reorderFavorites: (...a: unknown[]) => sent.push(['reorderFavorites', ...a]),
}));

const e = (id: string, state = 'on'): EntityState => ({ entityId: id, state, attributes: {}, lastChanged: 't', lastUpdated: 't' });
const base = {
  link: 'connected' as const, serverStatus: 'online' as const, haConnected: true,
  entities: {} as Record<string, EntityState>, areas: [] as never[], devices: [] as never[],
  registry: [] as never[], favorites: [] as string[],
};

describe('QuickAccessTab', () => {
  beforeEach(() => {
    sent.length = 0;
    useConnectionStore.setState({ ...base });
  });

  it('shows an empty state when there are no favorites', () => {
    render(<QuickAccessTab onSelect={() => {}} />);
    expect(screen.getByText(/no favourites yet/i)).toBeInTheDocument();
  });

  it('renders pinned favorites and opens one', async () => {
    const onSelect = vi.fn();
    useConnectionStore.setState({
      ...base,
      entities: { 'light.kitchen_lamp': e('light.kitchen_lamp'), 'scene.movie': e('scene.movie') },
      favorites: ['light.kitchen_lamp'],
    });
    render(<QuickAccessTab onSelect={onSelect} />);
    expect(screen.getByText('Kitchen Lamp')).toBeInTheDocument();
    expect(screen.queryByText('Movie')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Kitchen Lamp' }));
    expect(onSelect).toHaveBeenCalledWith('light.kitchen_lamp');
  });

  it('enters edit mode and shows remove buttons', async () => {
    useConnectionStore.setState({
      ...base,
      entities: { 'light.kitchen_lamp': e('light.kitchen_lamp') },
      favorites: ['light.kitchen_lamp'],
    });
    render(<QuickAccessTab onSelect={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: /edit favorites/i }));
    expect(screen.getByRole('button', { name: /remove kitchen lamp/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /done/i })).toBeInTheDocument();
  });

  it('removes a favorite in edit mode', async () => {
    useConnectionStore.setState({
      ...base,
      entities: { 'light.kitchen_lamp': e('light.kitchen_lamp') },
      favorites: ['light.kitchen_lamp'],
    });
    render(<QuickAccessTab onSelect={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: /edit favorites/i }));
    await userEvent.click(screen.getByRole('button', { name: /remove kitchen lamp/i }));
    expect(sent.some((s) => JSON.stringify(s) === JSON.stringify(['setFavorite', 'light.kitchen_lamp', false]))).toBe(true);
  });

  it('saves order when Done is pressed', async () => {
    useConnectionStore.setState({
      ...base,
      entities: { 'light.kitchen_lamp': e('light.kitchen_lamp') },
      favorites: ['light.kitchen_lamp'],
    });
    render(<QuickAccessTab onSelect={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: /edit favorites/i }));
    await userEvent.click(screen.getByRole('button', { name: /done/i }));
    expect(sent.some((s) => Array.isArray(s) && s[0] === 'reorderFavorites')).toBe(true);
  });
});
