# Aspect — Sidebar Nav Plan 1: Nav Shell — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the top tab bar with a sidebar (desktop/tablet) / bottom bar (phone): **Home · Favorites · Rooms · Map · Settings**. Home reuses the Summary, Favorites reuses Quick Access, Rooms becomes an overview→room flow with a back control, and Map/Settings are placeholders (built in later plans).

**Architecture:** A `Nav` renders a `Sidebar` (≥md) or `BottomBar` (<md) from a shared `navItems` list. `AppShell` holds a view-model `{ section, roomId }` and switches the content region; the detail sheet still overlays everything. A pure `roomsOverview()` derives per-room stats for the overview cards.

**Tech Stack:** unchanged (Tailwind responsive utilities, Radix not needed for nav, MDI icons, existing tiles/sections).

**Prerequisite:** UI overhaul merged. Local pnpm path note: prefix PowerShell with `$env:Path = "C:\Users\antoi\AppData\Roaming\npm;$env:Path";` if needed.

---

## File Structure

```
apps/web/src/
  nav/navItems.ts        NEW  Section type + items (id,label,icon) + settingsItem
  nav/Sidebar.tsx        NEW
  nav/BottomBar.tsx      NEW
  nav/Nav.tsx            NEW  responsive wrapper + Nav.test.tsx
  dashboard/roomsOverview.ts   NEW  pure room stats (+ test)
  dashboard/RoomsOverview.tsx  NEW  room cards grid
  dashboard/RoomView.tsx       NEW  single room + back
  dashboard/AppShell.tsx       MOD  view-model + Nav + section switch (replaces Tabs)
  dashboard/AppShell.test.tsx  MOD
```

(`SummaryTab` is reused as Home; `QuickAccessTab` as Favorites — no file renames to avoid churn. `Tabs`/`TabPanel` is no longer used by AppShell.)

---

## Task 1: Nav items + Sidebar + BottomBar + Nav

**Files:** Create `apps/web/src/nav/navItems.ts`, `apps/web/src/nav/Sidebar.tsx`, `apps/web/src/nav/BottomBar.tsx`, `apps/web/src/nav/Nav.tsx`, `apps/web/src/nav/Nav.test.tsx`

- [ ] **Step 1: Create `apps/web/src/nav/navItems.ts`**

```ts
import {
  mdiHomeOutline, mdiStarOutline, mdiViewGridOutline,
  mdiMapMarkerRadiusOutline, mdiCogOutline,
} from '@mdi/js';

export type Section = 'home' | 'favorites' | 'rooms' | 'map' | 'settings';

export interface NavDestination {
  id: Section;
  label: string;
  icon: string;
}

/** Primary destinations (top of the sidebar / left of the bottom bar). */
export const NAV_ITEMS: NavDestination[] = [
  { id: 'home', label: 'Home', icon: mdiHomeOutline },
  { id: 'favorites', label: 'Favorites', icon: mdiStarOutline },
  { id: 'rooms', label: 'Rooms', icon: mdiViewGridOutline },
  { id: 'map', label: 'Map', icon: mdiMapMarkerRadiusOutline },
];

/** Settings is pinned to the bottom of the sidebar. */
export const SETTINGS_ITEM: NavDestination = {
  id: 'settings', label: 'Settings', icon: mdiCogOutline,
};

export const ALL_DESTINATIONS: NavDestination[] = [...NAV_ITEMS, SETTINGS_ITEM];
```

- [ ] **Step 2: Create `apps/web/src/nav/Sidebar.tsx`**

```tsx
import type { ReactElement } from 'react';
import { Icon } from '../ui/Icon.js';
import { NAV_ITEMS, SETTINGS_ITEM, type Section, type NavDestination } from './navItems.js';
import { SQUIRCLE } from '../ui/tokens.js';

function NavButton({ item, active, onClick }: { item: NavDestination; active: boolean; onClick: () => void }): ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={[
        'flex items-center gap-3 rounded-[13px] px-3.5 py-2.5 text-[14px] font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40',
        active ? 'bg-[#f3f4f6] text-[#15161a]' : 'text-[var(--color-muted)] hover:bg-white/5 hover:text-[var(--color-text)]',
      ].join(' ')}
      style={{ cornerShape: `superellipse(${SQUIRCLE})` } as React.CSSProperties}
    >
      <Icon path={item.icon} size={20} />
      {item.label}
    </button>
  );
}

export function Sidebar({ section, onNavigate }: { section: Section; onNavigate: (s: Section) => void }): ReactElement {
  return (
    <aside className="hidden w-[226px] flex-none flex-col gap-1 border-r border-white/7 bg-[rgba(20,22,28,0.5)] p-3.5 backdrop-blur-[20px] md:flex">
      <div className="flex items-center gap-3 px-2 pb-4 pt-1.5">
        <img src="/logo.svg" alt="" className="h-8 w-8" />
        <b className="text-[18px] font-extrabold tracking-[-0.4px]">Aspect</b>
      </div>
      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => (
          <NavButton key={item.id} item={item} active={section === item.id} onClick={() => onNavigate(item.id)} />
        ))}
      </nav>
      <div className="flex-1" />
      <NavButton item={SETTINGS_ITEM} active={section === 'settings'} onClick={() => onNavigate('settings')} />
    </aside>
  );
}
```

