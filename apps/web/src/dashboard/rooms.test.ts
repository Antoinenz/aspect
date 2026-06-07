import { describe, it, expect } from 'vitest';
import { buildRooms } from './rooms.js';
import type { Area, Device, EntityState, RegistryEntry } from '@aspect/shared';

const e = (entityId: string, state = 'on'): EntityState => ({
  entityId,
  state,
  attributes: {},
  lastChanged: 't',
  lastUpdated: 't',
});
const reg = (
  entityId: string,
  areaId: string | null,
  deviceId: string | null = null,
  name: string | null = null,
): RegistryEntry => ({
  entityId,
  areaId,
  deviceId,
  name,
  platform: 'demo',
  entityCategory: null,
  hidden: false,
  disabled: false,
  deviceClass: null,
});

describe('buildRooms', () => {
  it('groups entities by their registry area, sorted by area then name', () => {
    const entities: Record<string, EntityState> = {
      'light.b': e('light.b'),
      'light.a': e('light.a'),
    };
    const areas: Area[] = [
      { areaId: 'living', name: 'Living Room' },
      { areaId: 'kitchen', name: 'Kitchen' },
    ];
    const registry: RegistryEntry[] = [
      reg('light.a', 'kitchen', null, 'A Light'),
      reg('light.b', 'living', null, 'B Light'),
    ];
    const rooms = buildRooms(entities, areas, [], registry);
    expect(rooms.map((r) => r.name)).toEqual(['Kitchen', 'Living Room']);
    expect(rooms[0]?.entities[0]?.name).toBe('A Light');
  });

  it('resolves area through the device when the entity has none', () => {
    const entities = { 'light.a': e('light.a') };
    const areas: Area[] = [{ areaId: 'kitchen', name: 'Kitchen' }];
    const devices: Device[] = [{ deviceId: 'd1', name: 'Bulb', areaId: 'kitchen' }];
    const registry: RegistryEntry[] = [reg('light.a', null, 'd1')];
    const rooms = buildRooms(entities, areas, devices, registry);
    expect(rooms[0]?.name).toBe('Kitchen');
  });

  it('puts area-less entities in an "Other" room at the end', () => {
    const entities = { 'light.a': e('light.a'), 'light.b': e('light.b') };
    const areas: Area[] = [{ areaId: 'kitchen', name: 'Kitchen' }];
    const registry: RegistryEntry[] = [reg('light.a', 'kitchen')];
    const rooms = buildRooms(entities, areas, [], registry);
    expect(rooms.map((r) => r.name)).toEqual(['Kitchen', 'Other']);
    expect(rooms[1]?.entities[0]?.entity.entityId).toBe('light.b');
  });

  it('excludes unsupported domains and empty rooms', () => {
    const entities = { 'camera.front': e('camera.front'), 'light.a': e('light.a') };
    const areas: Area[] = [
      { areaId: 'kitchen', name: 'Kitchen' },
      { areaId: 'garden', name: 'Garden' },
    ];
    const registry: RegistryEntry[] = [
      reg('light.a', 'kitchen'),
      reg('camera.front', 'garden'),
    ];
    const rooms = buildRooms(entities, areas, [], registry);
    expect(rooms.map((r) => r.name)).toEqual(['Kitchen']);
  });

  it('attaches domain and resolved display name to each entity', () => {
    const entities = { 'light.kitchen_lamp': e('light.kitchen_lamp') };
    const rooms = buildRooms(entities, [], [], []);
    const re = rooms[0]?.entities[0];
    expect(re?.domain).toBe('light');
    expect(re?.name).toBe('Kitchen Lamp');
  });
});
