import { type ReactElement, type ReactNode } from 'react';
import {
  mdiWeatherSunny, mdiWeatherNight, mdiThemeLightDark,
  mdiCheckCircle, mdiSync, mdiAlertCircleOutline, mdiClose, mdiStarOutline,
} from '@mdi/js';
import { useConnectionStore } from '../store/connectionStore.js';
import { useThemeStore, type ThemeChoice } from './theme.js';
import { setFavorite } from '../server-client/commands.js';
import { friendlyName } from '../domain/entities.js';
import { Icon } from '../ui/Icon.js';
import { SQUIRCLE } from '../ui/tokens.js';

const APP_VERSION = '0.1.0 (preview)';
const PROJECT_URL = 'https://github.com/Antoinenz/aspect';

const squircle = (radius: number): React.CSSProperties =>
  ({ borderRadius: `${radius}px`, cornerShape: `superellipse(${SQUIRCLE})` } as React.CSSProperties);

function Card({ title, children }: { title: string; children: ReactNode }): ReactElement {
  return (
    <section
      className="border border-[var(--color-border)] bg-[var(--color-surface)] p-4 backdrop-blur-[var(--blur-frost)]"
      style={squircle(18)}
    >
      <h2 className="m-0 mb-3 text-[13px] font-bold uppercase tracking-[0.6px] text-[var(--color-muted)]">{title}</h2>
      {children}
    </section>
  );
}

const THEME_OPTIONS: { value: ThemeChoice; label: string; icon: string }[] = [
  { value: 'light', label: 'Light', icon: mdiWeatherSunny },
  { value: 'dark', label: 'Dark', icon: mdiWeatherNight },
  { value: 'auto', label: 'Auto', icon: mdiThemeLightDark },
];

function ThemeCard(): ReactElement {
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  return (
    <Card title="Appearance">
      <div className="grid grid-cols-3 gap-2">
        {THEME_OPTIONS.map((opt) => {
          const active = theme === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setTheme(opt.value)}
              aria-pressed={active}
              className={[
                'flex flex-col items-center gap-1.5 px-2 py-3 text-[13px] font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40',
                active
                  ? 'bg-[var(--color-frost)] text-[var(--color-frost-text)]'
                  : 'border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-text)]',
              ].join(' ')}
              style={squircle(13)}
            >
              <Icon path={opt.icon} size={22} />
              {opt.label}
            </button>
          );
        })}
      </div>
    </Card>
  );
}

function ConnectionCard(): ReactElement {
  const link = useConnectionStore((s) => s.link);
  const haConnected = useConnectionStore((s) => s.haConnected);

  let icon = mdiAlertCircleOutline;
  let color = 'var(--color-danger)';
  let text = 'Disconnected';
  if (haConnected) {
    icon = mdiCheckCircle;
    color = '#5fd08a';
    text = 'Connected to Home Assistant';
  } else if (link === 'connected') {
    icon = mdiAlertCircleOutline;
    color = '#ffd27d';
    text = 'Server online · Home Assistant unavailable';
  } else if (link === 'connecting') {
    icon = mdiSync;
    color = '#ffd27d';
    text = 'Connecting…';
  }

  return (
    <Card title="Connection">
      <div className="flex items-center gap-2.5">
        <Icon path={icon} size={20} color={color} />
        <span className="text-[15px] font-semibold">{text}</span>
      </div>
    </Card>
  );
}

function FavoritesCard(): ReactElement {
  const favorites = useConnectionStore((s) => s.favorites);
  const entities = useConnectionStore((s) => s.entities);

  if (favorites.length === 0) {
    return (
      <Card title="Favorites">
        <p className="m-0 flex items-center gap-2 text-[14px] text-[var(--color-muted)]">
          <Icon path={mdiStarOutline} size={18} />
          No favorites yet — pin devices from their detail view.
        </p>
      </Card>
    );
  }

  return (
    <Card title="Favorites">
      <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
        {favorites.map((id) => {
          const entity = entities[id];
          const name = entity ? friendlyName(entity, null) : id;
          return (
            <li
              key={id}
              className="flex items-center justify-between border border-[var(--color-border)] bg-[var(--color-elevated)] py-2 pl-3 pr-2"
              style={squircle(12)}
            >
              <span className="truncate text-[14px] font-semibold">{name}</span>
              <button
                type="button"
                onClick={() => setFavorite(id, false)}
                aria-label={`Remove ${name} from favorites`}
                className="flex flex-none items-center justify-center rounded-full p-1.5 text-[var(--color-muted)] hover:bg-white/10 hover:text-[var(--color-text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
              >
                <Icon path={mdiClose} size={18} />
              </button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function AboutCard(): ReactElement {
  return (
    <Card title="About">
      <div className="flex flex-col gap-1 text-[14px]">
        <div className="flex items-center justify-between">
          <span className="font-semibold">Aspect</span>
          <span className="text-[var(--color-muted)]">v{APP_VERSION}</span>
        </div>
        <a
          href={PROJECT_URL}
          target="_blank"
          rel="noreferrer"
          className="text-[var(--color-muted)] underline-offset-2 hover:text-[var(--color-text)] hover:underline"
        >
          {PROJECT_URL.replace('https://', '')}
        </a>
      </div>
    </Card>
  );
}

export function SettingsPage(): ReactElement {
  return (
    <div>
      <h1 className="m-0 mb-5 text-[26px] font-extrabold tracking-[-0.5px]">Settings</h1>
      <div className="flex flex-col gap-3.5">
        <ThemeCard />
        <ConnectionCard />
        <FavoritesCard />
        <AboutCard />
      </div>
    </div>
  );
}
