import { type ReactElement, type ReactNode, useState } from 'react';
import {
  mdiWeatherSunny, mdiWeatherNight, mdiThemeLightDark,
  mdiCheckCircle, mdiSync, mdiAlertCircleOutline,
  mdiAnimationPlay, mdiHomeOutline, mdiStarOutline,
  mdiViewGridOutline, mdiMapMarkerRadiusOutline,
} from '@mdi/js';
import { useConnectionStore } from '../store/connectionStore.js';
import { useThemeStore, type ThemeChoice } from './theme.js';
import { useMotionStore, type MotionPref } from './motionStore.js';
import { Icon } from '../ui/Icon.js';
import { SQUIRCLE } from '../ui/tokens.js';
import type { Section } from '../nav/navItems.js';

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

function MotionCard(): ReactElement {
  const motion = useMotionStore((s) => s.motion);
  const setMotion = useMotionStore((s) => s.setMotion);

  const MOTION_OPTIONS: { value: MotionPref; label: string; sub: string }[] = [
    { value: 'on', label: 'Enabled', sub: 'Page slides, card entrances, sidebar pill' },
    { value: 'off', label: 'Reduced', sub: 'No transitions or animations' },
  ];

  return (
    <Card title="Motion">
      <div className="flex flex-col gap-2">
        {MOTION_OPTIONS.map((opt) => {
          const active = motion === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setMotion(opt.value)}
              aria-pressed={active}
              className={[
                'flex items-center gap-3 px-3 py-2.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40',
                active
                  ? 'bg-[var(--color-frost)] text-[var(--color-frost-text)]'
                  : 'border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-text)]',
              ].join(' ')}
              style={squircle(13)}
            >
              <Icon path={mdiAnimationPlay} size={20} color={active ? 'var(--color-frost-text)' : 'var(--color-muted)'} />
              <span>
                <span className="block text-[13.5px] font-semibold">{opt.label}</span>
                <span className={['block text-[12px]', active ? 'text-[var(--color-frost-muted)]' : 'text-[var(--color-muted)]'].join(' ')}>{opt.sub}</span>
              </span>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

const STARTUP_OPTIONS: { value: Section; label: string; icon: string }[] = [
  { value: 'home', label: 'Home', icon: mdiHomeOutline },
  { value: 'favorites', label: 'Quick Access', icon: mdiStarOutline },
  { value: 'rooms', label: 'Rooms', icon: mdiViewGridOutline },
  { value: 'map', label: 'Map', icon: mdiMapMarkerRadiusOutline },
];

function StartupCard(): ReactElement {
  const valid = STARTUP_OPTIONS.map((o) => o.value);
  const [current, setCurrent] = useState<Section>(() => {
    const saved = localStorage.getItem('aspect-startup-section') as Section | null;
    return saved && valid.includes(saved) ? saved : 'home';
  });

  function pick(value: Section): void {
    localStorage.setItem('aspect-startup-section', value);
    setCurrent(value);
  }

  return (
    <Card title="Startup">
      <p className="m-0 mb-2.5 text-[12.5px] text-[var(--color-muted)]">Tab shown when you open Aspect</p>
      <div className="grid grid-cols-2 gap-2">
        {STARTUP_OPTIONS.map((opt) => {
          const active = current === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => pick(opt.value)}
              aria-pressed={active}
              className={[
                'flex items-center gap-2 px-3 py-2.5 text-[13.5px] font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40',
                active
                  ? 'bg-[var(--color-frost)] text-[var(--color-frost-text)]'
                  : 'border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-text)]',
              ].join(' ')}
              style={squircle(13)}
            >
              <Icon path={opt.icon} size={18} color={active ? 'var(--color-frost-text)' : 'var(--color-muted)'} />
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
        <MotionCard />
        <StartupCard />
        <ConnectionCard />
        <AboutCard />
      </div>
    </div>
  );
}
