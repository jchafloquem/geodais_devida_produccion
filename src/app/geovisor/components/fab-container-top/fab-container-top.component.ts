import {Component, inject} from '@angular/core';
import Basemap from '@arcgis/core/Basemap';
import {GeovisorSharedService} from '../../services/geovisor.service';

@Component({
    selector: 'app-fab-container-top',
    imports: [],
    templateUrl: './fab-container-top.component.html',
    styleUrl: './fab-container-top.component.scss'
})
export class FabContainerTopComponent {
	public _geovisorSharedService = inject(GeovisorSharedService);
	public mapaBaseView = true;
	// Propiedades para las rutas de las imágenes
	sateliteImg = 'assets/icons/esrisatellite.webp';
	osmImg = 'assets/icons/osmmapnik.webp';
	topoImg = 'assets/icons/esriroad.webp';
	wordImg = 'assets/icons/word.webp';
	mapabase(base: string): void {
		this._geovisorSharedService.mapa.basemap = Basemap.fromId(base);
	}
}
