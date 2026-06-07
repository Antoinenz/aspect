import type { ReactElement } from 'react';
import { Icon } from './Icon.js';
import { SQUIRCLE } from './tokens.js';

export function StatusPill({
  path, label, value, onClick,
}: { path: string; label: string; value: string; onClick?: () => void }): ReactElement {
  const sq = { borderRadius: '18px', cornerShape: `superellipse(${SQUIRCLE})` } as React.CSSProperties;
  return (
    <button type="button" onClick={onClick} style={sq}
      className="flex flex-none items-center gap-2.5 border border-white/10 bg-[rgba(40,44,54,0.5)] px-[15px] py-2.5 text-left backdrop-blur-[18px]">
      <Icon path={path} size={18} />
      <span><b className="block text-[13px] font-bold">{label}</b><span className="block text-[11px] text-[var(--color-muted)]">{value}</span></span>
    </button>
  );
}
