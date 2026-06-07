import {
  mdiLightbulb, mdiCeilingLight, mdiPowerSocket, mdiThermostat, mdiSnowflake,
  mdiBlindsHorizontal, mdiLock, mdiFan, mdiPalette, mdiScriptText, mdiRobot,
  mdiGestureTapButton, mdiFormatListBulleted, mdiTuneVertical, mdiSpeaker,
  mdiThermometer, mdiWaterPercent, mdiFlash, mdiMotionSensor, mdiDoorOpen,
  mdiWeatherPartlyCloudy, mdiToggleSwitchVariant, mdiHelpCircleOutline,
} from '@mdi/js';
import { domainOf } from './entities.js';
import type { EntityState } from '@aspect/shared';

const DOMAIN_ICON: Record<string, string> = {
  light: mdiLightbulb,
  switch: mdiToggleSwitchVariant,
  climate: mdiThermostat,
  cover: mdiBlindsHorizontal,
  lock: mdiLock,
  fan: mdiFan,
  scene: mdiPalette,
  script: mdiScriptText,
  automation: mdiRobot,
  button: mdiGestureTapButton,
  select: mdiFormatListBulleted,
  number: mdiTuneVertical,
  media_player: mdiSpeaker,
};

const SENSOR_CLASS_ICON: Record<string, string> = {
  battery: mdiFlash,
  temperature: mdiThermometer,
  humidity: mdiWaterPercent,
  power: mdiFlash,
  motion: mdiMotionSensor,
  door: mdiDoorOpen,
  window: mdiDoorOpen,
};

/** Best MDI path for an entity, using device_class for sensors. */
export function iconFor(entity: EntityState): string {
  const domain = domainOf(entity.entityId);
  if (domain === 'sensor' || domain === 'binary_sensor') {
    const dc = entity.attributes.device_class;
    if (typeof dc === 'string' && SENSOR_CLASS_ICON[dc]) return SENSOR_CLASS_ICON[dc]!;
    return domain === 'binary_sensor' ? mdiMotionSensor : mdiThermometer;
  }
  if (domain === 'weather') return mdiWeatherPartlyCloudy;
  if (domain === 'ceiling_light') return mdiCeilingLight;
  if (domain === 'outlet') return mdiPowerSocket;
  if (domain === 'air') return mdiSnowflake;
  return DOMAIN_ICON[domain] ?? mdiHelpCircleOutline;
}

/** Subtle icon tint by domain (Apple-style); null = neutral. */
export function tintFor(domain: string): string | null {
  if (domain === 'light') return '#ffd27d';
  if (domain === 'climate' || domain === 'cover') return '#86c2ff';
  if (domain === 'lock') return '#8ee6b0';
  return null;
}
