import { motion } from 'motion/react';
import type { ReactElement } from 'react';
import { Icon } from './Icon.js';
import { SQUIRCLE } from './tokens.js';

export interface TileProps {
  path: string;
  tint?: string | null;
  name: string;
  state: string;
  active: boolean;
  wide?: boolean;
  battery?: number | null;
  onPress: () => void;
  /** When provided, the icon chip becomes an action button that calls this instead of onPress. */
  onAction?: (() => void) | null;
}

export function Tile({
  path, tint, name, state, active, wide = false, battery = null, onPress, onAction = null,
}: TileProps): ReactElement {
  const sq = { borderRadius: '24px', cornerShape: `superellipse(${SQUIRCLE})` } as React.CSSProperties;
  const chipSq = { borderRadius: '13px', cornerShape: `superellipse(${SQUIRCLE})` } as React.CSSProperties;
  const low = battery !== null && battery <= 15;
  const iconBg = active ? '#191c24' : 'rgba(255,255,255,0.10)';
  const iconColor = active ? '#fff' : (tint ?? '#dfe3ea');

  return (
    <motion.div
      className={[
        'relative flex min-h-[120px] flex-col',
        'border backdrop-blur-[22px] transition-colors duration-150',
        wide ? 'col-span-2' : '',
        active
          ? 'bg-[#f6f7f9]/95 border-white/50 text-[#15161a] hover:bg-[#edeef1]/95'
          : 'bg-[rgba(36,40,50,0.5)] border-white/10 text-[var(--color-text)] backdrop-saturate-[1.3] hover:bg-[rgba(48,54,66,0.65)]',
      ].join(' ')}
      style={sq}
      whileTap={{ scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
    >
      {/* Full-tile press zone — opens entity detail */}
      <button
        type="button"
        onClick={onPress}
        aria-label={name}
        className="absolute inset-0 cursor-pointer rounded-[24px] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
        style={sq}
      />

      {/* Icon — action button when onAction exists; pointer-events-none span otherwise
          (clicks fall through to the full-tile button above) */}
      {onAction ? (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onAction(); }}
          aria-label={`Toggle ${name}`}
          className="absolute left-3.5 top-3.5 z-10 flex h-[42px] w-[42px] cursor-pointer items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
          style={{ ...chipSq, background: iconBg }}
        >
          <Icon path={path} size={22} color={iconColor} />
        </button>
      ) : (
        <span
          aria-hidden
          className="pointer-events-none absolute left-3.5 top-3.5 flex h-[42px] w-[42px] items-center justify-center"
          style={{ ...chipSq, background: iconBg }}
        >
          <Icon path={path} size={22} color={iconColor} />
        </span>
      )}

      {battery !== null && (
        <span className={`pointer-events-none absolute right-3.5 top-3.5 text-[11px] font-semibold ${low ? 'text-[#ff8a8a]' : active ? 'text-[#7c8090]' : 'text-[rgba(235,238,245,0.55)]'}`}>
          {battery}%
        </span>
      )}

      {/* Text content — pointer-events-none so clicks fall through to the press zone */}
      <div className="pointer-events-none flex flex-1 flex-col p-4">
        <span className={`mt-auto text-[14px] font-bold tracking-[-0.2px] ${active ? 'text-[#15161a]' : ''}`}>{name}</span>
        <span className={`mt-0.5 text-[12px] font-medium ${active ? 'text-[#565a66]' : 'text-[var(--color-muted)]'}`}>{state}</span>
      </div>
    </motion.div>
  );
}
