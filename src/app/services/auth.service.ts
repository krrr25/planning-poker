import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AdminProfile } from '../models/admin.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  readonly admin = signal<AdminProfile | null>(null);

  async loadMe(): Promise<AdminProfile | null> {
    try {
      const profile = await firstValueFrom(this.http.get<AdminProfile>('/api/auth/me'));
      this.admin.set(profile);
      return profile;
    } catch {
      this.admin.set(null);
      return null;
    }
  }

  async login(email: string, password: string): Promise<void> {
    const profile = await firstValueFrom(
      this.http.post<AdminProfile>('/api/auth/login', { email, password })
    );
    this.admin.set(profile);
    await this.router.navigateByUrl('/admin/rooms');
  }

  async logout(): Promise<void> {
    await firstValueFrom(this.http.post('/api/auth/logout', {}));
    this.admin.set(null);
    await this.router.navigateByUrl('/admin');
  }
}
