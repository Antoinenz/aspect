import { useMemo, useState, useCallback, useRef, type ReactElement } from 'react';
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
import { MapPage } from '../map/MapPage.js';

export function AppShell(): ReactElement {
  const entities = useConnectionStore((s) => s.entities);
  const areas = useConnectionStore((s) => s.areas);
  const devices = useConnectionStore((s) => s.devices);
  const registry = useConnectionStore((s) => s.registry);
  const rooms = useMemo(() => buildRooms(entities, areas, devices, registry), [entities, areas, devices, registry]);

  const [section, setSection] = useState<Section>(() => {
    const saved = localStorage.getItem('aspect-startup-section') as Section | null;
    const valid: Section[] = ['home', 'rooms', 'favorites', 'map', 'settings'];
    return saved && valid.includes(saved) ? saved : 'home';
  });
  const [roomId, setRoomId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const mainRef = useRef<HTMLElement>(null);

  const navigate = useCallback((s: Section) => {
    setSection(s);
    setRoomId(null);
    if (mainRef.current && typeof mainRef.current.scrollTo === 'function') {
      mainRef.current.scrollTo({ top: 0 });
    }
  }, []);
  const closeSheet = useCallback(() => setSelectedId(null), []);
  const openEntity = useCallback((id: string) => setSelectedId(id), []);

  const openRoom = rooms.find((r) => r.areaId === roomId) ?? null;

  return (
    <div className="flex h-dvh overflow-hidden">
      <Nav section={section} onNavigate={navigate} />
      <main ref={mainRef} className="flex-1 overflow-y-auto overflow-x-hidden [scrollbar-gutter:stable] px-5 pb-24 pt-[calc(24px+env(safe-area-inset-top))] md:px-8 md:pb-10">
        <div className="mx-auto max-w-[1100px]">
          <div key={section + (roomId ?? '')} className="section-enter">
            {section === 'home' && <SummaryTab onSelect={openEntity} />}
            {section === 'favorites' && (
              <QuickAccessTab
                rooms={rooms}
                onSelect={openEntity}
                onSelectRoom={(areaId) => { setSection('rooms'); setRoomId(areaId); }}
              />
            )}
            {section === 'rooms' && (
              openRoom
                ? <RoomView room={openRoom} onBack={() => setRoomId(null)} onSelect={(re) => openEntity(re.entity.entityId)} />
                : <RoomsOverview rooms={rooms} onOpen={(areaId) => setRoomId(areaId)} />
            )}
            {section === 'map' && <MapPage />}
            {section === 'settings' && <SettingsPage />}
          </div>
        </div>
      </main>
      <EntityDetailSheet entityId={selectedId} onClose={closeSheet} />
    </div>
  );
}
