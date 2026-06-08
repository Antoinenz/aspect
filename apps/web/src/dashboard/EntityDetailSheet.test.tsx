import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EntityDetailSheet } from './EntityDetailSheet.js';
import { useConnectionStore } from '../store/connectionStore.js';
import type { EntityState } from '@aspect/shared';

const sent: unknown[] = [];
vi.mock('../server-client/commands.js', () => ({
  callService: () => {},
  setFavorite: (...a: unknown[]) => sent.push(a),
}));

const e = (id: string, state = 'on'): EntityState => ({ entityId: id, state, attributes: {}, lastChanged: 't', lastUpdated: 't' });
const base = {
  link: 'connected' as const, serverStatus: 'online' as const, haConnected: true,
  entities: { 'light.kitchen_lamp': e('light.kitchen_lamp') } as Record<string, EntityState>,
  areas: [] as never[], devices: [] as never[], registry: [] as never[], favorites: [] as string[],
};

describe('EntityDetailSheet pin', () => {
  beforeEach(() => { sent.length = 0; useConnectionStore.setState({ ...base }); });

  it('pins an unpinned entity', async () => {
    render(<EntityDetailSheet entityId="light.kitchen_lamp" onClose={() => {}} />);
    await userEvent.click(await screen.findByRole('button', { name: /favourite/i }));
    expect(sent[0]).toEqual(['light.kitchen_lamp', true]);
  });

  it('shows "Pinned" when already a favorite', async () => {
    useConnectionStore.setState({ ...base, favorites: ['light.kitchen_lamp'] });
    render(<EntityDetailSheet entityId="light.kitchen_lamp" onClose={() => {}} />);
    expect(await screen.findByRole('button', { name: /favourited/i })).toBeInTheDocument();
  });
});
