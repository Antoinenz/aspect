import { describe, it, expect } from 'vitest';
import { HaCache } from '../../src/cache/haCache.js';
import type { EntityState } from '@aspect/shared';

const entity = (id: string, state: string): EntityState => ({
  entityId: id,
  state,
  attributes: {},
  lastChanged: 't',
  lastUpdated: 't',
});

describe('HaCache', () => {
  it('starts empty', () => {
    const cache = new HaCache();
    const snap = cache.getSnapshot();
    expect(snap.entities).toEqual([]);
    expect(snap.areas).toEqual([]);
  });

  it('stores a snapshot and returns it sorted by entityId', () => {
    const cache = new HaCache();
    cache.setSnapshot({
      entities: [entity('light.b', 'on'), entity('light.a', 'off')],
      areas: [{ areaId: 'k', name: 'Kitchen' }],
      devices: [],
      registry: [],
    });
    const snap = cache.getSnapshot();
    expect(snap.entities.map((e) => e.entityId)).toEqual(['light.a', 'light.b']);
    expect(snap.areas).toHaveLength(1);
  });

  it('upserts a single entity and reports it as changed', () => {
    const cache = new HaCache();
    cache.setSnapshot({ entities: [entity('light.a', 'off')], areas: [], devices: [], registry: [] });
    const changed = cache.applyEntity(entity('light.a', 'on'));
    expect(changed).toBe(true);
    expect(cache.getSnapshot().entities[0]?.state).toBe('on');
  });

  it('returns false when an upsert does not change anything', () => {
    const cache = new HaCache();
    const e = entity('light.a', 'on');
    cache.applyEntity(e);
    expect(cache.applyEntity({ ...e })).toBe(false);
  });

  it('removes an entity and reports whether it existed', () => {
    const cache = new HaCache();
    cache.applyEntity(entity('light.a', 'on'));
    expect(cache.removeEntity('light.a')).toBe(true);
    expect(cache.removeEntity('light.a')).toBe(false);
    expect(cache.getSnapshot().entities).toEqual([]);
  });

  it('replaces registries without touching entities', () => {
    const cache = new HaCache();
    cache.applyEntity(entity('light.a', 'on'));
    cache.setRegistries({
      areas: [{ areaId: 'k', name: 'Kitchen' }],
      devices: [{ deviceId: 'd', name: 'D', areaId: 'k' }],
      registry: [],
    });
    const snap = cache.getSnapshot();
    expect(snap.entities).toHaveLength(1);
    expect(snap.areas).toHaveLength(1);
    expect(snap.devices).toHaveLength(1);
  });
});
