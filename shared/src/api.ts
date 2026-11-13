// The GameAPI interface. The client talks only to this.
// LocalGameAPI (steps 2-9) runs the shared rules in the browser; RemoteGameAPI (step 10) talks to the server.
// Methods are added in later steps as they are needed.

import type { Avatar, FurnitureItem, Player, Point } from './types.ts';
import type { Room } from './room.ts';

export interface RoomState {
  room: Room;
  items: FurnitureItem[];
  avatars: Avatar[];
}

export interface GameAPI {
  /** The current player. */
  getPlayer(): Promise<Player>;
  /** Enter a room and get its full state. */
  enterRoom(roomId: number): Promise<RoomState>;
  /** Ask to walk to a world point. Returns the path (world points) to animate. */
  walk(to: Point): Promise<Point[]>;
}
