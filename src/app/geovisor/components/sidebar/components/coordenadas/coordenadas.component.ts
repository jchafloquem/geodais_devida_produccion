import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { GeovisorSharedService } from '../../../../services/geovisor.service';

@Component({
  selector: 'app-coordenadas',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './coordenadas.component.html',
  styleUrl: './coordenadas.component.scss'
})
export class CoordenadasComponent {
  public _geovisorSharedService = inject(GeovisorSharedService);

  // Propiedades para el modo de coordenadas
  public coordSystem: 'GEOGRAFICA' | 'UTM' = 'GEOGRAFICA';

  // Propiedades para Geográficas
  public latitud: number | null = null;
  public longitud: number | null = null;

  // Propiedades para UTM
  public este: number | null = null;
  public norte: number | null = null;
  public zona: '17S' | '18S' | '19S' | null = '18S'; // Default a 18S

  public errorMensaje: string | null = null;

  irACoordenada(): void {
    this.errorMensaje = null;

    if (this.coordSystem === 'GEOGRAFICA') {
      this.buscarPorGeograficas();
    } else {
      this.buscarPorUTM();
    }
  }

  private buscarPorGeograficas(): void {
    if (this.latitud === null || this.longitud === null ||
      typeof this.latitud !== 'number' || typeof this.longitud !== 'number') {
      this.errorMensaje = 'Por favor, ingrese valores numéricos para Latitud y Longitud.';
      return;
    }

    // Validación simple para coordenadas peruanas
    if (this.latitud < -20 || this.latitud > 0) {
      this.errorMensaje = 'La Latitud para Perú debe estar entre 0 y -20.';
      return;
    }

    if (this.longitud < -82 || this.longitud > -67) {
      this.errorMensaje = 'La Longitud para Perú debe estar entre -82 y -67.';
      return;
    }

    this._geovisorSharedService.goToCoordinates(this.latitud, this.longitud);
  }

  private buscarPorUTM(): void {
    if (this.este === null || this.norte === null || this.zona === null ||
      typeof this.este !== 'number' || typeof this.norte !== 'number') {
      this.errorMensaje = 'Por favor, ingrese valores numéricos para Este, Norte y seleccione una Zona.';
      return;
    }

    // Validación simple para valores UTM en Perú
    if (this.este < 100000 || this.este > 1000000) {
      this.errorMensaje = 'El valor "Este" parece estar fuera del rango típico para Perú (100,000 - 1,000,000).';
      return;
    }

    if (this.norte < 8000000 || this.norte > 10000000) {
      this.errorMensaje = 'El valor "Norte" parece estar fuera del rango típico para Perú (8,000,000 - 10,000,000).';
      return;
    }

    this._geovisorSharedService.goToUTMCoordinates(this.este, this.norte, this.zona);
  }

  limpiarUbicacion(): void {
    // Resetear Geográficas
    this.latitud = null;
    this.longitud = null;
    // Resetear UTM
    this.este = null;
    this.norte = null;
    this.zona = '18S'; // Volver al default
    // Resetear error y marcador
    this.errorMensaje = null;
    this._geovisorSharedService.clearCoordinateMarker();
  }
}
