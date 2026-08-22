import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AzureProjectsResponse } from '../models/room.model';

@Injectable({ providedIn: 'root' })
export class AzureService {
  private readonly http = inject(HttpClient);

  async listProjects(): Promise<AzureProjectsResponse> {
    return firstValueFrom(this.http.get<AzureProjectsResponse>('/api/azure/projects'));
  }
}
