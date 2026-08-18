import { DatePipe } from '@angular/common';
import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { PokerCardComponent } from '../../components/poker-card/poker-card.component';
import { TableCardComponent } from '../../components/table-card/table-card.component';
import { AuthService } from '../../services/auth.service';
import { RoomService } from '../../services/room.service';

@Component({
  selector: 'app-room',
  imports: [FormsModule, RouterLink, DatePipe, PokerCardComponent, TableCardComponent],
  templateUrl: './room.component.html',
  styleUrl: './room.component.scss',
})
export class RoomComponent implements OnDestroy {
  private readonly route = inject(ActivatedRoute);
  readonly rooms = inject(RoomService);
  private readonly auth = inject(AuthService);

  code = this.route.snapshot.paramMap.get('code') || '';
  userName = '';
  readonly room = this.rooms.room;
  readonly expired = signal(false);
  readonly copied = signal(false);
  readonly resetting = signal(false);
  readonly joinError = signal('');
  readonly joined = signal(false);
  readonly isAdmin = computed(() => this.auth.admin()?.role === 'admin');
  readonly showJoin = computed(() => !!this.room() && !this.joined() && !this.expired());
  readonly myVote = computed(() => {
    const id = this.participantId();
    return this.room()?.participants.find((p) => p.id === id)?.vote ?? null;
  });
  readonly pending = computed(() => this.room()?.participants.filter((p) => !p.hasVoted) ?? []);
  readonly pendingNames = computed(() => this.pending().map((p) => p.name).join(', '));

  private poll?: ReturnType<typeof setInterval>;
  private participantId = signal<string | null>(null);

  constructor() {
    void this.boot();
  }

  ngOnDestroy(): void {
    if (this.poll) {
      clearInterval(this.poll);
    }
  }

  private async boot(): Promise<void> {
    await this.auth.loadMe();
    try {
      await this.rooms.get(this.code);
    } catch {
      this.expired.set(true);
      return;
    }

    if (this.rooms.hasSession(this.code)) {
      const raw = localStorage.getItem(this.rooms.sessionKey(this.code));
      if (raw) {
        this.participantId.set((JSON.parse(raw) as { participantId: string }).participantId);
      }
      this.joined.set(true);
    } else if (this.auth.admin()) {
      try {
        const result = await this.rooms.join(this.code, this.auth.admin()!.name);
        this.participantId.set(result.participantId);
        this.joined.set(true);
      } catch {
        this.joined.set(false);
      }
    }

    this.poll = setInterval(() => {
      void this.rooms.get(this.code).catch(() => this.expired.set(true));
    }, 1500);
  }

  async join(): Promise<void> {
    this.joinError.set('');
    try {
      const result = await this.rooms.join(this.code, this.userName.trim());
      this.participantId.set(result.participantId);
      this.joined.set(true);
    } catch (err: unknown) {
      const message = (err as { error?: { message?: string } })?.error?.message;
      this.joinError.set(message || 'Could not join. Try another name.');
    }
  }

  async vote(value: string): Promise<void> {
    if (this.room()?.status !== 'voting') {
      return;
    }
    await this.rooms.vote(this.code, value);
  }

  async start(): Promise<void> {
    this.resetting.set(false);
    await this.rooms.start(this.code);
  }

  async reveal(): Promise<void> {
    const pending = this.pending();
    if (pending.length && !confirm(`${pending.map((p) => p.name).join(', ')} has not voted. Reveal anyway?`)) {
      return;
    }
    await this.rooms.reveal(this.code);
  }

  async reset(): Promise<void> {
    this.resetting.set(true);
    await this.rooms.reset(this.code);
    setTimeout(() => this.resetting.set(false), 600);
  }

  async copyLink(): Promise<void> {
    await navigator.clipboard.writeText(`${location.origin}/room/${this.code}`);
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), 1400);
  }
}
