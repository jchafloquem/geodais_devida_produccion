import { CommonModule, NgClass } from '@angular/common';
import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { GeovisorSharedService } from '../../services/geovisor.service';
import { CapasComponent } from './components/capas/capas.component';
import { LeyendaComponent } from './components/leyenda/leyenda.component';
import { AcercaComponent } from './components/acerca/acerca.component';

@Component({
  selector: 'app-sidebar',
  imports: [CommonModule,
    MatIconModule,
    NgClass,
    MatButtonModule,
    CapasComponent,
    LeyendaComponent,
    AcercaComponent,
  ],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss'
})
export class SidebarComponent {
  public _geovisorSharedService = inject(GeovisorSharedService);
  public subMenu: 'capas' | 'leyendas' | 'acerca' | 'Dashboard' = 'capas';
  public toogleMenu = false;
  public menuItems: {
    key: 'capas' | 'leyendas' | 'acerca' | 'Dashboard';
    icon: string;
    label: string;
  }[] = [
      { key: 'capas', icon: 'layers', label: 'Capas' },
      { key: 'leyendas', icon: 'view_list', label: 'Leyendas' },
      { key: 'acerca', icon: 'info', label: 'Acerca de' },
      { key: 'Dashboard', icon: 'space_dashboard', label: 'Dashboard' }
    ];

  clickToogleMenu(filtro?: 'capas' | 'leyendas' | 'acerca' | 'Dashboard'): void {
    if (filtro == undefined) {
      this.toogleMenu = !this.toogleMenu;
    } else {
      if (this.subMenu == filtro) {
        this.subMenu = filtro;
        this.toogleMenu = !this.toogleMenu;
      } else {
        this.subMenu = filtro;
        this.toogleMenu = true;
      }
    }
  }
}

