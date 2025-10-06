import { Component, AfterViewInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { SidemenuComponent } from '../../components/sidebarmenu/sidemenu.component';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import StatisticDefinition from '@arcgis/core/rest/support/StatisticDefinition.js';
import Chart from 'chart.js/auto';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { NavbarmenuComponent } from '../../components/navbarmenu/navbarmenu.component';
import { FooterComponent } from '../../components/footer/footer.component';


Chart.register(ChartDataLabels);

@Component({
  standalone: true,
  imports: [CommonModule, RouterModule, SidemenuComponent, NavbarmenuComponent, FooterComponent],
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
})
export class DashboardComponent implements AfterViewInit {
  private readonly SERVICIO_PIRDAIS = 'https://siscod.devida.gob.pe/server/rest/services/DPM_LIMITES_PIRDAIS/MapServer/0';
  private readonly QUERY_SERVICIO = `${this.SERVICIO_PIRDAIS}/query`;
  isMenuOpen = true;   // Estado inicial del menú
  isDesktop = false;   // Detecta si es pantalla grande
  public totalRegistrosCultivos = 0;
  public conteoPorCultivo: Record<string, number> = {};
  public totalCafe = 0;
  public totalCacao = 0;
  public totalAreaCultivo = 0; // en m²
  public areaPorCultivo: { cultivo: string; total_area: number }[] = [];
  public totalAreaCafe = 0;
  public totalAreaCacao = 0;
  private readonly METAS_HECTAREAS: { [key: number]: number } = {
    2024: 43364,
    2025: 5000,
  };
  private readonly METAS_FAMILIAS: { [key: number]: number } = {
    2024: 38313,
    2025: 6000,
  };
  public currentMetaFamilias: number = 0;
  public currentMetaHectareas: number = 0;
  public availableYears: number[] = [];
  public selectedYear: number = new Date().getFullYear();
  private charts: Chart[] = [];

  async ngAfterViewInit(): Promise<void> {
    const dashboardCultivos = new FeatureLayer({ url: this.SERVICIO_PIRDAIS });
    try {
        await dashboardCultivos.load();
        this.availableYears = await this.getAvailableYears(dashboardCultivos);
        if (this.availableYears.includes(2025)) {
            this.selectedYear = 2025; // Selecciona 2025 por defecto
        } else if (this.availableYears.length > 0) {
            this.selectedYear = this.availableYears[0]; // Fallback al año más reciente
        }
        await this.loadDashboardData();
    } catch (err) {
        console.error('Error durante la inicialización del dashboard:', err);
    }
  }

  async getAvailableYears(layer: FeatureLayer): Promise<number[]> {
    // De acuerdo a la solicitud, ahora usamos una lista fija de años del 2024 al 2030.
    const years = [];
    for (let year = 2030; year >= 2024; year--) {
      years.push(year);
    }
    // El parámetro 'layer' ya no se usa, pero se mantiene por consistencia en la firma del método.
    return Promise.resolve(years);
  }

  public onYearChange(event: Event) {
    const selectElement = event.target as HTMLSelectElement;
    this.selectedYear = Number(selectElement.value);
    this.loadDashboardData();
  }

  private clearCharts(): void {
    this.charts.forEach(chart => chart.destroy());
    this.charts = [];
  }

  async loadDashboardData(): Promise<void> {
    this.clearCharts();
    this.currentMetaHectareas = this.METAS_HECTAREAS[this.selectedYear] || 0;
    this.currentMetaFamilias = this.METAS_FAMILIAS[this.selectedYear] || 0;

    const dashboardCultivos = new FeatureLayer({ url: this.SERVICIO_PIRDAIS });
    const yearFilter = `EXTRACT(YEAR FROM fecha_levantamiento) = ${this.selectedYear}`;

    try {
        const [totalArea, cafeCacao, areaPorCultivo, totalDNIResult] = await Promise.all([
            this.sumarAreaCultivoTotal(dashboardCultivos, yearFilter),
            this.contarCafeCacao(dashboardCultivos, yearFilter),
            this.sumarAreaPorCultivo(dashboardCultivos, yearFilter),
            this.contarRegistrosUnicosPorDNI(dashboardCultivos, yearFilter),
        ]);
        this.totalAreaCultivo = totalArea;
        this.totalCafe = cafeCacao.cafe;
        this.totalCacao = cafeCacao.cacao;
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
        this.generarGraficoCultivosPorTipo(dashboardCultivos, yearFilter);

    } catch (err) {
        console.error(`Error al cargar datos para el año ${this.selectedYear}:`, err);
    }
  }

  //Tarjetas sobre la Meta & Avance
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
      console.error('❌ Error al calcular suma de área:', err);
      return 0;
    }
  }
  async sumarAreaPorCultivo(layer: FeatureLayer, whereClause: string = '1=1'): Promise<any[]> {
    const statDef = new StatisticDefinition({
      onStatisticField: 'area_cultivo',
      outStatisticFieldName: 'total_area',
      statisticType: 'sum',
    });

    const query = layer.createQuery();
    query.where = whereClause;
    query.outStatistics = [statDef];
    query.groupByFieldsForStatistics = ['tipo_cultivo'];
    query.returnGeometry = false;

    try {
      const result = await layer.queryFeatures(query);

      const data = result.features.map((f) => ({
        cultivo: f.attributes['tipo_cultivo'],
        total_area: f.attributes['total_area'],
      }));

      // Guardar áreas de café y cacao
      data.forEach((c) => {
        const nombre = c.cultivo.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        if (nombre.includes('cafe')) this.totalAreaCafe = c.total_area;
        if (nombre.includes('cacao')) this.totalAreaCacao = c.total_area;
      });

      return data;
    } catch (err) {
      console.error('❌ Error al calcular área por cultivo:', err);
      this.totalAreaCafe = 0;
      this.totalAreaCacao = 0;
      return [];
    }
  }
  //Grafico sobre la Meta & Avance
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
              '#2c9c7d ', // azul
              '#f9edbc'   // verde claro/transparente
            ],
            borderColor: ['#075A73', '#085A25'],
            borderWidth: 2
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
                // CAMBIO: Se asegura de usar 0 decimales para el valor
                return `${context.label}: ${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
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
              // CAMBIO: Se asegura de usar 1 decimal para el porcentaje
              return `${porcentaje.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
            }
          }
        }
      },
      plugins: [ChartDataLabels]
    }));
  }
  //Grafico sobre la Meta por Oficina Zonal
  async crearGraficoProgresoporHectareasOZ(whereClause: string = '1=1') {
    const baseUrl = this.QUERY_SERVICIO;
    interface Cultivo {
      org: string;
      area_cultivo: number;
    }
    let allFeatures: any[] = [];
    let offset = 0;
    const pageSize = 2000;
    let hasMore = true;

    while (hasMore) {
      const url =
        `${baseUrl}?where=${encodeURIComponent(whereClause)}&outFields=oficina_zonal,area_cultivo` +
        `&returnGeometry=false&f=json&resultRecordCount=${pageSize}&resultOffset=${offset}`;

      const res = await fetch(url);
      const data = await res.json();
      if (data.features?.length) {
        allFeatures = allFeatures.concat(data.features);
        offset += pageSize;
        hasMore = data.features.length === pageSize;
      } else {
        hasMore = false;
      }
    }
    const rawData: Cultivo[] = allFeatures.map((feat: any) => ({
      org: feat.attributes.oficina_zonal,
      area_cultivo: feat.attributes.area_cultivo,
    }));
    // Agrupamos por Oficina Zonal
    const agrupado: Record<string, number> = {};
    rawData.forEach((item: Cultivo) => {
      agrupado[item.org] = (agrupado[item.org] || 0) + item.area_cultivo;
    });
    // 🔹 Ordenar de mayor a menor
    const entries = Object.entries(agrupado).sort((a, b) => b[1] - a[1]);
    const labels = entries.map(e => e[0]);
    const values = entries.map(e => e[1]);

    // 🔹 Colores por Oficina Zonal
    const colorMap: Record<string, string> = {
      'OZ SAN FRANCISCO': '#FEEFD8',
      'OZ PUCALLPA': '#B7D9FE',
      'OZ LA MERCED': '#FFC0B6',
      'OZ TINGO MARIA': '#D6F9FD',
      'OZ TARAPOTO': '#C2BBFE',
      'OZ SAN JUAN DE ORO': '#FED2F3',
      'OZ QUILLABAMBA': '#FEFEB9',
      'OZ IQUITOS': '#CAFEDA',
    };
    const backgroundColors = labels.map(org => colorMap[org] || '#cccccc');
    const borderColors = backgroundColors.map(c => c);
    const ctx = document.getElementById('graficoMetaOZ') as HTMLCanvasElement;
    if (!ctx) return;

    this.charts.push(new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Área cultivada (ha)',
            data: values,
            backgroundColor: backgroundColors,
            borderColor: borderColors,
            borderWidth: 1,
            barThickness: 25,
            maxBarThickness: 50,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        scales: {
          x: {
            min: 0,
            max: 20000,
            beginAtZero: true,
            ticks: {
              callback: (value) =>
                `${Number(value).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
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
            text: 'AVANCE: HECTAREAS (CACAO & CAFE)',
            font: { size: 18, weight: 'bold' },
            color: '#333',
            padding: { top: 10, bottom: 20 }
          },
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const value = ctx.raw as number;
                return `${Number(value).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ha`;
              },
            },
          },
          datalabels: {
            anchor: 'end',
            align: 'right',
            color: '#000',
            font: { weight: 'bold', size: 12 },
            formatter: (v: number) =>
              `${Number(v).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ha`,
          },
        },
      },
      plugins: [ChartDataLabels],
    }));
  }

  //Grafico sobre la Meta por Oficina Zonal - CACAO
  async crearGraficoProgresoporHectareasOZCacao(whereClause: string = '1=1') {
    const baseUrl = this.QUERY_SERVICIO;

    interface Cultivo { org: string; area_cultivo: number; cultivo: string; }

    let allFeatures: any[] = [];
    let offset = 0;
    const pageSize = 2000;
    let hasMore = true;

    while (hasMore) {
      const finalWhere = `tipo_cultivo='CACAO' AND ${whereClause}`;
      const url =
        `${baseUrl}?where=${encodeURIComponent(finalWhere)}&outFields=oficina_zonal,area_cultivo,tipo_cultivo` +
        `&returnGeometry=false&f=json&resultRecordCount=${pageSize}&resultOffset=${offset}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.features?.length) {
        allFeatures = allFeatures.concat(data.features);
        offset += pageSize;
        hasMore = data.features.length === pageSize;
      } else {
        hasMore = false;
      }
    }

    const rawData: Cultivo[] = allFeatures.map(feat => ({
      org: feat.attributes.oficina_zonal, // CAMBIO: 'org' -> 'oficina_zonal'
      area_cultivo: feat.attributes.area_cultivo,
      cultivo: feat.attributes.tipo_cultivo, // CAMBIO: 'cultivo' -> 'tipo_cultivo'
    }));

    const agrupado: Record<string, number> = {};
    rawData.forEach(item => {
      if (item.cultivo === 'CACAO') {
        agrupado[item.org] = (agrupado[item.org] || 0) + item.area_cultivo;
      }
    });

    const entries = Object.entries(agrupado).sort((a, b) => b[1] - a[1]);
    const labels = entries.map(e => e[0]);
    const values = entries.map(e => e[1]);

    const metasOZ: Record<string, number> = {
      'OZ SAN FRANCISCO': 4824,
      'OZ PUCALLPA': 10154,
      'OZ LA MERCED': 5134,
      'OZ TINGO MARIA': 4629,
      'OZ TARAPOTO': 7383,
      'OZ SAN JUAN DE ORO': 1281,
      'OZ QUILLABAMBA': 0,
      'OZ IQUITOS': 505,
    };
    const metaValues = labels.map(org => metasOZ[org] ?? 0);

    const colorMap: Record<string, string> = {
      'OZ SAN FRANCISCO': '#FEEFD8',
      'OZ PUCALLPA': '#B7D9FE',
      'OZ LA MERCED': '#FFC0B6',
      'OZ TINGO MARIA': '#D6F9FD',
      'OZ TARAPOTO': '#C2BBFE',
      'OZ SAN JUAN DE ORO': '#FED2F3',
      'OZ QUILLABAMBA': '#FEFEB9',
      'OZ IQUITOS': '#CAFEDA',
    };
    const backgroundColors = labels.map(org => colorMap[org] || '#cccccc');
    const borderColors = backgroundColors.map(c => c);

    const ctx = document.getElementById('graficoMetaOZCACAO') as HTMLCanvasElement;
    if (!ctx) return;

    this.charts.push(new Chart(ctx, {
      type: 'bar', // ✅ barras verticales
      data: {
        labels,
        datasets: [
          {
            label: 'Área cultivada de CACAO (ha)',
            data: values,
            backgroundColor: backgroundColors,
            borderColor: borderColors,
            borderWidth: 1,
            barThickness: 25,
            maxBarThickness: 50,
            order: 1,
            datalabels: {
              anchor: 'end',
              align: 'end',
              color: '#000',
              font: { weight: 'bold', size: 12 },
              // CAMBIO: 'es-PE' -> 'en-US' y 2 decimales -> 0 decimales
              formatter: (v: number) =>
                `${v.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ha`,
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
                  // CAMBIO: 'es-PE' -> 'en-US' y 2 decimales -> 0 decimales
                  return `${Number(value).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ha`;
                }
                // CAMBIO: 'es-PE' -> 'en-US' y 2 decimales -> 0 decimales
                return `Meta: ${Number(meta).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ha`;
              },
            },
          },
        },
      },
      plugins: [ChartDataLabels],
    }));
  }
  //Grafico sobre la Meta por Oficina Zonal - CAFE
  async crearGraficoProgresoporHectareasOZCAFE(whereClause: string = '1=1') {
    const baseUrl = this.QUERY_SERVICIO;
    interface Cultivo { org: string; area_cultivo: number; cultivo: string; }
    let allFeatures: any[] = [];
    let offset = 0;
    const pageSize = 2000;
    let hasMore = true;

    while (hasMore) {
      const finalWhere = `tipo_cultivo='CAFE' AND ${whereClause}`;
      const url =
        `${baseUrl}?where=${encodeURIComponent(finalWhere)}&outFields=oficina_zonal,area_cultivo,tipo_cultivo` +
        `&returnGeometry=false&f=json&resultRecordCount=${pageSize}&resultOffset=${offset}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.features?.length) {
        allFeatures = allFeatures.concat(data.features);
        offset += pageSize;
        hasMore = data.features.length === pageSize;
      } else {
        hasMore = false;
      }
    }

    const rawData: Cultivo[] = allFeatures.map(feat => ({
      org: feat.attributes.oficina_zonal, // CAMBIO: 'org' -> 'oficina_zonal'
      area_cultivo: feat.attributes.area_cultivo,
      cultivo: feat.attributes.tipo_cultivo, // CAMBIO: 'cultivo' -> 'tipo_cultivo'
    }));

    const agrupado: Record<string, number> = {};
    rawData.forEach(item => {
      if (item.cultivo === 'CAFE') {
        agrupado[item.org] = (agrupado[item.org] || 0) + item.area_cultivo;
      }
    });

    const entries = Object.entries(agrupado).sort((a, b) => b[1] - a[1]);
    const labels = entries.map(e => e[0]);
    const values = entries.map(e => e[1]);

    const metasOZ: Record<string, number> = {
      'OZ SAN FRANCISCO': 2344,
      'OZ PUCALLPA': 0,
      'OZ LA MERCED': 1973,
      'OZ TINGO MARIA': 2133,
      'OZ TARAPOTO': 688,
      'OZ SAN JUAN DE ORO': 1119,
      'OZ QUILLABAMBA': 1197,
      'OZ IQUITOS': 0,
    };
    const metaValues = labels.map(org => metasOZ[org] ?? 0);

    const colorMap: Record<string, string> = {
      'OZ SAN FRANCISCO': '#FEEFD8',
      'OZ PUCALLPA': '#B7D9FE',
      'OZ LA MERCED': '#FFC0B6',
      'OZ TINGO MARIA': '#D6F9FD',
      'OZ TARAPOTO': '#C2BBFE',
      'OZ SAN JUAN DE ORO': '#FED2F3',
      'OZ QUILLABAMBA': '#FEFEB9',
      'OZ IQUITOS': '#CAFEDA',
    };
    const backgroundColors = labels.map(org => colorMap[org] || '#cccccc');
    const borderColors = backgroundColors.map(c => c);

    const ctx = document.getElementById('graficoMetaOZCAFE') as HTMLCanvasElement;
    if (!ctx) return;

    this.charts.push(new Chart(ctx, {
      type: 'bar', // ✅ barras verticales
      data: {
        labels,
        datasets: [
          {
            label: 'Área cultivada de CAFE (ha)',
            data: values,
            backgroundColor: backgroundColors,
            borderColor: borderColors,
            borderWidth: 1,
            barThickness: 25,
            maxBarThickness: 50,
            order: 1,
            datalabels: {
              anchor: 'end',
              align: 'end',
              color: '#000',
              font: { weight: 'bold', size: 12 },
              // CAMBIO: 2 decimales -> 0 decimales
              formatter: (v: number) =>
                `${v.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ha`,
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
            text: 'OFICINA ZONAL / HECTÁREAS CAFE vs META',
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
                  // CAMBIO: 2 decimales -> 0 decimales
                  return `${Number(value).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ha`;
                }
                // CAMBIO: 2 decimales -> 0 decimales
                return `Meta: ${Number(meta).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ha`;
              },
            },
          },
        },
      },
      plugins: [ChartDataLabels],
    }));
  }



  //Grafico sobre total participantes
  public totalRegistrosUnicosDNI: Record<string, number> = {};
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
      console.error('❌ Error al contar DNIs únicos:', err);
      return 0;
    }
  }
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
            borderWidth: 2
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
                // CAMBIO: Se asegura de usar 0 decimales
                return `${context.label}: ${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
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
              // CAMBIO: Se asegura de usar 1 decimal para el porcentaje
              return `${porcentaje.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
            }
          }
        }
      },
      plugins: [ChartDataLabels]
    }));
  }

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
      console.error('❌ Error al contar registros únicos por DNI por cultivo:', err);
      this.totalRegistrosUnicosDNI = { cafe: 0, cacao: 0, cafe_y_cacao: 0, total: 0 };
      return { cafe: 0, cacao: 0, cafe_y_cacao: 0, total: 0 };
    }
  }
  async crearGraficoProgresoporFamiliasOZ(whereClause: string = '1=1') {
    const baseUrl = this.QUERY_SERVICIO;
    interface Participante {
      org: string;
      dni: string;
    }

    let allFeatures: any[] = [];
    let offset = 0;
    const pageSize = 2000;
    let hasMore = true;
    while (hasMore) {
      const url =
        `${baseUrl}?where=${encodeURIComponent(whereClause)}&outFields=oficina_zonal,dni_participante` +
        `&returnGeometry=false&f=json&resultRecordCount=${pageSize}&resultOffset=${offset}`;

      const res = await fetch(url);
      const data = await res.json();

      if (data.features?.length) {
        allFeatures = allFeatures.concat(data.features);
        offset += pageSize;
        hasMore = data.features.length === pageSize;
      } else {
        hasMore = false;
      }
    }

    const rawData: Participante[] = allFeatures.map((feat: any) => ({
      org: feat.attributes.oficina_zonal,
      dni: feat.attributes.dni_participante,
    }));

    // 🔹 Agrupar por Oficina Zonal y contar DNIs únicos
    const agrupado: Record<string, Set<string>> = {};
    rawData.forEach((item: Participante) => {
      if (!item.dni) return;
      if (!agrupado[item.org]) {
        agrupado[item.org] = new Set<string>();
      }
      agrupado[item.org].add(item.dni);
    });

    // Convertir los sets a números
    const entries = Object.entries(agrupado)
      .map(([org, dnis]) => [org, dnis.size] as [string, number])
      .sort((a, b) => b[1] - a[1]);

    const labels = entries.map(e => e[0]);
    const values = entries.map(e => e[1]);

    // 🔹 Colores por ORG (mapa de referencia)
    const colorMap: Record<string, string> = {
      'OZ SAN FRANCISCO': '#FEEFD8',
      'OZ PUCALLPA': '#B7D9FE',
      'OZ LA MERCED': '#FFC0B6',
      'OZ TINGO MARIA': '#D6F9FD',
      'OZ TARAPOTO': '#C2BBFE',
      'OZ SAN JUAN DE ORO': '#FED2F3',
      'OZ QUILLABAMBA': '#FEFEB9',
      'OZ IQUITOS': '#CAFEDA',
    };

    // Asignar colores según el ORG, si no existe usar gris
    const backgroundColors = labels.map(org => colorMap[org] || '#cccccc');
    const borderColors = backgroundColors.map(c => c);

    const ctx = document.getElementById('graficoMetaParticipantes') as HTMLCanvasElement;
    if (!ctx) return;

    this.charts.push(new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Participantes únicos (DNI)',
            data: values,
            backgroundColor: backgroundColors,
            borderColor: borderColors,
            borderWidth: 1,
            barThickness: 25,
            maxBarThickness: 50,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y', // barras horizontales
        scales: {
          x: {
            min: 0,
            max: 14000,
            beginAtZero: true,
            ticks: {
              // CAMBIO: 'es-PE' -> 'en-US' y 0 decimales
              callback: (value) =>
                `${Number(value).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
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
                // CAMBIO: 'es-PE' -> 'en-US' y 0 decimales
                return `${Number(value).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} participantes`;
              },
            },
          },
          datalabels: {
            anchor: 'end',
            align: 'right',
            color: '#000',
            font: { weight: 'bold', size: 12 },
            // CAMBIO: 'es-PE' -> 'en-US' y 0 decimales
            formatter: (v: number) =>
              `${Number(v).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
          },
        },
      },
      plugins: [ChartDataLabels],
    }));
  }

  //Grafico sobre total poligonos
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
      console.error('❌ Error al consultar CAFE y CACAO:', err);
      return { cafe: 0, cacao: 0 };
    });
  }
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
        plugins: [ChartDataLabels],
      }));
    };

    getAllCultivoData().catch((err) => console.error('❌ Error al consultar todos los cultivos:', err));
  }
  // Grafico de barra por cantidad de familias por Oficina Zonal - Cacao
  async crearGraficoCantidadFamiliasOZCacao(whereClause: string = '1=1') {
    const baseUrl = this.QUERY_SERVICIO;
    interface Cultivo {
      org: string;
      cultivo: string;
      dni: string;
    }

    let allFeatures: any[] = [];
    let offset = 0;
    const pageSize = 2000;
    let hasMore = true;

    // 🔹 Paginación para traer TODOS los registros SOLO de CACAO
    while (hasMore) {
      const finalWhere = `tipo_cultivo='CACAO' AND ${whereClause}`;
      const url =
        `${baseUrl}?where=${encodeURIComponent(finalWhere)}&outFields=oficina_zonal,tipo_cultivo,dni_participante` +
        `&returnGeometry=false&f=json&resultRecordCount=${pageSize}&resultOffset=${offset}`;

      const res = await fetch(url);
      const data = await res.json();

      if (data.features?.length) {
        allFeatures = allFeatures.concat(data.features);
        offset += pageSize;
        hasMore = data.features.length === pageSize;
      } else {
        hasMore = false;
      }
    }

    const rawData: Cultivo[] = allFeatures.map((feat: any) => ({
      org: feat.attributes.oficina_zonal, // CAMBIO: 'org' -> 'oficina_zonal'
      cultivo: feat.attributes.tipo_cultivo, // CAMBIO: 'cultivo' -> 'tipo_cultivo'
      dni: feat.attributes.dni_participante, // CAMBIO: 'dni' -> 'dni_participante'
    }));

    // 🔹 Contamos **DNI únicos** de CACAO por Oficina Zonal
    const agrupado: Record<string, Set<string>> = {};
    rawData.forEach((item: Cultivo) => {
      if (item.cultivo === 'CACAO' && item.dni) {
        if (!agrupado[item.org]) agrupado[item.org] = new Set<string>();
        agrupado[item.org].add(item.dni);
      }
    });

    // 🔹 Convertimos los sets a números y ordenamos
    const entries = Object.entries(agrupado)
      .map(([org, dnis]) => [org, dnis.size] as [string, number])
      .sort((a, b) => b[1] - a[1]);

    const labels = entries.map(e => e[0]);
    const values = entries.map(e => e[1]);

    // 🔹 Colores por ORG
    const colorMap: Record<string, string> = {
      'OZ SAN FRANCISCO': '#FEEFD8',
      'OZ PUCALLPA': '#B7D9FE',
      'OZ LA MERCED': '#FFC0B6',
      'OZ TINGO MARIA': '#D6F9FD',
      'OZ TARAPOTO': '#C2BBFE',
      'OZ SAN JUAN DE ORO': '#FED2F3',
      'OZ QUILLABAMBA': '#FEFEB9',
      'OZ IQUITOS': '#CAFEDA',
    };

    const backgroundColors = labels.map(org => colorMap[org] || '#cccccc');
    const borderColors = backgroundColors.map(c => c);

    const ctx = document.getElementById('graficoCantidadDNIOZCACAO') as HTMLCanvasElement;
    if (!ctx) return;

    this.charts.push(new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Participantes unicos con CACAO',
            data: values,
            backgroundColor: backgroundColors,
            borderColor: borderColors,
            borderWidth: 1,
            barThickness: 25,
            maxBarThickness: 50,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        scales: {
          x: {
            min:0,
            max: 10000,
            beginAtZero: true,
            ticks: {
              // CAMBIO: 'es-PE' -> 'en-US' y 0 decimales
              callback: (value) =>
                `${Number(value).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
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
              // CAMBIO: 'es-PE' -> 'en-US' y 0 decimales
              label: (ctx) =>
                `${Number(ctx.raw).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} participantes`,
            },
          },
          datalabels: {
            anchor: 'end',
            align: 'right',
            color: '#000',
            font: { weight: 'bold', size: 12 },
            // CAMBIO: 'es-PE' -> 'en-US' y 0 decimales
            formatter: (v: number) =>
              `${Number(v).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
          },
        },
      },
      plugins: [ChartDataLabels],
    }));
  }

  //Participantes por oficina Zonal
  async crearGraficoCantidadFamiliasOZCafe(whereClause: string = '1=1') {
    const baseUrl = this.QUERY_SERVICIO;
    interface Cultivo {
      org: string;
      cultivo: string;
      dni: string;
    }

    let allFeatures: any[] = [];
    let offset = 0;
    const pageSize = 2000;
    let hasMore = true;

    // 🔹 Paginación para traer TODOS los registros SOLO de CAFÉ
    while (hasMore) {
      const finalWhere = `tipo_cultivo='CAFE' AND ${whereClause}`;
      const url =
        `${baseUrl}?where=${encodeURIComponent(finalWhere)}&outFields=oficina_zonal,tipo_cultivo,dni_participante` +
        `&returnGeometry=false&f=json&resultRecordCount=${pageSize}&resultOffset=${offset}`;

      const res = await fetch(url);
      const data = await res.json();

      if (data.features?.length) {
        allFeatures = allFeatures.concat(data.features);
        offset += pageSize;
        hasMore = data.features.length === pageSize;
      } else {
        hasMore = false;
      }
    }

    const rawData: Cultivo[] = allFeatures.map((feat: any) => ({
      org: feat.attributes.oficina_zonal, // CAMBIO: 'org' -> 'oficina_zonal'
      cultivo: feat.attributes.tipo_cultivo, // CAMBIO: 'cultivo' -> 'tipo_cultivo'
      dni: feat.attributes.dni_participante, // CAMBIO: 'dni' -> 'dni_participante'
    }));

    // 🔹 Contamos **DNI únicos** de CAFÉ por Oficina Zonal
    const agrupado: Record<string, Set<string>> = {};
    rawData.forEach((item: Cultivo) => {
      if (item.cultivo === 'CAFE' && item.dni) {
        if (!agrupado[item.org]) agrupado[item.org] = new Set<string>();
        agrupado[item.org].add(item.dni);
      }
    });

    // 🔹 Convertimos los sets a números y ordenamos
    const entries = Object.entries(agrupado)
      .map(([org, dnis]) => [org, dnis.size] as [string, number])
      .sort((a, b) => b[1] - a[1]);

    const labels = entries.map(e => e[0]);
    const values = entries.map(e => e[1]);

    // 🔹 Colores por ORG
    const colorMap: Record<string, string> = {
      'OZ SAN FRANCISCO': '#FEEFD8',
      'OZ PUCALLPA': '#B7D9FE',
      'OZ LA MERCED': '#FFC0B6',
      'OZ TINGO MARIA': '#D6F9FD',
      'OZ TARAPOTO': '#C2BBFE',
      'OZ SAN JUAN DE ORO': '#FED2F3',
      'OZ QUILLABAMBA': '#FEFEB9',
      'OZ IQUITOS': '#CAFEDA',
    };

    const backgroundColors = labels.map(org => colorMap[org] || '#cccccc');
    const borderColors = backgroundColors.map(c => c);

    const ctx = document.getElementById('graficoCantidadDNIOZCAFE') as HTMLCanvasElement;
    if (!ctx) return;

    this.charts.push(new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Participantes únicos con CAFE',
            data: values,
            backgroundColor: backgroundColors,
            borderColor: borderColors,
            borderWidth: 1,
            barThickness: 25,
            maxBarThickness: 50,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        scales: {
          x: {
            min:0,
            max: 10000,
            beginAtZero: true,
            ticks: {
              // CAMBIO: 'es-PE' -> 'en-US' y 0 decimales
              callback: (value) =>
                `${Number(value).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
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
            text: 'FAMILIAS PARTICIPANTES CAFE',
            font: { size: 18, weight: 'bold' },
            color: '#333',
            padding: { top: 10, bottom: 20 }
          },
          legend: { display: false },
          tooltip: {
            callbacks: {
              // CAMBIO: 'es-PE' -> 'en-US' y 0 decimales
              label: (ctx) =>
                `${Number(ctx.raw).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} participantes`,
            },
          },
          datalabels: {
            anchor: 'end',
            align: 'right',
            color: '#000',
            font: { weight: 'bold', size: 12 },
            // CAMBIO: 'es-PE' -> 'en-US' y 0 decimales
            formatter: (v: number) =>
              `${Number(v).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
          },
        },
      },
      plugins: [ChartDataLabels],
    }));
  }


  //Grafico por poligonos de cultivos de cacao por Oficina Zonal
   async crearGraficoCantidadPoligonosOZCacao(whereClause: string = '1=1') {
    const baseUrl = this.QUERY_SERVICIO;
    interface Cultivo {
      org: string;
      cultivo: string;
    }

    let allFeatures: any[] = [];
    let offset = 0;
    const pageSize = 2000;
    let hasMore = true;

    // 🔹 Paginación para traer TODOS los registros SOLO de CACAO
    while (hasMore) {
      const finalWhere = `tipo_cultivo='CACAO' AND ${whereClause}`;
      const url =
        `${baseUrl}?where=${encodeURIComponent(finalWhere)}&outFields=oficina_zonal,tipo_cultivo` +
        `&returnGeometry=false&f=json&resultRecordCount=${pageSize}&resultOffset=${offset}`;

      const res = await fetch(url);
      const data = await res.json();

      if (data.features?.length) {
        allFeatures = allFeatures.concat(data.features);
        offset += pageSize;
        hasMore = data.features.length === pageSize;
      } else {
        hasMore = false;
      }
    }

    const rawData: Cultivo[] = allFeatures.map((feat: any) => ({
      org: feat.attributes.oficina_zonal, // CAMBIO: 'org' -> 'oficina_zonal'
      cultivo: feat.attributes.tipo_cultivo, // CAMBIO: 'cultivo' -> 'tipo_cultivo'
    }));

    // 🔹 Contamos registros de CACAO por Oficina Zonal
    const agrupado: Record<string, number> = {};
    rawData.forEach((item: Cultivo) => {
      if (item.cultivo === 'CACAO') {
        agrupado[item.org] = (agrupado[item.org] || 0) + 1;
      }
    });

    // 🔹 Ordenar de mayor a menor
    const entries = Object.entries(agrupado).sort((a, b) => b[1] - a[1]);
    const labels = entries.map(e => e[0]);
    const values = entries.map(e => e[1]);

    // 🔹 Colores por ORG
    const colorMap: Record<string, string> = {
      'OZ SAN FRANCISCO': '#FEEFD8',
      'OZ PUCALLPA': '#B7D9FE',
      'OZ LA MERCED': '#FFC0B6',
      'OZ TINGO MARIA': '#D6F9FD',
      'OZ TARAPOTO': '#C2BBFE',
      'OZ SAN JUAN DE ORO': '#FED2F3',
      'OZ QUILLABAMBA': '#FEFEB9',
      'OZ IQUITOS': '#CAFEDA',
    };

    const backgroundColors = labels.map(org => colorMap[org] || '#cccccc');
    const borderColors = backgroundColors.map(c => c);

    const ctx = document.getElementById('graficoCantidadOZCACAO') as HTMLCanvasElement;
    if (!ctx) return;

    this.charts.push(new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Cantidad de polígonos de CACAO',
            data: values,
            backgroundColor: backgroundColors,
            borderColor: borderColors,
            borderWidth: 1,
            barThickness: 25,
            maxBarThickness: 50,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        scales: {
          x: {
            min:0,
            max: 10000,
            beginAtZero: true,
            ticks: {
              // CAMBIO: 'es-PE' -> 'en-US' y 0 decimales
              callback: (value) =>
                `${Number(value).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
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
            text: 'POLIGONOS DE CACAO',
            font: { size: 18, weight: 'bold' },
            color: '#333',
            padding: { top: 10, bottom: 20 }
          },
          legend: { display: false },
          tooltip: {
            callbacks: {
              // CAMBIO: 'es-PE' -> 'en-US' y 0 decimales
              label: (ctx) =>
                `${Number(ctx.raw).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} polígonos`,
            },
          },
          datalabels: {
            anchor: 'end',
            align: 'right',
            color: '#000',
            font: { weight: 'bold', size: 12 },
            // CAMBIO: 'es-PE' -> 'en-US' y 0 decimales
            formatter: (v: number) =>
              `${Number(v).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
          },
        },
      },
      plugins: [ChartDataLabels],
    }));
  }
  //Grafico por poligonos de cultivos de cafe por Oficina Zonal
  async crearGraficoCantidadPoligonosOZCafe(whereClause: string = '1=1') {
    const baseUrl = this.QUERY_SERVICIO;
    interface Cultivo {
      org: string;
      cultivo: string;
    }

    let allFeatures: any[] = [];
    let offset = 0;
    const pageSize = 2000;
    let hasMore = true;

    // 🔹 Paginación para traer TODOS los registros SOLO de CAFÉ
    while (hasMore) {
      const finalWhere = `tipo_cultivo='CAFE' AND ${whereClause}`;
      const url =
        `${baseUrl}?where=${encodeURIComponent(finalWhere)}&outFields=oficina_zonal,tipo_cultivo` +
        `&returnGeometry=false&f=json&resultRecordCount=${pageSize}&resultOffset=${offset}`;

      const res = await fetch(url);
      const data = await res.json();

      if (data.features?.length) {
        allFeatures = allFeatures.concat(data.features);
        offset += pageSize;
        hasMore = data.features.length === pageSize;
      } else {
        hasMore = false;
      }
    }

    const rawData: Cultivo[] = allFeatures.map((feat: any) => ({
      org: feat.attributes.oficina_zonal, // CAMBIO: 'org' -> 'oficina_zonal'
      cultivo: feat.attributes.tipo_cultivo, // CAMBIO: 'cultivo' -> 'tipo_cultivo'
    }));

    // 🔹 Contamos registros de CAFÉ por Oficina Zonal
    const agrupado: Record<string, number> = {};
    rawData.forEach((item: Cultivo) => {
      if (item.cultivo === 'CAFE') {
        agrupado[item.org] = (agrupado[item.org] || 0) + 1;
      }
    });

    // 🔹 Ordenar de mayor a menor
    const entries = Object.entries(agrupado).sort((a, b) => b[1] - a[1]);
    const labels = entries.map(e => e[0]);
    const values = entries.map(e => e[1]);

    // 🔹 Colores por ORG
    const colorMap: Record<string, string> = {
      'OZ SAN FRANCISCO': '#FEEFD8',
      'OZ PUCALLPA': '#B7D9FE',
      'OZ LA MERCED': '#FFC0B6',
      'OZ TINGO MARIA': '#D6F9FD',
      'OZ TARAPOTO': '#C2BBFE',
      'OZ SAN JUAN DE ORO': '#FED2F3',
      'OZ QUILLABAMBA': '#FEFEB9',
      'OZ IQUITOS': '#CAFEDA',
    };

    const backgroundColors = labels.map(org => colorMap[org] || '#cccccc');
    const borderColors = backgroundColors.map(c => c);

    const ctx = document.getElementById('graficoCantidadOZCAFE') as HTMLCanvasElement;
    if (!ctx) return;

    this.charts.push(new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Cantidad de polígonos de CAFÉ',
            data: values,
            backgroundColor: backgroundColors,
            borderColor: borderColors,
            borderWidth: 1,
            barThickness: 25,
            maxBarThickness: 50,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        scales: {
          x: {
            min: 0,
            max: 10000,
            beginAtZero: true,
            ticks: {
              // CAMBIO: 'es-PE' -> 'en-US' y 0 decimales
              callback: (value) =>
                `${Number(value).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
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
            text: 'POLIGONOS DE CAFE',
            font: { size: 18, weight: 'bold' },
            color: '#333',
            padding: { top: 10, bottom: 20 }
          },
          legend: { display: false },
          tooltip: {
            callbacks: {
              // CAMBIO: 'es-PE' -> 'en-US' y 0 decimales
              label: (ctx) =>
                `${Number(ctx.raw).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} polígonos`,
            },
          },
          datalabels: {
            anchor: 'end',
            align: 'right',
            color: '#000',
            font: { weight: 'bold', size: 12 },
            // CAMBIO: 'es-PE' -> 'en-US' y 0 decimales
            formatter: (v: number) =>
              `${Number(v).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
          },
        },
      },
      plugins: [ChartDataLabels],
    }));
  }

}