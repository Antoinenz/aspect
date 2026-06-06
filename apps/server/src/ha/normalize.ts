import type {
  Area,
  Device,
  EntityState,
  RegistryEntry,
} from '@aspect/shared';

/** Raw HA entity state as delivered by get_states / state_changed events. */
export interface RawHassEntity {
  entity_id: string;
  state: string;
  attributes?: Record<string, unknown>;
  last_changed: string;
  last_updated: string;
}

export interface RawArea {
  area_id: string;
  name: string;
}

export interface RawDevice {
  id: string;
  name: string | null;
  name_by_user?: string | null;
  area_id: string | null;
}

export interface RawRegistryEntry {
  entity_id: string;
  device_id: string | null;
  area_id: string | null;
  name: string | null;
  original_name?: string | null;
  platform: string;
}

export function normalizeEntity(raw: RawHassEntity): EntityState {
  return {
    entityId: raw.entity_id,
    state: raw.state,
    attributes: raw.attributes ?? {},
    lastChanged: raw.last_changed,
    lastUpdated: raw.last_updated,
  };
}

export function normalizeArea(raw: RawArea): Area {
  return { areaId: raw.area_id, name: raw.name };
}

export function normalizeDevice(raw: RawDevice): Device {
  return {
    deviceId: raw.id,
    name: raw.name_by_user ?? raw.name,
    areaId: raw.area_id,
  };
}

export function normalizeRegistryEntry(raw: RawRegistryEntry): RegistryEntry {
  return {
    entityId: raw.entity_id,
    deviceId: raw.device_id,
    areaId: raw.area_id,
    name: raw.name ?? raw.original_name ?? null,
    platform: raw.platform,
  };
}
