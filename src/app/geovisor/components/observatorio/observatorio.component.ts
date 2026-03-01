import { Component, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import Chart from 'chart.js/auto';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import { environment } from 'src/environments/environment';

const pseudo3DPlugin = {
  id: 'pseudo3D',
  beforeDatasetsDraw: (chart: any) => {
    const barMeta = chart.getDatasetMeta(0);
    if (barMeta.type !== 'bar' || !barMeta.data) {
      return;
    }
    const { ctx } = chart;
    const offset = 4;
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    const isHorizontal = chart.options.indexAxis === 'y';
    barMeta.data.forEach((bar: any) => {
      const { x, y, base, width, height } = bar;
      if (isHorizontal) {
        const barThickness = height;
        ctx.beginPath();
        ctx.moveTo(base, y + barThickness / 2);
        ctx.lineTo(base + offset, y + barThickness / 2 + offset);
        ctx.lineTo(x + offset, y + barThickness / 2 + offset);
        ctx.lineTo(x, y + barThickness / 2);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(x, y - barThickness / 2);
        ctx.lineTo(x + offset, y - barThickness / 2 + offset);
        ctx.lineTo(x + offset, y + barThickness / 2 + offset);
        ctx.lineTo(x, y + barThickness / 2);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.moveTo(x - width / 2, y);
        ctx.lineTo(x - width / 2 + offset, y - offset);
        ctx.lineTo(x + width / 2 + offset, y - offset);
        ctx.lineTo(x + width / 2, y);
        ctx.closePath();
        ctx.fill();
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

@Component({
  selector: 'app-observatorio',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule],
  templateUrl: './observatorio.component.html',
  styleUrl: './observatorio.component.scss'
})
export class ObservatorioComponent implements AfterViewInit {
  @ViewChild('graficoDeptos') graficoDeptos!: ElementRef<HTMLCanvasElement>;
  private chart: Chart | null = null;

  // --- Propiedades para el gráfico dinámico ---
  public activeChartView: 'parcelas' | 'productores' | 'superficie' = 'productores';
  public chartTitle: string = 'Distribución de Parcelas por Departamento';
  public isLoading: boolean = true;

  // Almacenes de datos para el gráfico
  private datosGraficoParcelas: { labels: string[], values: number[] } = { labels: [], values: [] };
  private datosGraficoProductores: { labels: string[], values: number[] } = { labels: [], values: [] };
  private datosGraficoSuperficie: { labels: string[], values: number[] } = { labels: [], values: [] };

  // Variables para los indicadores
  public totalProductores: number = 0;
  public totalParcelas: number = 0;
  public totalSuperficie: number = 0;

  // URL del servicio de datos
  private readonly PROD_MAP_BASE = `${environment.apiUrl}/mapas/capa/1`;

  ngAfterViewInit() {
    this.cargarDatosObservatorio();
  }

  /**
   * Carga los datos del FeatureLayer y actualiza tanto los indicadores como el gráfico.
   */
  async cargarDatosObservatorio() {
    this.isLoading = true;
    const layer = new FeatureLayer({ url: this.PROD_MAP_BASE });

    try {
      const totalFeatures = await layer.queryFeatureCount({ where: '1=1' });
      if (totalFeatures === 0) {
        this.totalParcelas = 0;
        this.totalProductores = 0;
        this.totalSuperficie = 0;
        this.isLoading = false;
        return;
      }
      this.totalParcelas = totalFeatures;

      // --- Contenedores para todos los cálculos ---
      const pageSize = 2000;
      let fetched = 0;
      // Para indicadores totales
      const dnisGlobales = new Set<string>();
      let areaGlobal = 0;
      // Para gráficos por departamento
      const parcelasPorDepto: Record<string, number> = {};
      const superficiePorDepto: Record<string, number> = {};
      const productoresPorDepto: Record<string, Set<string>> = {};

      while (fetched < totalFeatures) {
        const result = await layer.queryFeatures({
          where: '1=1',
          outFields: ['dni_participante', 'area_cultivo', 'departamento'],
          returnGeometry: false,
          start: fetched,
          num: pageSize
        });

        if (!result.features.length) break;

        result.features.forEach(feature => {
          const { dni_participante, area_cultivo, departamento } = feature.attributes;

          // 1. Cálculos para indicadores globales
          if (dni_participante) dnisGlobales.add(dni_participante);
          if (area_cultivo) areaGlobal += area_cultivo;

          // 2. Cálculos para gráficos por departamento
          if (departamento) {
            // Parcelas
            parcelasPorDepto[departamento] = (parcelasPorDepto[departamento] || 0) + 1;
            // Superficie
            if (area_cultivo) {
              superficiePorDepto[departamento] = (superficiePorDepto[departamento] || 0) + area_cultivo;
            }
            // Productores
            if (dni_participante) {
              if (!productoresPorDepto[departamento]) {
                productoresPorDepto[departamento] = new Set<string>();
              }
              productoresPorDepto[departamento].add(dni_participante);
            }
          }
        });

        fetched += result.features.length;
      }

      // Asignar indicadores globales
      this.totalProductores = dnisGlobales.size;
      this.totalSuperficie = areaGlobal;

      // Procesar y almacenar datos para gráficos
      const parcelasEntries = Object.entries(parcelasPorDepto).sort((a, b) => b[1] - a[1]);
      this.datosGraficoParcelas = { labels: parcelasEntries.map(e => e[0]), values: parcelasEntries.map(e => e[1]) };

      const superficieEntries = Object.entries(superficiePorDepto).sort((a, b) => b[1] - a[1]);
      this.datosGraficoSuperficie = { labels: superficieEntries.map(e => e[0]), values: superficieEntries.map(e => e[1]) };

      const productoresEntries = Object.entries(productoresPorDepto).map(([depto, dnis]) => [depto, dnis.size] as [string, number]).sort((a, b) => b[1] - a[1]);
      this.datosGraficoProductores = { labels: productoresEntries.map(e => e[0]), values: productoresEntries.map(e => e[1]) };

      // Cargar el gráfico inicial
      this.actualizarGrafico();

    } catch (error) {
      console.error('Error al cargar datos del observatorio:', error);
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Cambia la vista activa del gráfico y lo redibuja.
   * @param vista El tipo de datos a mostrar: 'parcelas', 'productores' o 'superficie'.
   */
  public cambiarVistaGrafico(vista: 'parcelas' | 'productores' | 'superficie') {
    this.activeChartView = vista;
    this.actualizarGrafico();
  }

  /**
   * Redibuja el gráfico de barras con los datos correspondientes a la vista activa.
   */
  private actualizarGrafico() {
    if (!this.graficoDeptos) return;
    const ctx = this.graficoDeptos.nativeElement;

    let data: { labels: string[], values: number[] };
    let max_x: number | undefined = undefined;
    let formatter = (v: number) => v.toLocaleString('es-PE');

    switch (this.activeChartView) {
      case 'productores':
        data = this.datosGraficoProductores;
        this.chartTitle = 'Distribución de Productores por Departamento';
        max_x = 15000; // Dejar que se ajuste automáticamente
        break;
      case 'superficie':
        data = this.datosGraficoSuperficie;
        this.chartTitle = 'Distribución de Superficie (Ha) por Departamento';
        max_x = 15000;
        formatter = (v: number) => v.toLocaleString('es-PE', { maximumFractionDigits: 0 }) + ' Ha';
        break;
      case 'parcelas':
      default:
        data = this.datosGraficoParcelas;
        this.chartTitle = 'Distribución de Parcelas por Departamento';
        max_x = 15000;
        break;
    }

    if (this.chart) {
      this.chart.destroy();
    }

    this.chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.labels,
        datasets: [
          {
            label: 'Registros',
            data: data.values,
            backgroundColor: '#88B268',
            borderColor: '#6A8A50',
            borderWidth: 2,
            barThickness: 15,
          },
        ],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        layout: {
          padding: { right: 5, bottom: 5 }
        },
        scales: {
          x: {
            beginAtZero: true,
            max: max_x,
            ticks: { font: { size: 10, weight: 'bold' } },
          },
          y: {
            ticks: { font: { size: 9, weight: 'bold' }, autoSkip: false },
          },
        },
        plugins: {
          legend: { display: false },
          datalabels: {
            anchor: 'end',
            align: 'right',
            color: '#000',
            font: { weight: 'bold', size: 10 },
            formatter: formatter
          },
        },
      },
      plugins: [pseudo3DPlugin, ChartDataLabels],
    });
  }
}
