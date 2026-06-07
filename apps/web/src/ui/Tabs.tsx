import * as RTabs from '@radix-ui/react-tabs';
import type { ReactElement, ReactNode } from 'react';
import { Icon } from './Icon.js';
import { SQUIRCLE } from './tokens.js';

export interface TabItem { id: string; label: string; path: string; }

export function Tabs({
  items, value, onValueChange, children,
}: {
  items: TabItem[]; value: string; onValueChange: (v: string) => void; children: ReactNode;
}): ReactElement {
  const sq = { borderRadius: '16px', cornerShape: `superellipse(${SQUIRCLE})` } as React.CSSProperties;
  return (
    <RTabs.Root value={value} onValueChange={onValueChange}>
      <RTabs.List className="-mx-5 mb-5 flex gap-[7px] overflow-x-auto px-5 pb-1">
        {items.map((t) => (
          <RTabs.Trigger
            key={t.id}
            value={t.id}
            style={sq}
            className="flex flex-none items-center gap-1.5 whitespace-nowrap border border-white/10 bg-[rgba(40,44,54,0.4)] px-[15px] py-[9px] text-[13px] font-semibold text-[var(--color-muted)] backdrop-blur-[14px] data-[state=active]:border-transparent data-[state=active]:bg-[rgba(244,245,247,0.95)] data-[state=active]:text-[#15161a]"
          >
            <Icon path={t.path} size={15} />
            {t.label}
          </RTabs.Trigger>
        ))}
      </RTabs.List>
      {children}
    </RTabs.Root>
  );
}

export const TabPanel = RTabs.Content;
