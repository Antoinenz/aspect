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
