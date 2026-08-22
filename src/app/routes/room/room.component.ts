import { DatePipe } from '@angular/common';
import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { PokerCardComponent } from '../../components/poker-card/poker-card.component';
import { TableCardComponent } from '../../components/table-card/table-card.component';
import { AuthService } from '../../services/auth.service';
import { ConfirmService } from '../../services/confirm.service';
import { RoomService } from '../../services/room.service';
import { formatEstimate } from '../../utils/estimate';
import { readApiError } from '../../utils/api-error';
import { formatWorkItemLabel } from '../../utils/work-item';

@Component({
  selector: 'app-room',
  imports: [FormsModule, RouterLink, DatePipe, PokerCardComponent, TableCardComponent],
  templateUrl: './room.component.html',
  styleUrl: './room.component.scss',
})
export class RoomComponent implements OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly rooms = inject(RoomService);
  private readonly auth = inject(AuthService);
  private readonly confirm = inject(ConfirmService);

  code = this.route.snapshot.paramMap.get('code') || '';
  userName = '';
  readonly room = this.rooms.room;
  readonly expired = signal(false);
  readonly copied = signal(false);
  readonly joinError = signal('');
  readonly joined = signal(false);
  readonly storyError = signal('');
  readonly loadingStory = signal(false);
  workItemId = '';
  readonly isAdmin = computed(() => this.auth.admin()?.role === 'admin');
  readonly showJoin = computed(
    () => !!this.room() && !this.joined() && !this.expired() && !this.isAdmin()
  );
  readonly myParticipantId = computed(() => this.participantId());
  readonly myName = computed(() => {
    const id = this.participantId();
    if (this.isAdmin()) {
      return this.auth.admin()?.name ?? this.room()?.createdByName ?? null;
    }
    return this.room()?.participants.find((p) => p.id === id)?.name ?? this.sessionName();
  });
  readonly myVote = computed(() => {
    const id = this.participantId();
    return this.room()?.participants.find((p) => p.id === id)?.vote ?? null;
  });
  readonly myVoteLabel = computed(() => formatEstimate(this.myVote()));
  readonly averageLabel = computed(() => formatEstimate(this.room()?.average));
  readonly pending = computed(() => this.room()?.participants.filter((p) => !p.hasVoted) ?? []);
  readonly currentStory = computed(() => this.room()?.currentStory ?? null);
  readonly workItemLabel = computed(() => {
    const story = this.currentStory();
    return story ? formatWorkItemLabel(story) : '';
  });
  readonly canLoadStory = computed(
    () =>
      this.isAdmin() &&
      this.room()?.status === 'waiting' &&
      !!this.room()?.azureProject &&
      !this.currentStory()
  );
  readonly seats = computed(() =>
    [...(this.room()?.participants ?? [])].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    )
  );

  private poll?: ReturnType<typeof setInterval>;
  private participantId = signal<string | null>(null);
  private sessionName = signal<string | null>(null);

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

    if (this.auth.admin()) {
      this.joined.set(false);
    } else if (this.rooms.hasSession(this.code)) {
      const raw = localStorage.getItem(this.rooms.sessionKey(this.code));
      if (raw) {
        const session = JSON.parse(raw) as { participantId: string; name?: string };
        this.participantId.set(session.participantId);
        this.sessionName.set(session.name || null);
      }
      this.joined.set(true);
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
      this.sessionName.set(result.name);
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
    await this.rooms.start(this.code);
  }

  async loadStory(): Promise<void> {
    this.storyError.set('');
    const id = this.workItemId.trim();
    if (!/^\d+$/.test(id)) {
      this.storyError.set('Enter a numeric work item ID.');
      return;
    }

    this.loadingStory.set(true);
    try {
      await this.rooms.loadStory(this.code, id);
      this.workItemId = '';
      this.storyError.set('');
    } catch (err: unknown) {
      this.storyError.set(readApiError(err, 'Could not load that work item.'));
    } finally {
      this.loadingStory.set(false);
    }
  }

  async revote(): Promise<void> {
    const story = this.currentStory();
    const ok = await this.confirm.ask({
      title: 'Revote on this story?',
      message: story
        ? `Clear all votes and vote again on ${formatWorkItemLabel(story)}.`
        : 'Clear all votes and vote again on the current story.',
      confirmLabel: 'Revote',
      cancelLabel: 'Cancel',
    });
    if (!ok) {
      return;
    }
    await this.rooms.revote(this.code);
  }

  async nextStory(): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'Move to the next story?',
      message: 'Votes will be cleared and the current work item will be removed. You can load another ID or start without one.',
      confirmLabel: 'Next story',
      cancelLabel: 'Stay',
    });
    if (!ok) {
      return;
    }
    await this.rooms.nextStory(this.code);
    this.workItemId = '';
    this.storyError.set('');
  }

  async reveal(): Promise<void> {
    const pending = this.pending();
    if (pending.length) {
      const ok = await this.confirm.ask({
        title: 'Reveal anyway?',
        message:
          pending.length === 1
            ? 'This person has not voted yet.'
            : `${pending.length} people have not voted yet.`,
        confirmLabel: 'Reveal votes',
        cancelLabel: 'Wait',
        items: pending.map((p) => p.name),
      });
      if (!ok) {
        return;
      }
    }
    await this.rooms.reveal(this.code);
  }

  async copyLink(): Promise<void> {
    await navigator.clipboard.writeText(`${location.origin}/room/${this.code}`);
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), 1400);
  }

  async leave(): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'Leave the table?',
      message:
        'You will be removed from this room. The facilitator will no longer see you waiting to vote.',
      confirmLabel: 'Leave table',
      cancelLabel: 'Stay',
      danger: true,
    });
    if (!ok) {
      return;
    }
    if (this.poll) {
      clearInterval(this.poll);
      this.poll = undefined;
    }
    await this.rooms.leave(this.code);
    this.joined.set(false);
    this.participantId.set(null);
    this.sessionName.set(null);
    await this.router.navigateByUrl('/');
  }

  async kick(person: { id: string; name: string }): Promise<void> {
    const ok = await this.confirm.ask({
      title: `Remove ${person.name}?`,
      message: 'They will leave the table and will not count as waiting to vote.',
      confirmLabel: 'Remove',
      cancelLabel: 'Keep',
      danger: true,
    });
    if (!ok) {
      return;
    }
    await this.rooms.removeSeat(this.code, person);
  }

  async endRoom(): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'End this room?',
      message: 'The team will not be able to join or vote. Create a new room for the next session.',
      confirmLabel: 'End room',
      cancelLabel: 'Keep room',
      danger: true,
    });
    if (!ok) {
      return;
    }
    await this.rooms.end(this.code);
    await this.router.navigateByUrl('/admin/rooms');
  }
}
