import { Participant, RoomViewer } from './participant.model';

export type RoomStatus = 'waiting' | 'voting' | 'revealed';

export interface CurrentStory {
  workItemId: string;
  workItemType: string;
  title: string;
  url: string | null;
}

export interface RoomState {
  code: string;
  name: string;
  azureProject: string | null;
  currentStory: CurrentStory | null;
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

export interface AzureProjectsResponse {
  configured: boolean;
  projects: string[];
}