- [ ] **Step 3: Create `apps/web/src/nav/BottomBar.tsx`**

```tsx
import type { ReactElement } from 'react';
import { Icon } from '../ui/Icon.js';
import { ALL_DESTINATIONS, type Section } from './navItems.js';

export function BottomBar({ section, onNavigate }: { section: Section; onNavigate: (s: Section) => void }): ReactElement {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 flex items-stretch justify-around border-t border-white/10 bg-[rgba(18,20,26,0.8)] backdrop-blur-[22px] backdrop-saturate-[1.3] md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {ALL_DESTINATIONS.map((item) => {
        const active = section === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onNavigate(item.id)}
            aria-current={active ? 'page' : undefined}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[10.5px] font-semibold focus:outline-none ${active ? 'text-[var(--color-text)]' : 'text-[var(--color-muted)]'}`}
          >
            <Icon path={item.icon} size={22} color={active ? '#f4f5f7' : 'var(--color-muted)'} />
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 4: Create `apps/web/src/nav/Nav.tsx`**

```tsx
import type { ReactElement } from 'react';
import { Sidebar } from './Sidebar.js';
import { BottomBar } from './BottomBar.js';
import type { Section } from './navItems.js';

/** Renders both; CSS shows the sidebar on >=md and the bottom bar on <md. */
export function Nav({ section, onNavigate }: { section: Section; onNavigate: (s: Section) => void }): ReactElement {
  return (
    <>
      <Sidebar section={section} onNavigate={onNavigate} />
      <BottomBar section={section} onNavigate={onNavigate} />
    </>
  );
}
```

- [ ] **Step 5: Write `apps/web/src/nav/Nav.test.tsx`**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Nav } from './Nav.js';

