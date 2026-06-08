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
        active ? 'bg-[var(--color-frost)] text-[var(--color-frost-text)]' : 'text-[var(--color-muted)] hover:bg-white/5 hover:text-[var(--color-text)]',
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
