import type { ReactElement } from 'react';
import { motion } from 'motion/react';
import { Icon } from '../ui/Icon.js';
import { roomsOverview } from './roomStats.js';
import { roomIcon } from './roomIcon.js';
import type { Room } from './rooms.js';
import { SQUIRCLE } from '../ui/tokens.js';

const gridVariants = {
  visible: { transition: { staggerChildren: 0.045 } },
};
const cardVariants = {
  hidden: { opacity: 0, y: 14, scale: 0.97 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring' as const, stiffness: 380, damping: 30 } },
};

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
        <motion.div
          className="grid gap-[14px] [grid-template-columns:repeat(auto-fill,minmax(180px,1fr))]"
          variants={gridVariants}
          initial="hidden"
          animate="visible"
        >
          {stats.map((s) => (
            <motion.button
              key={s.areaId}
              type="button"
              onClick={() => onOpen(s.areaId)}
              variants={cardVariants}
              whileTap={{ scale: 0.97 }}
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
            </motion.button>
          ))}
        </motion.div>
      )}
    </div>
  );
}
