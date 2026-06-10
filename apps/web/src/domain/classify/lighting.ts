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
