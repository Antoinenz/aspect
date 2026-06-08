import type { ReactElement } from 'react';
import { mdiStar } from '@mdi/js';
import { Icon } from '../ui/Icon.js';
import { roomsOverview } from './roomStats.js';
import { roomIcon } from './roomIcon.js';
import { useRoomFavourites } from './roomFavouritesStore.js';
import type { Room } from './rooms.js';
import { SQUIRCLE } from '../ui/tokens.js';

export function RoomsOverview({ rooms, onOpen }: { rooms: Room[]; onOpen: (areaId: string) => void }): ReactElement {
  const favRooms = useRoomFavourites((s) => s.favRooms);
  const stats = roomsOverview(rooms);
  return (
    <div>
      <h1 className="m-0 text-[26px] font-extrabold tracking-[-0.5px]">Rooms</h1>
      <p className="mb-5 mt-0.5 text-[12.5px] font-medium text-[var(--color-muted)]">
        {stats.length} {stats.length === 1 ? 'room' : 'rooms'}
        {stats.some((s) => s.onCount > 0) && (
          <> · {stats.filter((s) => s.onCount > 0).length} active</>
        )}
      </p>
      {stats.length === 0 ? (
        <p className="text-[15px] text-[var(--color-muted)]">No rooms to show yet.</p>
      ) : (
        <div className="grid gap-[14px] [grid-template-columns:repeat(auto-fill,minmax(180px,1fr))]">
          {stats.map((s, i) => {
            const active = s.onCount > 0;
            const fav = favRooms.has(s.areaId);
            return (
              <button
                key={s.areaId}
                type="button"
                onClick={() => onOpen(s.areaId)}
                className={[
                  'card-enter relative flex min-h-[120px] flex-col rounded-[20px] border p-4 text-left backdrop-blur-[22px] transition-[transform,background-color] duration-150 active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40',
                  active
                    ? 'border-white/50 bg-[#f6f7f9]/95 text-[#15161a] hover:bg-[#edeef1]/95'
                    : 'border-white/10 bg-[rgba(36,40,50,0.5)] backdrop-saturate-[1.3] hover:bg-[rgba(48,54,66,0.65)]',
                ].join(' ')}
                style={{ cornerShape: `superellipse(${SQUIRCLE})`, animationDelay: `${i * 45}ms` } as React.CSSProperties}
              >
                {fav && (
                  <span className="absolute right-3 top-3">
                    <Icon path={mdiStar} size={13} color="#ffd27d" />
                  </span>
                )}
                <span
                  className={`flex h-[42px] w-[42px] items-center justify-center rounded-[13px] ${active ? 'bg-[#191c24]' : 'bg-white/10'}`}
                  style={{ cornerShape: `superellipse(${SQUIRCLE})` } as React.CSSProperties}
                >
                  <Icon path={roomIcon(s.name)} size={22} color={active ? '#fff' : '#cfd3db'} />
                </span>
                <span className="mt-auto text-[14px] font-bold tracking-[-0.2px]">{s.name}</span>
                <span className={`mt-0.5 text-[12px] font-medium ${active ? 'text-[#565a66]' : 'text-[var(--color-muted)]'}`}>
                  {active ? <span className="font-semibold">{s.onCount} on</span> : 'All off'} · {s.deviceCount} {s.deviceCount === 1 ? 'device' : 'devices'}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
