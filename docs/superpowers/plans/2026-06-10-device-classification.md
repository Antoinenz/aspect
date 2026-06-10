# Device Classification (Kinds, Icons & Filtering) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Aspect's coarse domain/`device_class`-only icon and filter logic with a fine-grained per-entity `DeviceKind` classifier (`classifyDevice`), so tiles show more specific icons (ceiling light vs pendant vs bedside lamp, TV vs speaker, extractor fan vs ceiling fan, etc.) and filter pills (Lights/Climate/Security/Playing) categorize entities correctly — fixing the extractor fan showing under "Lights" instead of "Climate".

**Architecture:** A new `apps/web/src/domain/classify/` module tree. Five category modules (`lighting`, `airAndClimate`, `security`, `media`, `other`) each export an ordered slice of detection rules (`DEVICE_CLASS_RULES`, `NAME_RULES`, `FALLBACK_RULES`) plus an icon map for their kinds. `classify/iconAttr.ts` holds a flat map of unambiguous HA `icon` attribute slugs → `DeviceKind` (checked first, before any rules). `classify/index.ts` concatenates the rule arrays in global priority order (icon-attr → device_class → name heuristics → domain fallback) and exposes `classifyDevice`, `iconForKind`, `filterCategoryForKind`, `tintForKind`. `apps/web/src/domain/icons.ts` and `apps/web/src/dashboard/filterView.ts` become thin wrappers over this module; `apps/web/src/domain/deviceClass.ts` is removed.

**Tech Stack:** TypeScript 5.7.2, Vitest 3.0.5, `@mdi/js` 7.4.47, React 19 (call-site updates only — no new UI).

---

## File Structure

**Create:**
- `apps/web/src/domain/classify/types.ts` — `DeviceKind` (composed from 5 category unions), `FilterKind`, `ClassifyContext`, `Rule`, `contextFor()`
- `apps/web/src/domain/classify/types.test.ts`
- `apps/web/src/domain/classify/iconAttr.ts` — HA icon-slug → `DeviceKind` map + `classifyByIconAttr()`
- `apps/web/src/domain/classify/iconAttr.test.ts`
- `apps/web/src/domain/classify/lighting.ts` — light domain rules + icons
- `apps/web/src/domain/classify/lighting.test.ts`
- `apps/web/src/domain/classify/airAndClimate.ts` — fan, climate, shading covers, climate sensors
- `apps/web/src/domain/classify/airAndClimate.test.ts`
- `apps/web/src/domain/classify/security.ts` — lock, access covers, binary_sensors
- `apps/web/src/domain/classify/security.test.ts`
- `apps/web/src/domain/classify/media.ts` — media_player
- `apps/web/src/domain/classify/media.test.ts`
- `apps/web/src/domain/classify/other.ts` — switch, scene, non-climate sensors, universal fallback
- `apps/web/src/domain/classify/other.test.ts`
- `apps/web/src/domain/classify/index.ts` — `classifyDevice`, `iconForKind`, `filterCategoryForKind`, `tintForKind`
- `apps/web/src/domain/classify/index.test.ts`

**Modify:**
- `apps/web/src/domain/icons.ts` — `iconFor`/`tintFor` become thin wrappers over `classify/index.js`
- `apps/web/src/domain/icons.test.ts` — update for new `tintFor(entity)` signature
- `apps/web/src/dashboard/filterView.ts` — `matchesFilter` uses `classifyDevice`/`filterCategoryForKind`; `FilterKind` re-exported from `classify/index.js`
- `apps/web/src/dashboard/filterView.test.ts` (new) — extractor fan → climate, motion sensor → security
- `apps/web/src/dashboard/FilterPanel.tsx:6-7,182` — `tintFor(re.entity)`, drop unused `domainOf`
- `apps/web/src/dashboard/RoomTab.tsx:5-6,43` — `tintFor(re.entity)`, drop unused `domainOf`
- `apps/web/src/dashboard/QuickAccessTab.tsx:54,227` — `tintFor(entity)` (keep `domainOf`, used elsewhere)
- `apps/web/src/dashboard/SummaryTab.tsx:278` — `tintFor(entity)` (keep `domainOf`, used elsewhere)

**Remove:**
- `apps/web/src/domain/deviceClass.ts`

---

## Task 1: `classify/types.ts` + `classify/iconAttr.ts`

**Files:**
- Create: `apps/web/src/domain/classify/types.ts`
- Create: `apps/web/src/domain/classify/types.test.ts`
- Create: `apps/web/src/domain/classify/iconAttr.ts`
- Create: `apps/web/src/domain/classify/iconAttr.test.ts`

- [ ] **Step 1: Write the failing test for `contextFor`**

Create `apps/web/src/domain/classify/types.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { contextFor } from './types.js';
import type { EntityState } from '@aspect/shared';

const e = (id: string, attrs: Record<string, unknown> = {}): EntityState => ({
  entityId: id, state: 'on', attributes: attrs, lastChanged: 't', lastUpdated: 't',
});

describe('contextFor', () => {
  it('extracts domain, device_class, and a lowercased name', () => {
    const ctx = contextFor(
      e('fan.bathroom_extractor', { friendly_name: 'Extractor Fan', device_class: 'fan' }),
      'fan',
    );
    expect(ctx).toEqual({ domain: 'fan', deviceClass: 'fan', name: 'extractor fan' });
  });

  it('defaults to an empty name and null device_class when absent', () => {
    const ctx = contextFor(e('light.k'), 'light');
    expect(ctx).toEqual({ domain: 'light', deviceClass: null, name: '' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run src/domain/classify/types.test.ts`
