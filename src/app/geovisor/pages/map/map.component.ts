import { Component, OnInit, AfterViewInit, ViewChild, ElementRef, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GeovisorSharedService } from '../../services/geovisor.service';
import { RouterModule } from '@angular/router';
import { NavbarComponent } from '../../components/navbar/navbar.component';
import { SidebarComponent } from '../../components/sidebar/sidebar.component';
import { FabContainerTopComponent } from '../../components/fab-container-top/fab-container-top.component';
import { InfoCoordenadasComponent } from '../../components/info-coordenadas/info-coordenadas.component';
import { Usuario } from '../../../auth/interfaces/usuario';
import { MatIconModule } from '@angular/material/icon';
import { AuthStateService } from '../../../auth/shared/access/auth-state.service';


@Component({
  standalone: true,
  selector: 'app-map',
  imports: [
    RouterModule,
    NavbarComponent,
    SidebarComponent,
    FabContainerTopComponent,
    InfoCoordenadasComponent,
    CommonModule,
    MatIconModule,
  ],
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.scss']
})
export class MapComponent implements OnInit, AfterViewInit, OnDestroy {
  public capasVisibles: __esri.FeatureLayer[] = [];
  private _authStateService = inject(AuthStateService);
  public _geovisorSharedService = inject(GeovisorSharedService);

  public usuario: Usuario | null = null;
  public tiempoSesion = '';
  private sesionInicio!: number;
  private intervaloSesion!: ReturnType<typeof setInterval>;
  public toogle = false;

  @ViewChild('mapViewNode', { static: true }) private mapViewEl!: ElementRef;

  ngOnInit(): void {
    const userSessionData = localStorage.getItem('userSessionData');
    // La única fuente de verdad: leer los datos completos de la sesión del usuario.
    if (userSessionData) {
      try {
        this.usuario = JSON.parse(userSessionData);
        this.iniciarContadorSesion();
      } catch (error) {
        console.error('Error al parsear los datos de sesión desde localStorage', error);
        this.usuario = null;
      }
    }
  }

  private iniciarContadorSesion(): void {
    this.sesionInicio = Date.now();
    this.intervaloSesion = setInterval(() => {
      const segundos = Math.floor((Date.now() - this.sesionInicio) / 1000);
      const horas = Math.floor(segundos / 3600).toString().padStart(2, '0');
      const minutos = Math.floor((segundos % 3600) / 60).toString().padStart(2, '0');
      const segs = (segundos % 60).toString().padStart(2, '0');
      this.tiempoSesion = `${horas}:${minutos}:${segs}`;
    }, 1000);
  }

  // ⚡ Aquí inicializamos el mapa SOLO cuando el DOM ya existe
  ngAfterViewInit(): void {
    this._geovisorSharedService.initializeMap(this.mapViewEl);
  }

  onFileSelected(event: any) {
    const file: File = event.target.files[0];
    if (file) {
      this._geovisorSharedService.dataImport(file);
    }
  }
  ngOnDestroy(): void {
    // Destruye la vista usando el servicio
    this._geovisorSharedService.destroyMap();
    // Limpia el intervalo de sesión
    clearInterval(this.intervaloSesion);
  }

}
