import { type ReactElement, useState } from 'react';
import { Reorder, useDragControls } from 'motion/react';
import { mdiDragVertical, mdiClose, mdiPencilOutline, mdiCheck } from '@mdi/js';
import { useConnectionStore } from '../store/connectionStore.js';
import { Tile } from '../ui/Tile.js';
import { Icon } from '../ui/Icon.js';
import { iconFor, tintFor } from '../domain/icons.js';
import { formatState, isActive, friendlyName, domainOf } from '../domain/entities.js';
import { setFavorite, reorderFavorites } from '../server-client/commands.js';
import type { EntityState } from '@aspect/shared';
import { SQUIRCLE } from '../ui/tokens.js';

function DragHandle({ controls }: { controls: ReturnType<typeof useDragControls> }): ReactElement {
  return (
    <span
      onPointerDown={(e) => controls.start(e)}
      className="flex cursor-grab touch-none items-center px-1 text-[var(--color-muted)] active:cursor-grabbing"
      aria-hidden
    >
      <Icon path={mdiDragVertical} size={22} />
    </span>
  );
}

function EditRow({ entity, onRemove }: { entity: EntityState; onRemove: () => void }): ReactElement {
  const controls = useDragControls();
  const name = friendlyName(entity, null);
  return (
    <Reorder.Item
      value={entity.entityId}
      dragListener={false}
      dragControls={controls}
      className="flex items-center gap-2 rounded-[13px] border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-2.5 backdrop-blur-[var(--blur-frost)]"
      style={{ cornerShape: `superellipse(${SQUIRCLE})` } as React.CSSProperties}
    >
      <DragHandle controls={controls} />
      <span className="flex h-8 w-8 flex-none items-center justify-center rounded-[10px] bg-white/10" style={{ cornerShape: `superellipse(${SQUIRCLE})` } as React.CSSProperties}>
        <Icon path={iconFor(entity)} size={18} color={tintFor(domainOf(entity.entityId)) ?? undefined} />
      </span>
      <span className="flex-1 truncate text-[14px] font-semibold">{name}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${name} from favorites`}
        className="flex flex-none items-center justify-center rounded-full p-1.5 text-[var(--color-muted)] hover:bg-white/10 hover:text-[var(--color-danger)] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
      >
        <Icon path={mdiClose} size={18} />
      </button>
    </Reorder.Item>
  );
}

export function QuickAccessTab({ onSelect }: { onSelect: (entityId: string) => void }): ReactElement {
  const favorites = useConnectionStore((s) => s.favorites);
  const entities = useConnectionStore((s) => s.entities);
  const [editing, setEditing] = useState(false);
  const [order, setOrder] = useState<string[]>([]);

  const tiles = favorites
    .map((id) => entities[id])
    .filter((e): e is NonNullable<typeof e> => e !== undefined);

  function startEdit(): void {
    setOrder([...favorites]);
    setEditing(true);
  }

  function finishEdit(): void {
    reorderFavorites(order);
    useConnectionStore.getState().applyFavorites(order);
    setEditing(false);
  }

  function removeFromEdit(id: string): void {
    setOrder((prev) => prev.filter((x) => x !== id));
    setFavorite(id, false);
  }

  if (tiles.length === 0 && !editing) {
    return (
      <div className="grid gap-2">
        <h1 className="m-0 text-[26px] font-extrabold tracking-[-0.5px]">Quick Access</h1>
        <p className="text-[15px] text-[var(--color-muted)]">
          No favorites yet. Open any device and tap the ☆ star to pin it here.
        </p>
      </div>
    );
  }

  if (editing) {
    const editTiles = order
      .map((id) => entities[id])
      .filter((e): e is NonNullable<typeof e> => e !== undefined);

    return (
      <div>
        <div className="mb-5 flex items-center justify-between">
          <h1 className="m-0 text-[26px] font-extrabold tracking-[-0.5px]">Quick Access</h1>
          <button
            type="button"
            onClick={finishEdit}
            className="flex items-center gap-1.5 rounded-[13px] bg-[var(--color-frost)] px-3 py-1.5 text-[13px] font-bold text-[var(--color-frost-text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            style={{ cornerShape: `superellipse(${SQUIRCLE})` } as React.CSSProperties}
          >
            <Icon path={mdiCheck} size={16} />
            Done
          </button>
        </div>
        <p className="mb-3 mt-0 text-[12.5px] text-[var(--color-muted)]">Drag to reorder · tap × to remove</p>
        <Reorder.Group
          axis="y"
          values={order}
          onReorder={setOrder}
          className="flex flex-col gap-2"
          as="div"
        >
          {editTiles.map((entity) => (
            <EditRow
              key={entity.entityId}
              entity={entity}
              onRemove={() => removeFromEdit(entity.entityId)}
            />
          ))}
        </Reorder.Group>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <h1 className="m-0 text-[26px] font-extrabold tracking-[-0.5px]">Quick Access</h1>
        <button
          type="button"
          onClick={startEdit}
          aria-label="Edit favorites"
          className="flex items-center gap-1.5 rounded-[13px] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-[13px] font-semibold text-[var(--color-muted)] backdrop-blur-[var(--blur-frost)] hover:text-[var(--color-text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          style={{ cornerShape: `superellipse(${SQUIRCLE})` } as React.CSSProperties}
        >
          <Icon path={mdiPencilOutline} size={16} />
          Edit
        </button>
      </div>
      <div className="grid gap-[13px] [grid-template-columns:repeat(auto-fill,minmax(150px,1fr))]">
        {tiles.map((entity) => (
          <Tile
            key={entity.entityId}
            path={iconFor(entity)}
            tint={tintFor(domainOf(entity.entityId))}
            name={friendlyName(entity, null)}
            state={formatState(entity)}
            active={isActive(entity)}
            wide={domainOf(entity.entityId) === 'climate' || domainOf(entity.entityId) === 'media_player'}
            onPress={() => onSelect(entity.entityId)}
          />
        ))}
      </div>
    </div>
  );
}
