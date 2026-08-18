import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-poker-card',
  templateUrl: './poker-card.component.html',
  styleUrl: './poker-card.component.scss',
})
export class PokerCardComponent {
  readonly value = input.required<string>();
  readonly selected = input(false);
  readonly revealed = input(false);
  readonly reset = input(false);
  readonly disabled = input(false);
  readonly pick = output<string>();

  onPick(): void {
    if (!this.disabled()) {
      this.pick.emit(this.value());
    }
  }
}
