import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { GeovisorSharedService, OficinaStats } from '../../../../services/geovisor.service';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import StatisticDefinition from '@arcgis/core/rest/support/StatisticDefinition.js';


@Component({
  selector: 'app-filtros',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './filtros.component.html',
  styleUrl: './filtros.component.scss'
})
export class FiltrosComponent implements OnInit {
  public _geovisorSharedService = inject(GeovisorSharedService);

  public oficinas: { nombre: string }[] = [];
  public selectedOficina: string | null = null;
  public isLoading = true;

  public stats: OficinaStats | null = null;
  public isStatsLoading = false;

  private pirdaisLayer = new FeatureLayer({
    url: "https://siscod.devida.gob.pe/server/rest/services/LIMITES_CULTIVOS/MapServer/0"
  });

  ngOnInit(): void {
    this.cargarOficinas();
  }

  private async cargarOficinas(): Promise<void> {
    this.isLoading = true;
    try {
      this.oficinas = await this._geovisorSharedService.getOficinasZonales();
    } catch (error) {
      console.error("Error en el componente al cargar oficinas", error);
    } finally {
      this.isLoading = false;
    }
  }

  buscarOficina(): void {
    if (this.selectedOficina) {
      this._geovisorSharedService.zoomToOficinaZonal(this.selectedOficina);
      this.cargarEstadisticas(this.selectedOficina);
    } else {
      this._geovisorSharedService.showToast('Por favor, seleccione una oficina zonal.', 'info', true);
    }
  }

  private async cargarEstadisticas(oficina: string): Promise<void> {
    this.stats = null;
    this.isStatsLoading = true;
    try {
      const calculatedStats = await this.calcularEstadisticasOficina(oficina);

      // Si no se encuentran polígonos, mostrar un mensaje y no actualizar las estadísticas.
      if (calculatedStats.totalFamilias === 0 && calculatedStats.totalHectareas === 0) {
        this.stats = null; // Limpiamos stats anteriores
        this._geovisorSharedService.showToast(`No se encontraron polígonos para la oficina ${oficina}.`, 'warning', true);
        return; // Detenemos la ejecución aquí
      }

      this.stats = {
        ...calculatedStats
      };
      console.log('Estadísticas finales calculadas:', this.stats);
      console.log('Valor de totalHectareas:', this.stats.totalHectareas);
    } catch (error) {
      console.error(`Error al cargar estadísticas para ${oficina}`, error);
      this.stats = null;
    } finally {
      this.isStatsLoading = false;
    }
  }

  private async calcularEstadisticasOficina(oficina: string): Promise<OficinaStats> {
    const dnisCacao = new Set<string>();
    const dnisCafe = new Set<string>();
    const dnisTotal = new Set<string>();
    let totalHectareas = 0;
    let hectareasCacao = 0;
    let hectareasCafe = 0;

    try {
      const query = this.pirdaisLayer.createQuery();
      // 1. Filtramos DIRECTAMENTE en el servidor. Es mucho más eficiente.
      // Usamos UPPER() para una comparación insensible a mayúsculas/minúsculas, lo que resuelve el problema.
      query.where = `UPPER(oficina_zonal) = '${oficina.trim().toUpperCase()}'`;
      query.outFields = ["dni_participante", "tipo_cultivo", "area_cultivo"];
      query.returnGeometry = false;

      console.log(`Consultando al servidor con el filtro: ${query.where}`);

      const featureSet = await this.pirdaisLayer.queryFeatures(query);
      const officeFeatures = featureSet.features;

      console.log(`Encontrados ${officeFeatures.length} registros para la oficina '${oficina}' desde el servidor.`);

      // 2. Si el servidor no devuelve resultados, retornamos estadísticas en cero.
      if (officeFeatures.length === 0) {
        console.warn(`No se encontraron polígonos para la oficina ${oficina}.`);
        return { totalHectareas: 0, hectareasCacao: 0, hectareasCafe: 0, totalFamilias: 0, familiasCacao: 0, familiasCafe: 0, familiasAmbos: 0 };
      }

      // 3. Calculamos las estadísticas sobre los datos ya filtrados por el servidor.
      officeFeatures.forEach(feature => {
          const attrs = feature.attributes;
          const dni = attrs.dni_participante;
          const area = attrs.area_cultivo || 0;
          const cultivo = (attrs.tipo_cultivo || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

          // Sumar hectáreas
          totalHectareas += area;

          if (dni) {
            dnisTotal.add(dni);
          }

          if (cultivo.includes("cacao")) {
            hectareasCacao += area;
            if (dni) dnisCacao.add(dni);
          }
          if (cultivo.includes("cafe")) {
            hectareasCafe += area;
            if (dni) dnisCafe.add(dni);
          }
        });

      const dnisAmbos = new Set([...dnisCacao].filter(dni => dnisCafe.has(dni))).size;

      return {
        totalHectareas,
        hectareasCacao,
        hectareasCafe,
        totalFamilias: dnisTotal.size,
        familiasCacao: dnisCacao.size,
        familiasCafe: dnisCafe.size,
        familiasAmbos: dnisAmbos
      };
    } catch (error) {
      console.error("Error al calcular estadísticas de la oficina:", error);
      return { totalHectareas: 0, hectareasCacao: 0, hectareasCafe: 0, totalFamilias: 0, familiasCacao: 0, familiasCafe: 0, familiasAmbos: 0 };
    }
  }

  limpiarFiltro(): void {
    this.selectedOficina = null;
    this._geovisorSharedService.clearHighlights();
    this.stats = null;
  }
}
