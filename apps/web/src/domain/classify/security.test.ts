import { describe, it, expect } from 'vitest';
import { DEVICE_CLASS_RULES, NAME_RULES, FALLBACK_RULES, ICONS } from './security.js';
import type { ClassifyContext, SecurityKind } from './types.js';

const ctx = (overrides: Partial<ClassifyContext> = {}): ClassifyContext => ({
  domain: 'binary_sensor', deviceClass: null, name: '', ...overrides,
});

function classify(c: ClassifyContext): SecurityKind | null {
  for (const rule of [...DEVICE_CLASS_RULES, ...NAME_RULES, ...FALLBACK_RULES]) {
    if (rule.test(c)) return rule.kind as SecurityKind;
  }
  return null;
}

describe('security rules', () => {
  it('detects access covers by device_class', () => {
    expect(classify(ctx({ domain: 'cover', deviceClass: 'garage' }))).toBe('garage_door');
    expect(classify(ctx({ domain: 'cover', deviceClass: 'gate' }))).toBe('gate');
    expect(classify(ctx({ domain: 'cover', deviceClass: 'door' }))).toBe('door_cover');
    expect(classify(ctx({ domain: 'cover', deviceClass: 'window' }))).toBe('window_cover');
  });

  it('detects access covers by name when device_class is missing', () => {
    expect(classify(ctx({ domain: 'cover', name: 'garage door' }))).toBe('garage_door');
  });

  it('always classifies the lock domain as lock', () => {
    expect(classify(ctx({ domain: 'lock', name: 'front door' }))).toBe('lock');
  });

  it('detects motion, occupancy, and safety binary sensors by device_class', () => {
    expect(classify(ctx({ deviceClass: 'motion' }))).toBe('motion_sensor');
    expect(classify(ctx({ deviceClass: 'occupancy' }))).toBe('occupancy_sensor');
    expect(classify(ctx({ deviceClass: 'smoke' }))).toBe('smoke_sensor');
    expect(classify(ctx({ deviceClass: 'gas' }))).toBe('gas_sensor');
    expect(classify(ctx({ deviceClass: 'moisture' }))).toBe('leak_sensor');
    expect(classify(ctx({ deviceClass: 'carbon_monoxide' }))).toBe('co_sensor');
    expect(classify(ctx({ deviceClass: 'vibration' }))).toBe('vibration_sensor');
    expect(classify(ctx({ deviceClass: 'door' }))).toBe('door_sensor');
    expect(classify(ctx({ deviceClass: 'window' }))).toBe('window_sensor');
  });

  it('detects motion sensors by name when device_class is missing', () => {
    expect(classify(ctx({ name: 'porch motion' }))).toBe('motion_sensor');
  });

  it('falls back to binary_sensor_generic for unrecognized binary sensors', () => {
    expect(classify(ctx({ name: 'unknown sensor' }))).toBe('binary_sensor_generic');
  });

  it('provides a non-empty icon for every security kind', () => {
    for (const icon of Object.values(ICONS)) {
      expect(icon).toBeTruthy();
    }
  });
});
