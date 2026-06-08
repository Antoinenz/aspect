import { isActive } from '../domain/entities.js';
import type { Room } from './rooms.js';

export interface RoomStat {
  areaId: string;
  name: string;
  deviceCount: number;
  onCount: number;
}

export function roomsOverview(rooms: Room[]): RoomStat[] {
  return rooms.map((room) => ({
    areaId: room.areaId,
    name: room.name,
    deviceCount: room.entities.length,
    onCount: room.entities.filter((re) => isActive(re.entity)).length,
  }));
}
