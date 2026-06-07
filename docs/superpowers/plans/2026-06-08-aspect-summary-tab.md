# Aspect — UI Overhaul Plan 4: Summary Tab — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Summary placeholder with the real "is everything OK / what's happening" glance: status pills (Climate · Security · Playing), who's home, weather + thermostats, an alerts list (open doors/windows, unlocked locks, low batteries, smoke/leak), and activity (lights on + one-tap "turn all off").

**Architecture:** A pure `summary.ts` derives a `SummaryData` view-model from the store's entities + registry (single pass). `SummaryTab` renders it with existing primitives (`StatusPill`, `Tile`, `ActionButton`, `Icon`), and opens the shared detail sheet via an `onSelect` callback passed down from `AppShell`. Every block renders only when it has content.

**Tech Stack:** unchanged (reuses Plan 2/3 primitives + the command channel).

**Prerequisite:** UI Plans 1–3 merged. Local pnpm path note: prefix PowerShell with `$env:Path = "C:\Users\antoi\AppData\Roaming\npm;$env:Path";` if needed.

---

## File Structure

```
apps/web/src/dashboard/
  summary.ts             NEW  buildSummary(entities, registry) -> SummaryData (pure)
  summary.test.ts        NEW
  SummaryTab.tsx         MOD  replace placeholder with the real summary
  SummaryTab.test.tsx    NEW
  AppShell.tsx           MOD  pass onSelect to SummaryTab
```

---

## Task 1: Summary view-model (pure)

**Files:** Create `apps/web/src/dashboard/summary.ts`, `apps/web/src/dashboard/summary.test.ts`

- [ ] **Step 1: Write `apps/web/src/dashboard/summary.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { buildSummary } from './summary.js';
import type { EntityState, RegistryEntry } from '@aspect/shared';

const e = (id: string, state: string, attrs: Record<string, unknown> = {}): EntityState => ({
  entityId: id, state, attributes: attrs, lastChanged: 't', lastUpdated: 't',
});
const reg = (entityId: string, name: string | null = null): RegistryEntry => ({
  entityId, name, deviceId: null, areaId: null, platform: 'demo',
  entityCategory: null, hidden: false, disabled: false, deviceClass: null,
});

describe('buildSummary', () => {
  it('summarizes climate range, security, playing, people, weather', () => {
    const entities = {
      'climate.a': e('climate.a', 'heat', { temperature: 21 }),
      'climate.b': e('climate.b', 'cool', { temperature: 23 }),
      'lock.front': e('lock.front', 'locked'),
      'lock.back': e('lock.back', 'unlocked'),
      'media_player.tv': e('media_player.tv', 'playing'),
      'person.sam': e('person.sam', 'home'),
      'person.alex': e('person.alex', 'not_home'),
      'weather.home': e('weather.home', 'sunny', { temperature: 19 }),
      'light.k': e('light.k', 'on'),
      'light.l': e('light.l', 'off'),
    };
    const s = buildSummary(entities, []);
    expect(s.climate).toEqual({ count: 2, range: '21–23°' });
    expect(s.security).toEqual({ locks: 2, unlocked: 1, openings: 0 });
    expect(s.playing).toBe(1);
    expect(s.people.map((p) => [p.name, p.home])).toEqual([['Sam', true], ['Alex', false]]);
    expect(s.weather).toEqual({ state: 'sunny', temp: '19°' });
    expect(s.lightsOn).toEqual(['light.k']);
    expect(s.thermostats).toEqual(['climate.a', 'climate.b']);
  });

  it('collects alerts: open contact, unlocked lock, low battery, safety', () => {
    const entities = {
      'binary_sensor.door': e('binary_sensor.door', 'on', { device_class: 'door' }),
      'binary_sensor.smoke': e('binary_sensor.smoke', 'on', { device_class: 'smoke' }),
      'lock.back': e('lock.back', 'unlocked'),
      'sensor.batt': e('sensor.batt', '8', { device_class: 'battery' }),
      'sensor.batt_ok': e('sensor.batt_ok', '90', { device_class: 'battery' }),
    };
    const registry = [reg('binary_sensor.door', 'Front Door'), reg('sensor.batt', 'Sensor Battery')];
    const kinds = buildSummary(entities, registry).alerts.map((a) => a.kind).sort();
    expect(kinds).toEqual(['battery', 'open', 'safety', 'unlocked']);
    const door = buildSummary(entities, registry).alerts.find((a) => a.kind === 'open');
    expect(door?.name).toBe('Front Door');
  });

  it('returns empty/null sections when nothing matches', () => {
    const s = buildSummary({}, []);
    expect(s.climate).toBeNull();
    expect(s.security).toBeNull();
    expect(s.playing).toBe(0);
    expect(s.people).toEqual([]);
    expect(s.weather).toBeNull();
    expect(s.alerts).toEqual([]);
    expect(s.lightsOn).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @aspect/web test:run dashboard/summary`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `apps/web/src/dashboard/summary.ts`**

