import { useMemo, type ReactElement } from 'react';
import {
  mdiThermostat, mdiShieldCheckOutline, mdiPlayCircleOutline, mdiAccount,
  mdiAlertCircleOutline, mdiLightbulbGroupOutline, mdiWeatherPartlyCloudy,
} from '@mdi/js';
import { useConnectionStore } from '../store/connectionStore.js';
import { buildSummary } from './summary.js';
import { Icon } from '../ui/Icon.js';
import { StatusPill } from '../ui/StatusPill.js';
import { Tile } from '../ui/Tile.js';
import { ActionButton } from '../controls/ActionButton.js';
import { iconFor, tintFor } from '../domain/icons.js';
import { formatState, isActive, friendlyName } from '../domain/entities.js';
import { callService } from '../server-client/commands.js';

const ALERT_ICON = {
  open: mdiAlertCircleOutline, unlocked: mdiShieldCheckOutline,
  safety: mdiAlertCircleOutline, battery: mdiAlertCircleOutline,
} as const;

export function SummaryTab({ onSelect }: { onSelect: (entityId: string) => void }): ReactElement {
  const entities = useConnectionStore((s) => s.entities);
  const registry = useConnectionStore((s) => s.registry);
  const optimistic = useConnectionStore((s) => s.applyOptimistic);
  const s = useMemo(() => buildSummary(entities, registry), [entities, registry]);

  const empty =
    !s.climate && !s.security && s.playing === 0 && !s.weather &&
    s.people.length === 0 && s.thermostats.length === 0 &&
    s.lightsOn.length === 0 && s.alerts.length === 0;

  if (empty) {
    return <p className="text-[15px] text-[var(--color-muted)]">Nothing to summarize yet.</p>;
  }

  const turnAllLightsOff = (): void => {
    for (const id of s.lightsOn) {
      optimistic(id, { state: 'off' });
      callService('light', 'turn_off', id);
    }
  };

  return (
    <div className="grid gap-6">
      <h1 className="m-0 text-[26px] font-extrabold tracking-[-0.5px]">Home</h1>

      {/* Status pills */}
      <div className="-mx-5 flex gap-[9px] overflow-x-auto px-5 pb-1">
        {s.climate && (
          <StatusPill path={mdiThermostat} label="Climate" value={s.climate.range ?? `${s.climate.count}`} />
        )}
        {s.security && (
          <StatusPill path={mdiShieldCheckOutline} label="Security"
            value={s.security.openings ? `${s.security.openings} open` : s.security.unlocked ? `${s.security.unlocked} unlocked` : 'All secure'} />
        )}
        {s.playing > 0 && (
          <StatusPill path={mdiPlayCircleOutline} label="Playing" value={`${s.playing}`} />
        )}
      </div>

      {/* Presence */}
      {s.people.length > 0 && (
        <section className="grid gap-2.5">
          <h2 className="m-0 text-[15px] font-bold text-[var(--color-muted)]">Who&apos;s home</h2>
          <div className="flex flex-wrap gap-2.5">
            {s.people.map((p) => (
              <div key={p.entityId} className="flex items-center gap-2 rounded-[14px] border border-white/10 bg-[rgba(36,40,50,0.5)] px-3 py-2 backdrop-blur-[18px]">
                {p.picture
                  ? <img src={p.picture} alt="" className="h-6 w-6 rounded-full object-cover" />
                  : <Icon path={mdiAccount} size={18} color={p.home ? '#8ee6b0' : 'var(--color-muted)'} />}
                <span className="text-[13px] font-semibold">{p.name}</span>
                <span className="text-[12px] text-[var(--color-muted)]">{p.home ? 'Home' : 'Away'}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Alerts */}
      {s.alerts.length > 0 && (
        <section className="grid gap-2">
          <h2 className="m-0 text-[15px] font-bold text-[var(--color-muted)]">Needs attention</h2>
          <div className="grid gap-2">
            {s.alerts.map((a) => (
              <button key={a.entityId} type="button" onClick={() => onSelect(a.entityId)}
                className="flex items-center gap-3 rounded-[16px] border border-[#5a2e2e] bg-[rgba(58,30,30,0.4)] px-4 py-3 text-left backdrop-blur-[18px] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                style={{ cornerShape: 'superellipse(4)' } as React.CSSProperties}>
                <Icon path={ALERT_ICON[a.kind]} size={20} color="#ff8a8a" />
                <span className="flex-1 text-[14px] font-semibold">{a.name}</span>
                <span className="text-[12px] text-[#ff9a9a]">{a.detail}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Weather + thermostats */}
      {(s.weather || s.thermostats.length > 0) && (
        <section className="grid gap-2.5">
          <h2 className="m-0 text-[15px] font-bold text-[var(--color-muted)]">Climate</h2>
          <div className="grid gap-[13px] [grid-template-columns:repeat(auto-fill,minmax(150px,1fr))]">
            {s.weather && (
              <div className="flex min-h-[120px] flex-col rounded-[20px] border border-white/10 bg-[rgba(36,40,50,0.5)] p-4 backdrop-blur-[22px] backdrop-saturate-[1.3]"
                style={{ cornerShape: 'superellipse(4)' } as React.CSSProperties}>
                <Icon path={mdiWeatherPartlyCloudy} size={26} color="#86c2ff" />
                <span className="mt-auto text-[14px] font-bold capitalize">{s.weather.state.replace(/_/g, ' ')}</span>
                {s.weather.temp && <span className="text-[12px] text-[var(--color-muted)]">{s.weather.temp}</span>}
              </div>
            )}
            {s.thermostats.map((id) => {
              const entity = entities[id];
              if (!entity) return null;
              return (
                <Tile key={id} path={iconFor(entity)} tint={tintFor('climate')} name={friendlyName(entity, null)}
                  state={formatState(entity)} active={isActive(entity)} wide onPress={() => onSelect(id)} />
              );
            })}
          </div>
        </section>
      )}

      {/* Activity */}
      {s.lightsOn.length > 0 && (
        <section className="flex items-center justify-between gap-3 rounded-[16px] border border-white/10 bg-[rgba(36,40,50,0.5)] px-4 py-3 backdrop-blur-[18px]"
          style={{ cornerShape: 'superellipse(4)' } as React.CSSProperties}>
          <span className="flex items-center gap-2.5 text-[14px] font-semibold">
            <Icon path={mdiLightbulbGroupOutline} size={20} color="#ffd27d" />
            {s.lightsOn.length} {s.lightsOn.length === 1 ? 'light' : 'lights'} on
          </span>
          <ActionButton onClick={turnAllLightsOff}>Turn all off</ActionButton>
        </section>
      )}
    </div>
  );
}
