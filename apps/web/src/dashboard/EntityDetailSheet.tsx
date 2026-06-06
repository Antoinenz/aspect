import type { ReactElement } from 'react';
import type { EntityState } from '@aspect/shared';
import { Sheet } from '../ui/Sheet.js';
import { useConnectionStore } from '../store/connectionStore.js';
import { friendlyName, formatState } from '../domain/entities.js';

export interface EntityDetailSheetProps {
  entityId: string | null;
  onClose: () => void;
}

/**
 * Read-only detail view for a tapped entity. Real controls (toggle, brightness,
 * climate, etc.) arrive in Plan 4; this establishes the surface and shows the
 * current state + attributes.
 */
export function EntityDetailSheet({
  entityId,
  onClose,
}: EntityDetailSheetProps): ReactElement {
  const entity = useConnectionStore((s) => (entityId ? s.entities[entityId] : undefined));
  const registryName = useConnectionStore((s) =>
    entityId ? (s.registry.find((r) => r.entityId === entityId)?.name ?? null) : null,
  );
  const name = entity ? friendlyName(entity, registryName) : '';

  return (
    <Sheet open={entity != null} onClose={onClose} title={name}>
      {entity && (
        <div style={{ display: 'grid', gap: 16 }}>
          <p style={{ margin: 0, fontSize: 15, color: 'var(--muted)' }}>
            {formatState(entity)}
          </p>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>
            Controls are coming soon.
          </p>
          <AttributeList entity={entity} />
        </div>
      )}
    </Sheet>
  );
}

function AttributeList({ entity }: { entity: EntityState }): ReactElement | null {
  const entries = Object.entries(entity.attributes);
  if (entries.length === 0) return null;
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <span
        style={{
          fontSize: 11,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--muted)',
        }}
      >
        Attributes
      </span>
      {entries.map(([key, value]) => (
        <div
          key={key}
          style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13 }}
        >
          <span style={{ color: 'var(--muted)' }}>{key}</span>
          <span style={{ textAlign: 'right', wordBreak: 'break-word' }}>
            {formatAttr(value)}
          </span>
        </div>
      ))}
    </div>
  );
}

function formatAttr(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
