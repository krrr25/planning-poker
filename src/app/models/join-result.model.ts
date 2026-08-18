import { RoomState } from './room.model';

export interface JoinResult {
  token: string;
  participantId: string;
  name: string;
  isHost: boolean;
  room: RoomState;
}
