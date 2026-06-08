import type { ReactElement } from 'react';
import { RoomTab } from './RoomTab.js';
import type { Room, RoomEntity } from './rooms.js';

export function RoomView({
  room, onBack, onSelect,
}: { room: Room; onBack: () => void; onSelect: (entity: RoomEntity) => void }): ReactElement {
  return <RoomTab room={room} onBack={onBack} onSelect={onSelect} />;
}
