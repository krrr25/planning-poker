import { Component, input } from '@angular/core';
import { Participant } from '../../models/participant.model';
import { RoomStatus } from '../../models/room.model';

@Component({
  selector: 'app-table-card',
  templateUrl: './table-card.component.html',
  styleUrl: './table-card.component.scss',
})
export class TableCardComponent {
  readonly participant = input.required<Participant>();
  readonly status = input<RoomStatus>('waiting');
  readonly delayMs = input(0);
}
