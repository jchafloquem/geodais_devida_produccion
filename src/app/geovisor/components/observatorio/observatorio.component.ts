import { Component, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import Chart from 'chart.js/auto';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import StatisticDefinition from '@arcgis/core/rest/support/StatisticDefinition.js';

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

  // Variables para los indicadores
  public totalProductores: number = 0;
  public totalParcelas: number = 0;
  public totalSuperficie: number = 0;

  // URL del servicio de datos
  private readonly PROD_MAP_BASE = `https://sistemas.devida.gob.pe/geodais/api/mapas/capa/1`;

  ngAfterViewInit() {
    this.cargarDatosObservatorio();
  }

  /**
   * Carga los datos del FeatureLayer y actualiza tanto los indicadores como el gráfico.
   */
  async cargarDatosObservatorio() {
    const layer = new FeatureLayer({ url: this.PROD_MAP_BASE });

    // Ejecutamos las consultas en paralelo para optimizar el tiempo de carga
    this.calcularIndicadores(layer);
    this.generarGraficoDepartamentos(layer);
  }

  async calcularIndicadores(layer: FeatureLayer) {
    try {
      // 1. Total de Parcelas (Conteo simple)
      this.totalParcelas = await layer.queryFeatureCount({ where: '1=1' });

      // 2. Total de Superficie (Suma estadística)
      const statDef = new StatisticDefinition({
        onStatisticField: 'area_cultivo',
        outStatisticFieldName: 'total_area',
        statisticType: 'sum'
      });
      const query = layer.createQuery();
      query.where = '1=1';
      query.outStatistics = [statDef];
      const resultSuperficie = await layer.queryFeatures(query);
      if (resultSuperficie.features.length > 0) {
        this.totalSuperficie = resultSuperficie.features[0].attributes['total_area'] || 0;
      }

      // 3. Total de Productores (DNIs únicos) - Requiere paginación manual
      const pageSize = 2000;
      const dnis = new Set<string>();
      let fetched = 0;

      while (true) {
        const result = await layer.queryFeatures({
          where: '1=1',
          outFields: ['dni_participante'],
          returnGeometry: false,
          start: fetched,
          num: pageSize
        });

        if (!result.features.length) break;

        result.features.forEach(f => {
          const dni = f.attributes['dni_participante'];
          if (dni) dnis.add(dni);
        });

        fetched += result.features.length;
        if (fetched >= this.totalParcelas) break;
      }
      this.totalProductores = dnis.size;

    } catch (error) {
      console.error('Error al calcular indicadores del observatorio:', error);
    }
  }

  async generarGraficoDepartamentos(layer: FeatureLayer) {
    if (!this.graficoDeptos) return;
    const ctx = this.graficoDeptos.nativeElement;

    // Obtener conteo por departamento usando estadísticas del servidor (más eficiente)
    // Si el servidor no soporta groupByFieldsForStatistics, usaríamos paginación manual como en el Dashboard.
    // Asumiremos paginación manual para consistencia y robustez con el Dashboard.
    const conteoPorDepto: Record<string, number> = {};
    const pageSize = 2000;
    const total = await layer.queryFeatureCount({ where: '1=1' });
    let fetched = 0;

    while (fetched < total) {
      const result = await layer.queryFeatures({
        where: '1=1',
        outFields: ['departamento'],
        returnGeometry: false,
        start: fetched,
        num: pageSize,
      });

      if (!result.features.length) break;

      result.features.forEach(feature => {
        const depto = feature.attributes.departamento;
        if (depto) {
          conteoPorDepto[depto] = (conteoPorDepto[depto] || 0) + 1;
        }
      });

      fetched += result.features.length;
    }

    const entries = Object.entries(conteoPorDepto).sort((a, b) => b[1] - a[1]);
    const labels = entries.map(e => e[0]);
    const values = entries.map(e => e[1]);

    if (this.chart) {
      this.chart.destroy();
    }

    this.chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Registros',
            data: values,
            backgroundColor: '#88B268',
            borderColor: '#6A8A50',
            borderWidth: 2,
            barThickness: 20,
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
            formatter: (v: number) => v.toLocaleString('es-PE')
          },
        },
      },
      plugins: [pseudo3DPlugin, ChartDataLabels],
    });
  }
}
