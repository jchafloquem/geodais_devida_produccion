import { CommonModule, NgClass } from '@angular/common';
import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { GeovisorSharedService } from '../../services/geovisor.service';
import { CapasComponent } from './components/capas/capas.component';
import { LeyendaComponent } from './components/leyenda/leyenda.component';
import { BuscarComponent } from './components/buscar/buscar.component';
import { AcercaComponent } from './components/acerca/acerca.component';
import { ResumenComponent } from './components/resumen/resumen.component';
import { CoordenadasComponent } from './components/coordenadas/coordenadas.component';
import { FiltrosComponent } from './components/filtros/filtros.component';
import { ManualComponent } from './components/manual/manual.component';


@Component({
  selector: 'app-sidebar',
  imports: [CommonModule,
    MatIconModule,
    NgClass,
    MatButtonModule,
    CapasComponent,
    LeyendaComponent,
    BuscarComponent,
    CoordenadasComponent,
    ResumenComponent,
    FiltrosComponent,
    ManualComponent,
    AcercaComponent,
  ],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss'
})
export class SidebarComponent {
  public _geovisorSharedService = inject(GeovisorSharedService);
  public subMenu: 'capas' | 'leyendas' |'buscar'| 'resumen' |'coordenadas'| 'filtros'|'manual'|'acerca' = 'capas';
  public toogleMenu = false;
  public menuItems: {
    key: 'capas' | 'leyendas' |'buscar'| 'resumen' |'coordenadas'|'filtros'|'manual'|'acerca';
    icon: string;
    label: string;
  }[] = [
      { key: 'capas', icon: 'layers', label: 'Capas' },
      { key: 'leyendas', icon: 'view_list', label: 'Leyendas' },
      { key: 'buscar', icon: 'search', label: 'Buscar' },
      { key: 'resumen', icon: 'summarize', label: 'Resumen' },
      { key: 'coordenadas', icon: 'explore', label: 'Coordenadas' },
      { key: 'filtros', icon: 'filter_alt', label: 'Filtros' },
      { key: 'manual', icon: 'auto_stories', label: 'Manual' },
      { key: 'acerca', icon: 'info', label: 'Acerca de' },
    ];

  clickToogleMenu(filtro?: 'capas' | 'leyendas' | 'buscar' |'resumen' |'coordenadas'| 'filtros'|'manual'|'acerca'): void {
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

