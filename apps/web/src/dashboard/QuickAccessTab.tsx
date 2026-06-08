import { type ReactElement, useState } from 'react';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, rectSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { mdiClose, mdiPencilOutline, mdiCheck } from '@mdi/js';
import { useConnectionStore } from '../store/connectionStore.js';
import { Tile } from '../ui/Tile.js';
import { Icon } from '../ui/Icon.js';
import { iconFor, tintFor } from '../domain/icons.js';
import { formatState, isActive, friendlyName, domainOf } from '../domain/entities.js';
import { tileAction } from '../domain/tileAction.js';
import { setFavorite, reorderFavorites } from '../server-client/commands.js';
import type { EntityState } from '@aspect/shared';
import { SQUIRCLE } from '../ui/tokens.js';

function SortableTile({
  entity, index, onRemove,
}: { entity: EntityState; index: number; onRemove: () => void }): ReactElement {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: entity.entityId,
  });
  const wide = domainOf(entity.entityId) === 'climate' || domainOf(entity.entityId) === 'media_player';
  const name = friendlyName(entity, null);

  return (
    <div
      ref={setNodeRef}
      className={`relative ${wide ? 'col-span-2' : ''}`}
      style={{ transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 50 : undefined }}
    >
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        aria-label={`Remove ${name} from favourites`}
        className="absolute -right-2 -top-2 z-20 flex h-[22px] w-[22px] items-center justify-center rounded-full bg-black/80 shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
      >
        <Icon path={mdiClose} size={12} color="white" />
      </button>
      <div
        {...attributes}
        {...listeners}
        className={isDragging ? 'cursor-grabbing opacity-40' : 'cursor-grab tile-wiggle'}
        style={{ animationDelay: `${(index * 37) % 150}ms`, touchAction: 'none' }}
      >
        <div className="pointer-events-none">
          <Tile
            path={iconFor(entity)}
            tint={tintFor(domainOf(entity.entityId))}
            name={name}
            state={formatState(entity)}
            active={isActive(entity)}
            wide={false}
            battery={null}
            onPress={() => {}}
            onAction={null}
          />
        </div>
      </div>
    </div>
  );
}

export function QuickAccessTab({ onSelect }: { onSelect: (entityId: string) => void }): ReactElement {
  const favorites = useConnectionStore((s) => s.favorites);
  const entities = useConnectionStore((s) => s.entities);
  const optimistic = useConnectionStore((s) => s.applyOptimistic);
  const [editing, setEditing] = useState(false);
  const [order, setOrder] = useState<string[]>([]);

  const tiles = favorites
    .map((id) => entities[id])
    .filter((e): e is NonNullable<typeof e> => e !== undefined);

  const isDevice = (id: string): boolean => domainOf(id) !== 'scene' && domainOf(id) !== 'script';
  const deviceCount = tiles.filter((e) => isDevice(e.entityId)).length;

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

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

  function handleDragEnd(event: DragEndEvent): void {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setOrder((items) => {
        const oldIndex = items.indexOf(String(active.id));
        const newIndex = items.indexOf(String(over.id));
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  }

  if (tiles.length === 0 && !editing) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-2 text-center">
        <h1 className="m-0 text-[26px] font-extrabold tracking-[-0.5px]">Favourites</h1>
        <p className="m-0 max-w-[260px] text-[15px] text-[var(--color-muted)]">
          No favourites yet. Open any device and tap the ☆ star to pin it here.
        </p>
      </div>
    );
  }

  const header = (
    <div className="mb-5 flex items-center justify-between">
      <div>
        <h1 className="m-0 text-[26px] font-extrabold tracking-[-0.5px]">Favourites</h1>
        <p className="m-0 mt-0.5 text-[12.5px] font-medium text-[var(--color-muted)]">
          {editing
            ? `${order.filter(isDevice).length} ${order.filter(isDevice).length === 1 ? 'device' : 'devices'}`
            : `${deviceCount} ${deviceCount === 1 ? 'device' : 'devices'}`}
        </p>
      </div>
      {editing ? (
        <button
          type="button"
          onClick={finishEdit}
          className="flex items-center gap-1.5 rounded-[13px] bg-[var(--color-frost)] px-3 py-1.5 text-[13px] font-bold text-[var(--color-frost-text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          style={{ cornerShape: `superellipse(${SQUIRCLE})` } as React.CSSProperties}
        >
          <Icon path={mdiCheck} size={16} />
          Done
        </button>
      ) : (
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
      )}
    </div>
  );

  if (editing) {
    const editTiles = order
      .map((id) => entities[id])
      .filter((e): e is NonNullable<typeof e> => e !== undefined);

    return (
      <div>
        {header}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={order} strategy={rectSortingStrategy}>
            <div className="grid gap-[13px] [grid-template-columns:repeat(auto-fill,minmax(150px,1fr))]">
              {editTiles.map((entity, index) => (
                <SortableTile
                  key={entity.entityId}
                  entity={entity}
                  index={index}
                  onRemove={() => removeFromEdit(entity.entityId)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>
    );
  }

  return (
    <div>
      {header}
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
            onAction={tileAction(entity, optimistic)}
            onPress={() => onSelect(entity.entityId)}
          />
        ))}
      </div>
    </div>
  );
}
