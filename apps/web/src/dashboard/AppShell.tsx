import { useMemo, useState, useCallback, type ReactElement } from 'react';
import { mdiViewDashboardOutline, mdiStarOutline } from '@mdi/js';
import { useConnectionStore } from '../store/connectionStore.js';
import { Tabs, TabPanel, type TabItem } from '../ui/Tabs.js';
import { buildRooms } from './rooms.js';
import { roomIcon } from './roomIcon.js';
import { RoomTab } from './RoomTab.js';
import { SummaryTab } from './SummaryTab.js';
import { QuickAccessTab } from './QuickAccessTab.js';
import { EntityDetailSheet } from './EntityDetailSheet.js';

export function AppShell(): ReactElement {
  const entities = useConnectionStore((s) => s.entities);
  const areas = useConnectionStore((s) => s.areas);
  const devices = useConnectionStore((s) => s.devices);
  const registry = useConnectionStore((s) => s.registry);

  const rooms = useMemo(
    () => buildRooms(entities, areas, devices, registry),
    [entities, areas, devices, registry],
  );

  const tabs: TabItem[] = useMemo(
    () => [
      { id: '__summary__', label: 'Summary', path: mdiViewDashboardOutline },
      { id: '__quick__', label: 'Quick', path: mdiStarOutline },
      ...rooms.map((r) => ({ id: r.areaId, label: r.name, path: roomIcon(r.name) })),
    ],
    [rooms],
  );

  const [tab, setTab] = useState('__summary__');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const closeSheet = useCallback(() => setSelectedId(null), []);

  return (
    <main className="mx-auto min-h-[100dvh] max-w-[1100px] px-5 pb-10 pt-[calc(24px+env(safe-area-inset-top))]">
      <Tabs items={tabs} value={tab} onValueChange={setTab}>
        <TabPanel value="__summary__"><SummaryTab onSelect={(id) => setSelectedId(id)} /></TabPanel>
        <TabPanel value="__quick__"><QuickAccessTab /></TabPanel>
        {rooms.map((room) => (
          <TabPanel key={room.areaId} value={room.areaId}>
            <RoomTab room={room} onSelect={(re) => setSelectedId(re.entity.entityId)} />
          </TabPanel>
        ))}
      </Tabs>
      <EntityDetailSheet entityId={selectedId} onClose={closeSheet} />
    </main>
  );
}
