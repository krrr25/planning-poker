import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-landing',
  imports: [FormsModule, RouterLink],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.scss',
})
export class LandingComponent {
  private readonly router = inject(Router);
  code = '';
  error = signal('');

  go(): void {
    const code = this.code.trim().toLowerCase();
    if (code.length < 4) {
      this.error.set('Enter the room code from your facilitator.');
      return;
    }
    void this.router.navigate(['/room', code]);
  }
}
