import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { GeovisorSharedService, OficinaStats } from '../../../../services/geovisor.service';
import { FeatureLayer, Graphic } from '../../../../interfaces/arcgis-imports';
import { environment } from 'src/environments/environment';


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

  // Para guardar el estado de visibilidad de las capas antes de aplicar el filtro
  private _savedLayerState: Map<string, boolean> = new Map();

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
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Manejador del evento de búsqueda.
   * Si hay una oficina seleccionada, solicita al servicio hacer zoom a su ubicación
   * y dispara el cálculo de sus estadísticas.
   */
  async buscarOficina(): Promise<void> {
    if (this.selectedOficina) {
      const oficina = this.selectedOficina;
      const map = this._geovisorSharedService.mapa;
      const view = this._geovisorSharedService.view;

      // 0. Gestión de Capas: Guardar estado y activar modo "Enfoque"
      if (this._savedLayerState.size === 0) {
        map.layers.forEach((l: any) => {
          // Ignoramos capas gráficas internas (como highlights o marcadores) para no romper la UI
          if (l.type !== 'graphics') {
            this._savedLayerState.set(l.id, l.visible);
          }
        });
      }

      // Apagar todas las capas excepto las relevantes para el filtro
      map.layers.forEach((l: any) => {
        if (l.type === 'graphics') return;
        const title = l.title?.toUpperCase() || '';
        l.visible = (title === 'POLIGONOS DE CULTIVO' || title === 'OFICINAS ZONALES');
      });

      // URL directa para asegurar funcionamiento independiente del servicio
      //const SERVICE_URL = "https://siscod.devida.gob.pe/server/rest/services/DPM_PIRDAIS_CULTIVOS_PRODUCCION/MapServer";
      const SERVICE_URL = `${environment.apiUrl}/mapas/capa`;

      // 1. Filtro Visual: Capa de Polígonos (Capa 1)
      const polyLayer = map.layers.find((l: any) => l.title === 'POLIGONOS DE CULTIVO') as any;
      if (polyLayer) {
        const sublayer = polyLayer.findSublayerById(1);
        if (sublayer) {
          sublayer.definitionExpression = `UPPER(oficina_zonal) = '${oficina.toUpperCase()}'`;
          polyLayer.visible = true;
        }
      }

      // 2. Filtro Visual: Capa de Oficinas (Capa 0) - ¡Sorpresa!
      // Mostramos solo el límite de la oficina seleccionada para dar contexto.
      const officeLayer = map.layers.find((l: any) => l.title === 'OFICINAS ZONALES') as any;
      if (officeLayer) {
        const sublayer = officeLayer.findSublayerById(0);
        if (sublayer) {
          sublayer.definitionExpression = `UPPER(nombre) = '${oficina.toUpperCase()}'`;
          officeLayer.visible = true; // Aseguramos que se vea
        }
      }

      // 3. Zoom y Resaltado (Lógica local para robustez)
      try {
        const featureLayer = new FeatureLayer({ url: `${SERVICE_URL}/0` }); // Consultamos Capa 0 (Oficinas)
        const query = featureLayer.createQuery();
        query.where = `UPPER(nombre) = '${oficina.toUpperCase()}'`;
        query.returnGeometry = true;
        query.outFields = ["*"];

        const results = await featureLayer.queryFeatures(query);

        if (results.features.length > 0 && view) {
          const feature = results.features[0];
          // MEJORA: Usamos el 'extent' de la geometría expandido un 20% (1.2)
          // Esto garantiza que se vea todo el ámbito de la oficina sin cortar los bordes.
          if (feature.geometry && feature.geometry.extent) {
            await view.goTo(feature.geometry.extent.expand(1.2), { duration: 1000 });
          }
        } else {
           this._geovisorSharedService.showToast('No se encontró la ubicación de la oficina.', 'warning');
        }
      } catch (error) {
        console.error("Error al ubicar oficina:", error);
      }

      // 4. Cargar Estadísticas
      await this.cargarEstadisticas(oficina);
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
      const calculatedStats = await this._geovisorSharedService.getStatsForOficina(oficina);

      // Si no se encuentran polígonos, mostrar un mensaje, pero seguir mostrando las tarjetas con valor 0.
      if (calculatedStats.totalFamilias === 0 && calculatedStats.totalHectareas === 0) {
        this._geovisorSharedService.showToast(`No se encontraron polígonos para la oficina ${oficina}.`, 'warning', true);
      }

      // Asignamos siempre las estadísticas para que las tarjetas se muestren, incluso si los valores son cero.
      this.stats = {
        ...calculatedStats
      };
    } catch (error) {
      this.stats = null;
    } finally {
      this.isStatsLoading = false;
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

    const map = this._geovisorSharedService.mapa;

    // Restaurar el estado de visibilidad de las capas (si se guardó previamente)
    if (this._savedLayerState.size > 0) {
      this._savedLayerState.forEach((visible, layerId) => {
        const layer = map.findLayerById(layerId);
        if (layer) layer.visible = visible;
      });
      this._savedLayerState.clear();
    }

    // Restaurar Polígonos (Capa 1)
    const polyLayer = map.layers.find((l: any) => l.title === 'POLIGONOS DE CULTIVO') as any;
    if (polyLayer) {
      const sublayer = polyLayer.findSublayerById(1);
      if (sublayer) sublayer.definitionExpression = '1=1';
    }

    // Restaurar Oficinas (Capa 0)
    const officeLayer = map.layers.find((l: any) => l.title === 'OFICINAS ZONALES') as any;
    if (officeLayer) {
      const sublayer = officeLayer.findSublayerById(0);
      if (sublayer) sublayer.definitionExpression = '1=1';
      officeLayer.visible = false; // Ocultamos la capa de oficinas al limpiar
    }
  }
}
