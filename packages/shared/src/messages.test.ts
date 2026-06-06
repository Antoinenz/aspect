import { describe, it, expect } from 'vitest';
import {
  createStatusMessage,
  createSnapshotMessage,
  createEntityUpdateMessage,
  isServerToClientMessage,
  createCallServiceMessage,
  isClientToServerMessage,
  type StatusMessage,
} from './messages.js';
import type { EntityState } from './entities.js';

const sampleEntity: EntityState = {
  entityId: 'light.kitchen',
  state: 'on',
  attributes: { brightness: 200 },
  lastChanged: '2026-01-01T00:00:00Z',
  lastUpdated: '2026-01-01T00:00:00Z',
};

describe('createStatusMessage', () => {
  it('builds a status message with a timestamp', () => {
    const before = Date.now();
    const msg = createStatusMessage('online', true);
    expect(msg.type).toBe('status');
    expect(msg.status).toBe('online');
    expect(msg.haConnected).toBe(true);
    expect(msg.ts).toBeGreaterThanOrEqual(before);
  });
});

describe('createSnapshotMessage', () => {
  it('wraps the world payload', () => {
    const msg = createSnapshotMessage({
      entities: [sampleEntity],
      areas: [{ areaId: 'kitchen', name: 'Kitchen' }],
      devices: [],
      registry: [],
    });
    expect(msg.type).toBe('snapshot');
    expect(msg.entities).toHaveLength(1);
    expect(msg.areas[0]?.name).toBe('Kitchen');
  });
});

describe('createEntityUpdateMessage', () => {
  it('defaults removed to an empty array', () => {
    const msg = createEntityUpdateMessage([sampleEntity]);
    expect(msg.type).toBe('entity_update');
    expect(msg.removed).toEqual([]);
  });
});

describe('isServerToClientMessage', () => {
  it('accepts a valid status message', () => {
    const msg: StatusMessage = createStatusMessage('degraded', false);
    expect(isServerToClientMessage(msg)).toBe(true);
  });

  it('accepts snapshot and entity_update messages', () => {
    expect(
      isServerToClientMessage(
        createSnapshotMessage({
          entities: [],
          areas: [],
          devices: [],
          registry: [],
        }),
      ),
    ).toBe(true);
    expect(isServerToClientMessage(createEntityUpdateMessage([]))).toBe(true);
  });

  it('rejects malformed input', () => {
    expect(isServerToClientMessage({ type: 'nope' })).toBe(false);
    expect(isServerToClientMessage(null)).toBe(false);
    expect(isServerToClientMessage('status')).toBe(false);
  });

  it('rejects a status message with an unknown status value', () => {
    expect(
      isServerToClientMessage({
        type: 'status',
        status: 'bogus',
        haConnected: false,
        ts: Date.now(),
      }),
    ).toBe(false);
  });
});

describe('createCallServiceMessage / isClientToServerMessage', () => {
  it('builds a call_service message with optional data', () => {
    const msg = createCallServiceMessage('light', 'turn_on', 'light.k', {
      brightness_pct: 50,
    });
    expect(msg).toEqual({
      type: 'call_service',
      domain: 'light',
      service: 'turn_on',
      entityId: 'light.k',
      data: { brightness_pct: 50 },
    });
    expect(isClientToServerMessage(msg)).toBe(true);
  });

  it('omits data when not provided', () => {
    const msg = createCallServiceMessage('switch', 'toggle', 'switch.x');
    expect('data' in msg).toBe(false);
    expect(isClientToServerMessage(msg)).toBe(true);
  });

  it('rejects malformed client messages', () => {
    expect(isClientToServerMessage({ type: 'call_service', domain: 'light' })).toBe(false);
    expect(isClientToServerMessage({ type: 'nope' })).toBe(false);
    expect(isClientToServerMessage(null)).toBe(false);
  });
});
