import { Component, AfterViewInit, LOCALE_ID } from '@angular/core';
import { CommonModule, registerLocaleData } from '@angular/common';
import { RouterModule } from '@angular/router';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import StatisticDefinition from '@arcgis/core/rest/support/StatisticDefinition.js';
import Chart from 'chart.js/auto';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import localeEsPE from '@angular/common/locales/es-PE';

// Plugin para 3D en barras
const pseudo3DPlugin = {
  id: 'pseudo3D',
  beforeDatasetsDraw: (chart: Chart) => {
    const barMeta = chart.getDatasetMeta(0);
    if (barMeta.type !== 'bar' || !barMeta.data) return;
    const { ctx } = chart;
    const offset = 4;
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    const isHorizontal = chart.options.indexAxis === 'y';
    barMeta.data.forEach(bar => {
      const { x, y, base, width, height } = bar as any;
      if (!isHorizontal) {
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

registerLocaleData(localeEsPE, 'es-PE');

@Component({
  selector: 'app-resumen',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './resumen.component.html',
  styleUrl: './resumen.component.scss',
  providers: [{ provide: LOCALE_ID, useValue: 'es-PE' }],
})
export class ResumenComponent implements AfterViewInit {
  private readonly SERVICIO_PIRDAIS = 'https://siscod.devida.gob.pe/server/rest/services/DPM_PIRDAIS_CULTIVOS_PRODUCCION/MapServer/1';
  public totalRegistrosCultivos = 0;
  public totalCafe = 0;
  public totalCacao = 0;
  public totalAreaCultivo = 0;
  public totalAreaCafe = 0;
  public totalAreaCacao = 0;
  private readonly METAS_HECTAREAS: { [key: number]: number } = { 2024: 43364, 2025: 5000 };
  private readonly METAS_FAMILIAS: { [key: number]: number } = { 2024: 38313, 2025: 4000 };
  public currentMetaFamilias: number = 0;
  public currentMetaHectareas: number = 0;
  public availableYears: number[] = [];
  public selectedYear: number | 0 = new Date().getFullYear();
  private charts: Chart[] = [];
  public totalRegistrosUnicosDNI: Record<string, number> = {};

  async ngAfterViewInit(): Promise<void> {
    const dashboardCultivos = new FeatureLayer({ url: this.SERVICIO_PIRDAIS });
    try {
      await dashboardCultivos.load();
      this.availableYears = await this.getAvailableYears();
      if (this.availableYears.includes(2025)) {
        this.selectedYear = 2025;
      } else if (this.availableYears.length > 0) {
        this.selectedYear = this.availableYears[0];
      }
      await this.loadDashboardData();
    } catch (err) {
    }
  }

  async getAvailableYears(): Promise<number[]> {
    const years = [];
    for (let year = 2030; year >= 2024; year--) {
      years.push(year);
    }
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
    let yearFilter: string;
    if (this.selectedYear === 0) {
      yearFilter = '1=1';
      this.currentMetaHectareas = Object.values(this.METAS_HECTAREAS).reduce((sum, meta) => sum + meta, 0);
      this.currentMetaFamilias = Object.values(this.METAS_FAMILIAS).reduce((sum, meta) => sum + meta, 0);
    } else {
      yearFilter = `EXTRACT(YEAR FROM fecha_levantamiento) = ${this.selectedYear}`;
      this.currentMetaHectareas = this.METAS_HECTAREAS[this.selectedYear] || 0;
      this.currentMetaFamilias = this.METAS_FAMILIAS[this.selectedYear] || 0;
    }
    const dashboardCultivos = new FeatureLayer({ url: this.SERVICIO_PIRDAIS });
    try {
      const [totalArea, poligonosData, areaPorCultivo, totalDNIResult] = await Promise.all([
        this.sumarAreaCultivoTotal(dashboardCultivos, yearFilter),
        this.contarPoligonos(dashboardCultivos, yearFilter),
        this.sumarAreaPorCultivo(dashboardCultivos, yearFilter),
        this.contarRegistrosUnicosPorDNI(dashboardCultivos, yearFilter),
      ]);
      this.totalAreaCultivo = totalArea;
      this.totalCafe = poligonosData.cafe;
      this.totalCacao = poligonosData.cacao;
      this.totalRegistrosCultivos = poligonosData.total;
      this.totalRegistrosUnicosDNI = totalDNIResult;
      this.crearGraficoPorDepartamento(yearFilter);
    } catch (err) {
    }
  }

  async sumarAreaCultivoTotal(layer: FeatureLayer, whereClause: string = '1=1'): Promise<number> {
    const statDef = new StatisticDefinition({ onStatisticField: 'area_cultivo', outStatisticFieldName: 'sum_area', statisticType: 'sum' });
    const query = layer.createQuery();
    query.where = whereClause;
    query.outStatistics = [statDef];
    const result = await layer.queryFeatures(query);
    return result.features[0]?.attributes?.['sum_area'] ?? 0;
  }

  async sumarAreaPorCultivo(layer: FeatureLayer, whereClause: string = '1=1'): Promise<any[]> {
    const statDef = new StatisticDefinition({ onStatisticField: 'area_cultivo', outStatisticFieldName: 'total_area', statisticType: 'sum' });
    const query = layer.createQuery();
    query.where = whereClause;
    query.outStatistics = [statDef];
    query.groupByFieldsForStatistics = ['tipo_cultivo'];
    const result = await layer.queryFeatures(query);
    const data = result.features.map(f => ({ cultivo: f.attributes['tipo_cultivo'], total_area: f.attributes['total_area'] }));

    // Reiniciar valores antes de recalcular
    this.totalAreaCafe = 0;
    this.totalAreaCacao = 0;

    for (const item of data) {
      const cultivo = (item.cultivo || '').toUpperCase().trim();
      if (cultivo === 'CAFE') {
        this.totalAreaCafe = item.total_area;
      } else if (cultivo === 'CACAO') {
        this.totalAreaCacao = item.total_area;
      }
    }

    return data;
  }

  async contarPoligonos(layer: FeatureLayer, whereClause: string = '1=1'): Promise<{ cafe: number, cacao: number, total: number }> {
    let conteoCafe = 0;
    let conteoCacao = 0;
    const pageSize = 2000;
    let fetched = 0;
    const totalPoligonos = await layer.queryFeatureCount({ where: whereClause });

    while (fetched < totalPoligonos) {
      const query = layer.createQuery();
      query.where = whereClause;
      query.outFields = ['tipo_cultivo'];
      query.returnGeometry = false;
      query.start = fetched;
      query.num = pageSize;

      const result = await layer.queryFeatures(query);
      result.features.forEach(f => {
        const cultivoRaw = (f.attributes['tipo_cultivo'] || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
        if (cultivoRaw.includes('cafe')) {
          conteoCafe++;
        }
        if (cultivoRaw.includes('cacao')) {
          conteoCacao++;
        }
      });
      fetched += result.features.length;
    }

    return { cafe: conteoCafe, cacao: conteoCacao, total: totalPoligonos };
  }

  async contarRegistrosUnicosPorDNI(layer: FeatureLayer, whereClause: string = '1=1'): Promise<Record<string, number>> {
    const dnisPorCultivo: Record<string, Set<string>> = { cafe: new Set(), cacao: new Set() };
    const dnisTotales = new Set<string>();
    const pageSize = 2000;
    let fetched = 0;
    const total = await layer.queryFeatureCount({ where: whereClause });

    while (fetched < total) {
      const query = layer.createQuery();
      query.where = whereClause;
      query.outFields = ['dni_participante', 'tipo_cultivo'];
      query.returnGeometry = false;
      query.start = fetched;
      query.num = pageSize;

      const result = await layer.queryFeatures(query);
      result.features.forEach(f => {
        const dni = f.attributes['dni_participante'];
        if (!dni) return;
        const cultivoRaw = (f.attributes['tipo_cultivo'] || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
        if (cultivoRaw.includes('cafe')) dnisPorCultivo['cafe'].add(dni);
        if (cultivoRaw.includes('cacao')) dnisPorCultivo['cacao'].add(dni);
        dnisTotales.add(dni);
      });
      fetched += result.features.length;
    }

    const cafe_y_cacao = [...dnisPorCultivo['cafe']].filter(dni => dnisPorCultivo['cacao'].has(dni));
    return {
      cafe: dnisPorCultivo['cafe'].size,
      cacao: dnisPorCultivo['cacao'].size,
      'cafe_y_cacao': cafe_y_cacao.length,
      total: dnisTotales.size
    };
  }

  async crearGraficoPorDepartamento(whereClause: string = '1=1') {
    const statDef = new StatisticDefinition({ onStatisticField: 'OBJECTID', outStatisticFieldName: 'count_registros', statisticType: 'count' });
    const featureLayer = new FeatureLayer({ url: this.SERVICIO_PIRDAIS });
    const query = featureLayer.createQuery();
    query.where = whereClause;
    query.outStatistics = [statDef];
    query.groupByFieldsForStatistics = ['DEPARTAMENTO'];
    query.orderByFields = ['count_registros DESC'];
    const ctx = document.getElementById('graficoResumenPorDepartamento') as HTMLCanvasElement;
    if (!ctx) return;
    try {
      const result = await featureLayer.queryFeatures(query);
      if (!result.features || result.features.length === 0) {
        const context = ctx.getContext('2d');
        if (context) {
          context.clearRect(0, 0, ctx.width, ctx.height);
          context.textAlign = 'center';
          context.fillStyle = '#999';
          context.font = '14px Arial';
          context.fillText('No hay datos disponibles', ctx.width / 2, ctx.height / 2);
        }
        return;
      }
      const labels = result.features.map(f => f.attributes.DEPARTAMENTO).filter(Boolean);
      const values = result.features.map(f => f.attributes.count_registros);
      this.charts.push(new Chart(ctx, {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            label: 'Registros por Departamento',
            data: values,
            backgroundColor: '#88B268',
            borderColor: '#6A8A50',
            borderWidth: 2,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: { beginAtZero: true, ticks: { font: { size: 10, weight: 'bold' } } },
            x: { ticks: { font: { size: 10, weight: 'bold' } } },
          },
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: (c) => `${Number(c.raw).toLocaleString('es-PE')} registros` } },
            datalabels: {
              anchor: 'end',
              align: 'top',
              color: '#000',
              font: { weight: 'bold', size: 10 },
              formatter: (v: number) => `${Number(v).toLocaleString('es-PE')}`,
            },
          },
        },
        plugins: [pseudo3DPlugin, ChartDataLabels],
      }));
    } catch (err) {
    }
  }
}
