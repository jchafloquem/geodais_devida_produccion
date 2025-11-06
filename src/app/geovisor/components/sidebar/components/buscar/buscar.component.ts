
import { Component, inject } from '@angular/core';
import { GeovisorSharedService, CustomSearchResult } from '../../../../services/geovisor.service';
import { CommonModule } from '@angular/common'; // Importa CommonModule

@Component({
  selector: 'app-buscar',
  standalone: true,
  imports: [CommonModule], // Añade CommonModule a los imports
  templateUrl: './buscar.component.html',
  styleUrl: './buscar.component.scss',
})
export class BuscarComponent {
  resultados: CustomSearchResult[] = [];
  isLoading = false;
  searchPerformed = false;
  private geovisorService = inject(GeovisorSharedService);

  async buscar(termino: string) {
    this.searchPerformed = true;
    if (!termino || termino.trim() === '') {
      this.resultados = [];
      return;
    }
    this.isLoading = true;
    this.resultados = [];
    try {
      this.resultados = await this.geovisorService.searchFeatures(termino);
    } catch (error) {
      console.error("Error en la búsqueda:", error);
      this.geovisorService.showToast('Ocurrió un error al buscar.', 'error');
    } finally {
      this.isLoading = false;
    }
  }

  seleccionarResultado(resultado: CustomSearchResult) {
    this.geovisorService.goToSearchResult(resultado);
  }
  limpiarBusqueda(inputElement: HTMLInputElement) {
    this.resultados = [];
    this.searchPerformed = false;
    inputElement.value = '';
    inputElement.focus();
  }
}
