import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SummaryTab } from './SummaryTab.js';
import { useConnectionStore } from '../store/connectionStore.js';
import type { EntityState } from '@aspect/shared';

const sent: unknown[] = [];
vi.mock('../server-client/commands.js', () => ({ callService: (...a: unknown[]) => sent.push(a) }));

const e = (id: string, state: string, attrs: Record<string, unknown> = {}): EntityState => ({
  entityId: id, state, attributes: attrs, lastChanged: 't', lastUpdated: 't',
});
const base = {
  link: 'connected' as const, serverStatus: 'online' as const, haConnected: true,
  entities: {} as Record<string, EntityState>, areas: [] as never[], devices: [] as never[],
  registry: [] as never[], favorites: [] as string[],
};

describe('SummaryTab', () => {
  beforeEach(() => { sent.length = 0; useConnectionStore.setState({ ...base }); });

  it('shows an empty state when there is nothing to summarize', () => {
    render(<SummaryTab onSelect={() => {}} />);
    expect(screen.getByText(/nothing to summarize/i)).toBeInTheDocument();
  });

  it('renders an alert and opens it on click', async () => {
    const onSelect = vi.fn();
    useConnectionStore.setState({
      ...base,
      entities: { 'binary_sensor.door': e('binary_sensor.door', 'on', { device_class: 'door' }) },
    });
    render(<SummaryTab onSelect={onSelect} />);
    await userEvent.click(screen.getByText(/door/i));
    expect(onSelect).toHaveBeenCalledWith('binary_sensor.door');
  });

  it('turns all lights off', async () => {
    useConnectionStore.setState({ ...base, entities: { 'light.a': e('light.a', 'on'), 'light.b': e('light.b', 'on') } });
    render(<SummaryTab onSelect={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: /turn all off/i }));
    expect(sent).toHaveLength(2);
    expect(sent[0]).toEqual(['light', 'turn_off', 'light.a']);
  });
});