```ts
import type { EntityState, RegistryEntry } from '@aspect/shared';
import { domainOf, friendlyName } from '../domain/entities.js';

export interface PersonStatus {
  entityId: string;
  name: string;
  home: boolean;
  picture: string | null;
}

export type AlertKind = 'open' | 'unlocked' | 'safety' | 'battery';

export interface SummaryAlert {
  entityId: string;
  name: string;
  kind: AlertKind;
  detail: string;
}

export interface SummaryData {
  climate: { count: number; range: string | null } | null;
  security: { locks: number; unlocked: number; openings: number } | null;
  playing: number;
  weather: { state: string; temp: string | null } | null;
  people: PersonStatus[];
  thermostats: string[];
  lightsOn: string[];
  alerts: SummaryAlert[];
}

const OPENING_CLASSES = new Set(['door', 'window', 'opening', 'garage_door']);
const SAFETY_CLASSES = new Set(['smoke', 'gas', 'moisture', 'carbon_monoxide']);
const BATTERY_LOW = 20;

export function buildSummary(
  entities: Record<string, EntityState>,
  registry: RegistryEntry[],
): SummaryData {
  const regName = new Map(registry.map((r) => [r.entityId, r.name] as const));
  const nameOf = (e: EntityState): string =>
    friendlyName(e, regName.get(e.entityId) ?? null);

  const thermostats: string[] = [];
  const targets: number[] = [];
  let locks = 0;
  let unlocked = 0;
  let openings = 0;
  let playing = 0;
  const people: PersonStatus[] = [];
  const lightsOn: string[] = [];
  const alerts: SummaryAlert[] = [];
  let weather: SummaryData['weather'] = null;

  for (const e of Object.values(entities)) {
    const dc = typeof e.attributes.device_class === 'string' ? e.attributes.device_class : null;
    switch (domainOf(e.entityId)) {
      case 'climate': {
        thermostats.push(e.entityId);
        if (typeof e.attributes.temperature === 'number') targets.push(e.attributes.temperature);
        break;
      }
      case 'lock':
        locks += 1;
        if (e.state === 'unlocked') {
          unlocked += 1;
          alerts.push({ entityId: e.entityId, name: nameOf(e), kind: 'unlocked', detail: 'Unlocked' });
        }
        break;
      case 'media_player':
        if (e.state === 'playing') playing += 1;
        break;
      case 'light':
        if (e.state === 'on') lightsOn.push(e.entityId);
        break;
      case 'person':
        people.push({
          entityId: e.entityId,
          name: nameOf(e),
          home: e.state === 'home',
          picture: typeof e.attributes.entity_picture === 'string' ? e.attributes.entity_picture : null,
        });
        break;
      case 'weather':
        if (!weather) {
          weather = {
            state: e.state,
            temp: typeof e.attributes.temperature === 'number' ? `${Math.round(e.attributes.temperature)}°` : null,
          };
        }
        break;
      case 'binary_sensor':
        if (dc && OPENING_CLASSES.has(dc) && e.state === 'on') {
          openings += 1;
          alerts.push({ entityId: e.entityId, name: nameOf(e), kind: 'open', detail: 'Open' });
        } else if (dc && SAFETY_CLASSES.has(dc) && e.state === 'on') {
          alerts.push({ entityId: e.entityId, name: nameOf(e), kind: 'safety', detail: dc.replace(/_/g, ' ') });
        }
        break;
      case 'sensor':
        if (dc === 'battery') {
          const n = Number(e.state);
          if (Number.isFinite(n) && n <= BATTERY_LOW) {
            alerts.push({ entityId: e.entityId, name: nameOf(e), kind: 'battery', detail: `${Math.round(n)}%` });
          }
        }
        break;
    }
  }

  const range =
    targets.length === 0
      ? null
      : Math.min(...targets) === Math.max(...targets)
        ? `${Math.min(...targets)}°`
        : `${Math.min(...targets)}–${Math.max(...targets)}°`;

  return {
    climate: thermostats.length ? { count: thermostats.length, range } : null,
    security: locks || openings ? { locks, unlocked, openings } : null,
    playing,
    weather,
    people,
    thermostats,
    lightsOn,
    alerts,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @aspect/web test:run dashboard/summary`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/dashboard/summary.ts apps/web/src/dashboard/summary.test.ts