describe('Nav', () => {
  it('renders all destinations and fires onNavigate', async () => {
    const onNavigate = vi.fn();
    render(<Nav section="home" onNavigate={onNavigate} />);
    // Home appears in both sidebar and bottom bar; just assert at least one of each label exists.
    expect(screen.getAllByText('Home').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Settings').length).toBeGreaterThan(0);
    await userEvent.click(screen.getAllByText('Rooms')[0]!);
    expect(onNavigate).toHaveBeenCalledWith('rooms');
  });
});
```

- [ ] **Step 6: Run + typecheck**

Run: `pnpm --filter @aspect/web test:run nav/Nav && pnpm --filter @aspect/web typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/nav
git commit -m "feat(web): add responsive Sidebar/BottomBar navigation"
```

---

## Task 2: Rooms overview + room view

**Files:** Create `apps/web/src/dashboard/roomsOverview.ts`, `apps/web/src/dashboard/roomsOverview.test.ts`, `apps/web/src/dashboard/RoomsOverview.tsx`, `apps/web/src/dashboard/RoomView.tsx`

- [ ] **Step 1: Write `apps/web/src/dashboard/roomsOverview.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { roomsOverview } from './roomsOverview.js';
import type { Room } from './rooms.js';
import type { EntityState } from '@aspect/shared';

const re = (id: string, state: string) => ({
  entity: { entityId: id, state, attributes: {}, lastChanged: 't', lastUpdated: 't' } as EntityState,
  name: id, domain: id.split('.')[0]!, battery: null, wide: false,
});

describe('roomsOverview', () => {
  it('computes device and active counts per room', () => {
    const rooms: Room[] = [
      { areaId: 'k', name: 'Kitchen', entities: [re('light.a', 'on'), re('light.b', 'off'), re('switch.c', 'on')] },
      { areaId: 'b', name: 'Bedroom', entities: [re('light.d', 'off')] },
    ];
    expect(roomsOverview(rooms)).toEqual([
      { areaId: 'k', name: 'Kitchen', deviceCount: 3, onCount: 2 },
      { areaId: 'b', name: 'Bedroom', deviceCount: 1, onCount: 0 },
    ]);
  });
});
```

- [ ] **Step 2: Implement `apps/web/src/dashboard/roomsOverview.ts`**

```ts
import { isActive } from '../domain/entities.js';
import type { Room } from './rooms.js';

export interface RoomStat {
  areaId: string;
  name: string;
  deviceCount: number;
  onCount: number;
}

export function roomsOverview(rooms: Room[]): RoomStat[] {
  return rooms.map((room) => ({
    areaId: room.areaId,
    name: room.name,
    deviceCount: room.entities.length,
    onCount: room.entities.filter((re) => isActive(re.entity)).length,
  }));
}
```

- [ ] **Step 3: Run the test to verify it passes**

Run: `pnpm --filter @aspect/web test:run roomsOverview`
Expected: PASS.

- [ ] **Step 4: Create `apps/web/src/dashboard/RoomsOverview.tsx`**

```tsx
import type { ReactElement } from 'react';
import { Icon } from '../ui/Icon.js';
import { roomsOverview } from './roomsOverview.js';
import { roomIcon } from './roomIcon.js';
import type { Room } from './rooms.js';
import { SQUIRCLE } from '../ui/tokens.js';

export function RoomsOverview({ rooms, onOpen }: { rooms: Room[]; onOpen: (areaId: string) => void }): ReactElement {
  const stats = roomsOverview(rooms);
  return (
    <div>
      <h1 className="m-0 text-[26px] font-extrabold tracking-[-0.5px]">Rooms</h1>
      <p className="mb-5 mt-0.5 text-[12.5px] font-medium text-[var(--color-muted)]">
        {stats.length} {stats.length === 1 ? 'room' : 'rooms'}
      </p>
      {stats.length === 0 ? (
        <p className="text-[15px] text-[var(--color-muted)]">No rooms to show yet.</p>
      ) : (
        <div className="grid gap-[14px] [grid-template-columns:repeat(auto-fill,minmax(180px,1fr))]">
          {stats.map((s) => (
            <button
              key={s.areaId}
              type="button"
              onClick={() => onOpen(s.areaId)}
              className="flex min-h-[108px] flex-col rounded-[20px] border border-white/10 bg-[rgba(36,40,50,0.5)] p-4 text-left backdrop-blur-[22px] backdrop-saturate-[1.3] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
              style={{ cornerShape: `superellipse(${SQUIRCLE})` } as React.CSSProperties}
            >
              <span className="flex h-[42px] w-[42px] items-center justify-center rounded-[13px] bg-white/10" style={{ cornerShape: `superellipse(${SQUIRCLE})` } as React.CSSProperties}>
                <Icon path={roomIcon(s.name)} size={22} color="#cfd3db" />
              </span>
              <span className="mt-auto text-[14px] font-bold tracking-[-0.2px]">{s.name}</span>
              <span className="mt-0.5 text-[12px] font-medium text-[var(--color-muted)]">
                {s.onCount > 0 ? <span className="text-[#ffd27d]">{s.onCount} on</span> : 'All off'} · {s.deviceCount} devices
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Create `apps/web/src/dashboard/RoomView.tsx`**

```tsx
import type { ReactElement } from 'react';
import { mdiChevronLeft } from '@mdi/js';
import { Icon } from '../ui/Icon.js';
import { RoomTab } from './RoomTab.js';
import type { Room, RoomEntity } from './rooms.js';

export function RoomView({
  room, onBack, onSelect,
}: { room: Room; onBack: () => void; onSelect: (entity: RoomEntity) => void }): ReactElement {
  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        className="mb-4 flex items-center gap-1 rounded-[12px] px-2.5 py-1.5 text-[13px] font-semibold text-[var(--color-muted)] hover:text-[var(--color-text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
      >
        <Icon path={mdiChevronLeft} size={18} /> Rooms
      </button>
      <RoomTab room={room} onSelect={onSelect} />
    </div>
  );
}
```

- [ ] **Step 6: Typecheck**

Run: `pnpm --filter @aspect/web typecheck`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/dashboard/roomsOverview.ts apps/web/src/dashboard/roomsOverview.test.ts apps/web/src/dashboard/RoomsOverview.tsx apps/web/src/dashboard/RoomView.tsx
git commit -m "feat(web): add rooms overview + room view with back"
```

---

## Task 3: AppShell with sidebar navigation

**Files:** Modify `apps/web/src/dashboard/AppShell.tsx`, `apps/web/src/dashboard/AppShell.test.tsx`

- [ ] **Step 1: Replace `apps/web/src/dashboard/AppShell.tsx`**

```tsx
import { useMemo, useState, useCallback, type ReactElement } from 'react';
import { useConnectionStore } from '../store/connectionStore.js';
import { Nav } from '../nav/Nav.js';
import type { Section } from '../nav/navItems.js';
import { buildRooms } from './rooms.js';
import { SummaryTab } from './SummaryTab.js';
import { QuickAccessTab } from './QuickAccessTab.js';
import { RoomsOverview } from './RoomsOverview.js';
import { RoomView } from './RoomView.js';
import { EntityDetailSheet } from './EntityDetailSheet.js';

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
          {section === 'settings' && <Placeholder text="Settings are coming soon." />}
        </div>
      </main>
      <EntityDetailSheet entityId={selectedId} onClose={closeSheet} />
    </div>
  );
}
```

- [ ] **Step 2: Replace `apps/web/src/dashboard/AppShell.test.tsx`**

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppShell } from './AppShell.js';
import { useConnectionStore } from '../store/connectionStore.js';
import type { EntityState } from '@aspect/shared';

const e = (id: string, state = 'on'): EntityState => ({ entityId: id, state, attributes: {}, lastChanged: 't', lastUpdated: 't' });
const base = {
  link: 'connected' as const, serverStatus: 'online' as const, haConnected: true,
  entities: {} as Record<string, EntityState>, areas: [] as never[], devices: [] as never[],
  registry: [] as never[], favorites: [] as string[],
};

const withKitchen = () => useConnectionStore.setState({
  ...base,
  entities: { 'light.kitchen_lamp': e('light.kitchen_lamp') },
  areas: [{ areaId: 'kitchen', name: 'Kitchen' }],
  registry: [{ entityId: 'light.kitchen_lamp', areaId: 'kitchen', deviceId: null, name: null, platform: 'demo', entityCategory: null, hidden: false, disabled: false, deviceClass: null }],
});

describe('AppShell', () => {
  beforeEach(() => useConnectionStore.setState({ ...base }));

  it('renders the nav with Home and Settings', () => {
    render(<AppShell />);
    expect(screen.getAllByText('Home').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Settings').length).toBeGreaterThan(0);
  });

  it('navigates to Rooms overview, into a room, opens a tile, and back', async () => {
    act(withKitchen);
    render(<AppShell />);
    await userEvent.click(screen.getAllByText('Rooms')[0]!);
    // Overview shows the room card
    await userEvent.click(await screen.findByText('Kitchen'));
    // Room view shows the tile; open it
    await userEvent.click(await screen.findByRole('button', { name: /kitchen lamp/i }));
    expect(await screen.findByRole('dialog', { name: /kitchen lamp/i })).toBeInTheDocument();
  });

  it('shows the Map placeholder', async () => {
    render(<AppShell />);
    await userEvent.click(screen.getAllByText('Map')[0]!);
    expect(await screen.findByText(/map is coming soon/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run the full web suite, typecheck, build**

Run: `pnpm --filter @aspect/web test:run && pnpm --filter @aspect/web typecheck && pnpm --filter @aspect/web build`
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/dashboard/AppShell.tsx apps/web/src/dashboard/AppShell.test.tsx
git commit -m "feat(web): switch AppShell to sidebar nav with rooms overview"
```

---

## Task 4: Full verification

**Files:** none committed

- [ ] **Step 1: Whole workspace**

Run: `pnpm install --frozen-lockfile && pnpm typecheck && pnpm test:run && pnpm build`
Expected: every step exits 0; all tests pass.

- [ ] **Step 2: Visual smoke (against real HA, recommended).** Run the server and open the app: a left sidebar (Home/Favorites/Rooms/Map · Settings pinned) on desktop, a bottom bar on a narrow window; Home = Summary, Favorites = pinned tiles, Rooms = overview grid → click a room → tiles + back, Map/Settings = "coming soon".

- [ ] **Step 3: Confirm clean tree** — `git status --short` empty.

---

## Definition of Done

- [ ] Sidebar on ≥md and bottom bar on <md, both with Home/Favorites/Rooms/Map/Settings; active = Frost.
- [ ] Home and Favorites render the existing Summary/Quick-Access; Rooms is an overview→room flow with back; Map/Settings are placeholders.
- [ ] The detail sheet still opens from any tile.
- [ ] `pnpm typecheck`, `pnpm test:run`, `pnpm build` all pass.

## Notes for the Next Plans

- **Plan 2 (Settings + theme):** replace the Settings placeholder; add a theme store (light/dark/auto) + `data-theme` in `theme.css`; connection status + about + manage favorites.
- **Plan 3 (Map):** replace the Map placeholder with Leaflet + `peoplePlaces`.
