import { describe, it, expect } from 'vitest';
import {
  domainOf,
  isSupported,
  friendlyName,
  domainIcon,
  isActive,
  formatState,
} from './entities.js';
import type { EntityState } from '@aspect/shared';

const e = (
  entityId: string,
  state: string,
  attributes: Record<string, unknown> = {},
): EntityState => ({ entityId, state, attributes, lastChanged: 't', lastUpdated: 't' });

describe('domainOf', () => {
  it('extracts the domain', () => {
    expect(domainOf('light.kitchen')).toBe('light');
    expect(domainOf('binary_sensor.door')).toBe('binary_sensor');
  });
});

describe('isSupported', () => {
  it('accepts v1 domains and rejects others', () => {
    expect(isSupported('light.x')).toBe(true);
    expect(isSupported('climate.x')).toBe(true);
    expect(isSupported('camera.x')).toBe(false);
    expect(isSupported('media_player.x')).toBe(false);
  });
});

describe('friendlyName', () => {
  it('prefers the registry name', () => {
    expect(friendlyName(e('light.kitchen', 'on'), 'Kitchen Lamp')).toBe('Kitchen Lamp');
  });
  it('falls back to friendly_name attribute', () => {
    expect(friendlyName(e('light.kitchen', 'on', { friendly_name: 'Kitchen' }), null)).toBe('Kitchen');
  });
  it('prettifies the entity id as a last resort', () => {
    expect(friendlyName(e('light.living_room_lamp', 'on'), null)).toBe('Living Room Lamp');
  });
});

describe('domainIcon', () => {
  it('returns an icon per domain and a default', () => {
    expect(domainIcon('light')).toBeTypeOf('string');
    expect(domainIcon('unknowndomain')).toBeTypeOf('string');
  });
});

describe('isActive', () => {
  it('is true for on/open/unlocked, false otherwise', () => {
    expect(isActive(e('light.x', 'on'))).toBe(true);
    expect(isActive(e('cover.x', 'open'))).toBe(true);
    expect(isActive(e('lock.x', 'unlocked'))).toBe(true);
    expect(isActive(e('light.x', 'off'))).toBe(false);
    expect(isActive(e('sensor.x', '21.5'))).toBe(false);
    expect(isActive(e('light.x', 'unavailable'))).toBe(false);
  });
});

describe('formatState', () => {
  it('appends unit_of_measurement for sensors', () => {
    expect(formatState(e('sensor.temp', '21.5', { unit_of_measurement: '°C' }))).toBe('21.5 °C');
  });
  it('shows brightness percent for lights that are on', () => {
    expect(formatState(e('light.x', 'on', { brightness: 128 }))).toBe('On · 50%');
  });
  it('capitalizes simple states', () => {
    expect(formatState(e('switch.x', 'off'))).toBe('Off');
    expect(formatState(e('lock.x', 'unlocked'))).toBe('Unlocked');
  });
  it('shows a friendly label for unavailable', () => {
    expect(formatState(e('light.x', 'unavailable'))).toBe('Unavailable');
  });
  it('replaces underscores with spaces in the fallback', () => {
    expect(formatState(e('climate.hvac', 'heat_cool'))).toBe('Heat cool');
  });
});