git commit -m "feat(web): add pure summary view-model"
```

---

## Task 2: Summary tab UI

**Files:** Modify `apps/web/src/dashboard/SummaryTab.tsx`, `apps/web/src/dashboard/AppShell.tsx`; Create `apps/web/src/dashboard/SummaryTab.test.tsx`

- [ ] **Step 1: Replace `apps/web/src/dashboard/SummaryTab.tsx`**

```tsx
import { useMemo, type ReactElement } from 'react';
import {
  mdiThermostat, mdiShieldCheckOutline, mdiPlayCircleOutline, mdiAccount,
  mdiAlertCircleOutline, mdiLightbulbGroupOutline, mdiWeatherPartlyCloudy,
  mdiHomeOutline, mdiHomeExportOutline,
} from '@mdi/js';
import { useConnectionStore } from '../store/connectionStore.js';
import { buildSummary } from './summary.js';
import { Icon } from '../ui/Icon.js';
import { StatusPill } from '../ui/StatusPill.js';
import { Tile } from '../ui/Tile.js';
import { ActionButton } from '../controls/ActionButton.js';
import { iconFor, tintFor } from '../domain/icons.js';
import { formatState, isActive, friendlyName } from '../domain/entities.js';
import { callService } from '../server-client/commands.js';

const ALERT_ICON = {
  open: mdiAlertCircleOutline, unlocked: mdiShieldCheckOutline,
  safety: mdiAlertCircleOutline, battery: mdiAlertCircleOutline,
} as const;

