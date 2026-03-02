import "driver.js/dist/driver.css";
import { CommonModule, isPlatformBrowser, registerLocaleData, Location } from '@angular/common';
import { Component, AfterViewInit, LOCALE_ID, OnDestroy, ViewChild, ElementRef, Inject, PLATFORM_ID } from '@angular/core';
import { driver } from "driver.js";
import { FooterComponent } from './components/footer/footer.component';
import { NavbarmenuComponent } from './components/navbar/navbarmenu.component';
import { RouterModule } from '@angular/router';
import { SidemenuComponent } from './components/sidebar/sidemenu.component';
import * as XLSX from 'xlsx';
import autoTable from 'jspdf-autotable';
import Chart, { ChartConfiguration } from 'chart.js/auto';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import localeEsPE from '@angular/common/locales/es-PE';
import StatisticDefinition from '@arcgis/core/rest/support/StatisticDefinition.js';
import { environment } from "src/environments/environment";


const pseudo3DPlugin = {
  id: 'pseudo3D',
  beforeDatasetsDraw: (chart: Chart) => {
    // Solo aplicar a gráficos de barras
    const barMeta = chart.getDatasetMeta(0);
    if (barMeta.type !== 'bar' || !barMeta.data) {
      return;
    }

    const { ctx } = chart;
    const offset = 4; // "Profundidad" del efecto 3D en píxeles

    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)'; // Color de la sombra, negro semitransparente

    const isHorizontal = chart.options.indexAxis === 'y';

    barMeta.data.forEach(bar => {
      const { x, y, base, width, height } = bar as any;

      if (isHorizontal) {
        // Lógica para barras horizontales
        const barThickness = height; // En horizontal, 'height' es el grosor de la barra

        // Cara inferior
        ctx.beginPath();
        ctx.moveTo(base, y + barThickness / 2);
        ctx.lineTo(base + offset, y + barThickness / 2 + offset);
        ctx.lineTo(x + offset, y + barThickness / 2 + offset);
        ctx.lineTo(x, y + barThickness / 2);
        ctx.closePath();
        ctx.fill();

        // Cara lateral (derecha)
        ctx.beginPath();
        ctx.moveTo(x, y - barThickness / 2);
        ctx.lineTo(x + offset, y - barThickness / 2 + offset);
        ctx.lineTo(x + offset, y + barThickness / 2 + offset);
        ctx.lineTo(x, y + barThickness / 2);
        ctx.closePath();
        ctx.fill();
      } else {
        // Lógica para barras verticales
        // Cara superior
        ctx.beginPath();
        ctx.moveTo(x - width / 2, y);
        ctx.lineTo(x - width / 2 + offset, y - offset);
        ctx.lineTo(x + width / 2 + offset, y - offset);
        ctx.lineTo(x + width / 2, y);
        ctx.closePath();
        ctx.fill();

        // Cara lateral (derecha)
        ctx.beginPath();
        ctx.moveTo(x + width / 2, y);
        ctx.lineTo(x + width / 2 + offset, y - offset);
        ctx.lineTo(x + width / 2 + offset, base - offset);
        ctx.lineTo(x + width / 2, base);
        ctx.closePath();
        ctx.fill();
      }
    });

    ctx.restore();
  }
};


const pie3DPlugin = {
  id: 'pie3D',
  beforeDatasetsDraw: (chart: Chart) => {
    // Se realiza un cast a 'string' para evitar un error de tipado de TypeScript,
    // que incorrectamente infiere que 'doughnut' no es un tipo de gráfico posible.
    const chartType = (chart.config as ChartConfiguration).type;
    if (chartType !== 'pie' && chartType !== 'doughnut') {
      return;
    }
    const { ctx } = chart;
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetX = 5;
    ctx.shadowOffsetY = 5;
  },
  afterDatasetsDraw: (chart: Chart) => {
    const chartType = (chart.config as ChartConfiguration).type;
    if (chartType !== 'pie' && chartType !== 'doughnut') {
      return;
    }
    chart.ctx.restore();
  }
};

registerLocaleData(localeEsPE, 'es-PE');

interface GraficoData {
  chart: Chart | null;
  labels: string[];
  data: number[];
  backgroundColor: string[];
  borderColor: string[];
}

interface Cultivo {
  cultivo: string;
  cantidad: number;
}

interface CultivoDepartamento {
  departamento: string;
  cultivo: string;
  cantidad: number;
}


