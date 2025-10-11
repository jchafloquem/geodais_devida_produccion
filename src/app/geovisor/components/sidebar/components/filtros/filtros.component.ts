import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { GeovisorSharedService, OficinaStats } from '../../../../services/geovisor.service';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';


/**
 * @Component FiltrosComponent
 * @description
 * Componente encargado de gestionar los filtros por Oficina Zonal.
 * Permite al usuario seleccionar una oficina, visualizarla en el mapa y
 * obtener estadísticas detalladas sobre hectáreas y familias participantes.
 */
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
    url: "https://siscod.devida.gob.pe/server/rest/services/DPM_PIRDAIS_CULTIVOS_PRODUCCION/MapServer/1"
  });

  /**
   * Hook del ciclo de vida de Angular. Se ejecuta al inicializar el componente.
   * Llama al método para cargar la lista de oficinas zonales.
   */
  ngOnInit(): void {
    this.cargarOficinas();
  }

  /**
   * Carga la lista de oficinas zonales desde el servicio compartido.
   * Actualiza el estado de carga mientras se realiza la petición.
   * @private
   * @async
   */
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

  /**
   * Manejador del evento de búsqueda.
   * Si hay una oficina seleccionada, solicita al servicio hacer zoom a su ubicación
   * y dispara el cálculo de sus estadísticas.
   */
  buscarOficina(): void {
    if (this.selectedOficina) {
      this._geovisorSharedService.zoomToOficinaZonal(this.selectedOficina);
      this.cargarEstadisticas(this.selectedOficina);
    } else {
      this._geovisorSharedService.showToast('Por favor, seleccione una oficina zonal.', 'info', true);
    }
  }

  /**
   * Orquesta la carga de estadísticas para una oficina zonal específica.
   * Gestiona el estado de carga y muestra notificaciones si no se encuentran datos.
   * @param oficina El nombre de la oficina zonal a consultar.
   * @private
   * @async
   */
  private async cargarEstadisticas(oficina: string): Promise<void> {
    this.stats = null;
    this.isStatsLoading = true;
    try {
      const calculatedStats = await this.calcularEstadisticasOficina(oficina);

      // Si no se encuentran polígonos, mostrar un mensaje, pero seguir mostrando las tarjetas con valor 0.
      if (calculatedStats.totalFamilias === 0 && calculatedStats.totalHectareas === 0) {
        this._geovisorSharedService.showToast(`No se encontraron polígonos para la oficina ${oficina}.`, 'warning', true);
      }

      // Asignamos siempre las estadísticas para que las tarjetas se muestren, incluso si los valores son cero.
      this.stats = {
        ...calculatedStats
      };
    } catch (error) {
      console.error(`Error al cargar estadísticas para ${oficina}`, error);
      this.stats = null;
    } finally {
      this.isStatsLoading = false;
    }
  }

  /**
   * Realiza la consulta al servicio de ArcGIS para obtener los datos de una oficina
   * y calcula las estadísticas de hectáreas y familias.
   * Utiliza paginación para manejar grandes volúmenes de datos y normaliza los
   * nombres de los cultivos para asegurar la consistencia del conteo.
   * @param oficina El nombre de la oficina zonal.
   * @returns Una promesa que resuelve a un objeto `OficinaStats` con los datos calculados.
   * @private
   * @async
   */
  private async calcularEstadisticasOficina(oficina: string): Promise<OficinaStats> {
    const oficinaUpper = oficina.trim().toUpperCase();
    const whereClause = `UPPER(oficina_zonal) = '${oficinaUpper}'`;

    // Se replica la lógica del dashboard para asegurar consistencia en los cálculos.
    // Esto implica descargar los registros y procesarlos en el cliente para manejar
    // posibles inconsistencias en los datos de 'tipo_cultivo'.

    try {
      const allFeatures: __esri.Graphic[] = [];
      const query = this.pirdaisLayer.createQuery();
      query.where = whereClause;
      query.outFields = ["dni_participante", "tipo_cultivo", "area_cultivo"];
      query.returnGeometry = false;

      // Paginación para manejar el límite de transferencia de registros del servidor.
      const pageSize = 2000;
      let start = 0;
      let hasMore = true;
      while (hasMore) {
        query.start = start;
        query.num = pageSize;
        const featureSet = await this.pirdaisLayer.queryFeatures(query);
        allFeatures.push(...featureSet.features);
        start += featureSet.features.length;
        hasMore = featureSet.exceededTransferLimit === true;
      }

      if (allFeatures.length === 0) {
        return { totalHectareas: 0, hectareasCacao: 0, hectareasCafe: 0, totalFamilias: 0, familiasCacao: 0, familiasCafe: 0, familiasAmbos: 0 };
      }

      const dnisCacao = new Set<string>();
      const dnisCafe = new Set<string>();
      const dnisTotal = new Set<string>();
      let totalHectareas = 0;
      let hectareasCacao = 0;
      let hectareasCafe = 0;

      allFeatures.forEach(feature => {
        const attrs = feature.attributes;
        const dni = attrs.dni_participante;
        const area = attrs.area_cultivo || 0;
        // Lógica de normalización robusta, igual a la del dashboard.
        const cultivoRaw = (attrs.tipo_cultivo || "")
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .trim();

        totalHectareas += area;
        if (dni) dnisTotal.add(dni);

        if (cultivoRaw.includes("cacao")) {
          hectareasCacao += area;
          if (dni) dnisCacao.add(dni);
        }
        if (cultivoRaw.includes("cafe")) {
          hectareasCafe += area;
          if (dni) dnisCafe.add(dni);
        }
      });

      const familiasAmbos = [...dnisCacao].filter(dni => dnisCafe.has(dni)).length;

      return {
        totalHectareas,
        hectareasCacao,
        hectareasCafe,
        totalFamilias: dnisTotal.size,
        familiasCacao: dnisCacao.size,
        familiasCafe: dnisCafe.size,
        familiasAmbos: familiasAmbos
      };
    } catch (error) {
      console.error("Error al calcular estadísticas de la oficina:", error);
      return { totalHectareas: 0, hectareasCacao: 0, hectareasCafe: 0, totalFamilias: 0, familiasCacao: 0, familiasCafe: 0, familiasAmbos: 0 };
    }
  }

  /**
   * Restablece el filtro.
   * Limpia la oficina seleccionada, quita cualquier resaltado del mapa
   * y oculta el panel de estadísticas.
   */
  limpiarFiltro(): void {
    this.selectedOficina = null;
    this._geovisorSharedService.clearHighlights();
    this.stats = null;
  }
}
