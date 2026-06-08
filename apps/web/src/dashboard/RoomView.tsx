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