@Component({
  standalone: true,
  imports: [CommonModule, RouterModule, SidemenuComponent, NavbarmenuComponent, FooterComponent],
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
  providers: [{ provide: LOCALE_ID, useValue: 'es-PE' }],
})
export class DashboardComponent implements AfterViewInit {
  /** URL del servicio de features de ArcGIS que contiene los datos de los cultivos. */
  private PROXY_MAP_BASE: string;
  private readonly PROD_MAP_BASE = `${environment.apiUrl}/mapas/capa/1`;

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private location: Location
  ) {
    // Se establece la URL de producción como la principal por defecto.
    this.PROXY_MAP_BASE = this.PROD_MAP_BASE;

    if (isPlatformBrowser(this.platformId)) {

      this.assetPath = this.location.prepareExternalUrl('assets');
    }
  }

  private queryServicio: string = '';

  isMenuOpen = false;   // Estado inicial del menú

  isDesktop = false;   // Detecta si es pantalla grande

  /** Almacena el número total de polígonos de cultivos registrados. */
  public totalRegistrosCultivos = 0;
  /** Objeto que almacena el conteo de registros por cada tipo de cultivo. */
  public conteoPorCultivo: Record<string, number> = {};
  /** Número total de polígonos de Café. */
  public totalCafe = 0;
  /** Número total de polígonos de Cacao. */
  public totalCacao = 0;

  /** Suma total del área de todos los cultivos (en hectáreas). */
  public totalAreaCultivo = 0; // en m²
  /** Array con el área total agrupada por tipo de cultivo. */
  public areaPorCultivo: { cultivo: string; total_area: number }[] = [];
  /** Área total de cultivos de Café. */
  public totalAreaCafe = 0;
  /** Área total de cultivos de Cacao. */
  public totalAreaCacao = 0;

  /**
   * Define las metas de hectáreas a alcanzar por año.
   * La clave es el año y el valor es la meta en hectáreas.
   */
  private readonly METAS_HECTAREAS: { [key: number]: number } = {
    2024: 43364,
    2025: 5000,
    2026: 5000,
  };
  /**
   * Define las metas de familias participantes a alcanzar por año.
   * La clave es el año y el valor es la meta de familias.
   */
  private readonly METAS_FAMILIAS: { [key: number]: number } = {
    2024: 38313,
    2025: 4000,
    2026: 5000,
  };

  /** Almacena la meta de familias para el año seleccionado. */
  public currentMetaFamilias: number = 0;
  /** Almacena la meta de hectáreas para el año seleccionado. */
  public currentMetaHectareas: number = 0;

  /** Array con los años disponibles para el filtro. */
  public availableYears: number[] = [];
  /** Año seleccionado en el filtro. El valor `0` representa "Todos". */
  public selectedYear: number | 0 = new Date().getFullYear();
  /** Fecha actual del sistema, usada para los títulos dinámicos. */
  public currentDate: Date = new Date();

  /** Almacena las instancias de los gráficos de Chart.js para su posterior destrucción. */
  private charts: Chart[] = [];

  // --- Propiedades para el Modal de Reporte ---
  /** Controla la visibilidad del modal de reporte. */
  public isModalVisible = false;
  /** Almacena los datos para mostrar en la tabla del modal. */
  public modalData: any[] = [];
  /** Flag para mostrar el indicador de carga en el modal. */
  public isModalLoading = false;
  /** Flag para indicar que la exportación a PDF está en progreso. */
  public isExportingPDF = false;

  /** Ruta base para los assets (imágenes, etc.), calculada dinámicamente. */
  public assetPath = '';

  // --- Propiedades para el manejo de errores del backend ---
  /** Flag para indicar si ha ocurrido un error de conexión con el backend. */
  public isBackendError = false;
  /** Mensaje de error que se mostrará si el backend falla. */
  public backendErrorMessage = '';
  /**

  /**
   * @method ngAfterViewInit
   * @description
   * Hook del ciclo de vida de Angular que se ejecuta después de que la vista del componente ha sido inicializada.
   * Inicia la carga de datos del dashboard.
   */
  async ngAfterViewInit(): Promise<void> {
    this.inicializarDashboard();
  }

  /**
   * @method inicializarDashboard
   * @description
   * Se ejecuta después de obtener la URL del backend. Prepara el dashboard,
   * obtiene los años disponibles y lanza la carga de datos inicial.
   * @async
   */
  async inicializarDashboard(): Promise<void> {
    let dashboardCultivos: FeatureLayer;
    try {
      // Intento 1: Conectar a Producción
      dashboardCultivos = new FeatureLayer({ url: this.PROD_MAP_BASE });
      await dashboardCultivos.load();
      this.PROXY_MAP_BASE = this.PROD_MAP_BASE; // Éxito, usar PROD
    } catch (prodError) {
      //console.error("Error crítico de conexión con el backend:", prodError);
      this.isBackendError = true;
      this.backendErrorMessage = 'No fue posible establecer conexión con el servidor. Por favor, intente nuevamente más tarde o confirme que el sistema se encuentre en funcionamiento. Si el problema persiste, comuníquese con el área de Informática.';
      return; // Salir si falla
    }

    try {
      this.availableYears = await this.getAvailableYears(dashboardCultivos);
      const currentYear = new Date().getFullYear();
      if (this.availableYears.includes(currentYear)) {
        this.selectedYear = currentYear; // Selecciona el año actual por defecto
      } else if (this.availableYears.length > 0) {
        this.selectedYear = this.availableYears[0]; // Fallback al año más reciente disponible
      }
      await this.loadDashboardData();
    } catch (err) {
      this.isBackendError = true;
      this.backendErrorMessage = 'Ocurrió un error al procesar los datos del dashboard. Por favor, recargue la página.';
    }
  }

  /**
   * @method getAvailableYears
   * @description
   * Genera una lista estática de años (2024-2030) para ser usada en el selector de filtro.
   * @param {FeatureLayer} layer - Parámetro no utilizado, mantenido por consistencia de firma.
   * @returns {Promise<number[]>} Una promesa que resuelve a un array de años.
   * @async
   */
  async getAvailableYears(layer: FeatureLayer): Promise<number[]> {
    // De acuerdo a la solicitud, ahora usamos una lista fija de años del 2024 al 2030.
    const years = [];
    for (let year = 2030; year >= 2024; year--) {
      years.push(year);
    }
    // El parámetro 'layer' ya no se usa, pero se mantiene por consistencia en la firma del método.
    return Promise.resolve(years);
  }

  /**
   * @method onYearChange
   * @description
   * Manejador de eventos para el cambio en el selector de año.
   * Actualiza el año seleccionado y vuelve a cargar los datos del dashboard.
   * @param {Event} event - El objeto del evento de cambio.
   */
  public onYearChange(event: Event) {
    const selectElement = event.target as HTMLSelectElement;
    this.selectedYear = Number(selectElement.value);
    this.loadDashboardData();
  }

  /**
   * @method clearCharts
   * @description
   * Destruye todas las instancias de gráficos de Chart.js almacenadas en el array `this.charts`.
   * Esto es crucial para liberar memoria y evitar errores de renderizado al recargar los datos.
   */
  private clearCharts(): void {
    this.charts.forEach(chart => chart.destroy());
    this.charts = [];
  }

  /**
   * @method loadDashboardData
   * @description
   * Orquesta la carga y actualización de todos los datos y gráficos del dashboard.
   * 1. Limpia los gráficos existentes.
   * 2. Define el filtro de año y las metas correspondientes.
   * 3. Ejecuta todas las consultas de datos en paralelo.
   * 4. Una vez resueltas las consultas, crea los nuevos gráficos.
   * @async
   */
  async loadDashboardData(): Promise<void> {
    this.clearCharts();

    let yearFilter: string;
    if (this.selectedYear === 0) { // 'Todos'
        yearFilter = '1=1';
        this.currentMetaHectareas = Object.values(this.METAS_HECTAREAS).reduce((sum, meta) => sum + meta, 0);
        this.currentMetaFamilias = Object.values(this.METAS_FAMILIAS).reduce((sum, meta) => sum + meta, 0);
    } else { // Specific year
        yearFilter = `EXTRACT(YEAR FROM fecha_levantamiento) = ${this.selectedYear}`;
        this.currentMetaHectareas = this.METAS_HECTAREAS[this.selectedYear] || 0;
        this.currentMetaFamilias = this.METAS_FAMILIAS[this.selectedYear] || 0;
    }

    const dashboardCultivos = new FeatureLayer({ url: this.PROXY_MAP_BASE });

    try {
        const [cafeCacao, areaPorCultivo, totalDNIResult] = await Promise.all([
            this.contarCafeCacao(dashboardCultivos, yearFilter),
            this.sumarAreaPorCultivo(dashboardCultivos, yearFilter),
            this.contarRegistrosUnicosPorDNI(dashboardCultivos, yearFilter),
        ]);

        const totalArea = areaPorCultivo.reduce((sum, current) => sum + (current.total_area || 0), 0);

        this.totalAreaCultivo = totalArea;
        this.totalCafe = cafeCacao.cafe;
        this.totalCacao = cafeCacao.cacao;
        this.totalRegistrosCultivos = this.totalCafe + this.totalCacao; // 🎯 CORRECCIÓN: Sumar los polígonos para la tarjeta de total.
        this.areaPorCultivo = areaPorCultivo;
        this.crearGraficoProgresoporHectareas(totalArea);
        this.crearGraficoProgresoporDNI(totalDNIResult["total"]);
        this.crearGraficoProgresoporHectareasOZ(yearFilter);
        this.crearGraficoProgresoporHectareasOZCacao(yearFilter);
        this.crearGraficoProgresoporHectareasOZCAFE(yearFilter);
        this.crearGraficoCantidadPoligonosOZCacao(yearFilter);
        this.crearGraficoCantidadPoligonosOZCafe(yearFilter);
        this.crearGraficoProgresoporFamiliasOZ(yearFilter);
        this.crearGraficoCantidadFamiliasOZCacao(yearFilter);
        this.crearGraficoCantidadFamiliasOZCafe(yearFilter);
        this.crearGraficoPorDepartamento(yearFilter);
        this.generarGraficoCultivosPorTipo(dashboardCultivos, yearFilter);

    } catch (err) {
      //console.error("Error al cargar los datos del dashboard:", err);
    }
  }

  //Tarjetas sobre la Meta & Avance
  /**
   * @method sumarAreaCultivoTotal
   * @description
   * Realiza una consulta de estadísticas al servicio para obtener la suma total del campo `area_cultivo`.
   * @param {FeatureLayer} layer - La capa de features sobre la que se realizará la consulta.
   * @param {string} whereClause - La cláusula WHERE para filtrar los datos (ej. por año).
   * @returns {Promise<number>} Una promesa que resuelve a la suma total del área.
   * @async
   */
  async sumarAreaCultivoTotal(layer: FeatureLayer, whereClause: string = '1=1'): Promise<number> {
    const statDef = new StatisticDefinition({
      onStatisticField: 'area_cultivo',
      outStatisticFieldName: 'sum_area',
      statisticType: 'sum',
    });
    const query = layer.createQuery();
    query.where = whereClause;
    query.outStatistics = [statDef];
    query.returnGeometry = false;
    try {
      const result = await layer.queryFeatures(query);
      if (result.features.length > 0) {
        const value = result.features[0].attributes?.['sum_area'];
        return value != null ? value : 0;
      }
      return 0;
    } catch (err) {
      return 0;
    }
  }

  /**
   * @method sumarAreaPorCultivo
   * @description
   * Consulta la suma del área de cultivo, agrupada por el campo `tipo_cultivo`.
   * Además, actualiza las propiedades `totalAreaCafe` y `totalAreaCacao` con sus respectivos valores.
   * @param {FeatureLayer} layer - La capa de features sobre la que se realizará la consulta.
   * @param {string} whereClause - La cláusula WHERE para filtrar los datos.
   * @returns {Promise<any[]>} Una promesa que resuelve a un array de objetos con `{ cultivo, total_area }`.
   * @async
   */
  async sumarAreaPorCultivo(layer: FeatureLayer, whereClause: string = '1=1'): Promise<any[]> {
    const areasPorCultivo: Record<string, number> = {};
    const pageSize = 2000;

    try {
      const total = await layer.queryFeatureCount({ where: whereClause });
      let fetched = 0;

      while (fetched < total) {
        const result = await layer.queryFeatures({
          where: whereClause,
          outFields: ['tipo_cultivo', 'area_cultivo'],
          returnGeometry: false,
          start: fetched,
          num: pageSize,
        });

        if (!result.features.length) {
          break;
        }

        result.features.forEach(feature => {
          const cultivo = feature.attributes.tipo_cultivo;
          const area = feature.attributes.area_cultivo;
          if (cultivo && area != null) {
            areasPorCultivo[cultivo] = (areasPorCultivo[cultivo] || 0) + area;
          }
        });

        fetched += result.features.length;
      }

      const data = Object.keys(areasPorCultivo).map(cultivo => ({
        cultivo: cultivo,
        total_area: areasPorCultivo[cultivo]
      }));

      // Reset and save areas for cafe and cacao
      this.totalAreaCafe = 0;
      this.totalAreaCacao = 0;
      data.forEach((c) => {
        const nombre = (c.cultivo || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        if (nombre.includes('cafe')) this.totalAreaCafe = c.total_area;
        if (nombre.includes('cacao')) this.totalAreaCacao = c.total_area;
      });

      return data;
    } catch (err) {
      this.totalAreaCafe = 0;
      this.totalAreaCacao = 0;
      return [];
    }
  }

  //Grafico sobre la Meta & Avance
  /**
   * @method crearGraficoProgresoporHectareas
   * @description
   * Crea un gráfico de tipo "doughnut" (dona) que muestra el progreso del avance de hectáreas
   * en comparación con la meta anual (`currentMetaHectareas`).
   * @param {number} total - El valor total del avance de hectáreas.
   */
  crearGraficoProgresoporHectareas(total: number) {
    const meta = this.currentMetaHectareas;
    const restante = Math.max(meta - total, 0);
    const ctx = document.getElementById('graficoMeta') as HTMLCanvasElement;

    this.charts.push(new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['AVANCE', 'RESTANTE'],
        datasets: [
          {
            data: [total, restante],
            backgroundColor: [
              '#2c9c7d ', // verde
              '#f9edbc'   // verde claro/transparente
            ],
            borderColor: ['#075A73', '#085A25'],
            borderWidth: 2,
            hoverOffset: 8
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false, // <<--- ahora respeta el alto del contenedor
        plugins: {
          title: {
            display: true,
            text: 'META / AVANCE',
            font: {
              size: 18,
              weight: 'bold'
            },
            color: '#333'
          },
          legend: {
            display: true,
            labels: {
              font: { weight: 'bold' }
            }
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const value = context.raw as number;
                return `${context.label}: ${value.toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
              }
            }
          },
          datalabels: {
            color: 'black',
            font: { weight: 'bold', size: 30 },
            formatter: (value) => {
              if (meta === 0) {
                return 'N/A';
              }
              const porcentaje = (value as number / meta) * 100;
              return `${porcentaje.toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}%`;
            }
          }
        }
      },
      plugins: [pie3DPlugin, ChartDataLabels]
    }));
  }

  //Grafico sobre la Meta por Oficina Zonal
  /**
   * @method crearGraficoProgresoporHectareasOZ
   * @description
   * Crea un gráfico de barras horizontales que muestra el total de hectáreas (Café y Cacao)
   * agrupado por Oficina Zonal. Los datos se obtienen mediante paginación.
   * @param {string} whereClause - La cláusula WHERE para filtrar los datos por año.
   * @async
   */
  async crearGraficoProgresoporHectareasOZ(whereClause: string = '1=1') {
    const ctx = document.getElementById('graficoMetaOZ') as HTMLCanvasElement;
    if (!ctx) return;

    const featureLayer = new FeatureLayer({ url: this.PROXY_MAP_BASE });
    const areasPorOficina: Record<string, number> = {};
    const pageSize = 2000;

    try {
      const total = await featureLayer.queryFeatureCount({ where: whereClause });
      let fetched = 0;

      while (fetched < total) {
        const result = await featureLayer.queryFeatures({
          where: whereClause,
          outFields: ['oficina_zonal', 'area_cultivo'],
          returnGeometry: false,
          start: fetched,
          num: pageSize,
        });

        if (!result.features.length) {
          break;
        }

        result.features.forEach(feature => {
          const org = feature.attributes.oficina_zonal;
          const area = feature.attributes.area_cultivo;
          if (org && area != null) {
            areasPorOficina[org] = (areasPorOficina[org] || 0) + area;
          }
        });

        fetched += result.features.length;
      }

      if (Object.keys(areasPorOficina).length === 0) {
        this.mostrarMensajeEnCanvas(ctx, 'No hay datos de hectáreas por Oficina Zonal.');
        return;
      }

      const entries = Object.entries(areasPorOficina).sort((a, b) => b[1] - a[1]);
      const labels = entries.map(e => e[0]);
      const values = entries.map(e => e[1]);

    // 🔹 Colores por Oficina Zonal
    const colorMap: Record<string, string> = {
      'SAN FRANCISCO': '#FEEFD8',
      'JAEN': '#FFBEBE',
      'PUCALLPA': '#B7D9FE',
      'LA MERCED': '#FFC0B6',
      'TINGO MARIA': '#D6F9FD',
      'TARAPOTO': '#C2BBFE',
      'SAN JUAN DE ORO': '#FED2F3',
      'QUILLABAMBA': '#FEFEB9',
      'IQUITOS': '#CAFEDA',
    };
    const backgroundColors = labels.map(org => colorMap[org] || '#cccccc');

    this.charts.push(new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Área cultivada (ha)',
            data: values,
            backgroundColor: backgroundColors,
            borderColor: '#4A5568',
            borderWidth: 2,
            barThickness: 25,
            maxBarThickness: 50,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: {
          padding: {
            bottom: 5, // Espacio para que el efecto 3D no se corte en el borde.
          }
        },
        indexAxis: 'y',
        scales: {
          x: {
            beginAtZero: true,
            max: 20000,
            ticks: {
              callback: (value) =>
                `${Number(value).toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
            },
          },
          y: {
            ticks: {
              font: { size: 12, weight: 'bold' },
            },
          },
        },
        plugins: {
          title: {
            display: true,
            text: 'AVANCE: HECTÁREAS (CACAO & CAFÉ)',
            font: { size: 18, weight: 'bold' },
            color: '#333',
            padding: { top: 10, bottom: 20 }
          },
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const value = ctx.raw as number;
                return `${Number(value).toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ha`;
              },
            },
          },
          datalabels: {
            anchor: 'end',
            align: 'right',
            color: '#000',
            font: { weight: 'bold', size: 12 },
            formatter: (v: number) =>
              `${Number(v).toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ha`,
          },
        },
      },
      plugins: [pseudo3DPlugin, ChartDataLabels],
    }));
    } catch (error) {
      //console.error('Error al crear gráfico de hectáreas por OZ:', error);
      this.mostrarMensajeEnCanvas(ctx, 'Error al cargar los datos del gráfico.');
    }
  }

  //Grafico sobre la Meta por Oficina Zonal - CACAO
  /**
   * @method crearGraficoProgresoporHectareasOZCacao
   * @description
   * Crea un gráfico combinado (barras y línea) que muestra el avance de hectáreas de Cacao por Oficina Zonal
   * en comparación con las metas específicas definidas para cada zona.
   * @param {string} whereClause - La cláusula WHERE para filtrar los datos por año.
   * @async
   */
  async crearGraficoProgresoporHectareasOZCacao(whereClause: string = '1=1') {
    const ctx = document.getElementById('graficoMetaOZCACAO') as HTMLCanvasElement;
    if (!ctx) return;

    const featureLayer = new FeatureLayer({ url: this.PROXY_MAP_BASE });
    const finalWhereClause = `tipo_cultivo='CACAO' AND ${whereClause}`;
    const areasPorOficina: Record<string, number> = {};
    const pageSize = 2000;

    try {
      const total = await featureLayer.queryFeatureCount({ where: finalWhereClause });
      let fetched = 0;

      while (fetched < total) {
        const result = await featureLayer.queryFeatures({
          where: finalWhereClause,
          outFields: ['oficina_zonal', 'area_cultivo'],
          returnGeometry: false,
          start: fetched,
          num: pageSize,
        });

        if (!result.features.length) {
          break;
        }

        result.features.forEach(feature => {
          const org = feature.attributes.oficina_zonal;
          const area = feature.attributes.area_cultivo;
          if (org && area != null) {
            areasPorOficina[org] = (areasPorOficina[org] || 0) + area;
          }
        });

        fetched += result.features.length;
      }

      if (Object.keys(areasPorOficina).length === 0) {
        this.mostrarMensajeEnCanvas(ctx, 'No hay datos de Cacao por Oficina Zonal.');
        return;
      }

      const entries = Object.entries(areasPorOficina).sort((a, b) => b[1] - a[1]);
      const labels = entries.map(e => e[0]);
      const values = entries.map(e => e[1]);

    const metasOZ: Record<string, number> = {
      'SAN FRANCISCO': 4824,
      'PUCALLPA': 10154,
      'LA MERCED': 5134,
      'TINGO MARIA': 4629,
      'TARAPOTO': 7383,
      'SAN JUAN DE ORO': 1281,
      'QUILLABAMBA': 0,
      'IQUITOS': 505,
    };
    const metaValues = labels.map(org => metasOZ[org] ?? 0);

    const colorMap: Record<string, string> = {
      'SAN FRANCISCO': '#FEEFD8',
      'JAEN': '#FFBEBE',
      'PUCALLPA': '#B7D9FE',
      'LA MERCED': '#FFC0B6',
      'TINGO MARIA': '#D6F9FD',
      'TARAPOTO': '#C2BBFE',
      'SAN JUAN DE ORO': '#FED2F3',
      'QUILLABAMBA': '#FEFEB9',
      'IQUITOS': '#CAFEDA',
    };
    const backgroundColors = labels.map(org => colorMap[org] || '#cccccc');

    this.charts.push(new Chart(ctx, {
      type: 'bar', // ✅ barras verticales
      data: {
        labels,
        datasets: [
          {
            label: 'Área cultivada de CACAO (ha)',
            data: values,
            backgroundColor: backgroundColors,
            borderColor: '#4A5568',
            borderWidth: 2,
            barThickness: 25,
            maxBarThickness: 50,
            order: 1,
            datalabels: {
              anchor: 'end',
              align: 'end',
              color: '#000',
              font: { weight: 'bold', size: 12 },
              formatter: (v: number) =>
                `${v.toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ha`,
            },
          },
          {
            label: 'Meta',
            type: 'line',
            data: metaValues,
            borderColor: '#FF0000',
            borderWidth: 2,
            pointRadius: 3,
            pointBackgroundColor: '#FF0000',
            borderDash: [6, 6],
            fill: false,
            order: 999, // ✅ línea siempre encima
            datalabels: {
              anchor: 'end',
              align: 'top',
              color: '#FF0000',
              font: { weight: 'bold', size: 11 },
              formatter: (meta: number, ctx) => {
                const valor = values[ctx.dataIndex] ?? 0;
                if (!meta || meta <= 0) return '';
                const diff = meta - valor;
                const perc = (diff / meta) * 100;
                if (perc <= 0) return `Superado: ${Math.abs(perc).toFixed(1)}%`;
                return `Falta: ${perc.toFixed(1)}%`;
              },
            },
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: {
          padding: {
            right: 5, // Espacio para que el efecto 3D no se corte en el borde.
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { font: { size: 12, weight: 'bold' } },
          },
          x: {
            ticks: { font: { size: 12, weight: 'bold' } },
          },
        },
        plugins: {
          title: {
            display: true,
            text: 'OFICINA ZONAL / HECTÁREAS CACAO vs META',
            font: { size: 18, weight: 'bold' },
            color: '#333',
            padding: { top: 10, bottom: 20 }
          },
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const value = ctx.raw as number;
                const meta = metaValues[ctx.dataIndex];
                if (ctx.dataset.label === 'Área cultivada de CACAO (ha)') {
                  return `${Number(value).toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ha`;
                }
                return `Meta: ${Number(meta).toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ha`;
              },
            },
          },
        },
      },
      plugins: [pseudo3DPlugin, ChartDataLabels],
    }));
    } catch (error) {
      //console.error('Error al crear gráfico de hectáreas Cacao vs Meta:', error);
      this.mostrarMensajeEnCanvas(ctx, 'Error al cargar los datos del gráfico.');
    }
  }
  //Grafico sobre la Meta por Oficina Zonal - CAFE
  /**
   * @method crearGraficoProgresoporHectareasOZCAFE
   * @description
   * Crea un gráfico combinado (barras y línea) que muestra el avance de hectáreas de Café por Oficina Zonal
   * en comparación con las metas específicas definidas para cada zona.
   * @param {string} whereClause - La cláusula WHERE para filtrar los datos por año.
   * @async
   */
  async crearGraficoProgresoporHectareasOZCAFE(whereClause: string = '1=1') {
    const ctx = document.getElementById('graficoMetaOZCAFE') as HTMLCanvasElement;
    if (!ctx) return;

    const featureLayer = new FeatureLayer({ url: this.PROXY_MAP_BASE });
    const finalWhereClause = `tipo_cultivo='CAFE' AND ${whereClause}`;
    const areasPorOficina: Record<string, number> = {};
    const pageSize = 2000;

    try {
      const total = await featureLayer.queryFeatureCount({ where: finalWhereClause });
      let fetched = 0;

      while (fetched < total) {
        const result = await featureLayer.queryFeatures({
          where: finalWhereClause,
          outFields: ['oficina_zonal', 'area_cultivo'],
          returnGeometry: false,
          start: fetched,
          num: pageSize,
        });

        if (!result.features.length) {
          break;
        }

        result.features.forEach(feature => {
          const org = feature.attributes.oficina_zonal;
          const area = feature.attributes.area_cultivo;
          if (org && area != null) {
            areasPorOficina[org] = (areasPorOficina[org] || 0) + area;
          }
        });

        fetched += result.features.length;
      }

      if (Object.keys(areasPorOficina).length === 0) {
        this.mostrarMensajeEnCanvas(ctx, 'No hay datos de Café por Oficina Zonal.');
        return;
      }

      const entries = Object.entries(areasPorOficina).sort((a, b) => b[1] - a[1]);
      const labels = entries.map(e => e[0]);
      const values = entries.map(e => e[1]);

    const metasOZ: Record<string, number> = {
      'SAN FRANCISCO': 2344,
      'PUCALLPA': 0,
      'JAEN': 4300, // Dato de ejemplo, ajustar si es necesario
      'LA MERCED': 1973,
      'TINGO MARIA': 2133,
      'TARAPOTO': 688,
      'SAN JUAN DE ORO': 1119,
      'QUILLABAMBA': 1197,
      'IQUITOS': 0,
    };
    const metaValues = labels.map(org => metasOZ[org] ?? 0);

    const colorMap: Record<string, string> = {
      'SAN FRANCISCO': '#FEEFD8',
      'JAEN': '#FFBEBE',
      'PUCALLPA': '#B7D9FE',
      'LA MERCED': '#FFC0B6',
      'TINGO MARIA': '#D6F9FD',
      'TARAPOTO': '#C2BBFE',
      'SAN JUAN DE ORO': '#FED2F3',
      'QUILLABAMBA': '#FEFEB9',
      'IQUITOS': '#CAFEDA',
    };
    const backgroundColors = labels.map(org => colorMap[org] || '#cccccc');

    this.charts.push(new Chart(ctx, {
      type: 'bar', // ✅ barras verticales
      data: {
        labels,
        datasets: [
          {
            label: 'Área cultivada de CAFE (ha)',
            data: values,
            backgroundColor: backgroundColors,
            borderColor: '#4A5568',
            borderWidth: 2,
            barThickness: 25,
            maxBarThickness: 50,
            order: 1,
            datalabels: {
              anchor: 'end',
              align: 'end',
              color: '#000',
              font: { weight: 'bold', size: 12 },
              formatter: (v: number) =>
                `${v.toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ha`,
            },
          },
          {
            label: 'Meta',
            type: 'line',
            data: metaValues,
            borderColor: '#FF0000',
            borderWidth: 2,
            pointRadius: 3,
            pointBackgroundColor: '#FF0000',
            borderDash: [6, 6],
            fill: false,
            order: 999, // ✅ línea encima de las barras
            datalabels: {
              anchor: 'end',
              align: 'top',
              color: '#FF0000',
              font: { weight: 'bold', size: 11 },
              formatter: (meta: number, ctx) => {
                const valor = values[ctx.dataIndex] ?? 0;
                if (!meta || meta <= 0) return '';
                const diff = meta - valor;
                const perc = (diff / meta) * 100;
                if (perc <= 0) return `Superado: ${Math.abs(perc).toFixed(1)}%`;
                return `Falta: ${perc.toFixed(1)}%`;
              },
            },
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: {
          padding: {
            right: 5, // Espacio para que el efecto 3D no se corte en el borde.
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { font: { size: 12, weight: 'bold' } },
          },
          x: {
            ticks: { font: { size: 12, weight: 'bold' } },
          },
        },
        plugins: {
          title: {
            display: true,
            text: 'OFICINA ZONAL / HECTÁREAS CAFÉ vs META',
            font: { size: 18, weight: 'bold' },
            color: '#333',
            padding: { top: 10, bottom: 20 },
          },
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const value = ctx.raw as number;
                const meta = metaValues[ctx.dataIndex];
                if (ctx.dataset.label === 'Área cultivada de CAFE (ha)') {
                  return `${Number(value).toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ha`;
                }
                return `Meta: ${Number(meta).toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ha`;
              },
            },
          },
        },
      },
      plugins: [pseudo3DPlugin, ChartDataLabels],
    }));
    } catch (error) {
      //console.error('Error al crear gráfico de hectáreas Café vs Meta:', error);
      this.mostrarMensajeEnCanvas(ctx, 'Error al cargar los datos del gráfico.');
    }
  }



  //Grafico sobre total participantes
  public totalRegistrosUnicosDNI: Record<string, number> = {};

  /**
   * @method contarTotalDNIUnicos
   * @description
   * Cuenta el número total de DNI únicos en toda la capa. **NOTA: Esta función no se está utilizando actualmente.**
   * @param {FeatureLayer} layer - La capa de features.
   * @returns {Promise<number>} El número total de DNIs únicos.
   * @async
   */
  public async contarTotalDNIUnicos(layer: FeatureLayer): Promise<number> {
    try { // NOTA: Esta función no se está utilizando actualmente.
      const pageSize = 2000;
      const dnisTotales = new Set<string>();

      const total = await layer.queryFeatureCount({ where: '1=1' });
      let fetched = 0;

      while (fetched < total) {
        const result = await layer.queryFeatures({
          where: '1=1',
          outFields: ['dni_participante'], // CAMBIO: 'dni' -> 'dni_participante'
          returnGeometry: false,
          start: fetched,
          num: pageSize,
        });

        result.features.forEach((f) => {
          const dni = f.attributes['dni_participante']; // CAMBIO: 'dni' -> 'dni_participante'
          if (dni) dnisTotales.add(dni);
        });

        fetched += result.features.length;
      }

      return dnisTotales.size;
    } catch (err) {
      return 0;
    }
  }

  /**
   * @method crearGraficoProgresoporDNI
   * @description
   * Crea un gráfico de tipo "doughnut" (dona) que muestra el progreso del número de familias participantes
   * en comparación con la meta anual (`currentMetaFamilias`).
   * @param {number} totalDNI - El número total de familias participantes (DNIs únicos).
   */
  crearGraficoProgresoporDNI(totalDNI: number) {
    const meta = this.currentMetaFamilias; // meta de DNIs únicos
    const restante = Math.max(meta - totalDNI, 0);
    const ctx = document.getElementById('graficoMetaDNI') as HTMLCanvasElement;

    this.charts.push(new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['AVANCE', 'RESTANTE'],
        datasets: [
          {
            data: [totalDNI, restante],
            backgroundColor: [
              '#2c9c7d',
              '#f9edbc'
            ],
            borderColor: ['#075A73', '#085A25'],
            borderWidth: 2,
            hoverOffset: 8
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false, // <<--- ahora respeta el alto del contenedor
        plugins: {
          title: {
            display: true,
            text: 'META / AVANCE',
            font: { size: 18, weight: 'bold' },
            color: '#333'
          },
          legend: {
            display: true,
            labels: { font: { weight: 'bold' } }
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const value = context.raw as number;
                return `${context.label}: ${value.toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
              }
            }
          },
          datalabels: {
            color: 'black',
            font: { weight: 'bold', size: 30 },
            formatter: (value) => {
              if (meta === 0) {
                return 'N/A';
              }
              const porcentaje = (value as number / meta) * 100;
              return `${porcentaje.toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}%`;
            }
          }
        }
      },
      plugins: [pie3DPlugin, ChartDataLabels]
    }));
  }

  /**
   * @method contarRegistrosUnicosPorDNI
   * @description
   * Realiza un conteo complejo de participantes (DNIs únicos) a través de paginación.
   * Calcula el número de participantes que tienen solo café, solo cacao, ambos, y el total general.
   * Los resultados se almacenan en la propiedad `totalRegistrosUnicosDNI`.
   * @param {FeatureLayer} layer - La capa de features.
   * @param {string} whereClause - La cláusula WHERE para filtrar los datos.
   * @returns {Promise<Record<string, number>>} Un objeto con los conteos: `{ cafe, cacao, cafe_y_cacao, total }`.
   * @async
   */
  async contarRegistrosUnicosPorDNI(layer: FeatureLayer, whereClause: string = '1=1'): Promise<Record<string, number>> {
    try {
      const pageSize = 2000;
      const dnisPorCultivo: Record<string, Set<string>> = {
        cafe: new Set<string>(),
        cacao: new Set<string>()
      };
      const dnisTotales = new Set<string>();
      const total = await layer.queryFeatureCount({ where: whereClause });
      let fetched = 0;

      while (fetched < total) {
        const result = await layer.queryFeatures({
          where: whereClause,
          outFields: ['dni_participante', 'tipo_cultivo'], // CAMBIO: 'dni' -> 'dni_participante', 'cultivo' -> 'tipo_cultivo'
          returnGeometry: false,
          start: fetched,
          num: pageSize,
        });

        result.features.forEach((f) => {
          const dni = f.attributes['dni_participante']; // CAMBIO: 'dni' -> 'dni_participante'
          if (!dni) return;

          const cultivoRaw = (f.attributes['tipo_cultivo'] || '') // CAMBIO: 'cultivo' -> 'tipo_cultivo'
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim();

          if (cultivoRaw.includes('cafe')) dnisPorCultivo['cafe'].add(dni);
          if (cultivoRaw.includes('cacao')) dnisPorCultivo['cacao'].add(dni);

          dnisTotales.add(dni);
        });

        fetched += result.features.length;
      }

      // calcular intersección (café y cacao)
      const cafe_y_cacao = [...dnisPorCultivo['cafe']].filter((dni) =>
        dnisPorCultivo['cacao'].has(dni)
      );

      const conteoFinal: Record<string, number> = {
        cafe: dnisPorCultivo['cafe'].size - cafe_y_cacao.length,
        cacao: dnisPorCultivo['cacao'].size - cafe_y_cacao.length,
        'cafe_y_cacao': cafe_y_cacao.length,
        total: dnisTotales.size
      };

      this.totalRegistrosUnicosDNI = conteoFinal;
      return conteoFinal;
    } catch (err) {
      this.totalRegistrosUnicosDNI = { cafe: 0, cacao: 0, cafe_y_cacao: 0, total: 0 };
      return { cafe: 0, cacao: 0, cafe_y_cacao: 0, total: 0 };
    }
  }

  /**
   * @method crearGraficoProgresoporFamiliasOZ
   * @description
   * Crea un gráfico de barras horizontales que muestra el número de familias participantes (DNIs únicos)
   * agrupado por Oficina Zonal.
   * @param {string} whereClause - La cláusula WHERE para filtrar los datos por año.
   * @async
   */
  async crearGraficoProgresoporFamiliasOZ(whereClause: string = '1=1') {
    const ctx = document.getElementById('graficoMetaParticipantes') as HTMLCanvasElement;
    if (!ctx) return;

    const featureLayer = new FeatureLayer({ url: this.PROXY_MAP_BASE });
    const query = featureLayer.createQuery();
    query.where = whereClause;
    const dnisPorOficina: Record<string, Set<string>> = {};
    const pageSize = 2000;

    try {
      const total = await featureLayer.queryFeatureCount({ where: whereClause });
      let fetched = 0;

      while (fetched < total) {
        const result = await featureLayer.queryFeatures({
          where: whereClause,
          outFields: ['oficina_zonal', 'dni_participante'],
          returnGeometry: false,
          start: fetched,
          num: pageSize,
        });

        if (!result.features.length) {
          break;
        }

        result.features.forEach(feature => {
          const org = feature.attributes.oficina_zonal;
          const dni = feature.attributes.dni_participante;
          if (org && dni) {
            if (!dnisPorOficina[org]) {
              dnisPorOficina[org] = new Set<string>();
            }
            dnisPorOficina[org].add(dni);
          }
        });

        fetched += result.features.length;
      }

      if (Object.keys(dnisPorOficina).length === 0) {
        this.mostrarMensajeEnCanvas(ctx, 'No hay datos de familias por Oficina Zonal.');
        return;
      }

      const agrupado: Record<string, number> = {};
      for (const org in dnisPorOficina) {
        agrupado[org] = dnisPorOficina[org].size;
      }

      const entries = Object.entries(agrupado).sort((a, b) => b[1] - a[1]);
      const labels = entries.map(e => e[0]);
      const values = entries.map(e => e[1]);

      // 🔹 Colores por ORG (mapa de referencia)
      const colorMap: Record<string, string> = {
      'SAN FRANCISCO': '#FEEFD8',
      'JAEN': '#FFBEBE',
      'PUCALLPA': '#B7D9FE',
      'LA MERCED': '#FFC0B6',
      'TINGO MARIA': '#D6F9FD',
      'TARAPOTO': '#C2BBFE',
      'SAN JUAN DE ORO': '#FED2F3',
      'QUILLABAMBA': '#FEFEB9',
      'IQUITOS': '#CAFEDA',
    };
      // Asignar colores según el ORG, si no existe usar gris
      const backgroundColors = labels.map(org => colorMap[org] || '#cccccc');

    this.charts.push(new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Participantes únicos (DNI)',
            data: values,
            backgroundColor: backgroundColors,
            borderColor: '#4A5568',
            borderWidth: 2,
            barThickness: 25,
            maxBarThickness: 50,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: {
          padding: {
            bottom: 5, // Espacio para que el efecto 3D no se corte en el borde.
          }
        },
        indexAxis: 'y', // barras horizontales
        scales: {
          x: {
            beginAtZero: true,
            max: 14000,
            ticks: {
              callback: (value) =>
                `${Number(value).toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
            },
          },
          y: {
            ticks: {
              font: { size: 12, weight: 'bold' },
            },
          },
        },
        plugins: {
          title: {
            display: true,
            text: 'AVANCE: FAMILIAS PARTICIPANTES',
            font: { size: 18, weight: 'bold' },
            color: '#333',
            padding: { top: 10, bottom: 20 }
          },
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const value = ctx.raw as number;
                return `${Number(value).toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} participantes`;
              },
            },
          },
          datalabels: {
            anchor: 'end',
            align: 'right',
            color: '#000',
            font: { weight: 'bold', size: 12 },
            formatter: (v: number) =>
              `${Number(v).toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
          },
        },
      },
      plugins: [pseudo3DPlugin, ChartDataLabels],
    }));
    } catch (error) {
      //console.error('Error al crear gráfico de familias por OZ:', error);
      this.mostrarMensajeEnCanvas(ctx, 'Error al cargar los datos del gráfico.');
    }
  }

  //Grafico sobre total poligonos
  /**
   * @method contarCafeCacao
   * @description
   * Cuenta el número total de polígonos (registros) para Café y Cacao.
   * @param {FeatureLayer} layer - La capa de features.
   * @param {string} whereClause - La cláusula WHERE para filtrar los datos.
   * @returns {Promise<{ cafe: number, cacao: number }>} Una promesa que resuelve a un objeto con los conteos.
   * @async
   */
  contarCafeCacao(layer: FeatureLayer, whereClause: string = '1=1') {
    const pageSize = 2000;
    let conteoCafe = 0;
    let conteoCacao = 0;

    const getAllData = async () => {
      const total = await layer.queryFeatureCount({ where: whereClause });
      let fetched = 0;

      while (fetched < total) {
        const result = await layer.queryFeatures({
          where: whereClause,
          outFields: ['tipo_cultivo'], // CAMBIO: 'cultivo' -> 'tipo_cultivo'
          returnGeometry: false,
          start: fetched,
          num: pageSize,
        });

        result.features.forEach((f) => {
          const cultivo = (f.attributes['tipo_cultivo'] || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // CAMBIO: 'cultivo' -> 'tipo_cultivo'
          if (cultivo.includes('cafe')) conteoCafe++;
          if (cultivo.includes('cacao')) conteoCacao++;
        });

        fetched += result.features.length;
      }

      return { cafe: conteoCafe, cacao: conteoCacao };
    };

    return getAllData().catch((err) => {
      return { cafe: 0, cacao: 0 };
    });
  }

  /**
   * @method generarGraficoCultivosPorTipo
   * @description
   * **Método no utilizado actualmente en el HTML.**
   * Crea un gráfico de tipo "pie" (torta) que muestra la distribución de la cantidad de polígonos por tipo de cultivo.
   * @param {FeatureLayer} layer - La capa de features.
   * @param {string} whereClause - La cláusula WHERE para filtrar los datos.
   */
  generarGraficoCultivosPorTipo(layer: FeatureLayer, whereClause: string = '1=1') {
    const pageSize = 2000;
    const conteo: Record<string, number> = {};

    const getAllCultivoData = async () => {
      const total = await layer.queryFeatureCount({ where: whereClause });
      let fetched = 0;

      while (fetched < total) {
        const result = await layer.queryFeatures({
          where: whereClause,
          outFields: ['tipo_cultivo'], // CAMBIO: 'cultivo' -> 'tipo_cultivo'
          returnGeometry: false,
          start: fetched,
          num: pageSize,
        });

        result.features.forEach((f) => {
          const cultivo = f.attributes['tipo_cultivo']; // CAMBIO: 'cultivo' -> 'tipo_cultivo'
          if (cultivo) conteo[cultivo] = (conteo[cultivo] || 0) + 1;
        });

        fetched += result.features.length;
      }

      this.conteoPorCultivo = conteo;
      const labels = Object.keys(conteo);
      const values = Object.values(conteo);
      this.totalRegistrosCultivos = values.reduce((acc, val) => acc + val, 0);

      const ctx = document.getElementById('graficoCultivoTipo') as HTMLCanvasElement;
      if (!ctx) return;

      this.charts.push(new Chart(ctx.getContext('2d')!, {
        type: 'pie',
        data: {
          labels,
          datasets: [
            {
              label: 'Registros por tipo de cultivo',
              data: values,
              backgroundColor: labels.map((cultivo) => {
                const c = cultivo.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                if (c.includes('cafe')) return '#a18262';
                if (c.includes('cacao')) return '#645650';
                return '#D3D3D3';
              }),
              borderColor: '#fff',
              borderWidth: 2,
              hoverOffset: 15,
            },
          ],
        },
        options: {
          responsive: true,
          animations: {
            rotate: { duration: 1200, easing: 'easeOutBounce' },
            scale: { duration: 800, easing: 'easeOutQuart' },
          },
          plugins: {
            legend: {
              position: 'right',
              labels: { color: '#333', font: { size: 13, weight: 'bold' } },
            },
            title: { display: true, text: 'Cantidad de registros por tipo de cultivo', font: { size: 18 } },
            datalabels: {
              color: '#fff',
              font: { weight: 'bold' },
              formatter: (value: number, context) => {
                const total = (context.chart.data.datasets[0].data as number[]).reduce((acc, val) => acc + val, 0);
                return ((value / total) * 100).toFixed(1) + '%';
              },
            },
          },
        },
        plugins: [pie3DPlugin, ChartDataLabels],
      }));
    };

    getAllCultivoData();
  }

  // Grafico de barra por cantidad de familias por Oficina Zonal - Cacao
  /**
   * @method crearGraficoCantidadFamiliasOZCacao
   * @description
   * Crea un gráfico de barras horizontales que muestra el número de familias participantes (DNIs únicos)
   * que tienen cultivos de Cacao, agrupado por Oficina Zonal.
   * @param {string} whereClause - La cláusula WHERE para filtrar los datos por año.
   * @async
   */
  async crearGraficoCantidadFamiliasOZCacao(whereClause: string = '1=1') {
    const ctx = document.getElementById('graficoCantidadDNIOZCACAO') as HTMLCanvasElement;
    if (!ctx) return;

    const featureLayer = new FeatureLayer({ url: this.PROXY_MAP_BASE });
    const finalWhereClause = `tipo_cultivo='CACAO' AND ${whereClause}`;
    const dnisPorOficina: Record<string, Set<string>> = {};
    const pageSize = 2000;

    try {
      const total = await featureLayer.queryFeatureCount({ where: finalWhereClause });
      let fetched = 0;

      while (fetched < total) {
        const result = await featureLayer.queryFeatures({
          where: finalWhereClause,
          outFields: ['oficina_zonal', 'dni_participante'],
          returnGeometry: false,
          start: fetched,
          num: pageSize,
        });

        if (!result.features.length) {
          break;
        }

        result.features.forEach(feature => {
          const org = feature.attributes.oficina_zonal;
          const dni = feature.attributes.dni_participante;
          if (org && dni) {
            if (!dnisPorOficina[org]) {
              dnisPorOficina[org] = new Set<string>();
            }
            dnisPorOficina[org].add(dni);
          }
        });

        fetched += result.features.length;
      }

      if (Object.keys(dnisPorOficina).length === 0) {
        this.mostrarMensajeEnCanvas(ctx, 'No hay datos de familias (Cacao) por Oficina Zonal.');
        return;
      }

      const agrupado: Record<string, number> = {};
      for (const org in dnisPorOficina) {
        agrupado[org] = dnisPorOficina[org].size;
      }

      const entries = Object.entries(agrupado).sort((a, b) => b[1] - a[1]);
      const labels = entries.map(e => e[0]);
      const values = entries.map(e => e[1]);

      // 🔹 Colores por ORG
      const colorMap: Record<string, string> = {
      'SAN FRANCISCO': '#FEEFD8',
      'JAEN': '#FFBEBE',
      'PUCALLPA': '#B7D9FE',
      'LA MERCED': '#FFC0B6',
      'TINGO MARIA': '#D6F9FD',
      'TARAPOTO': '#C2BBFE',
      'SAN JUAN DE ORO': '#FED2F3',
      'QUILLABAMBA': '#FEFEB9',
      'IQUITOS': '#CAFEDA',
    };

      const backgroundColors = labels.map(org => colorMap[org] || '#cccccc');

    this.charts.push(new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Participantes unicos con CACAO',
            data: values,
            backgroundColor: backgroundColors,
            borderColor: '#4A5568',
            borderWidth: 2,
            barThickness: 25,
            maxBarThickness: 50,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: {
          padding: {
            bottom: 5, // Espacio para que el efecto 3D no se corte en el borde.
          }
        },
        indexAxis: 'y',
        scales: {
          x: {
            beginAtZero: true,
            max:10000,
            ticks: {
              callback: (value) =>
                `${Number(value).toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
            },
          },
          y: {
            ticks: {
              font: { size: 12, weight: 'bold' },
            },
          },
        },
        plugins: {
          title: {
            display: true,
            text: 'FAMILIAS PARTICIPANTES CACAO',
            font: { size: 18, weight: 'bold' },
            color: '#333',
            padding: { top: 10, bottom: 20 }
          },
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) =>
                `${Number(ctx.raw).toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} participantes`,
            },
          },
          datalabels: {
            anchor: 'end',
            align: 'right',
            color: '#000',
            font: { weight: 'bold', size: 12 },
            formatter: (v: number) =>
              `${Number(v).toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
          },
        },
      },
      plugins: [pseudo3DPlugin, ChartDataLabels],
    }));
    } catch (error) {
      //console.error('Error al crear gráfico de familias (Cacao) por OZ:', error);
      this.mostrarMensajeEnCanvas(ctx, 'Error al cargar los datos del gráfico.');
    }
  }

  //Participantes por oficina Zonal
  /**
   * @method crearGraficoCantidadFamiliasOZCafe
   * @description
   * Crea un gráfico de barras horizontales que muestra el número de familias participantes (DNIs únicos)
   * que tienen cultivos de Café, agrupado por Oficina Zonal.
   * @param {string} whereClause - La cláusula WHERE para filtrar los datos por año.
   * @async
   */
  async crearGraficoCantidadFamiliasOZCafe(whereClause: string = '1=1') {
    const ctx = document.getElementById('graficoCantidadDNIOZCAFE') as HTMLCanvasElement;
    if (!ctx) return;

    const featureLayer = new FeatureLayer({ url: this.PROXY_MAP_BASE });
    const finalWhereClause = `tipo_cultivo='CAFE' AND ${whereClause}`;
    const dnisPorOficina: Record<string, Set<string>> = {};
    const pageSize = 2000;

    try {
      const total = await featureLayer.queryFeatureCount({ where: finalWhereClause });
      let fetched = 0;

      while (fetched < total) {
        const result = await featureLayer.queryFeatures({
          where: finalWhereClause,
          outFields: ['oficina_zonal', 'dni_participante'],
          returnGeometry: false,
          start: fetched,
          num: pageSize,
        });

        if (!result.features.length) {
          break;
        }

        result.features.forEach(feature => {
          const org = feature.attributes.oficina_zonal;
          const dni = feature.attributes.dni_participante;
          if (org && dni) {
            if (!dnisPorOficina[org]) {
              dnisPorOficina[org] = new Set<string>();
            }
            dnisPorOficina[org].add(dni);
          }
        });

        fetched += result.features.length;
      }

      if (Object.keys(dnisPorOficina).length === 0) {
        this.mostrarMensajeEnCanvas(ctx, 'No hay datos de familias (Café) por Oficina Zonal.');
        return;
      }

      const agrupado: Record<string, number> = {};
      for (const org in dnisPorOficina) {
        agrupado[org] = dnisPorOficina[org].size;
      }

      const entries = Object.entries(agrupado).sort((a, b) => b[1] - a[1]);
      const labels = entries.map(e => e[0]);
      const values = entries.map(e => e[1]);

      // 🔹 Colores por ORG
      const colorMap: Record<string, string> = {
      'SAN FRANCISCO': '#FEEFD8',
      'JAEN': '#FFBEBE',
      'PUCALLPA': '#B7D9FE',
      'LA MERCED': '#FFC0B6',
      'TINGO MARIA': '#D6F9FD',
      'TARAPOTO': '#C2BBFE',
      'SAN JUAN DE ORO': '#FED2F3',
      'QUILLABAMBA': '#FEFEB9',
      'IQUITOS': '#CAFEDA',
    };

      const backgroundColors = labels.map(org => colorMap[org] || '#cccccc');

    this.charts.push(new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Participantes únicos con CAFE',
            data: values,
            backgroundColor: backgroundColors,
            borderColor: '#4A5568',
            borderWidth: 2,
            barThickness: 25,
            maxBarThickness: 50,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: {
          padding: {
            bottom: 5, // Espacio para que el efecto 3D no se corte en el borde.
          }
        },
        indexAxis: 'y',
        scales: {
          x: {
            beginAtZero: true,
            max:10000,
            ticks: {
              callback: (value) =>
                `${Number(value).toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
            },
          },
          y: {
            ticks: {
              font: { size: 12, weight: 'bold' },
            },
          },
        },
        plugins: {
          title: {
            display: true,
            text: 'FAMILIAS PARTICIPANTES CAFÉ',
            font: { size: 18, weight: 'bold' },
            color: '#333',
            padding: { top: 10, bottom: 20 }
          },
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) =>
                `${Number(ctx.raw).toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} participantes`,
            },
          },
          datalabels: {
            anchor: 'end',
            align: 'right',
            color: '#000',
            font: { weight: 'bold', size: 12 },
            formatter: (v: number) =>
              `${Number(v).toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
          },
        },
      },
      plugins: [pseudo3DPlugin, ChartDataLabels],
    }));
    } catch (error) {
      //console.error('Error al crear gráfico de familias (Café) por OZ:', error);
      this.mostrarMensajeEnCanvas(ctx, 'Error al cargar los datos del gráfico.');
    }
  }


  //Grafico por poligonos de cultivos de cacao por Oficina Zonal
  /**
   * @method crearGraficoCantidadPoligonosOZCacao
   * @description
   * Crea un gráfico de barras horizontales que muestra la cantidad de polígonos de Cacao
   * agrupados por Oficina Zonal.
   * @param {string} whereClause - La cláusula WHERE para filtrar los datos por año.
   * @async
   */
  async crearGraficoCantidadPoligonosOZCacao(whereClause: string = '1=1') {
    const ctx = document.getElementById('graficoCantidadOZCACAO') as HTMLCanvasElement;
    if (!ctx) return;

    const featureLayer = new FeatureLayer({ url: this.PROXY_MAP_BASE });
    const finalWhereClause = `tipo_cultivo='CACAO' AND ${whereClause}`;
    const conteoPorOficina: Record<string, number> = {};
    const pageSize = 2000;

    try {
      const total = await featureLayer.queryFeatureCount({ where: finalWhereClause });
      let fetched = 0;

      while (fetched < total) {
        const result = await featureLayer.queryFeatures({
          where: finalWhereClause,
          outFields: ['oficina_zonal'],
          returnGeometry: false,
          start: fetched,
          num: pageSize,
        });

        if (!result.features.length) {
          break;
        }

        result.features.forEach(feature => {
          const org = feature.attributes.oficina_zonal;
          if (org) {
            conteoPorOficina[org] = (conteoPorOficina[org] || 0) + 1;
          }
        });

        fetched += result.features.length;
      }

      if (Object.keys(conteoPorOficina).length === 0) {
        this.mostrarMensajeEnCanvas(ctx, 'No hay datos de polígonos de Cacao.');
        return;
      }

      const entries = Object.entries(conteoPorOficina).sort((a, b) => b[1] - a[1]);
      const labels = entries.map(e => e[0]);
      const values = entries.map(e => e[1]);

    // 🔹 Colores por ORG
    const colorMap: Record<string, string> = {
      'SAN FRANCISCO': '#FEEFD8',
      'JAEN': '#FFBEBE',
      'PUCALLPA': '#B7D9FE',
      'LA MERCED': '#FFC0B6',
      'TINGO MARIA': '#D6F9FD',
      'TARAPOTO': '#C2BBFE',
      'SAN JUAN DE ORO': '#FED2F3',
      'QUILLABAMBA': '#FEFEB9',
      'IQUITOS': '#CAFEDA',
    };

    const backgroundColors = labels.map(org => colorMap[org] || '#cccccc');

    this.charts.push(new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Cantidad de polígonos de CACAO',
            data: values,
            backgroundColor: backgroundColors,
            borderColor: '#4A5568',
            borderWidth: 2,
            barThickness: 25,
            maxBarThickness: 50,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: {
          padding: {
            bottom: 5, // Espacio para que el efecto 3D no se corte en el borde.
          }
        },
        indexAxis: 'y',
        scales: {
          x: {
            beginAtZero: true,
            max:10000,
            ticks: {
              callback: (value) =>
                `${Number(value).toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
            },
          },
          y: {
            ticks: {
              font: { size: 12, weight: 'bold' },
            },
          },
        },
        plugins: {
          title: {
            display: true,
            text: 'POLÍGONOS DE CACAO',
            font: { size: 18, weight: 'bold' },
            color: '#333',
            padding: { top: 10, bottom: 20 }
          },
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) =>
                `${Number(ctx.raw).toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} polígonos`,
            },
          },
          datalabels: {
            anchor: 'end',
            align: 'right',
            color: '#000',
            font: { weight: 'bold', size: 12 },
            formatter: (v: number) =>
              `${Number(v).toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
          },
        },
      },
      plugins: [pseudo3DPlugin, ChartDataLabels],
    }));
    } catch (error) {
      //console.error('Error al crear gráfico de polígonos de Cacao:', error);
      this.mostrarMensajeEnCanvas(ctx, 'Error al cargar los datos del gráfico.');
    }
  }
  //Grafico por poligonos de cultivos de cafe por Oficina Zonal
  /**
   * @method crearGraficoCantidadPoligonosOZCafe
   * @description
   * Crea un gráfico de barras horizontales que muestra la cantidad de polígonos de Café
   * agrupados por Oficina Zonal.
   * @param {string} whereClause - La cláusula WHERE para filtrar los datos por año.
   * @async
   */
  async crearGraficoCantidadPoligonosOZCafe(whereClause: string = '1=1') {
    const ctx = document.getElementById('graficoCantidadOZCAFE') as HTMLCanvasElement;
    if (!ctx) return;

    const featureLayer = new FeatureLayer({ url: this.PROXY_MAP_BASE });
    const finalWhereClause = `tipo_cultivo='CAFE' AND ${whereClause}`;
    const conteoPorOficina: Record<string, number> = {};
    const pageSize = 2000;

    try {
      const total = await featureLayer.queryFeatureCount({ where: finalWhereClause });
      let fetched = 0;

      while (fetched < total) {
        const result = await featureLayer.queryFeatures({
          where: finalWhereClause,
          outFields: ['oficina_zonal'],
          returnGeometry: false,
          start: fetched,
          num: pageSize,
        });

        if (!result.features.length) {
          break;
        }

        result.features.forEach(feature => {
          const org = feature.attributes.oficina_zonal;
          if (org) {
            conteoPorOficina[org] = (conteoPorOficina[org] || 0) + 1;
          }
        });

        fetched += result.features.length;
      }

      if (Object.keys(conteoPorOficina).length === 0) {
        this.mostrarMensajeEnCanvas(ctx, 'No hay datos de polígonos de Café.');
        return;
      }

      const entries = Object.entries(conteoPorOficina).sort((a, b) => b[1] - a[1]);
      const labels = entries.map(e => e[0]);
      const values = entries.map(e => e[1]);

    // 🔹 Colores por ORG
    const colorMap: Record<string, string> = {
      'SAN FRANCISCO': '#FEEFD8',
      'JAEN': '#FFBEBE',
      'PUCALLPA': '#B7D9FE',
      'LA MERCED': '#FFC0B6',
      'TINGO MARIA': '#D6F9FD',
      'TARAPOTO': '#C2BBFE',
      'SAN JUAN DE ORO': '#FED2F3',
      'QUILLABAMBA': '#FEFEB9',
      'IQUITOS': '#CAFEDA',
    };

    const backgroundColors = labels.map(org => colorMap[org] || '#cccccc');

    this.charts.push(new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Cantidad de polígonos de CAFÉ',
            data: values,
            backgroundColor: backgroundColors,
            borderColor: '#4A5568',
            borderWidth: 2,
            barThickness: 25,
            maxBarThickness: 50,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: {
          padding: {
            bottom: 5, // Espacio para que el efecto 3D no se corte en el borde.
          }
        },
        indexAxis: 'y',
        scales: {
          x: {
            beginAtZero: true,
            max:10000,
            ticks: {
              callback: (value) =>
                `${Number(value).toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
            },
          },
          y: {
            ticks: {
              font: { size: 12, weight: 'bold' },
            },
          },
        },
        plugins: {
          title: {
            display: true,
            text: 'POLÍGONOS DE CAFÉ',
            font: { size: 18, weight: 'bold' },
            color: '#333',
            padding: { top: 10, bottom: 20 }
          },
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) =>
                `${Number(ctx.raw).toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} polígonos`,
            },
          },
          datalabels: {
            anchor: 'end',
            align: 'right',
            color: '#000',
            font: { weight: 'bold', size: 12 },
            formatter: (v: number) =>
              `${Number(v).toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
          },
        },
      },
      plugins: [pseudo3DPlugin, ChartDataLabels],
    }));
    } catch (error) {
      //console.error('Error al crear gráfico de polígonos de Café:', error);
      this.mostrarMensajeEnCanvas(ctx, 'Error al cargar los datos del gráfico.');
    }
  }

  /**
   * @method crearGraficoPorDepartamento
   * @description
   * Crea un gráfico de barras que muestra la cantidad de registros (polígonos)
   * agrupados por departamento.
   * @param {string} whereClause - La cláusula WHERE para filtrar los datos por año.
   * @async
   */
  async crearGraficoPorDepartamento(whereClause: string = '1=1') {
    const ctx = document.getElementById('graficoPorDepartamento') as HTMLCanvasElement;
    if (!ctx) return;

    const featureLayer = new FeatureLayer({ url: this.PROXY_MAP_BASE });
    const conteoPorDepto: Record<string, number> = {};
    const pageSize = 2000;

    try {
      const total = await featureLayer.queryFeatureCount({ where: whereClause });
      let fetched = 0;

      while (fetched < total) {
        const result = await featureLayer.queryFeatures({
          where: whereClause,
          outFields: ['departamento'],
          returnGeometry: false,
          start: fetched,
          num: pageSize,
        });

        if (!result.features.length) {
          break;
        }

        result.features.forEach(feature => {
          const depto = feature.attributes.departamento;
          if (depto) {
            conteoPorDepto[depto] = (conteoPorDepto[depto] || 0) + 1;
          }
        });

        fetched += result.features.length;
      }

      if (Object.keys(conteoPorDepto).length === 0) {
        this.mostrarMensajeEnCanvas(ctx, 'No hay datos disponibles para mostrar.');
        return;
      }

      const entries = Object.entries(conteoPorDepto).sort((a, b) => b[1] - a[1]);
      const labels = entries.map(e => e[0]);
      const values = entries.map(e => e[1]);

      // 🔹 Colores por Departamento para mejorar la visualización
      const colorMap: Record<string, string> = {
        'CUSCO': '#FEEFD8',
        'SAN MARTIN': '#FFBEBE',
        'HUANUCO': '#B7D9FE',
        'JUNIN': '#FFC0B6',
        'UCAYALI': '#D6F9FD',
        'PUNO': '#C2BBFE',
        'AYACUCHO': '#FED2F3',
        'PASCO': '#FEFEB9',
        'LORETO': '#CAFEDA',
        'CAJAMARCA': '#E2F0CB',
        'AMAZONAS': '#FF9AA2',
        'MADRE DE DIOS': '#E0BBE4'
      };
      const backgroundColors = labels.map(dept => colorMap[dept] || '#88B268');

      this.charts.push(new Chart(ctx, {
        type: 'bar', // Gráfico de barras verticales
        data: {
          labels,
          datasets: [
            {
              label: 'Registros por Departamento',
              data: values,
              backgroundColor: backgroundColors,
              borderColor: '#6A8A50',
              borderWidth: 2,
              barThickness: 50,      // Ancho fijo para evitar que ocupen todo el espacio
              maxBarThickness: 80,   // Ancho máximo permitido
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          layout: {
            padding: {
              right: 5, // Espacio para que el efecto 3D no se corte en el borde.
              bottom: 5
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              max: 15000,
              ticks: {
                font: { size: 12, weight: 'bold' },
              },
            },
            x: {
              ticks: {
                font: { size: 12, weight: 'bold' },
              },
            },
          },
          plugins: {
            title: {
              display: false, // El título ahora se muestra en el HTML
            },
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => {
                  const value = ctx.raw as number;
                  return `${Number(value).toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} registros`;
                },
              },
            },
            datalabels: {
              anchor: 'end',
              align: 'top',
              color: '#000',
              font: { weight: 'bold', size: 12 },
              formatter: (v: number) =>
                `${Number(v).toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
            },
          },
        },
      plugins: [pseudo3DPlugin, ChartDataLabels],
      }));
    } catch (error) {
      this.mostrarMensajeEnCanvas(ctx, 'Error al cargar los datos del gráfico.');
    }
  }

  /**
   * @method startDashboardTour
   * @description
   * Inicia un tour guiado por la página del dashboard utilizando driver.js.
   */
  public startDashboardTour(): void {
    const driverObj = driver({
      showProgress: true,
      nextBtnText: 'Siguiente →',
      prevBtnText: '← Anterior',
      doneBtnText: 'Finalizar',
      steps: [
        {
          element: '#dashboard-title',
          popover: {
            title: 'Bienvenido al Dashboard',
            description: 'Este es el centro de control estadístico. Aquí puedes ver el progreso de las metas y los datos recopilados.'
          }
        },
        {
          element: '#year-selector-container',
          popover: {
            title: 'Filtro por Año',
            description: 'Usa este selector para filtrar toda la información del dashboard por un año específico o ver el acumulado de "Todos" los años.'
          }
        },
        {
          element: '#hectareas-section',
          popover: {
            title: 'Sección de Hectáreas',
            description: 'Aquí encontrarás un resumen del avance en hectáreas de Cacao y Café, comparado con la meta anual.'
          }
        },
        {
          element: '#familias-section',
          popover: {
            title: 'Sección de Familias Participantes',
            description: 'Visualiza el número de familias involucradas en los cultivos, su distribución y el avance frente a la meta.'
          }
        },
        {
          element: '#poligonos-section',
          popover: {
            title: 'Sección de Polígonos',
            description: 'Consulta la cantidad total de polígonos (registros) de Cacao y Café que han sido levantados.'
          }
        },
        {
          element: '#departamento-section',
          popover: {
            title: 'Distribución por Departamento',
            description: 'Este gráfico muestra cómo se distribuyen los polígonos registrados a lo largo de los diferentes departamentos del país.'
          }
        }
      ]
    });

    driverObj.drive();
  }

  // --- Funcionalidad del Modal de Reporte ---

  /**
   * @method showCafeYCacaoReport
   * @description
   * Inicia la carga de datos y muestra el modal con el reporte de participantes
   * que tienen cultivos de Cacao y Café.
   * @async
   */
  public async showCafeYCacaoReport(): Promise<void> {
    this.isModalVisible = true;
    this.isModalLoading = true;
    try {
      const layer = new FeatureLayer({ url: this.PROXY_MAP_BASE });
      const yearFilter = this.selectedYear === 0 ? '1=1' : `EXTRACT(YEAR FROM fecha_levantamiento) = ${this.selectedYear}`;
      this.modalData = await this.getCafeYCacaoParticipantsDetails(layer, yearFilter);
    } catch (error) {
    } finally {
      this.isModalLoading = false;
    }
  }

  /**
   * @method getCafeYCacaoParticipantsDetails
   * @description
   * Obtiene la lista detallada de los registros de participantes que tienen tanto cultivos de Cacao como de Café.
   * @param {FeatureLayer} layer - La capa de features a consultar.
   * @param {string} whereClause - El filtro WHERE para la consulta (ej. por año).
   * @returns {Promise<any[]>} Una promesa que resuelve a un array con los atributos de los participantes.
   * @private
   * @async
   */
  private async getCafeYCacaoParticipantsDetails(layer: FeatureLayer, whereClause: string): Promise<any[]> {
    // Paso 1: Obtener los DNIs de los participantes en ambos cultivos (lógica similar a contarRegistrosUnicosPorDNI)
    const pageSize = 2000;
    const dnisPorCultivo: Record<string, Set<string>> = { cafe: new Set<string>(), cacao: new Set<string>() };
    const total = await layer.queryFeatureCount({ where: whereClause });
    let fetched = 0;

    while (fetched < total) {
      const result = await layer.queryFeatures({
        where: whereClause,
        outFields: ['dni_participante', 'tipo_cultivo'],
        returnGeometry: false,
        start: fetched,
        num: pageSize,
      });

      result.features.forEach((f) => {
        const dni = f.attributes['dni_participante'];
        if (!dni) return;
        const cultivoRaw = (f.attributes['tipo_cultivo'] || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
        if (cultivoRaw.includes('cafe')) dnisPorCultivo['cafe'].add(dni);
        if (cultivoRaw.includes('cacao')) dnisPorCultivo['cacao'].add(dni);
      });
      fetched += result.features.length;
    }

    const dnisEnAmbos = [...dnisPorCultivo['cafe']].filter((dni) => dnisPorCultivo['cacao'].has(dni));

    if (dnisEnAmbos.length === 0) {
      return []; // No hay participantes en ambos, devolvemos un array vacío.
    }

    // Paso 2: Consultar los detalles completos de esos DNI
    const dniListString = dnisEnAmbos.map(dni => `'${dni}'`).join(',');
    const finalWhereClause = `${whereClause} AND dni_participante IN (${dniListString})`;

    const query = layer.createQuery();
    query.where = finalWhereClause;
    query.outFields = ['dni_participante', 'nombres', 'codigo_plan', 'tipo_cultivo', 'fecha_levantamiento', 'oficina_zonal', 'departamento', 'provincia', 'distrito'];
    query.returnGeometry = false;
    query.orderByFields = ["nombres ASC", "tipo_cultivo ASC"];

    const detailedResult = await layer.queryFeatures(query);
    return detailedResult.features.map(f => f.attributes);
  }

  /** Cierra el modal de reporte y limpia sus datos. */
  public closeModal(): void {
    this.isModalVisible = false;
    this.modalData = [];
  }

  /**
   * @method exportToExcel
   * @description
   * Exporta los datos del modal a un archivo de Excel (.xlsx).
   */
  public exportToExcel(): void {
    if (!this.modalData.length) {
      return;
    }

    // Mapea los datos a un formato con cabeceras amigables
    const dataToExport = this.modalData.map(item => ({
      'DNI': item.dni_participante,
      'Nombres': item.nombres,
      'Código del Plan': item.codigo_plan,
      'Tipo de Cultivo': item.tipo_cultivo,
      'Fecha de Levantamiento': new Date(item.fecha_levantamiento).toLocaleDateString('es-PE'),
      'Oficina Zonal': item.oficina_zonal,
      'Departamento': item.departamento,
      'Provincia': item.provincia,
      'Distrito': item.distrito
    }));

    const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(dataToExport);
    const wb: XLSX.WorkBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Participantes');

    const year = this.selectedYear === 0 ? 'Todos' : this.selectedYear;
    XLSX.writeFile(wb, `reporte_cacao_y_cafe_${year}.xlsx`);
  }

  /**
   * @method exportToPDF
   * @description
   * Exporta los datos del modal a un archivo PDF.
   */
  public exportToPDF(): void {
    if (!this.modalData.length) {
      return;
    }

    const doc = new jsPDF({ orientation: 'landscape' });
    const head = [['DNI', 'Nombres', 'Plan', 'Cultivo', 'Fecha', 'Oficina', 'Dpto', 'Prov', 'Distrito']];
    const body = this.modalData.map(item => [
      item.dni_participante,
      item.nombres,
      item.codigo_plan,
      item.tipo_cultivo,
      new Date(item.fecha_levantamiento).toLocaleDateString('es-PE'),
      item.oficina_zonal,
      item.departamento,
      item.provincia,
      item.distrito
    ]);

    doc.text('Reporte: Participantes en Cacao y Café', 14, 15);
    autoTable(doc, { head, body, startY: 20, styles: { fontSize: 8 }, headStyles: { fillColor: [22, 160, 133] } });

    const year = this.selectedYear === 0 ? 'Todos' : this.selectedYear;
    doc.save(`reporte_cacao_y_cafe_${year}.pdf`);
  }

  /**
   * @method shareDashboardViaWhatsApp
   * @description
   * Construye y abre una URL de WhatsApp para compartir un enlace al dashboard actual.
   */
  public shareDashboardViaWhatsApp(): void {
    const yearText = this.selectedYear === 0 ? 'Acumulado' : `del año ${this.selectedYear}`;
    const message = `Hola, te comparto el dashboard de GeoCULTIVOS (${yearText}). Puedes verlo aquí: ${window.location.href}`;
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/?text=${encodedMessage}`;
    window.open(whatsappUrl, '_blank');
  }

  /**
   * @method exportDashboardToPDF
   * @description
   * Exporta una vista consolidada del dashboard a un archivo PDF.
   * Captura los elementos visuales clave (título, tarjetas, gráficos) como imágenes
   * y los organiza en un documento PDF de varias páginas.
   * @async
   */
  public async exportDashboardToPDF(): Promise<void> {
    this.isExportingPDF = true;

    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      const docWidth = doc.internal.pageSize.getWidth();
      const docHeight = doc.internal.pageSize.getHeight();
      const margin = 10;
      // Definir espacio para encabezado y pie de página
      const headerMargin = 15;
      const footerMargin = 15;
      const contentWidth = docWidth - margin * 2;
      let yPos = headerMargin + 5; // Posición Y inicial, con espacio extra para evitar superposición con el encabezado

      // --- Helper para añadir elementos al PDF y gestionar el salto de página ---
      const addElementToPdf = async (elementId: string) => {
        const element = document.getElementById(elementId);
        if (!element) {
          return;
        }

        // Usar fondo blanco para que los elementos se vean bien en el PDF
        const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
        const imgData = canvas.toDataURL('image/png');
        const imgWidth = canvas.width;
        const imgHeight = canvas.height;
        const ratio = imgWidth / imgHeight;
        const finalWidth = contentWidth;
        const finalHeight = finalWidth / ratio;

        if (yPos + finalHeight > docHeight - footerMargin) {
          doc.addPage();
          yPos = headerMargin; // Reiniciar yPos en nueva página
        }

        doc.addImage(imgData, 'PNG', margin, yPos, finalWidth, finalHeight);
        yPos += finalHeight + 5; // Espacio después del elemento
      };

      // --- Título del Reporte ---
      const title = `Reporte de Dashboard - ${this.selectedYear === 0 ? 'Acumulado' : this.selectedYear}`.toUpperCase();
      doc.setFontSize(18);
      doc.setTextColor(40, 40, 40);
      doc.text(title, docWidth / 2, yPos, { align: 'center' });
      yPos += 10; // Reducir el espacio después del título para compensar el ajuste inicial

      // --- Capturar y añadir cada sección del dashboard ---
      const elementIds = [
        'hectareas-section', 'graficoMeta', 'graficoMetaOZ',
        'familias-section', 'graficoMetaDNI', 'graficoMetaParticipantes',
        'graficoCantidadDNIOZCACAO', 'graficoCantidadDNIOZCAFE',
        'poligonos-section', 'graficoCantidadOZCACAO', 'graficoCantidadOZCAFE',
        'departamento-section'
      ];

      for (const id of elementIds) {
        await addElementToPdf(id);
      }

      // --- Añadir Encabezado y Pie de página ---
      const addHeaderAndFooter = (doc: jsPDF) => {
        const now = new Date();
        const dateTimeString = now.toLocaleString('es-PE', {
          year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit', second: '2-digit',
          hour12: false
        });

        const totalPages = doc.getNumberOfPages();
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();

        for (let i = 1; i <= totalPages; i++) {
          doc.setPage(i);

          // --- Encabezado ---
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(10);
          doc.setTextColor(100); // Gris oscuro
          doc.text('DIRECCION DE PROMOCION Y MONITOREO', margin, margin);
          doc.line(margin, margin + 2, pageWidth - margin, margin + 2);

          // --- Pie de página ---
          const footerLeftText = `EQUIPO-GIS/DPM/DEVIDA | Generado: ${dateTimeString}`;
          const pageInfo = `Página ${i} de ${totalPages}`;
          doc.setFontSize(8);
          doc.text(footerLeftText, margin, pageHeight - margin);
          doc.text(pageInfo, pageWidth - margin, pageHeight - margin, { align: 'right' });
        }
      };
      addHeaderAndFooter(doc);

      // --- Guardar el PDF ---
      doc.save(`reporte_dashboard_${this.selectedYear === 0 ? 'todos' : this.selectedYear}.pdf`);

    } catch (error) {
      // Aquí podrías añadir una notificación de error para el usuario.
    } finally {
      this.isExportingPDF = false;
    }
  }

  /**
   * @method mostrarMensajeEnCanvas
   * @description
   * Dibuja un mensaje de texto en el centro de un elemento canvas.
   * Útil para notificar al usuario cuando no hay datos o ha ocurrido un error.
   * @param {HTMLCanvasElement} canvas - El elemento canvas donde se dibujará el mensaje.
   * @param {string} mensaje - El texto que se mostrará.
   * @param {string} [color='#999'] - El color del texto.
   */
  private mostrarMensajeEnCanvas(canvas: HTMLCanvasElement, mensaje: string, color: string = '#999'): void {
    const context = canvas.getContext('2d');
    if (!context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.textAlign = 'center';
    context.fillStyle = color;
    context.font = '16px Arial';
    context.fillText(mensaje, canvas.width / 2, canvas.height / 2);
  }

  /**
   * @method retryConnection
   * @description Recarga la página para reintentar la conexión con el backend.
   */
  public retryConnection(): void {
    window.location.reload();
  }
}
