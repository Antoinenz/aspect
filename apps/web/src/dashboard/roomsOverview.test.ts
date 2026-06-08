import { describe, it, expect } from 'vitest';
import { roomsOverview } from './roomsOverview.js';
import type { Room } from './rooms.js';
import type { EntityState } from '@aspect/shared';

const re = (id: string, state: string) => ({
  entity: { entityId: id, state, attributes: {}, lastChanged: 't', lastUpdated: 't' } as EntityState,
  name: id, domain: id.split('.')[0]!, battery: null, wide: false,
});

describe('roomsOverview', () => {
  it('computes device and active counts per room', () => {
    const rooms: Room[] = [
      { areaId: 'k', name: 'Kitchen', entities: [re('light.a', 'on'), re('light.b', 'off'), re('switch.c', 'on')] },
      { areaId: 'b', name: 'Bedroom', entities: [re('light.d', 'off')] },
    ];
    expect(roomsOverview(rooms)).toEqual([
      { areaId: 'k', name: 'Kitchen', deviceCount: 3, onCount: 2 },
      { areaId: 'b', name: 'Bedroom', deviceCount: 1, onCount: 0 },
    ]);
  });
});
