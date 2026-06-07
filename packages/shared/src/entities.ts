/** A single Home Assistant entity's current state, normalized for Aspect. */
export interface EntityState {
  entityId: string;
  /** e.g. "on", "off", "23.5", "unavailable". */
  state: string;
  attributes: Record<string, unknown>;
  /** ISO 8601 timestamp. */
  lastChanged: string;
  /** ISO 8601 timestamp. */
  lastUpdated: string;
}

/** A Home Assistant area (room/zone). */
export interface Area {
  areaId: string;
  name: string;
}

/** A Home Assistant device. */
export interface Device {
  deviceId: string;
  name: string | null;
  areaId: string | null;
}

export type EntityCategory = 'config' | 'diagnostic';

/** A Home Assistant entity-registry entry (links an entity to a device/area). */
export interface RegistryEntry {
  entityId: string;
  deviceId: string | null;
  areaId: string | null;
  /** User-given or original friendly name, if any. */
  name: string | null;
  platform: string;
  /** 'config'/'diagnostic' entities are hidden from the main views. */
  entityCategory: EntityCategory | null;
  /** True if HA marks the entity hidden. */
  hidden: boolean;
  /** True if HA marks the entity disabled. */
  disabled: boolean;
  /** e.g. 'battery', 'temperature', 'motion' — drives icons & battery grouping. */
  deviceClass: string | null;
}

/** The full cached world the server knows about. */
export interface WorldSnapshot {
  entities: EntityState[];
  areas: Area[];
  devices: Device[];
  registry: RegistryEntry[];
}
