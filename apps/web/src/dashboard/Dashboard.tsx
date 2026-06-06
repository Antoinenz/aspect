import { useCallback, useMemo, useState, type ReactElement } from 'react';
import { useConnectionStore } from '../store/connectionStore.js';
import { buildRooms, type RoomEntity } from './rooms.js';
import { RoomSection } from './RoomSection.js';
import { EntityDetailSheet } from './EntityDetailSheet.js';

export function Dashboard(): ReactElement {
  const entities = useConnectionStore((s) => s.entities);
  const areas = useConnectionStore((s) => s.areas);
  const devices = useConnectionStore((s) => s.devices);
  const registry = useConnectionStore((s) => s.registry);

  const rooms = useMemo(
    () => buildRooms(entities, areas, devices, registry),
    [entities, areas, devices, registry],
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const closeSheet = useCallback(() => setSelectedId(null), []);
  const handleSelect = useCallback((re: RoomEntity) => setSelectedId(re.entity.entityId), []);

  return (
    <main
      style={{
        minHeight: '100dvh',
        maxWidth: 1100,
        margin: '0 auto',
        padding: 'calc(24px + env(safe-area-inset-top)) 20px 40px',
      }}
    >
      <header style={{ marginBottom: 26 }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, letterSpacing: '-0.5px' }}>
          Home
        </h1>
      </header>

      {rooms.length === 0 ? (
        <p style={{ color: 'var(--muted)', fontSize: 15 }}>
          No devices to show yet.
        </p>
      ) : (
        rooms.map((room) => (
          <RoomSection key={room.areaId} room={room} onSelect={handleSelect} />
        ))
      )}

      <EntityDetailSheet entityId={selectedId} onClose={closeSheet} />
    </main>
  );
}
