import { Routes } from '@angular/router';
import { AdminDashboardComponent } from './routes/admin-dashboard/admin-dashboard.component';
import { AdminLoginComponent } from './routes/admin-login/admin-login.component';
import { LandingComponent } from './routes/landing/landing.component';
import { RoomComponent } from './routes/room/room.component';

export const routes: Routes = [
  { path: '', component: LandingComponent },
  { path: 'admin', component: AdminLoginComponent },
  { path: 'admin/rooms', component: AdminDashboardComponent },
  { path: 'room/:code', component: RoomComponent },
  { path: '**', redirectTo: '' },
];
