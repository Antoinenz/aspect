import { describe, it, expect } from 'vitest';
import { NAME_RULES, FALLBACK_RULES, ICONS } from './lighting.js';
import type { ClassifyContext, LightingKind } from './types.js';

const ctx = (overrides: Partial<ClassifyContext> = {}): ClassifyContext => ({
  domain: 'light', deviceClass: null, name: '', ...overrides,
});

function classify(c: ClassifyContext): LightingKind | null {
  for (const rule of [...NAME_RULES, ...FALLBACK_RULES]) {
    if (rule.test(c)) return rule.kind as LightingKind;
  }
  return null;
}

describe('lighting rules', () => {
  it('detects a pendant light by name', () => {
    expect(classify(ctx({ name: 'dining pendant' }))).toBe('pendant_light');
  });

  it('detects a bedside lamp by name', () => {
    expect(classify(ctx({ name: 'bedside lamp' }))).toBe('bedside_lamp');
    expect(classify(ctx({ name: 'nightstand lamp' }))).toBe('bedside_lamp');
  });

  it('detects a ceiling light by name', () => {
    expect(classify(ctx({ name: 'hallway ceiling light' }))).toBe('ceiling_light');
  });

  it('detects a chandelier, floor lamp, and led strip by name', () => {
    expect(classify(ctx({ name: 'dining room chandelier' }))).toBe('chandelier');
    expect(classify(ctx({ name: 'reading floor lamp' }))).toBe('floor_lamp');
    expect(classify(ctx({ name: 'tv unit led strip' }))).toBe('led_strip');
  });

  it('does not match entities outside the light domain', () => {
    expect(classify(ctx({ domain: 'switch', name: 'pendant' }))).toBeNull();
  });

  it('falls back to light_generic for unrecognized light names', () => {
    expect(classify(ctx({ name: 'study light' }))).toBe('light_generic');
  });

  it('provides a non-empty icon for every lighting kind', () => {
    for (const icon of Object.values(ICONS)) {
      expect(icon).toBeTruthy();
    }
  });
});
