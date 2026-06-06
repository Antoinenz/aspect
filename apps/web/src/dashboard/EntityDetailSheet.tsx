import type { ReactElement } from 'react';
import type { EntityState } from '@aspect/shared';
import { Sheet } from '../ui/Sheet.js';
import { formatState } from '../domain/entities.js';
import type { RoomEntity } from './rooms.js';

export interface EntityDetailSheetProps {
  roomEntity: RoomEntity | null;
  onClose: () => void;
}

/**
 * Read-only detail view for a tapped entity. Real controls (toggle, brightness,
 * climate, etc.) arrive in Plan 4; this establishes the surface and shows the
 * current state + attributes.
 */
export function EntityDetailSheet({
  roomEntity,
  onClose,
}: EntityDetailSheetProps): ReactElement {
  return (
    <Sheet open={roomEntity !== null} onClose={onClose} title={roomEntity?.name ?? ''}>
      {roomEntity && (
        <div style={{ display: 'grid', gap: 16 }}>
          <p style={{ margin: 0, fontSize: 15, color: 'var(--muted)' }}>
            {formatState(roomEntity.entity)}
          </p>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>
            Controls are coming soon.
          </p>
          <AttributeList entity={roomEntity.entity} />
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
