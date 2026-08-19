import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { RoomState } from '../../models/room.model';
import { AuthService } from '../../services/auth.service';
import { ConfirmService } from '../../services/confirm.service';
import { RoomService } from '../../services/room.service';

@Component({
  selector: 'app-admin-dashboard',
  imports: [FormsModule, RouterLink, DatePipe],
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.scss',
})
export class AdminDashboardComponent {
  readonly auth = inject(AuthService);
  private readonly roomsApi = inject(RoomService);
  private readonly confirm = inject(ConfirmService);
  private readonly router = inject(Router);
  readonly origin = location.origin;

  name = '';
  rooms = signal<RoomState[]>([]);
  created = signal<RoomState | null>(null);
  creating = signal(false);
  copied = signal(false);

  constructor() {
    void this.auth.loadMe().then((admin) => {
      if (!admin) {
        void this.router.navigateByUrl('/admin');
        return;
      }
      void this.refresh();
    });
  }

  createdUrl(): string {
    const room = this.created();
    return room ? `${this.origin}/room/${room.code}` : '';
  }

  async refresh(): Promise<void> {
    this.rooms.set(await this.roomsApi.listMine());
  }

  async create(): Promise<void> {
    this.creating.set(true);
    try {
      const room = await this.roomsApi.create(this.name.trim());
      this.created.set(room);
      this.name = '';
      await this.refresh();
    } finally {
      this.creating.set(false);
    }
  }

  async copy(text: string): Promise<void> {
    await navigator.clipboard.writeText(text);
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), 1600);
  }

  async endRoom(code: string): Promise<void> {
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
    await this.roomsApi.end(code);
    await this.refresh();
  }
}
