import { Component, inject, Input } from '@angular/core';
import { Router, Route, RouterModule } from '@angular/router';

@Component({
  selector: 'app-sidemenu',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './sidemenu.component.html',
})
export class SidemenuComponent {
  @Input() visible: boolean = true;
  menuVisible = false;
  menuRoutes: Route[] = [];

  constructor() {
    const router = inject(Router);
    const excluded = ['error', 'auth', '404'];

    // Buscar la ruta padre 'geovisor'
    const geovisorRoute = router.config.find(r => r.path === 'geovisor');

    if (geovisorRoute) {
      // Tomar solo sus hijos
      const children = geovisorRoute.children ?? [];
      const lazy = (geovisorRoute as any)._loadedRoutes ?? [];

      this.menuRoutes = [...children, ...lazy].filter(
        r => r.path && !excluded.includes(r.path) && r.loadComponent
      );
    }
  }

  toggleMenu() {
    this.menuVisible = !this.menuVisible;
    console.log('Menu toggled:', this.menuVisible);
  }
}
