import { useMemo, useState, useCallback, type ReactElement } from 'react';
import { useConnectionStore } from '../store/connectionStore.js';
import { Nav } from '../nav/Nav.js';
import type { Section } from '../nav/navItems.js';
import { buildRooms } from './rooms.js';
import { SummaryTab } from './SummaryTab.js';
import { QuickAccessTab } from './QuickAccessTab.js';
import { RoomsOverview } from './RoomsGrid.js';
import { RoomView } from './RoomView.js';
import { EntityDetailSheet } from './EntityDetailSheet.js';
import { SettingsPage } from '../settings/SettingsPage.js';

function Placeholder({ text }: { text: string }): ReactElement {
  return <p className="text-[15px] text-[var(--color-muted)]">{text}</p>;
}

export function AppShell(): ReactElement {
  const entities = useConnectionStore((s) => s.entities);
  const areas = useConnectionStore((s) => s.areas);
  const devices = useConnectionStore((s) => s.devices);
  const registry = useConnectionStore((s) => s.registry);
  const rooms = useMemo(() => buildRooms(entities, areas, devices, registry), [entities, areas, devices, registry]);

  const [section, setSection] = useState<Section>('home');
  const [roomId, setRoomId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const navigate = useCallback((s: Section) => {
    setSection(s);
    setRoomId(null);
  }, []);
  const closeSheet = useCallback(() => setSelectedId(null), []);
  const openEntity = useCallback((id: string) => setSelectedId(id), []);

  const openRoom = rooms.find((r) => r.areaId === roomId) ?? null;

  return (
    <div className="flex min-h-dvh">
      <Nav section={section} onNavigate={navigate} />
      <main className="flex-1 overflow-x-hidden px-5 pb-24 pt-[calc(24px+env(safe-area-inset-top))] md:px-8 md:pb-10">
        <div className="mx-auto max-w-[1100px]">
          {section === 'home' && <SummaryTab onSelect={openEntity} />}
          {section === 'favorites' && <QuickAccessTab onSelect={openEntity} />}
          {section === 'rooms' && (
            openRoom
              ? <RoomView room={openRoom} onBack={() => setRoomId(null)} onSelect={(re) => openEntity(re.entity.entityId)} />
              : <RoomsOverview rooms={rooms} onOpen={(areaId) => setRoomId(areaId)} />
          )}
          {section === 'map' && <Placeholder text="Map is coming soon." />}
          {section === 'settings' && <SettingsPage />}
        </div>
      </main>
      <EntityDetailSheet entityId={selectedId} onClose={closeSheet} />
    </div>
  );
}
