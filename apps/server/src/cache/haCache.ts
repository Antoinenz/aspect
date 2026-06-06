import type {
  Area,
  Device,
  EntityState,
  RegistryEntry,
  WorldSnapshot,
} from '@aspect/shared';

/**
 * In-memory authoritative cache of the Home Assistant world. Passive: it has
 * no knowledge of HA or sockets. The connection layer feeds it; the client hub
 * reads snapshots from it. Entities are keyed by entityId for O(1) upserts.
 */
export class HaCache {
  private entities = new Map<string, EntityState>();
  private areas: Area[] = [];
  private devices: Device[] = [];
  private registry: RegistryEntry[] = [];

  setSnapshot(snapshot: WorldSnapshot): void {
    this.entities = new Map(snapshot.entities.map((e) => [e.entityId, e]));
    this.areas = [...snapshot.areas];
    this.devices = [...snapshot.devices];
    this.registry = [...snapshot.registry];
  }

  setRegistries(input: {
    areas: Area[];
    devices: Device[];
    registry: RegistryEntry[];
  }): void {
    this.areas = [...input.areas];
    this.devices = [...input.devices];
    this.registry = [...input.registry];
  }

  /** Upsert one entity. Returns true if the cached value actually changed. */
  applyEntity(entity: EntityState): boolean {
    const existing = this.entities.get(entity.entityId);
    if (existing && shallowEntityEqual(existing, entity)) return false;
    this.entities.set(entity.entityId, entity);
    return true;
  }

  /** Remove one entity. Returns true if it existed. */
  removeEntity(entityId: string): boolean {
    return this.entities.delete(entityId);
  }

  /** A stable, sorted-by-entityId view of the whole world. */
  getSnapshot(): WorldSnapshot {
    const entities = [...this.entities.values()].sort((a, b) =>
      a.entityId < b.entityId ? -1 : a.entityId > b.entityId ? 1 : 0,
    );
    return {
      entities,
      areas: [...this.areas],
      devices: [...this.devices],
      registry: [...this.registry],
    };
  }
}

function shallowEntityEqual(a: EntityState, b: EntityState): boolean {
  return (
    a.state === b.state &&
    a.lastUpdated === b.lastUpdated &&
    a.lastChanged === b.lastChanged &&
    JSON.stringify(a.attributes) === JSON.stringify(b.attributes)
  );
}
