import { Participant, RoomViewer } from './participant.model';

export type RoomStatus = 'waiting' | 'voting' | 'revealed';

export interface RoomState {
  code: string;
  name: string;
  status: RoomStatus;
  expiresAt: string;
  createdByName: string;
  deck: string[];
  remainingMs: number;
  votedCount: number;
  participantCount: number;
  average: number | null;
  participants: Participant[];
  viewer?: RoomViewer | null;
  joinUrl?: string;
}
