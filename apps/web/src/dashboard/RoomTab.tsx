import { type ReactElement, useState } from 'react';
import { mdiChevronLeft, mdiChevronRight, mdiPower, mdiStar, mdiStarOutline } from '@mdi/js';
import { Tile } from '../ui/Tile.js';
import { Icon } from '../ui/Icon.js';
import { formatState, isActive, domainOf } from '../domain/entities.js';
import { iconFor, tintFor } from '../domain/icons.js';
import { tileAction } from '../domain/tileAction.js';
import { callService } from '../server-client/commands.js';
import { useConnectionStore } from '../store/connectionStore.js';
import { useRoomFavourites } from './roomFavouritesStore.js';
import type { Room, RoomEntity } from './rooms.js';

export interface RoomTabProps {
  room: Room;
  onBack?: () => void;
  onSelect: (entity: RoomEntity) => void;
}

const GROUPS: { label: string; domains: string[] }[] = [
  { label: 'Lights', domains: ['light'] },
  { label: 'Climate', domains: ['climate'] },
  { label: 'Media', domains: ['media_player'] },
  { label: 'Blinds', domains: ['cover'] },
  { label: 'Fans', domains: ['fan'] },
  { label: 'Switches', domains: ['switch'] },
  { label: 'Locks', domains: ['lock'] },
  { label: 'Sensors', domains: ['binary_sensor', 'sensor'] },
  { label: 'Scenes', domains: ['scene'] },
  { label: 'Scripts', domains: ['script'] },
];

const KNOWN_DOMAINS = new Set(GROUPS.flatMap((g) => g.domains));

function EntityGrid({ entities, onSelect }: { entities: RoomEntity[]; onSelect: (re: RoomEntity) => void }): ReactElement {
  const optimistic = useConnectionStore((s) => s.applyOptimistic);
  return (
    <div className="grid gap-[13px] [grid-template-columns:repeat(auto-fill,minmax(150px,1fr))]">
      {entities.map((re) => (
        <Tile
          key={re.entity.entityId}
          path={iconFor(re.entity)}
          tint={tintFor(domainOf(re.entity.entityId))}
          name={re.name}
          state={formatState(re.entity)}
          active={isActive(re.entity)}
          wide={re.wide}
          battery={re.battery}
          onAction={tileAction(re.entity, optimistic)}
          onPress={() => onSelect(re)}
        />
      ))}
    </div>
  );
}

function UnavailableSection({ entities, onSelect }: { entities: RoomEntity[]; onSelect: (re: RoomEntity) => void }): ReactElement {
  const [open, setOpen] = useState(false);
  return (
    <section>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-[8px] text-[12px] font-bold uppercase tracking-[0.6px] text-[var(--color-muted)] hover:text-[var(--color-text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
      >
        <span className={`transition-transform duration-200 ${open ? 'rotate-90' : ''}`}>
          <Icon path={mdiChevronRight} size={15} />
        </span>
        {entities.length} Unavailable
      </button>
      {open && (
        <div className="mt-3 section-enter">
          <EntityGrid entities={entities} onSelect={onSelect} />
        </div>
      )}
    </section>
  );
}

export function RoomTab({ room, onBack, onSelect }: RoomTabProps): ReactElement {
  const available = room.entities.filter((re) => re.entity.state !== 'unavailable');
  const unavailable = room.entities.filter((re) => re.entity.state === 'unavailable');

  const byDomain = new Map<string, RoomEntity[]>();
  for (const re of available) {
    const list = byDomain.get(re.domain);
    if (list) list.push(re);
    else byDomain.set(re.domain, [re]);
  }

  const sections: { label: string; entities: RoomEntity[] }[] = [];
  for (const group of GROUPS) {
    const entities = group.domains.flatMap((d) => byDomain.get(d) ?? []);
    if (entities.length > 0) sections.push({ label: group.label, entities });
  }
  const otherEntities = available.filter((re) => !KNOWN_DOMAINS.has(re.domain));
  if (otherEntities.length > 0) sections.push({ label: 'Other', entities: otherEntities });

  const activeCount = available.filter((re) => isActive(re.entity)).length;

  const BULK_DOMAINS = new Set(['light', 'switch', 'fan']);
  const controllable = available.filter((re) => BULK_DOMAINS.has(re.domain));
  const anyActive = controllable.some((re) => isActive(re.entity));

  const isFav = useRoomFavourites((s) => s.isFav(room.areaId));
  const toggleFav = useRoomFavourites((s) => s.toggle);

  function turnAll(): void {
    const svc = anyActive ? 'turn_off' : 'turn_on';
    for (const re of controllable) callService(re.domain, svc, re.entity.entityId);
  }

  const chipClass = 'flex items-center gap-1.5 rounded-[11px] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-[12.5px] font-semibold text-[var(--color-muted)] backdrop-blur-[var(--blur-frost)] transition-colors hover:text-[var(--color-text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40';

  return (
    <div>
      <header className="mb-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="m-0 text-[26px] font-extrabold tracking-[-0.5px]">{room.name}</h1>
            <div className="mt-0.5 flex items-center text-[12.5px] font-medium text-[var(--color-muted)]">
              {onBack && (
                <>
                  <button
                    type="button"
                    onClick={onBack}
                    className="flex items-center gap-0.5 rounded-[4px] transition-colors hover:text-[var(--color-text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                  >
                    <Icon path={mdiChevronLeft} size={14} />
                    Rooms
                  </button>
                  <span className="mx-1.5">·</span>
                </>
              )}
              {available.length} {available.length === 1 ? 'accessory' : 'accessories'} · {activeCount} active
              {unavailable.length > 0 && ` · ${unavailable.length} unavailable`}
            </div>
          </div>
          <div className="flex shrink-0 gap-2 pt-1">
            <button type="button" onClick={() => toggleFav(room.areaId)} className={chipClass}>
              <Icon path={isFav ? mdiStar : mdiStarOutline} size={15} color={isFav ? '#ffd27d' : undefined} />
              {isFav ? 'Favourited' : 'Favourite'}
            </button>
            {controllable.length > 0 && (
              <button type="button" onClick={turnAll} className={chipClass}>
                <Icon path={mdiPower} size={15} />
                {anyActive ? 'Turn off' : 'Turn on'}
              </button>
            )}
          </div>
        </div>
      </header>
      <div className="flex flex-col gap-7">
        {sections.map((s) => (
          <section key={s.label}>
            <h2 className="m-0 mb-3 text-[12px] font-bold uppercase tracking-[0.6px] text-[var(--color-muted)]">
              {s.label}
            </h2>
            <EntityGrid entities={s.entities} onSelect={onSelect} />
          </section>
        ))}
        {unavailable.length > 0 && (
          <UnavailableSection entities={unavailable} onSelect={onSelect} />
        )}
      </div>
    </div>
  );
}
