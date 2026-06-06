import { describe, it, expect } from 'vitest';
import {
  normalizeEntity,
  normalizeArea,
  normalizeDevice,
  normalizeRegistryEntry,
} from '../../src/ha/normalize.js';

describe('normalizeEntity', () => {
  it('maps HA snake_case fields to camelCase domain shape', () => {
    const result = normalizeEntity({
      entity_id: 'light.kitchen',
      state: 'on',
      attributes: { brightness: 200 },
      last_changed: '2026-01-01T00:00:00Z',
      last_updated: '2026-01-01T00:00:01Z',
    });
    expect(result).toEqual({
      entityId: 'light.kitchen',
      state: 'on',
      attributes: { brightness: 200 },
      lastChanged: '2026-01-01T00:00:00Z',
      lastUpdated: '2026-01-01T00:00:01Z',
    });
  });

  it('defaults missing attributes to an empty object', () => {
    const result = normalizeEntity({
      entity_id: 'sensor.x',
      state: '5',
      last_changed: 't',
      last_updated: 't',
    });
    expect(result.attributes).toEqual({});
  });
});

describe('normalizeArea', () => {
  it('maps area_id and name', () => {
    expect(normalizeArea({ area_id: 'kitchen', name: 'Kitchen' })).toEqual({
      areaId: 'kitchen',
      name: 'Kitchen',
    });
  });
});

describe('normalizeDevice', () => {
  it('prefers name_by_user over name', () => {
    expect(
      normalizeDevice({
        id: 'dev1',
        name: 'Generic Bulb',
        name_by_user: 'Kitchen Bulb',
        area_id: 'kitchen',
      }),
    ).toEqual({ deviceId: 'dev1', name: 'Kitchen Bulb', areaId: 'kitchen' });
  });

  it('falls back to name and null area', () => {
    expect(
      normalizeDevice({ id: 'dev2', name: 'Bulb', name_by_user: null, area_id: null }),
    ).toEqual({ deviceId: 'dev2', name: 'Bulb', areaId: null });
  });
});

describe('normalizeRegistryEntry', () => {
  it('prefers name over original_name', () => {
    expect(
      normalizeRegistryEntry({
        entity_id: 'light.kitchen',
        device_id: 'dev1',
        area_id: null,
        name: 'My Light',
        original_name: 'Light',
        platform: 'hue',
      }),
    ).toEqual({
      entityId: 'light.kitchen',
      deviceId: 'dev1',
      areaId: null,
      name: 'My Light',
      platform: 'hue',
    });
  });

  it('falls back to original_name when name is null', () => {
    const r = normalizeRegistryEntry({
      entity_id: 'light.x',
      device_id: null,
      area_id: 'kitchen',
      name: null,
      original_name: 'Original',
      platform: 'hue',
    });
    expect(r.name).toBe('Original');
  });
});
