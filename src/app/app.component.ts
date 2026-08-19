import { Component, inject } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { ConfirmDialogComponent } from './components/confirm-dialog/confirm-dialog.component';
import { AuthService } from './services/auth.service';
import { ConfirmService } from './services/confirm.service';
import { RoomService } from './services/room.service';

@Component({
  selector: 'app-root',
  imports: [RouterLink, RouterOutlet, ConfirmDialogComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  readonly auth = inject(AuthService);
  private readonly confirm = inject(ConfirmService);
  private readonly rooms = inject(RoomService);

  constructor() {
    void this.auth.loadMe();
  }

  async logout(): Promise<void> {
    let liveRooms: { name: string }[] = [];
    try {
      liveRooms = await this.rooms.listMine();
    } catch {
      liveRooms = [];
    }

    if (liveRooms.length) {
      const ok = await this.confirm.ask({
        title: 'Log out?',
        message:
          liveRooms.length === 1
            ? 'You have an active room. Logging out does not end it — the team can still use the link. End the room first if you want to close the session.'
            : `You have ${liveRooms.length} active rooms. Logging out does not end them — the team can still use the links. End a room first if you want to close that session.`,
        confirmLabel: 'Log out',
        cancelLabel: 'Stay signed in',
        danger: true,
        items: liveRooms.map((room) => room.name),
      });
      if (!ok) {
        return;
      }
    }

    await this.auth.logout();
  }
}
