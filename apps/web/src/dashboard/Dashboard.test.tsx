import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../server-client/commands.js', () => ({ callService: () => {} }));
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Dashboard } from './Dashboard.js';
import { useConnectionStore } from '../store/connectionStore.js';
import type { EntityState } from '@aspect/shared';

const e = (entityId: string, state = 'on'): EntityState => ({
  entityId,
  state,
  attributes: {},
  lastChanged: 't',
  lastUpdated: 't',
});

const baseState = {
  link: 'connected' as const,
  serverStatus: 'online' as const,
  haConnected: true,
  entities: {} as Record<string, EntityState>,
  areas: [] as never[],
  devices: [] as never[],
  registry: [] as never[],
};

describe('Dashboard', () => {
  beforeEach(() => useConnectionStore.setState({ ...baseState }));

  it('shows an empty state when there are no entities', () => {
    render(<Dashboard />);
    expect(screen.getByText(/no devices/i)).toBeInTheDocument();
  });

  it('renders room sections with tiles', () => {
    act(() =>
      useConnectionStore.setState({
        ...baseState,
        entities: { 'light.kitchen_lamp': e('light.kitchen_lamp') },
        areas: [{ areaId: 'kitchen', name: 'Kitchen' }],
        registry: [
          {
            entityId: 'light.kitchen_lamp',
            areaId: 'kitchen',
            deviceId: null,
            name: null,
            platform: 'demo',
            entityCategory: null,
            hidden: false,
            disabled: false,
            deviceClass: null,
          },
        ],
      }),
    );
    render(<Dashboard />);
    expect(screen.getByText('Kitchen')).toBeInTheDocument();
    expect(screen.getByText('Kitchen Lamp')).toBeInTheDocument();
  });

  it('opens the detail sheet when a tile is tapped', async () => {
    act(() =>
      useConnectionStore.setState({
        ...baseState,
        entities: { 'light.kitchen_lamp': e('light.kitchen_lamp') },
      }),
    );
    render(<Dashboard />);
    await userEvent.click(screen.getByRole('button', { name: /kitchen lamp/i }));
    // The sheet opens with the entity name as its heading (role=dialog).
    expect(await screen.findByRole('dialog', { name: /kitchen lamp/i })).toBeInTheDocument();
  });
});
