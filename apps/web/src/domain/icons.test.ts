import { describe, it, expect } from 'vitest';
import { iconFor } from './icons.js';
import type { EntityState } from '@aspect/shared';

const e = (id: string, attrs: Record<string, unknown> = {}): EntityState => ({
  entityId: id, state: 'on', attributes: attrs, lastChanged: 't', lastUpdated: 't',
});

describe('iconFor', () => {
  it('returns a non-empty MDI path for known domains', () => {
    expect(iconFor(e('light.k'))).toBeTruthy();
    expect(iconFor(e('climate.k'))).toBeTruthy();
    expect(iconFor(e('lock.k'))).toBeTruthy();
  });
  it('uses device_class for sensors (battery, temperature)', () => {
    expect(iconFor(e('sensor.b', { device_class: 'battery' }))).not.toBe(iconFor(e('sensor.t', { device_class: 'temperature' })));
  });
  it('falls back to a default path for unknown domains', () => {
    expect(iconFor(e('mystery.x'))).toBeTruthy();
  });
});
