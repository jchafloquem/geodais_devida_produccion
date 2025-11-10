import { Routes } from '@angular/router';
import { privateGuard, publicGuard } from '../auth/guards/auth.guard';

export default [
			{
				path: 'map',
        title:'GeoCultivos DAIS',
        canActivate: [privateGuard()],
				loadComponent: () => import('./pages/map/map.component').then(m => m.MapComponent),
			},
      {
				path: 'dashboard',
        title:'Dashboard',
        canActivate: [privateGuard()],
				loadComponent: () => import('./pages/dashboard/dashboard.component').then ( m => m.DashboardComponent),
			},
      {
				path: 'reportes',
        title:'Reportes',
        canActivate: [privateGuard()],
				loadComponent: () => import('./pages/reporte/report.component').then ( m => m.ReportComponent),
			},
			{
				path: 'repositorio',
        title:'Repositorio',
        canActivate: [privateGuard()],
				loadComponent: () => import('./pages/repositorio/repositorio.component'),
			},
			{
				path: 'metadata',
        title:'Metadata',
        canActivate: [privateGuard()],
				loadComponent: () => import('./pages/metadata/metadata.component'),
			},
			{
				path: '',
				redirectTo: 'map',
				pathMatch: 'full',
			},
] as Routes

