import type { ReactElement } from 'react';
import { mdiStar, mdiStarOutline } from '@mdi/js';
import { Sheet } from '../ui/Sheet.js';
import { Icon } from '../ui/Icon.js';
import { useConnectionStore } from '../store/connectionStore.js';
import { friendlyName, formatState } from '../domain/entities.js';
import { ControlsFor } from '../controls/ControlsFor.js';
import { siblingReadings } from './deviceInfo.js';
import { setFavorite } from '../server-client/commands.js';

export interface EntityDetailSheetProps {
  entityId: string | null;
  onClose: () => void;
}

export function EntityDetailSheet({
  entityId,
  onClose,
}: EntityDetailSheetProps): ReactElement {
  const entity = useConnectionStore((s) => (entityId ? s.entities[entityId] : undefined));
  const registryName = useConnectionStore((s) =>
    entityId ? (s.registry.find((r) => r.entityId === entityId)?.name ?? null) : null,
  );
  const entities = useConnectionStore((s) => s.entities);
  const registry = useConnectionStore((s) => s.registry);
  const favorites = useConnectionStore((s) => s.favorites);
  const isFav = entityId !== null && favorites.includes(entityId);
  const siblings = entityId ? siblingReadings(entityId, entities, registry) : [];

  const name = entity ? friendlyName(entity, registryName) : '';

  return (
    <Sheet open={entity != null} onClose={onClose} title={name}>
      {entity && (
        <div style={{ display: 'grid', gap: 16 }}>
          <button
            type="button"
            onClick={() => { if (entityId) setFavorite(entityId, !isFav); }}
            className="flex items-center gap-2 self-start rounded-[14px] border border-white/10 bg-[rgba(36,40,50,0.5)] px-3 py-2 text-[13px] font-semibold backdrop-blur-[18px] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            style={{ cornerShape: 'superellipse(4)' } as React.CSSProperties}
          >
            <Icon path={isFav ? mdiStar : mdiStarOutline} size={18} color={isFav ? '#ffd27d' : 'var(--color-muted)'} />
            {isFav ? 'Pinned' : 'Pin to Quick'}
          </button>
          <p style={{ margin: 0, fontSize: 15, color: 'var(--muted)' }}>
            {formatState(entity)}
          </p>
          <ControlsFor entity={entity} />
          {siblings.length > 0 && (
            <div className="grid gap-2">
              <span className="text-[11px] uppercase tracking-[0.08em] text-[var(--color-muted)]">Device info</span>
              {siblings.map((s) => (
                <div key={s.entityId} className="flex justify-between gap-3 text-[13px]">
                  <span className="text-[var(--color-muted)]">{friendlyName(s, null)}</span>
                  <span className="text-right">{formatState(s)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Sheet>
  );
}
