import { AcercaComponent } from './components/acerca/acerca.component';
import { BuscarComponent } from './components/buscar/buscar.component';
import { CapasComponent } from './components/capas/capas.component';
import { CommonModule, NgClass } from '@angular/common';
import { Component, inject } from '@angular/core';
import { CoordenadasComponent } from './components/coordenadas/coordenadas.component';
import { FiltrosComponent } from './components/filtros/filtros.component';
import { GeovisorSharedService } from '../../services/geovisor.service';
import { LeyendaComponent } from './components/leyenda/leyenda.component';
import { ManualComponent } from './components/manual/manual.component';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ObservaComponent } from './components/observa/observa.component';
import { ResumenComponent } from './components/resumen/resumen.component';


@Component({
  selector: 'app-sidebar',
  imports: [
    AcercaComponent,
    BuscarComponent,
    CapasComponent,
    CommonModule,
    CoordenadasComponent,
    FiltrosComponent,
    LeyendaComponent,
    ManualComponent,
    MatButtonModule,
    MatIconModule,
    NgClass,
    ObservaComponent,
    ResumenComponent,
  ],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss'
})
export class SidebarComponent {
  public _geovisorSharedService = inject(GeovisorSharedService);
  public subMenu: 'observatorio' |'capas' | 'leyendas' |'buscar'| 'resumen' |'coordenadas'| 'filtros'|'manual'|'acerca' = 'observatorio';
  public toogleMenu = false;
  public menuItems: {
    key: 'observatorio'|'capas' | 'leyendas' |'buscar'| 'resumen' |'coordenadas'|'filtros'|'manual'|'acerca';
    icon: string;
    label: string;
  }[] = [
      { key: 'observatorio', icon: 'satellite_alt', label: 'Observatorio' },
      { key: 'capas', icon: 'layers', label: 'Capas' },
      { key: 'leyendas', icon: 'view_list', label: 'Leyendas' },
      { key: 'buscar', icon: 'search', label: 'Buscar' },
      { key: 'resumen', icon: 'summarize', label: 'Resumen' },
      { key: 'filtros', icon: 'filter_alt', label: 'Filtros' },
      { key: 'coordenadas', icon: 'explore', label: 'Coordenadas' },
      { key: 'manual', icon: 'auto_stories', label: 'Manual' },
      { key: 'acerca', icon: 'info', label: 'Acerca de' },
    ];

  clickToogleMenu(filtro?: 'observatorio'|'capas' | 'leyendas' | 'buscar' |'resumen' |'coordenadas'| 'filtros'|'manual'|'acerca'): void {
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
