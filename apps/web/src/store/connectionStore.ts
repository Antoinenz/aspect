import { create } from 'zustand';
import type {
  Area,
  Device,
  EntityState,
  RegistryEntry,
  ServerStatus,
} from '@aspect/shared';

/** Whether the browser currently holds a socket to the Aspect server. */
export type LinkState = 'disconnected' | 'connecting' | 'connected';

interface ConnectionState {
  link: LinkState;
  serverStatus: ServerStatus | null;
  haConnected: boolean;
  entities: Record<string, EntityState>;
  areas: Area[];
  devices: Device[];
  registry: RegistryEntry[];
  setLink: (link: LinkState) => void;
  applyStatus: (status: ServerStatus, haConnected: boolean) => void;
  applySnapshot: (snapshot: {
    entities: EntityState[];
    areas: Area[];
    devices: Device[];
    registry: RegistryEntry[];
  }) => void;
  applyEntityUpdate: (entities: EntityState[], removed: string[]) => void;
  applyOptimistic: (
    entityId: string,
    patch: { state?: string; attributes?: Record<string, unknown> },
  ) => void;
}

export const useConnectionStore = create<ConnectionState>((set) => ({
  link: 'disconnected',
  serverStatus: null,
  haConnected: false,
  entities: {},
  areas: [],
  devices: [],
  registry: [],
  setLink: (link) => set({ link }),
  applyStatus: (serverStatus, haConnected) => set({ serverStatus, haConnected }),
  applySnapshot: (snapshot) =>
    set({
      entities: Object.fromEntries(
        snapshot.entities.map((e) => [e.entityId, e]),
      ),
      areas: snapshot.areas,
      devices: snapshot.devices,
      registry: snapshot.registry,
    }),
  applyEntityUpdate: (entities, removed) =>
    set((state) => {
      const next = { ...state.entities };
      for (const e of entities) next[e.entityId] = e;
      for (const id of removed) delete next[id];
      return { entities: next };
    }),
  applyOptimistic: (entityId, patch) =>
    set((s) => {
      const current = s.entities[entityId];
      if (!current) return {};
      return {
        entities: {
          ...s.entities,
          [entityId]: {
            ...current,
            ...(patch.state !== undefined ? { state: patch.state } : {}),
            attributes: { ...current.attributes, ...(patch.attributes ?? {}) },
          },
        },
      };
    }),
}));
