import { Component, computed, input, output } from '@angular/core';
import { Participant } from '../../models/participant.model';
import { RoomStatus } from '../../models/room.model';
import { parseEstimate } from '../../utils/estimate';

@Component({
  selector: 'app-table-card',
  templateUrl: './table-card.component.html',
  styleUrl: './table-card.component.scss',
})
export class TableCardComponent {
  readonly participant = input.required<Participant>();
  readonly status = input<RoomStatus>('waiting');
  readonly delayMs = input(0);
  readonly isSelf = input(false);
  readonly canRemove = input(false);
  readonly remove = output<void>();

  readonly estimate = computed(() => parseEstimate(this.participant().vote));
}
