export interface Participant {
  id: string;
  name: string;
  isHost: boolean;
  hasVoted: boolean;
  vote: string | null;
}

export interface RoomViewer {
  participantId?: string;
  name?: string;
  isHost?: boolean;
  role?: string;
}
