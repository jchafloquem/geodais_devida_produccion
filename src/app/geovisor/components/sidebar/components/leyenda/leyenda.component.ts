import {Component, inject, OnInit} from '@angular/core';
import {GeovisorSharedService} from '../../../../services/geovisor.service';
import Legend from "@arcgis/core/widgets/Legend";

@Component({
    selector: 'app-leyenda',
    // La propiedad 'imports' solo es válida para componentes standalone.
    // Si este no es un componente standalone, esta línea debería eliminarse.
    templateUrl: './leyenda.component.html',
    styleUrl: './leyenda.component.scss'
})
export class LeyendaComponent implements OnInit {
	public _geovisorSharedService = inject(GeovisorSharedService);
	public legend: Legend | null = null;

	ngOnInit(): void {
		this.createLegend();
	}
	createLegend(): void {
		// Usar un intervalo es más robusto que un único timeout para manejar la
		// condición de carrera donde el servicio puede tardar en inicializar la leyenda.
		const interval = setInterval(() => {
			const legendWidget = this._geovisorSharedService.legend;
			// La propiedad 'container' de un widget de ArcGIS puede ser un string (ID del DOM) o el HTMLElement.
			// Nos aseguramos de que sea un HTMLElement antes de usarlo con métodos del DOM como 'contains' o 'appendChild'.
			if (legendWidget && legendWidget.container instanceof HTMLElement) {
				clearInterval(interval); // Detener la comprobación una vez que se encuentra la leyenda
				this.legend = legendWidget;
				const legendContainer = document.getElementById('legend-container');

				// Evita añadir el contenedor de la leyenda varias veces si el componente se reinicia.
				// Se usa 'legendWidget.container' directamente porque TypeScript ya ha verificado que es un HTMLElement
				// gracias al 'instanceof', evitando así el error de tipo que puede ocurrir con 'this.legend.container'.
				if (legendContainer && !legendContainer.contains(legendWidget.container)) {
					legendContainer.appendChild(legendWidget.container);
				}
			}
		}, 200);

		// Como salvaguarda, limpiar el intervalo después de 10 segundos para evitar que se ejecute para siempre.
		setTimeout(() => clearInterval(interval), 10000);
	}
}
