import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { GeovisorSharedService } from '../../../../services/geovisor.service';

@Component({
  selector: 'app-observa',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
  ],
  templateUrl: './observatory.component.html',
  styleUrl: './observatory.component.scss'
})
export class ObservatoryComponent {
  public _geovisorSharedService = inject(GeovisorSharedService);
  public activeSection: 'departamento' | 'oficina' | null = null;

  toggleSection(section: 'departamento' | 'oficina'): void {
    // Cambia el estado de la sección activa (la abre o la cierra)
    this.activeSection = this.activeSection === section ? null : section;

    // Notifica al servicio sobre el modo de visualización deseado
    if (this.activeSection === 'departamento') {
      this._geovisorSharedService.observatorioMode = 'chartOnly';
      this._geovisorSharedService.setObservatorioDataView('departamento');
    } else if (this.activeSection === 'oficina') {
      this._geovisorSharedService.observatorioMode = 'chartOnly';
      this._geovisorSharedService.setObservatorioDataView('oficina');
    } else {
      // Si ninguna sección que requiera un modo especial está activa, vuelve al modo completo.
      this._geovisorSharedService.observatorioMode = 'full';
      this._geovisorSharedService.setObservatorioDataView('departamento');
    }
  }
}
