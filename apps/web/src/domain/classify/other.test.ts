import { describe, it, expect } from 'vitest';
import { DEVICE_CLASS_RULES, NAME_RULES, FALLBACK_RULES, ICONS } from './other.js';
import type { ClassifyContext, OtherKind } from './types.js';

const ctx = (overrides: Partial<ClassifyContext> = {}): ClassifyContext => ({
  domain: 'switch', deviceClass: null, name: '', ...overrides,
});

function classify(c: ClassifyContext): OtherKind | string | null {
  for (const rule of [...DEVICE_CLASS_RULES, ...NAME_RULES, ...FALLBACK_RULES]) {
    if (rule.test(c)) return rule.kind;
  }
  return null;
}

describe('other rules', () => {
  it('detects a smart plug by device_class', () => {
    expect(classify(ctx({ deviceClass: 'outlet' }))).toBe('smart_plug');
  });

  it('detects an extractor fan named as a switch (the Lights → Climate fix)', () => {
    expect(classify(ctx({ name: 'extractor fan' }))).toBe('extractor_fan');
  });

  it('detects a light-like switch by reusing lighting name patterns', () => {
    expect(classify(ctx({ name: 'kitchen ceiling light' }))).toBe('ceiling_light');
    expect(classify(ctx({ name: 'bedside lamp switch' }))).toBe('bedside_lamp');
  });

  it('falls back to switch_generic for an unrecognized switch', () => {
    expect(classify(ctx({ name: 'utility switch' }))).toBe('switch_generic');
  });

  it('classifies the scene domain as scene', () => {
    expect(classify(ctx({ domain: 'scene', name: 'movie night' }))).toBe('scene');
  });

  it('detects power, energy, illuminance, and pressure sensors by device_class', () => {
    expect(classify(ctx({ domain: 'sensor', deviceClass: 'power' }))).toBe('power_sensor');
    expect(classify(ctx({ domain: 'sensor', deviceClass: 'energy' }))).toBe('energy_sensor');
    expect(classify(ctx({ domain: 'sensor', deviceClass: 'illuminance' }))).toBe('illuminance_sensor');
    expect(classify(ctx({ domain: 'sensor', deviceClass: 'pressure' }))).toBe('pressure_sensor');
  });

  it('falls back to sensor_generic for an unrecognized sensor', () => {
    expect(classify(ctx({ domain: 'sensor', name: 'mystery sensor' }))).toBe('sensor_generic');
  });

  it('falls back to sensor_generic for any other unmatched domain', () => {
    expect(classify(ctx({ domain: 'mystery', name: 'mystery entity' }))).toBe('sensor_generic');
  });

  it('provides a non-empty icon for every other kind', () => {
    for (const icon of Object.values(ICONS)) {
      expect(icon).toBeTruthy();
    }
  });
});