Expected: FAIL — `Cannot find module './types.js'` (file doesn't exist yet).

- [ ] **Step 3: Write `types.ts`**

Create `apps/web/src/domain/classify/types.ts`:

```ts
import type { EntityState } from '@aspect/shared';

export type LightingKind =
  | 'ceiling_light'
  | 'pendant_light'
  | 'chandelier'
  | 'wall_light'
  | 'floor_lamp'
  | 'desk_lamp'
  | 'bedside_lamp'
  | 'led_strip'
  | 'spotlight'
  | 'nightlight'
  | 'light_generic';

export type AirClimateKind =
  | 'extractor_fan'
  | 'ceiling_fan'
  | 'pedestal_fan'
  | 'air_purifier'
  | 'fan_generic'
  | 'thermostat'
  | 'trv'
  | 'climate_generic'
  | 'blind'
  | 'curtain'
  | 'shutter'
  | 'awning'
  | 'damper'
  | 'cover_generic'
  | 'temperature_sensor'
  | 'humidity_sensor'
  | 'co2_sensor'
  | 'air_quality_sensor';

export type SecurityKind =
  | 'garage_door'
  | 'gate'
  | 'door_cover'
  | 'window_cover'
  | 'lock'
  | 'motion_sensor'
  | 'occupancy_sensor'
  | 'vibration_sensor'
  | 'door_sensor'
  | 'window_sensor'
  | 'smoke_sensor'
  | 'gas_sensor'
  | 'co_sensor'
  | 'leak_sensor'
  | 'safety_sensor'
  | 'binary_sensor_generic';

export type MediaKind = 'tv' | 'speaker' | 'soundbar' | 'receiver' | 'media_generic';

export type OtherKind =
  | 'smart_plug'
  | 'switch_generic'
  | 'scene'
  | 'power_sensor'
  | 'energy_sensor'
  | 'illuminance_sensor'
  | 'pressure_sensor'
  | 'sensor_generic';

export type DeviceKind = LightingKind | AirClimateKind | SecurityKind | MediaKind | OtherKind;

export type FilterKind = 'lights' | 'climate' | 'security' | 'playing';

/** Inputs the rule engine matches against — derived once per entity. */
export interface ClassifyContext {
  domain: string;
  deviceClass: string | null;
  /** Lowercased `friendly_name`, or `''` if absent. */
  name: string;
}

export interface Rule {
  kind: DeviceKind;
  test: (ctx: ClassifyContext) => boolean;
}

export function contextFor(entity: EntityState, domain: string): ClassifyContext {
  const dc = entity.attributes.device_class;
  const fn = entity.attributes.friendly_name;
  return {
    domain,
    deviceClass: typeof dc === 'string' ? dc : null,
    name: typeof fn === 'string' ? fn.toLowerCase() : '',
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run src/domain/classify/types.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Write the failing test for `classifyByIconAttr`**

Create `apps/web/src/domain/classify/iconAttr.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { classifyByIconAttr } from './iconAttr.js';

describe('classifyByIconAttr', () => {
  it('maps known, specific icon slugs to a kind', () => {
    expect(classifyByIconAttr('mdi:ceiling-light')).toBe('ceiling_light');
    expect(classifyByIconAttr('mdi:television')).toBe('tv');
    expect(classifyByIconAttr('mdi:ceiling-fan')).toBe('ceiling_fan');
  });

  it('returns null for generic or unknown icons', () => {
    expect(classifyByIconAttr('mdi:lightbulb')).toBeNull();
    expect(classifyByIconAttr('mdi:something-unknown')).toBeNull();
  });

  it('returns null when there is no icon attribute', () => {
    expect(classifyByIconAttr(null)).toBeNull();
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `cd apps/web && npx vitest run src/domain/classify/iconAttr.test.ts`
Expected: FAIL — `Cannot find module './iconAttr.js'`

- [ ] **Step 7: Write `iconAttr.ts`**

Create `apps/web/src/domain/classify/iconAttr.ts`:

```ts
import type { DeviceKind } from './types.js';

/**
 * HA `icon` attribute slugs (e.g. "mdi:ceiling-light") that unambiguously imply
 * a DeviceKind. Only specific icons are listed here — generic ones like
 * "mdi:lightbulb" or "mdi:fan" fall through to device_class/name heuristics.
 */
export const ICON_ATTR_KIND: Record<string, DeviceKind> = {
  // Lighting
  'mdi:ceiling-light': 'ceiling_light',
  'mdi:ceiling-light-multiple': 'pendant_light',
  'mdi:floor-lamp': 'floor_lamp',
  'mdi:desk-lamp': 'desk_lamp',
  'mdi:wall-sconce': 'wall_light',
  'mdi:wall-sconce-flat': 'wall_light',
  'mdi:chandelier': 'chandelier',
  'mdi:led-strip': 'led_strip',
  'mdi:led-strip-variant': 'led_strip',
  'mdi:lightbulb-night': 'nightlight',
  'mdi:lightbulb-night-outline': 'nightlight',
  'mdi:spotlight': 'spotlight',
  'mdi:spotlight-beam': 'spotlight',
  'mdi:track-light': 'spotlight',

  // Air & climate
  'mdi:ceiling-fan': 'ceiling_fan',
  'mdi:air-purifier': 'air_purifier',
  'mdi:thermostat': 'thermostat',
  'mdi:radiator': 'trv',
  'mdi:blinds': 'blind',
  'mdi:blinds-horizontal': 'blind',
  'mdi:blinds-vertical': 'blind',
  'mdi:curtains': 'curtain',
  'mdi:curtains-closed': 'curtain',
  'mdi:window-shutter': 'shutter',
  'mdi:window-shutter-open': 'shutter',
  'mdi:awning': 'awning',
  'mdi:awning-outline': 'awning',

  // Security
  'mdi:garage': 'garage_door',
  'mdi:garage-variant': 'garage_door',
  'mdi:gate': 'gate',
  'mdi:motion-sensor': 'motion_sensor',
  'mdi:vibrate': 'vibration_sensor',
  'mdi:smoke-detector': 'smoke_sensor',
  'mdi:smoke-detector-variant': 'smoke_sensor',
  'mdi:gas-cylinder': 'gas_sensor',
  'mdi:molecule-co': 'co_sensor',
  'mdi:molecule-co2': 'co2_sensor',
  'mdi:water-alert': 'leak_sensor',
  'mdi:shield-alert': 'safety_sensor',

  // Media
  'mdi:television': 'tv',
  'mdi:television-classic': 'tv',
  'mdi:soundbar': 'soundbar',
  'mdi:amplifier': 'receiver',
  'mdi:speaker': 'speaker',
  'mdi:speaker-wireless': 'speaker',

  // Other
  'mdi:power-plug': 'smart_plug',
  'mdi:power-socket': 'smart_plug',
};

export function classifyByIconAttr(icon: string | null): DeviceKind | null {
  if (!icon) return null;
  return ICON_ATTR_KIND[icon] ?? null;
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `cd apps/web && npx vitest run src/domain/classify/iconAttr.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/domain/classify/types.ts apps/web/src/domain/classify/types.test.ts apps/web/src/domain/classify/iconAttr.ts apps/web/src/domain/classify/iconAttr.test.ts
git commit -m "feat(web): add device classification types and icon-attribute map"
```

---

## Task 2: `classify/lighting.ts`

**Files:**
- Create: `apps/web/src/domain/classify/lighting.ts`
- Create: `apps/web/src/domain/classify/lighting.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/domain/classify/lighting.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run src/domain/classify/lighting.test.ts`
Expected: FAIL — `Cannot find module './lighting.js'`

- [ ] **Step 3: Write `lighting.ts`**

Create `apps/web/src/domain/classify/lighting.ts`:

```ts
import {
  mdiCeilingLight, mdiCeilingLightMultiple, mdiChandelier, mdiWallSconceFlat,
  mdiFloorLamp, mdiDeskLamp, mdiLampOutline, mdiLedStrip, mdiSpotlight,
  mdiLightbulbNightOutline, mdiLightbulb,
} from '@mdi/js';
import type { ClassifyContext, LightingKind, Rule } from './types.js';

export const LIGHT_NAME_PATTERNS: ReadonlyArray<readonly [RegExp, LightingKind]> = [
  [/pendant/i, 'pendant_light'],
  [/chandelier/i, 'chandelier'],
  [/bedside|nightstand/i, 'bedside_lamp'],
  [/night ?light/i, 'nightlight'],
  [/floor lamp|floor light/i, 'floor_lamp'],
  [/desk lamp|desk light/i, 'desk_lamp'],
  [/wall light|wall lamp|sconce/i, 'wall_light'],
  [/led strip|light strip|strip light/i, 'led_strip'],
  [/spotlight|spot light|track light/i, 'spotlight'],
  [/ceiling/i, 'ceiling_light'],
];

export const DEVICE_CLASS_RULES: Rule[] = [];

export const NAME_RULES: Rule[] = LIGHT_NAME_PATTERNS.map(([re, kind]) => ({
  kind,
  test: (ctx: ClassifyContext) => ctx.domain === 'light' && re.test(ctx.name),
}));

export const FALLBACK_RULES: Rule[] = [
  { kind: 'light_generic', test: (ctx) => ctx.domain === 'light' },
];

export const ICONS: Record<LightingKind, string> = {
  ceiling_light: mdiCeilingLight,
  pendant_light: mdiCeilingLightMultiple,
  chandelier: mdiChandelier,
  wall_light: mdiWallSconceFlat,
  floor_lamp: mdiFloorLamp,
  desk_lamp: mdiDeskLamp,
  bedside_lamp: mdiLampOutline,
  led_strip: mdiLedStrip,
  spotlight: mdiSpotlight,
  nightlight: mdiLightbulbNightOutline,
  light_generic: mdiLightbulb,
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run src/domain/classify/lighting.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/domain/classify/lighting.ts apps/web/src/domain/classify/lighting.test.ts
git commit -m "feat(web): add lighting device-kind rules"
```

---

## Task 3: `classify/airAndClimate.ts`

**Files:**
- Create: `apps/web/src/domain/classify/airAndClimate.ts`
- Create: `apps/web/src/domain/classify/airAndClimate.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/domain/classify/airAndClimate.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { DEVICE_CLASS_RULES, NAME_RULES, FALLBACK_RULES, ICONS, FAN_NAME_PATTERNS } from './airAndClimate.js';
import type { AirClimateKind, ClassifyContext } from './types.js';

const ctx = (overrides: Partial<ClassifyContext> = {}): ClassifyContext => ({
  domain: 'fan', deviceClass: null, name: '', ...overrides,
});

function classify(c: ClassifyContext): AirClimateKind | null {
  for (const rule of [...DEVICE_CLASS_RULES, ...NAME_RULES, ...FALLBACK_RULES]) {
    if (rule.test(c)) return rule.kind as AirClimateKind;
  }
  return null;
}

describe('air & climate rules', () => {
  it('detects an extractor fan by name (the Lights → Climate fix)', () => {
    expect(classify(ctx({ name: 'extractor fan' }))).toBe('extractor_fan');
    expect(classify(ctx({ name: 'bathroom exhaust fan' }))).toBe('extractor_fan');
  });

  it('detects ceiling fan and air purifier by name, falls back to fan_generic', () => {
    expect(classify(ctx({ name: 'living room ceiling fan' }))).toBe('ceiling_fan');
    expect(classify(ctx({ name: 'bedroom air purifier' }))).toBe('air_purifier');
    expect(classify(ctx({ name: 'desk fan' }))).toBe('fan_generic');
  });

  it('detects a TRV vs a thermostat by name, else climate_generic', () => {
    expect(classify(ctx({ domain: 'climate', name: 'living room radiator' }))).toBe('trv');
    expect(classify(ctx({ domain: 'climate', name: 'hallway thermostat' }))).toBe('thermostat');
    expect(classify(ctx({ domain: 'climate', name: 'office climate' }))).toBe('climate_generic');
  });

  it('detects shading covers by device_class, falls back to cover_generic', () => {
    expect(classify(ctx({ domain: 'cover', deviceClass: 'blind' }))).toBe('blind');
    expect(classify(ctx({ domain: 'cover', deviceClass: 'shade' }))).toBe('blind');
    expect(classify(ctx({ domain: 'cover', deviceClass: 'curtain' }))).toBe('curtain');
    expect(classify(ctx({ domain: 'cover', deviceClass: 'shutter' }))).toBe('shutter');
    expect(classify(ctx({ domain: 'cover', deviceClass: 'awning' }))).toBe('awning');
    expect(classify(ctx({ domain: 'cover', deviceClass: 'damper' }))).toBe('damper');
    expect(classify(ctx({ domain: 'cover', name: 'office cover' }))).toBe('cover_generic');
  });

  it('detects shading covers by name when device_class is missing', () => {
    expect(classify(ctx({ domain: 'cover', name: 'lounge blind' }))).toBe('blind');
    expect(classify(ctx({ domain: 'cover', name: 'lounge curtain' }))).toBe('curtain');
  });

  it('detects climate sensors by device_class', () => {
    expect(classify(ctx({ domain: 'sensor', deviceClass: 'temperature' }))).toBe('temperature_sensor');
    expect(classify(ctx({ domain: 'sensor', deviceClass: 'humidity' }))).toBe('humidity_sensor');
    expect(classify(ctx({ domain: 'sensor', deviceClass: 'carbon_dioxide' }))).toBe('co2_sensor');
    expect(classify(ctx({ domain: 'sensor', deviceClass: 'pm25' }))).toBe('air_quality_sensor');
  });

  it('exposes the extractor_fan name pattern for reuse by the switch domain', () => {
    const extractor = FAN_NAME_PATTERNS.find(([, kind]) => kind === 'extractor_fan');
    expect(extractor?.[0].test('Extractor Fan')).toBe(true);
  });

  it('provides a non-empty icon for every air/climate kind', () => {
    for (const icon of Object.values(ICONS)) {
      expect(icon).toBeTruthy();
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run src/domain/classify/airAndClimate.test.ts`
Expected: FAIL — `Cannot find module './airAndClimate.js'`

- [ ] **Step 3: Write `airAndClimate.ts`**

Create `apps/web/src/domain/classify/airAndClimate.ts`:

```ts
import {
  mdiAirFilter, mdiCeilingFan, mdiFan, mdiAirPurifier,
  mdiThermostat, mdiRadiator,
  mdiBlindsHorizontal, mdiCurtains, mdiWindowShutter, mdiAwning, mdiHvac,
  mdiThermometer, mdiWaterPercent, mdiMoleculeCo2, mdiQualityHigh,
} from '@mdi/js';
import type { AirClimateKind, ClassifyContext, Rule } from './types.js';

export const FAN_NAME_PATTERNS: ReadonlyArray<readonly [RegExp, AirClimateKind]> = [
  [/extract|exhaust/i, 'extractor_fan'],
  [/ceiling fan/i, 'ceiling_fan'],
  [/pedestal|tower fan|stand(ing)? fan/i, 'pedestal_fan'],
  [/purifier/i, 'air_purifier'],
];

const CLIMATE_NAME_PATTERNS: ReadonlyArray<readonly [RegExp, AirClimateKind]> = [
  [/trv|radiator|valve/i, 'trv'],
  [/thermostat/i, 'thermostat'],
];

const SHADE_COVER_DEVICE_CLASS: Record<string, AirClimateKind> = {
  blind: 'blind',
  shade: 'blind',
  curtain: 'curtain',
  awning: 'awning',
  shutter: 'shutter',
  damper: 'damper',
};

const COVER_NAME_PATTERNS: ReadonlyArray<readonly [RegExp, AirClimateKind]> = [
  [/blind/i, 'blind'],
  [/curtain/i, 'curtain'],
  [/shutter/i, 'shutter'],
  [/awning/i, 'awning'],
  [/damper/i, 'damper'],
];

const CLIMATE_SENSOR_DEVICE_CLASS: Record<string, AirClimateKind> = {
  temperature: 'temperature_sensor',
  humidity: 'humidity_sensor',
  carbon_dioxide: 'co2_sensor',
  aqi: 'air_quality_sensor',
  pm25: 'air_quality_sensor',
  pm10: 'air_quality_sensor',
  volatile_organic_compounds: 'air_quality_sensor',
  nitrogen_dioxide: 'air_quality_sensor',
};

export const DEVICE_CLASS_RULES: Rule[] = [
  ...Object.entries(SHADE_COVER_DEVICE_CLASS).map(([dc, kind]) => ({
    kind,
    test: (ctx: ClassifyContext) => ctx.domain === 'cover' && ctx.deviceClass === dc,
  })),
  ...Object.entries(CLIMATE_SENSOR_DEVICE_CLASS).map(([dc, kind]) => ({
    kind,
    test: (ctx: ClassifyContext) => ctx.domain === 'sensor' && ctx.deviceClass === dc,
  })),
];

export const NAME_RULES: Rule[] = [
  ...FAN_NAME_PATTERNS.map(([re, kind]) => ({
    kind,
    test: (ctx: ClassifyContext) => ctx.domain === 'fan' && re.test(ctx.name),
  })),
  ...CLIMATE_NAME_PATTERNS.map(([re, kind]) => ({
    kind,
    test: (ctx: ClassifyContext) => ctx.domain === 'climate' && re.test(ctx.name),
  })),
  ...COVER_NAME_PATTERNS.map(([re, kind]) => ({
    kind,
    test: (ctx: ClassifyContext) => ctx.domain === 'cover' && re.test(ctx.name),
  })),
];

export const FALLBACK_RULES: Rule[] = [
  { kind: 'fan_generic', test: (ctx) => ctx.domain === 'fan' },
  { kind: 'climate_generic', test: (ctx) => ctx.domain === 'climate' },
  { kind: 'cover_generic', test: (ctx) => ctx.domain === 'cover' },
];

export const ICONS: Record<AirClimateKind, string> = {
  extractor_fan: mdiAirFilter,
  ceiling_fan: mdiCeilingFan,
  pedestal_fan: mdiFan,
  air_purifier: mdiAirPurifier,
  fan_generic: mdiFan,
  thermostat: mdiThermostat,
  trv: mdiRadiator,
  climate_generic: mdiThermostat,
  blind: mdiBlindsHorizontal,
  curtain: mdiCurtains,
  shutter: mdiWindowShutter,
  awning: mdiAwning,
  damper: mdiHvac,
  cover_generic: mdiBlindsHorizontal,
  temperature_sensor: mdiThermometer,
  humidity_sensor: mdiWaterPercent,
  co2_sensor: mdiMoleculeCo2,
  air_quality_sensor: mdiQualityHigh,
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run src/domain/classify/airAndClimate.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/domain/classify/airAndClimate.ts apps/web/src/domain/classify/airAndClimate.test.ts
git commit -m "feat(web): add fan/climate/cover/climate-sensor device-kind rules"
```

---

## Task 4: `classify/security.ts`

**Files:**
- Create: `apps/web/src/domain/classify/security.ts`
- Create: `apps/web/src/domain/classify/security.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/domain/classify/security.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run src/domain/classify/security.test.ts`
Expected: FAIL — `Cannot find module './security.js'`

- [ ] **Step 3: Write `security.ts`**

Create `apps/web/src/domain/classify/security.ts`:

```ts
import {
  mdiGarage, mdiGate, mdiDoorOpen, mdiWindowOpen, mdiLock,
  mdiMotionSensor, mdiVibrate, mdiSmokeDetector, mdiGasCylinder, mdiMoleculeCo,
  mdiWaterAlert, mdiShieldAlert,
} from '@mdi/js';
import type { ClassifyContext, Rule, SecurityKind } from './types.js';

const ACCESS_COVER_DEVICE_CLASS: Record<string, SecurityKind> = {
  garage: 'garage_door',
  gate: 'gate',
  door: 'door_cover',
  window: 'window_cover',
};

const ACCESS_COVER_NAME_PATTERNS: ReadonlyArray<readonly [RegExp, SecurityKind]> = [
  [/garage/i, 'garage_door'],
  [/gate/i, 'gate'],
  [/window/i, 'window_cover'],
  [/door/i, 'door_cover'],
];

const BINARY_SENSOR_DEVICE_CLASS: Record<string, SecurityKind> = {
  door: 'door_sensor',
  garage_door: 'door_sensor',
  window: 'window_sensor',
  opening: 'window_sensor',
  motion: 'motion_sensor',
  occupancy: 'occupancy_sensor',
  presence: 'occupancy_sensor',
  moisture: 'leak_sensor',
  smoke: 'smoke_sensor',
  gas: 'gas_sensor',
  carbon_monoxide: 'co_sensor',
  safety: 'safety_sensor',
  vibration: 'vibration_sensor',
};

const BINARY_SENSOR_NAME_PATTERNS: ReadonlyArray<readonly [RegExp, SecurityKind]> = [
  [/motion/i, 'motion_sensor'],
  [/occupanc|presence/i, 'occupancy_sensor'],
  [/vibrat/i, 'vibration_sensor'],
  [/leak|moisture|water/i, 'leak_sensor'],
  [/smoke/i, 'smoke_sensor'],
  [/gas/i, 'gas_sensor'],
  [/carbon monoxide|\bco\b/i, 'co_sensor'],
  [/window/i, 'window_sensor'],
  [/door/i, 'door_sensor'],
];

export const DEVICE_CLASS_RULES: Rule[] = [
  ...Object.entries(ACCESS_COVER_DEVICE_CLASS).map(([dc, kind]) => ({
    kind,
    test: (ctx: ClassifyContext) => ctx.domain === 'cover' && ctx.deviceClass === dc,
  })),
  ...Object.entries(BINARY_SENSOR_DEVICE_CLASS).map(([dc, kind]) => ({
    kind,
    test: (ctx: ClassifyContext) => ctx.domain === 'binary_sensor' && ctx.deviceClass === dc,
  })),
];

export const NAME_RULES: Rule[] = [
  ...ACCESS_COVER_NAME_PATTERNS.map(([re, kind]) => ({
    kind,
    test: (ctx: ClassifyContext) => ctx.domain === 'cover' && re.test(ctx.name),
  })),
  ...BINARY_SENSOR_NAME_PATTERNS.map(([re, kind]) => ({
    kind,
    test: (ctx: ClassifyContext) => ctx.domain === 'binary_sensor' && re.test(ctx.name),
  })),
];

export const FALLBACK_RULES: Rule[] = [
  { kind: 'lock', test: (ctx) => ctx.domain === 'lock' },
  { kind: 'binary_sensor_generic', test: (ctx) => ctx.domain === 'binary_sensor' },
];

export const ICONS: Record<SecurityKind, string> = {
  garage_door: mdiGarage,
  gate: mdiGate,
  door_cover: mdiDoorOpen,
  window_cover: mdiWindowOpen,
  lock: mdiLock,
  motion_sensor: mdiMotionSensor,
  occupancy_sensor: mdiMotionSensor,
  vibration_sensor: mdiVibrate,
  door_sensor: mdiDoorOpen,
  window_sensor: mdiWindowOpen,
  smoke_sensor: mdiSmokeDetector,
  gas_sensor: mdiGasCylinder,
  co_sensor: mdiMoleculeCo,
  leak_sensor: mdiWaterAlert,
  safety_sensor: mdiShieldAlert,
  binary_sensor_generic: mdiMotionSensor,
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run src/domain/classify/security.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/domain/classify/security.ts apps/web/src/domain/classify/security.test.ts
git commit -m "feat(web): add lock/access-cover/binary-sensor device-kind rules"
```

---

## Task 5: `classify/media.ts`

**Files:**
- Create: `apps/web/src/domain/classify/media.ts`
- Create: `apps/web/src/domain/classify/media.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/domain/classify/media.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { NAME_RULES, FALLBACK_RULES, ICONS } from './media.js';
import type { ClassifyContext, MediaKind } from './types.js';

const ctx = (overrides: Partial<ClassifyContext> = {}): ClassifyContext => ({
  domain: 'media_player', deviceClass: null, name: '', ...overrides,
});

function classify(c: ClassifyContext): MediaKind | null {
  for (const rule of [...NAME_RULES, ...FALLBACK_RULES]) {
    if (rule.test(c)) return rule.kind as MediaKind;
  }
  return null;
}

describe('media rules', () => {
  it('detects a TV by name', () => {
    expect(classify(ctx({ name: 'living room tv' }))).toBe('tv');
    expect(classify(ctx({ name: 'bedroom television' }))).toBe('tv');
  });

  it('detects a soundbar and receiver by name', () => {
    expect(classify(ctx({ name: 'tv soundbar' }))).toBe('soundbar');
    expect(classify(ctx({ name: 'av receiver' }))).toBe('receiver');
  });

  it('detects a speaker by name', () => {
    expect(classify(ctx({ name: 'kitchen speaker' }))).toBe('speaker');
  });

  it('falls back to media_generic', () => {
    expect(classify(ctx({ name: 'media player' }))).toBe('media_generic');
  });

  it('provides a non-empty icon for every media kind', () => {
    for (const icon of Object.values(ICONS)) {
      expect(icon).toBeTruthy();
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run src/domain/classify/media.test.ts`
Expected: FAIL — `Cannot find module './media.js'`

- [ ] **Step 3: Write `media.ts`**

Create `apps/web/src/domain/classify/media.ts`:

```ts
import { mdiTelevision, mdiSpeaker, mdiSoundbar, mdiAmplifier } from '@mdi/js';
import type { ClassifyContext, MediaKind, Rule } from './types.js';

const MEDIA_NAME_PATTERNS: ReadonlyArray<readonly [RegExp, MediaKind]> = [
  [/\btv\b|television/i, 'tv'],
  [/sound\s?bar/i, 'soundbar'],
  [/receiver|amplifier|\bamp\b/i, 'receiver'],
  [/speaker/i, 'speaker'],
];

export const DEVICE_CLASS_RULES: Rule[] = [];

export const NAME_RULES: Rule[] = MEDIA_NAME_PATTERNS.map(([re, kind]) => ({
  kind,
  test: (ctx: ClassifyContext) => ctx.domain === 'media_player' && re.test(ctx.name),
}));

export const FALLBACK_RULES: Rule[] = [
  { kind: 'media_generic', test: (ctx) => ctx.domain === 'media_player' },
];

export const ICONS: Record<MediaKind, string> = {
  tv: mdiTelevision,
  speaker: mdiSpeaker,
  soundbar: mdiSoundbar,
  receiver: mdiAmplifier,
  media_generic: mdiSpeaker,
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run src/domain/classify/media.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/domain/classify/media.ts apps/web/src/domain/classify/media.test.ts
git commit -m "feat(web): add media_player device-kind rules"
```

---

## Task 6: `classify/other.ts`

**Files:**
- Create: `apps/web/src/domain/classify/other.ts`
- Create: `apps/web/src/domain/classify/other.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/domain/classify/other.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run src/domain/classify/other.test.ts`
Expected: FAIL — `Cannot find module './other.js'`

- [ ] **Step 3: Write `other.ts`**

Create `apps/web/src/domain/classify/other.ts`:

```ts
import {
  mdiPowerPlug, mdiToggleSwitchVariant, mdiPalette, mdiFlash, mdiLightningBolt,
  mdiBrightness5, mdiGauge, mdiThermometer,
} from '@mdi/js';
import { LIGHT_NAME_PATTERNS } from './lighting.js';
import { FAN_NAME_PATTERNS } from './airAndClimate.js';
import type { ClassifyContext, OtherKind, Rule } from './types.js';

const SENSOR_DEVICE_CLASS: Record<string, OtherKind> = {
  power: 'power_sensor',
  energy: 'energy_sensor',
  illuminance: 'illuminance_sensor',
  pressure: 'pressure_sensor',
  atmospheric_pressure: 'pressure_sensor',
};

export const DEVICE_CLASS_RULES: Rule[] = [
  { kind: 'smart_plug', test: (ctx) => ctx.domain === 'switch' && ctx.deviceClass === 'outlet' },
  ...Object.entries(SENSOR_DEVICE_CLASS).map(([dc, kind]) => ({
    kind,
    test: (ctx: ClassifyContext) => ctx.domain === 'sensor' && ctx.deviceClass === dc,
  })),
];

export const NAME_RULES: Rule[] = [
  ...FAN_NAME_PATTERNS
    .filter(([, kind]) => kind === 'extractor_fan')
    .map(([re, kind]) => ({
      kind,
      test: (ctx: ClassifyContext) => ctx.domain === 'switch' && re.test(ctx.name),
    })),
  ...LIGHT_NAME_PATTERNS.map(([re, kind]) => ({
    kind,
    test: (ctx: ClassifyContext) => ctx.domain === 'switch' && re.test(ctx.name),
  })),
];

export const FALLBACK_RULES: Rule[] = [
  { kind: 'switch_generic', test: (ctx) => ctx.domain === 'switch' },
  { kind: 'scene', test: (ctx) => ctx.domain === 'scene' },
  { kind: 'sensor_generic', test: (ctx) => ctx.domain === 'sensor' },
  { kind: 'sensor_generic', test: () => true },
];

export const ICONS: Record<OtherKind, string> = {
  smart_plug: mdiPowerPlug,
  switch_generic: mdiToggleSwitchVariant,
  scene: mdiPalette,
  power_sensor: mdiFlash,
  energy_sensor: mdiLightningBolt,
  illuminance_sensor: mdiBrightness5,
  pressure_sensor: mdiGauge,
  sensor_generic: mdiThermometer,
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run src/domain/classify/other.test.ts`
Expected: PASS (9 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/domain/classify/other.ts apps/web/src/domain/classify/other.test.ts
git commit -m "feat(web): add switch/scene/other-sensor device-kind rules and universal fallback"
```

---

## Task 7: `classify/index.ts`

**Files:**
- Create: `apps/web/src/domain/classify/index.ts`
- Create: `apps/web/src/domain/classify/index.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/domain/classify/index.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { classifyDevice, iconForKind, filterCategoryForKind, tintForKind } from './index.js';
import type { EntityState } from '@aspect/shared';

const e = (id: string, attrs: Record<string, unknown> = {}): EntityState => ({
  entityId: id, state: 'on', attributes: attrs, lastChanged: 't', lastUpdated: 't',
});

describe('classifyDevice', () => {
  it('prefers an explicit icon attribute over name heuristics', () => {
    expect(classifyDevice(e('light.island', {
      icon: 'mdi:ceiling-light-multiple',
      friendly_name: 'Island Light',
    }))).toBe('pendant_light');
  });

  it('prefers device_class over name for shading covers', () => {
    expect(classifyDevice(e('cover.lounge', {
      device_class: 'blind',
      friendly_name: 'Lounge Curtain',
    }))).toBe('blind');
  });

  it('classifies a fan named "Extractor Fan" as extractor_fan in the climate bucket', () => {
    const kind = classifyDevice(e('fan.bathroom_extractor', { friendly_name: 'Extractor Fan' }));
    expect(kind).toBe('extractor_fan');
    expect(filterCategoryForKind(kind)).toBe('climate');
  });

  it('classifies a switch named "Extractor Fan" the same way', () => {
    const kind = classifyDevice(e('switch.bathroom_extractor', { friendly_name: 'Extractor Fan' }));
    expect(kind).toBe('extractor_fan');
    expect(filterCategoryForKind(kind)).toBe('climate');
  });

  it('classifies an outlet switch as a smart plug with no filter bucket', () => {
    const kind = classifyDevice(e('switch.lamp_plug', { device_class: 'outlet' }));
    expect(kind).toBe('smart_plug');
    expect(filterCategoryForKind(kind)).toBeNull();
  });

  it('classifies a motion binary_sensor under security', () => {
    const kind = classifyDevice(e('binary_sensor.hallway', { device_class: 'motion' }));
    expect(kind).toBe('motion_sensor');
    expect(filterCategoryForKind(kind)).toBe('security');
  });

  it('classifies an unmatched light as light_generic, lights bucket, amber tint', () => {
    const kind = classifyDevice(e('light.study', { friendly_name: 'Study' }));
    expect(kind).toBe('light_generic');
    expect(filterCategoryForKind(kind)).toBe('lights');
    expect(tintForKind(kind)).toBe('#ffd27d');
  });

  it('classifies a TV under the playing bucket with a null tint', () => {
    const kind = classifyDevice(e('media_player.living_room_tv', { friendly_name: 'Living Room TV' }));
    expect(kind).toBe('tv');
    expect(filterCategoryForKind(kind)).toBe('playing');
    expect(tintForKind(kind)).toBeNull();
  });

  it('falls back to sensor_generic with a non-empty icon for an unknown domain', () => {
    const kind = classifyDevice(e('mystery.x'));
    expect(kind).toBe('sensor_generic');
    expect(iconForKind(kind)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run src/domain/classify/index.test.ts`
Expected: FAIL — `Cannot find module './index.js'`

- [ ] **Step 3: Write `index.ts`**

Create `apps/web/src/domain/classify/index.ts`:

```ts
import type { EntityState } from '@aspect/shared';
import { domainOf } from '../entities.js';
import { classifyByIconAttr } from './iconAttr.js';
import * as lighting from './lighting.js';
import * as airAndClimate from './airAndClimate.js';
import * as security from './security.js';
import * as media from './media.js';
import * as other from './other.js';
import { contextFor } from './types.js';
import type { DeviceKind, FilterKind } from './types.js';

export type { DeviceKind, FilterKind } from './types.js';

const DEVICE_CLASS_RULES = [
  ...lighting.DEVICE_CLASS_RULES,
  ...airAndClimate.DEVICE_CLASS_RULES,
  ...security.DEVICE_CLASS_RULES,
  ...media.DEVICE_CLASS_RULES,
  ...other.DEVICE_CLASS_RULES,
];

const NAME_RULES = [
  ...lighting.NAME_RULES,
  ...airAndClimate.NAME_RULES,
  ...security.NAME_RULES,
  ...media.NAME_RULES,
  ...other.NAME_RULES,
];

const FALLBACK_RULES = [
  ...lighting.FALLBACK_RULES,
  ...airAndClimate.FALLBACK_RULES,
  ...security.FALLBACK_RULES,
  ...media.FALLBACK_RULES,
  ...other.FALLBACK_RULES,
];

const ALL_RULES = [...DEVICE_CLASS_RULES, ...NAME_RULES, ...FALLBACK_RULES];

const ICONS: Record<DeviceKind, string> = {
  ...lighting.ICONS,
  ...airAndClimate.ICONS,
  ...security.ICONS,
  ...media.ICONS,
  ...other.ICONS,
};

/**
 * Classifies an entity into a fine-grained DeviceKind.
 * Priority: explicit `icon` attribute → device_class → name heuristics → domain fallback.
 */
export function classifyDevice(entity: EntityState): DeviceKind {
  const icon = entity.attributes.icon;
  const fromIcon = classifyByIconAttr(typeof icon === 'string' ? icon : null);
  if (fromIcon) return fromIcon;

  const ctx = contextFor(entity, domainOf(entity.entityId));
  for (const rule of ALL_RULES) {
    if (rule.test(ctx)) return rule.kind;
  }
  return 'sensor_generic';
}

export function iconForKind(kind: DeviceKind): string {
  return ICONS[kind];
}

const FILTER_CATEGORY: Record<DeviceKind, FilterKind | null> = {
  // Lighting
  ceiling_light: 'lights', pendant_light: 'lights', chandelier: 'lights', wall_light: 'lights',
  floor_lamp: 'lights', desk_lamp: 'lights', bedside_lamp: 'lights', led_strip: 'lights',
  spotlight: 'lights', nightlight: 'lights', light_generic: 'lights',
  // Air & climate
  extractor_fan: 'climate', ceiling_fan: 'climate', pedestal_fan: 'climate', air_purifier: 'climate', fan_generic: 'climate',
  thermostat: 'climate', trv: 'climate', climate_generic: 'climate',
  blind: 'climate', curtain: 'climate', shutter: 'climate', awning: 'climate', damper: 'climate', cover_generic: 'climate',
  temperature_sensor: 'climate', humidity_sensor: 'climate', co2_sensor: 'climate', air_quality_sensor: 'climate',
  // Security
  garage_door: 'security', gate: 'security', door_cover: 'security', window_cover: 'security',
  lock: 'security',
  motion_sensor: 'security', occupancy_sensor: 'security', vibration_sensor: 'security',
  door_sensor: 'security', window_sensor: 'security', smoke_sensor: 'security', gas_sensor: 'security',
  co_sensor: 'security', leak_sensor: 'security', safety_sensor: 'security', binary_sensor_generic: null,
  // Media
  tv: 'playing', speaker: 'playing', soundbar: 'playing', receiver: 'playing', media_generic: 'playing',
  // Other
  smart_plug: null, switch_generic: null, scene: null,
  power_sensor: null, energy_sensor: null, illuminance_sensor: null, pressure_sensor: null, sensor_generic: null,
};

export function filterCategoryForKind(kind: DeviceKind): FilterKind | null {
  return FILTER_CATEGORY[kind];
}

const FILTER_TINT: Record<FilterKind, string | null> = {
  lights: '#ffd27d',
  climate: '#86c2ff',
  security: '#8ee6b0',
  playing: null,
};

export function tintForKind(kind: DeviceKind): string | null {
  const filter = filterCategoryForKind(kind);
  return filter ? FILTER_TINT[filter] : null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run src/domain/classify/index.test.ts`
Expected: PASS (9 tests)

- [ ] **Step 5: Run the full classify suite**

Run: `cd apps/web && npx vitest run src/domain/classify`
Expected: PASS (all files in Tasks 1–7)

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/domain/classify/index.ts apps/web/src/domain/classify/index.test.ts
git commit -m "feat(web): add classifyDevice entry point combining all device-kind rules"
```

---

## Task 8: Rewire `icons.ts`, remove `deviceClass.ts`

**Files:**
- Modify: `apps/web/src/domain/icons.ts`
- Modify: `apps/web/src/domain/icons.test.ts`
- Delete: `apps/web/src/domain/deviceClass.ts`

- [ ] **Step 1: Update `icons.test.ts` for the new `tintFor(entity)` signature**

Replace the full contents of `apps/web/src/domain/icons.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { iconFor, tintFor } from './icons.js';
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

  it('uses device_class for sensors (temperature vs illuminance)', () => {
    expect(iconFor(e('sensor.t', { device_class: 'temperature' })))
      .not.toBe(iconFor(e('sensor.l', { device_class: 'illuminance' })));
  });

  it('falls back to a default path for unknown domains', () => {
    expect(iconFor(e('mystery.x'))).toBeTruthy();
  });
});

describe('tintFor', () => {
  it('tints lights amber and climate blue', () => {
    expect(tintFor(e('light.k'))).toBe('#ffd27d');
    expect(tintFor(e('climate.k'))).toBe('#86c2ff');
  });

  it('routes an extractor fan to the climate tint (Lights → Climate fix)', () => {
    expect(tintFor(e('fan.bathroom_extractor', { friendly_name: 'Extractor Fan' }))).toBe('#86c2ff');
  });

  it('returns null for media players', () => {
    expect(tintFor(e('media_player.tv'))).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run src/domain/icons.test.ts`
Expected: FAIL — `tintFor` still takes a `domain: string`, so `tintFor(e('light.k'))` type-errors / `tintFor(e(...))` returns `null` for all (string vs object mismatch).

- [ ] **Step 3: Rewrite `icons.ts`**

Replace the full contents of `apps/web/src/domain/icons.ts`:

```ts
import { classifyDevice, iconForKind, tintForKind } from './classify/index.js';
import type { EntityState } from '@aspect/shared';

/** Best MDI path for an entity, based on its detected DeviceKind. */
export function iconFor(entity: EntityState): string {
  return iconForKind(classifyDevice(entity));
}

/** Subtle icon tint by filter category (Apple-style); null = neutral. */
export function tintFor(entity: EntityState): string | null {
  return tintForKind(classifyDevice(entity));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run src/domain/icons.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Remove `deviceClass.ts`**

```bash
git rm apps/web/src/domain/deviceClass.ts
```

(`filterView.ts` is the only importer — it's updated in Task 9.)

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/domain/icons.ts apps/web/src/domain/icons.test.ts
git commit -m "feat(web): rewire iconFor/tintFor onto classifyDevice"
```

---

## Task 9: Rewire `filterView.ts`

**Files:**
- Modify: `apps/web/src/dashboard/filterView.ts`
- Create: `apps/web/src/dashboard/filterView.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/dashboard/filterView.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { filterRooms, hasCategory } from './filterView.js';
import type { Room } from './rooms.js';
import type { EntityState } from '@aspect/shared';

const e = (id: string, attrs: Record<string, unknown> = {}): EntityState => ({
  entityId: id, state: 'on', attributes: attrs, lastChanged: 't', lastUpdated: 't',
});

const room = (areaId: string, name: string, entities: EntityState[]): Room => ({
  areaId,
  name,
  entities: entities.map((entity) => ({
    entity, name: entity.attributes.friendly_name as string ?? entity.entityId,
    domain: entity.entityId.split('.')[0]!, battery: null, wide: false,
  })),
});

describe('filterRooms', () => {
  it('puts an extractor fan under climate, not lights', () => {
    const rooms: Room[] = [room('bathroom', 'Bathroom', [
      e('fan.bathroom_extractor', { friendly_name: 'Extractor Fan' }),
    ])];

    expect(filterRooms(rooms, 'climate')).toHaveLength(1);
    expect(filterRooms(rooms, 'lights')).toHaveLength(0);
  });

  it('puts a motion sensor under security', () => {
    const rooms: Room[] = [room('porch', 'Porch', [
      e('binary_sensor.porch_motion', { friendly_name: 'Porch Motion', device_class: 'motion' }),
    ])];

    expect(hasCategory(rooms, 'security')).toBe(true);
    expect(hasCategory(rooms, 'lights')).toBe(false);
  });

  it('puts a ceiling light under lights', () => {
    const rooms: Room[] = [room('hallway', 'Hallway', [
      e('light.hallway_ceiling', { friendly_name: 'Hallway Ceiling Light' }),
    ])];

    expect(hasCategory(rooms, 'lights')).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run src/dashboard/filterView.test.ts`
Expected: FAIL — extractor fan currently matches `'lights'` (domain `fan`), not `'climate'`.

- [ ] **Step 3: Rewrite `filterView.ts`**

Replace the full contents of `apps/web/src/dashboard/filterView.ts`:

```ts
import type { Room, RoomEntity } from './rooms.js';
import { classifyDevice, filterCategoryForKind } from '../domain/classify/index.js';
import type { FilterKind } from '../domain/classify/index.js';

export type { FilterKind };

function matchesFilter(re: RoomEntity, kind: FilterKind): boolean {
  return filterCategoryForKind(classifyDevice(re.entity)) === kind;
}

export interface FilteredRoom {
  areaId: string;
  name: string;
  entities: RoomEntity[];
}

export function filterRooms(rooms: Room[], kind: FilterKind): FilteredRoom[] {
  return rooms
    .map((room) => ({
      areaId: room.areaId,
      name: room.name,
      entities: room.entities.filter((re) => matchesFilter(re, kind)),
    }))
    .filter((r) => r.entities.length > 0);
}

/** Returns true if any room contains at least one entity matching the category. */
export function hasCategory(rooms: Room[], kind: FilterKind): boolean {
  return rooms.some((room) => room.entities.some((re) => matchesFilter(re, kind)));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run src/dashboard/filterView.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/dashboard/filterView.ts apps/web/src/dashboard/filterView.test.ts
git commit -m "feat(web): classify entities for filter pills, fixing extractor fan bucket"
```

---

## Task 10: Update call sites for the new `tintFor(entity)` signature

**Files:**
- Modify: `apps/web/src/dashboard/FilterPanel.tsx:6-7,182`
- Modify: `apps/web/src/dashboard/RoomTab.tsx:5-6,43`
- Modify: `apps/web/src/dashboard/QuickAccessTab.tsx:54,227`
- Modify: `apps/web/src/dashboard/SummaryTab.tsx:278`

- [ ] **Step 1: `FilterPanel.tsx` — drop unused `domainOf`, fix `tintFor` call**

In `apps/web/src/dashboard/FilterPanel.tsx`, change line 6 from:

```tsx
import { formatState, isActive, domainOf } from '../domain/entities.js';
```

to:

```tsx
import { formatState, isActive } from '../domain/entities.js';
```

Then change line 182 from:

```tsx
                  tint={tintFor(domainOf(re.entity.entityId))}
```

to:

```tsx
                  tint={tintFor(re.entity)}
```

- [ ] **Step 2: `RoomTab.tsx` — drop unused `domainOf`, fix `tintFor` call**

In `apps/web/src/dashboard/RoomTab.tsx`, change line 5 from:

```tsx
import { formatState, isActive, domainOf } from '../domain/entities.js';
```

to:

```tsx
import { formatState, isActive } from '../domain/entities.js';
```

Then change line 43 from:

```tsx
          tint={tintFor(domainOf(re.entity.entityId))}
```

to:

```tsx
          tint={tintFor(re.entity)}
```

- [ ] **Step 3: `QuickAccessTab.tsx` — fix both `tintFor` calls (keep `domainOf`)**

`domainOf` is used elsewhere in this file (the `wide` calculations and `isDevice`), so keep its import on line 11.

Change line 54 from:

```tsx
            tint={tintFor(domainOf(entity.entityId))}
```

to:

```tsx
            tint={tintFor(entity)}
```

Change line 227 from:

```tsx
                  tint={tintFor(domainOf(entity.entityId))}
```

to:

```tsx
                  tint={tintFor(entity)}
```

- [ ] **Step 4: `SummaryTab.tsx` — fix the thermostat tile's `tintFor` call (keep `domainOf`)**

`domainOf` is used elsewhere in this file (the `allLights` filter), so keep its import on line 17.

Change line 278 from:

```tsx
                      <Tile key={id} path={iconFor(entity)} tint={tintFor('climate')} name={friendlyName(entity, null)}
```

to:

```tsx
                      <Tile key={id} path={iconFor(entity)} tint={tintFor(entity)} name={friendlyName(entity, null)}
```

- [ ] **Step 5: Typecheck**

Run: `cd apps/web && npx tsc --noEmit`
Expected: No errors (confirms no leftover `domainOf` imports are unused, and all `tintFor`/`iconFor` call sites match the new signatures).

- [ ] **Step 6: Run the full web test suite**

Run: `cd apps/web && npx vitest run`
Expected: PASS — all existing tests plus the new `classify/*`, `icons.test.ts`, and `filterView.test.ts` suites.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/dashboard/FilterPanel.tsx apps/web/src/dashboard/RoomTab.tsx apps/web/src/dashboard/QuickAccessTab.tsx apps/web/src/dashboard/SummaryTab.tsx
git commit -m "feat(web): pass entity to tintFor at all call sites"
```

---

## Manual verification

- [ ] **Step 1: Start the dev server in demo mode and check the Bathroom room**

Run: `cd apps/web && npm run dev` (or the project's usual dev command), open the app, enable demo mode, and navigate to the Bathroom room.

Expected: "Extractor Fan" now renders with the air-filter icon and a blue (climate) tint instead of an amber (lights) tint.

- [ ] **Step 2: Check the Climate filter pill on the Home tab**

Expected: "Extractor Fan" appears under the Climate filter; it no longer appears under Lights.

- [ ] **Step 3: Check the Security filter pill**

Expected: "Porch Motion" (`sensor.porch_motion` in demo data has no `device_class`, so it classifies as `sensor_generic` and is correctly excluded — confirm it does *not* appear under Security, since it's a `sensor.*` not `binary_sensor.*` entity). If a `binary_sensor.*` motion entity exists in demo data, confirm it *does* appear under Security.

---

## Self-review notes

- **Spec coverage:** All taxonomy kinds from the design doc's Section 3 table are present in `types.ts` and have icons in the corresponding category module. The 4-step detection algorithm (icon attr → device_class → name heuristics → domain fallback) is implemented in `classify/index.ts` via `ALL_RULES` ordering. `FilterKind` is defined in `classify/types.ts` and re-exported from `filterView.ts` per Section 5. `deviceClass.ts` is removed in Task 8. All 5 call sites are updated in Task 10.
- **Extractor fan fix:** Covered by `airAndClimate.test.ts` (fan domain), `other.test.ts` (switch domain), `index.test.ts` (integration), and `filterView.test.ts` (end-to-end through `filterRooms`).
- **Motion sensor fix:** Covered by `security.test.ts` and `index.test.ts`; `filterView.test.ts` confirms a `binary_sensor` with `device_class: 'motion'` lands in the security bucket.
- **Type consistency:** `Rule.kind: DeviceKind` accepts each category's narrower kind union (`LightingKind`, `AirClimateKind`, etc.) since they're all subsets of `DeviceKind`. `ICONS: Record<DeviceKind, string>` in `index.ts` is built from the union of five disjoint per-category `Record<XKind, string>` maps, covering all 58 kinds with no gaps or overlaps.
