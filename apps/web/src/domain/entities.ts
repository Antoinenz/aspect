import type { EntityState } from '@aspect/shared';

/** Domains Aspect renders in v1. */
export const SUPPORTED_DOMAINS: ReadonlySet<string> = new Set([
  'light',
  'switch',
  'climate',
  'cover',
  'lock',
  'fan',
  'scene',
  'sensor',
  'binary_sensor',
]);

const ICONS: Record<string, string> = {
  light: '💡',
  switch: '🔌',
  climate: '🌡️',
  cover: '🪟',
  lock: '🔒',
  fan: '🌀',
  scene: '🎬',
  sensor: '📈',
  binary_sensor: '⚪',
};

const ACTIVE_STATES: Record<string, string> = {
  light: 'on',
  switch: 'on',
  fan: 'on',
  binary_sensor: 'on',
  cover: 'open',
  lock: 'unlocked',
};

export function domainOf(entityId: string): string {
  const dot = entityId.indexOf('.');
  return dot === -1 ? entityId : entityId.slice(0, dot);
}

export function isSupported(entityId: string): boolean {
  return SUPPORTED_DOMAINS.has(domainOf(entityId));
}

export function prettifyId(entityId: string): string {
  const obj = entityId.slice(entityId.indexOf('.') + 1);
  return obj
    .split('_')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function friendlyName(
  entity: EntityState,
  registryName: string | null,
): string {
  if (registryName) return registryName;
  const fn = entity.attributes.friendly_name;
  if (typeof fn === 'string' && fn.length > 0) return fn;
  return prettifyId(entity.entityId);
}

export function domainIcon(domain: string): string {
  return ICONS[domain] ?? '◾';
}

export function isActive(entity: EntityState): boolean {
  if (entity.state === 'unavailable' || entity.state === 'unknown') return false;
  const expected = ACTIVE_STATES[domainOf(entity.entityId)];
  return expected !== undefined && entity.state === expected;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function formatState(entity: EntityState): string {
  if (entity.state === 'unavailable') return 'Unavailable';
  if (entity.state === 'unknown') return 'Unknown';

  const domain = domainOf(entity.entityId);

  if (domain === 'light' && entity.state === 'on') {
    const b = entity.attributes.brightness;
    if (typeof b === 'number') {
      return `On · ${Math.round((b / 255) * 100)}%`;
    }
    return 'On';
  }

  if (domain === 'sensor') {
    const unit = entity.attributes.unit_of_measurement;
    return typeof unit === 'string' ? `${entity.state} ${unit}` : entity.state;
  }

  return capitalize(entity.state.replace(/_/g, ' '));
}
