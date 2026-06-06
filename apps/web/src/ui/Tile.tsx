import { motion } from 'motion/react';
import type { ReactElement } from 'react';

export interface TileProps {
  icon: string;
  name: string;
  state: string;
  active: boolean;
  onPress: () => void;
}

export function Tile({ icon, name, state, active, onPress }: TileProps): ReactElement {
  return (
    <motion.button
      type="button"
      onClick={onPress}
      whileTap={{ scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      style={{
        appearance: 'none',
        textAlign: 'left',
        cursor: 'pointer',
        display: 'block',
        width: '100%',
        padding: 15,
        borderRadius: 'var(--radius-tile)',
        background: active ? 'var(--active-surface)' : 'var(--surface)',
        border: `1px solid ${active ? 'var(--active-border)' : 'var(--border)'}`,
        color: active ? 'var(--active-text)' : 'var(--text)',
        font: 'inherit',
      }}
    >
      <span
        aria-hidden
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 36,
          height: 36,
          borderRadius: 'var(--radius-icon)',
          fontSize: 17,
          marginBottom: 12,
          background: active ? 'var(--active-icon)' : 'var(--border)',
        }}
      >
        {icon}
      </span>
      <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600 }}>{name}</span>
      <span style={{ display: 'block', fontSize: 11.5, marginTop: 3, opacity: 0.8 }}>
        {state}
      </span>
    </motion.button>
  );
}
