import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { JoinResult } from '../models/join-result.model';
import { RoomState } from '../models/room.model';

@Injectable({ providedIn: 'root' })
export class RoomService {
  private readonly http = inject(HttpClient);
  readonly room = signal<RoomState | null>(null);
  readonly error = signal('');

  sessionKey(code: string): string {
    return `pp.participant.${code}`;
  }

  saveSession(code: string, data: { token: string; participantId: string; name: string }): void {
    localStorage.setItem(this.sessionKey(code), JSON.stringify(data));
  }

  hasSession(code: string): boolean {
    return !!localStorage.getItem(this.sessionKey(code));
  }

  async listMine(): Promise<RoomState[]> {
    return firstValueFrom(this.http.get<RoomState[]>('/api/rooms'));
  }

  async create(name: string): Promise<RoomState> {
    return firstValueFrom(this.http.post<RoomState>('/api/rooms', { name }));
  }

  async get(code: string): Promise<RoomState> {
    const room = await firstValueFrom(this.http.get<RoomState>(`/api/rooms/${code}`));
    this.room.set(room);
    this.error.set('');
    return room;
  }

  async join(code: string, name: string): Promise<JoinResult> {
    const result = await firstValueFrom(
      this.http.post<JoinResult>(`/api/rooms/${code}/join`, { name })
    );
    this.saveSession(code, {
      token: result.token,
      participantId: result.participantId,
      name: result.name,
    });
    this.room.set(result.room);
    return result;
  }

  async start(code: string): Promise<void> {
    this.room.set(await firstValueFrom(this.http.post<RoomState>(`/api/rooms/${code}/start`, {})));
  }

  async vote(code: string, value: string): Promise<void> {
    this.room.set(
      await firstValueFrom(this.http.post<RoomState>(`/api/rooms/${code}/vote`, { value }))
    );
  }

  async reveal(code: string): Promise<void> {
    this.room.set(await firstValueFrom(this.http.post<RoomState>(`/api/rooms/${code}/reveal`, {})));
  }

  async reset(code: string): Promise<void> {
    this.room.set(await firstValueFrom(this.http.post<RoomState>(`/api/rooms/${code}/reset`, {})));
  }

  async extend(code: string): Promise<void> {
    this.room.set(await firstValueFrom(this.http.post<RoomState>(`/api/rooms/${code}/extend`, {})));
  }
}