export function SummaryTab({ onSelect }: { onSelect: (entityId: string) => void }): ReactElement {
  const entities = useConnectionStore((s) => s.entities);
  const registry = useConnectionStore((s) => s.registry);
  const optimistic = useConnectionStore((s) => s.applyOptimistic);
  const s = useMemo(() => buildSummary(entities, registry), [entities, registry]);

  const empty =
    !s.climate && !s.security && s.playing === 0 && !s.weather &&
    s.people.length === 0 && s.thermostats.length === 0 &&
    s.lightsOn.length === 0 && s.alerts.length === 0;

  if (empty) {
    return <p className="text-[15px] text-[var(--color-muted)]">Nothing to summarize yet.</p>;
  }

  const turnAllLightsOff = (): void => {
    for (const id of s.lightsOn) {
      optimistic(id, { state: 'off' });
      callService('light', 'turn_off', id);
    }
  };

  return (
    <div className="grid gap-6">
      <h1 className="m-0 text-[26px] font-extrabold tracking-[-0.5px]">Home</h1>

      {/* Status pills */}
      <div className="-mx-5 flex gap-[9px] overflow-x-auto px-5 pb-1">
        {s.climate && (
          <StatusPill path={mdiThermostat} label="Climate" value={s.climate.range ?? `${s.climate.count}`} />
        )}
        {s.security && (
          <StatusPill path={mdiShieldCheckOutline} label="Security"
            value={s.security.openings ? `${s.security.openings} open` : s.security.unlocked ? `${s.security.unlocked} unlocked` : 'All secure'} />
        )}
        {s.playing > 0 && (
          <StatusPill path={mdiPlayCircleOutline} label="Playing" value={`${s.playing}`} />
        )}
      </div>

      {/* Presence */}
      {s.people.length > 0 && (
        <section className="grid gap-2.5">
          <h2 className="m-0 text-[15px] font-bold text-[var(--color-muted)]">Who's home</h2>
          <div className="flex flex-wrap gap-2.5">
            {s.people.map((p) => (
              <div key={p.entityId} className="flex items-center gap-2 rounded-[14px] border border-white/10 bg-[rgba(36,40,50,0.5)] px-3 py-2 backdrop-blur-[18px]">
                {p.picture
                  ? <img src={p.picture} alt="" className="h-6 w-6 rounded-full object-cover" />
                  : <Icon path={mdiAccount} size={18} color={p.home ? '#8ee6b0' : 'var(--color-muted)'} />}
                <span className="text-[13px] font-semibold">{p.name}</span>
                <span className="text-[12px] text-[var(--color-muted)]">{p.home ? 'Home' : 'Away'}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Alerts */}
      {s.alerts.length > 0 && (
        <section className="grid gap-2">
          <h2 className="m-0 text-[15px] font-bold text-[var(--color-muted)]">Needs attention</h2>
          <div className="grid gap-2">
            {s.alerts.map((a) => (
              <button key={a.entityId} type="button" onClick={() => onSelect(a.entityId)}
                className="flex items-center gap-3 rounded-[16px] border border-[#5a2e2e] bg-[rgba(58,30,30,0.4)] px-4 py-3 text-left backdrop-blur-[18px] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                style={{ cornerShape: 'superellipse(4)' } as React.CSSProperties}>
                <Icon path={ALERT_ICON[a.kind]} size={20} color="#ff8a8a" />
                <span className="flex-1 text-[14px] font-semibold">{a.name}</span>
                <span className="text-[12px] text-[#ff9a9a]">{a.detail}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Weather + thermostats */}
      {(s.weather || s.thermostats.length > 0) && (
        <section className="grid gap-2.5">
          <h2 className="m-0 text-[15px] font-bold text-[var(--color-muted)]">Climate</h2>
          <div className="grid gap-[13px] [grid-template-columns:repeat(auto-fill,minmax(150px,1fr))]">
            {s.weather && (
              <div className="flex min-h-[120px] flex-col rounded-[20px] border border-white/10 bg-[rgba(36,40,50,0.5)] p-4 backdrop-blur-[22px] backdrop-saturate-[1.3]"
                style={{ cornerShape: 'superellipse(4)' } as React.CSSProperties}>
                <Icon path={mdiWeatherPartlyCloudy} size={26} color="#86c2ff" />
                <span className="mt-auto text-[14px] font-bold capitalize">{s.weather.state.replace(/_/g, ' ')}</span>
                {s.weather.temp && <span className="text-[12px] text-[var(--color-muted)]">{s.weather.temp}</span>}
              </div>
            )}
            {s.thermostats.map((id) => {
              const entity = entities[id];
              if (!entity) return null;
              return (
                <Tile key={id} path={iconFor(entity)} tint={tintFor('climate')} name={friendlyName(entity, null)}
                  state={formatState(entity)} active={isActive(entity)} wide onPress={() => onSelect(id)} />
              );
            })}
          </div>
        </section>
      )}

      {/* Activity */}
      {s.lightsOn.length > 0 && (
        <section className="flex items-center justify-between gap-3 rounded-[16px] border border-white/10 bg-[rgba(36,40,50,0.5)] px-4 py-3 backdrop-blur-[18px]"
          style={{ cornerShape: 'superellipse(4)' } as React.CSSProperties}>
          <span className="flex items-center gap-2.5 text-[14px] font-semibold">
            <Icon path={mdiLightbulbGroupOutline} size={20} color="#ffd27d" />
            {s.lightsOn.length} {s.lightsOn.length === 1 ? 'light' : 'lights'} on
          </span>
          <ActionButton onClick={turnAllLightsOff}>Turn all off</ActionButton>
        </section>
      )}
    </div>
  );
}
```

> Note: the unused `mdiHomeOutline`/`mdiHomeExportOutline` imports above are not needed — include only the icons you actually reference (`mdiThermostat`, `mdiShieldCheckOutline`, `mdiPlayCircleOutline`, `mdiAccount`, `mdiAlertCircleOutline`, `mdiLightbulbGroupOutline`, `mdiWeatherPartlyCloudy`). Remove any unused import to satisfy `noUnusedLocals`.

- [ ] **Step 2: Pass `onSelect` from `apps/web/src/dashboard/AppShell.tsx`.** Change the Summary panel line from `<SummaryTab />` to:

```tsx
        <TabPanel value="__summary__"><SummaryTab onSelect={(id) => setSelectedId(id)} /></TabPanel>
```

- [ ] **Step 3: Write `apps/web/src/dashboard/SummaryTab.test.tsx`**

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SummaryTab } from './SummaryTab.js';
import { useConnectionStore } from '../store/connectionStore.js';
import type { EntityState } from '@aspect/shared';

const sent: unknown[] = [];
vi.mock('../server-client/commands.js', () => ({ callService: (...a: unknown[]) => sent.push(a) }));

const e = (id: string, state: string, attrs: Record<string, unknown> = {}): EntityState => ({
  entityId: id, state, attributes: attrs, lastChanged: 't', lastUpdated: 't',
});
const base = {
  link: 'connected' as const, serverStatus: 'online' as const, haConnected: true,
  entities: {} as Record<string, EntityState>, areas: [] as never[], devices: [] as never[],
  registry: [] as never[], favorites: [] as string[],
};

describe('SummaryTab', () => {
  beforeEach(() => { sent.length = 0; useConnectionStore.setState({ ...base }); });

  it('shows an empty state when there is nothing to summarize', () => {
    render(<SummaryTab onSelect={() => {}} />);
    expect(screen.getByText(/nothing to summarize/i)).toBeInTheDocument();
  });

  it('renders an alert and opens it on click', async () => {
    const onSelect = vi.fn();
    useConnectionStore.setState({
      ...base,
      entities: { 'binary_sensor.door': e('binary_sensor.door', 'on', { device_class: 'door' }) },
    });
    render(<SummaryTab onSelect={onSelect} />);
    await userEvent.click(screen.getByText(/door/i));
    expect(onSelect).toHaveBeenCalledWith('binary_sensor.door');
  });

  it('turns all lights off', async () => {
    useConnectionStore.setState({ ...base, entities: { 'light.a': e('light.a', 'on'), 'light.b': e('light.b', 'on') } });
    render(<SummaryTab onSelect={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: /turn all off/i }));
    expect(sent).toHaveLength(2);
    expect(sent[0]).toEqual(['light', 'turn_off', 'light.a']);
  });
});
```

- [ ] **Step 4: Run the web suite, typecheck, build**

Run: `pnpm --filter @aspect/web test:run && pnpm --filter @aspect/web typecheck && pnpm --filter @aspect/web build`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/dashboard/SummaryTab.tsx apps/web/src/dashboard/SummaryTab.test.tsx apps/web/src/dashboard/AppShell.tsx
git commit -m "feat(web): build the Summary tab (pills, presence, alerts, climate, activity)"
```

---

## Task 3: Full verification

**Files:** none committed

- [ ] **Step 1: Whole workspace**

Run: `pnpm install --frozen-lockfile && pnpm typecheck && pnpm test:run && pnpm build`
Expected: every step exits 0; all tests pass.

- [ ] **Step 2: Visual smoke (against real HA, recommended).** Build + run the server (HA_URL/HA_TOKEN/ASPECT_WEB_DIR) and open the app on the Summary tab — expect status pills, who's-home, any alerts (open doors / low batteries), weather + thermostats, and a "lights on / Turn all off" row. Tapping an alert or thermostat opens its detail sheet.

- [ ] **Step 3: Confirm clean tree** — `git status --short` empty.

---

## Definition of Done

- [ ] The Summary tab shows status pills (Climate/Security/Playing), who's home, alerts (only when present), weather + thermostats, and a lights-on / turn-all-off row — each block only when it has content.
- [ ] Tapping an alert or thermostat opens the shared detail sheet; "Turn all off" turns off every on light.
- [ ] `pnpm typecheck`, `pnpm test:run`, `pnpm build` all pass.

## Notes for the Next Plan (UI Plan 5 — Quick Access)

- Replace the `QuickAccessTab` placeholder with the pinned favorites (data already in the store: `favorites` + `setFavorite`); render favorite entities with the same `Tile`s, and add a pin (star) affordance to the tile overflow + detail sheet.
- Status pills could later navigate to the relevant room/entity (currently informational).
