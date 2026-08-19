import { Injectable, signal } from '@angular/core';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  items?: string[];
}

@Injectable({ providedIn: 'root' })
export class ConfirmService {
  readonly open = signal(false);
  readonly options = signal<ConfirmOptions | null>(null);
  private resolver?: (value: boolean) => void;

  ask(options: ConfirmOptions): Promise<boolean> {
    this.options.set({
      confirmLabel: 'Continue',
      cancelLabel: 'Cancel',
      danger: false,
      ...options,
    });
    this.open.set(true);
    return new Promise((resolve) => {
      this.resolver = resolve;
    });
  }

  close(result: boolean): void {
    this.open.set(false);
    this.resolver?.(result);
    this.resolver = undefined;
  }
}
