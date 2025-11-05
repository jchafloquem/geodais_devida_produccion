import {
	Component,
	inject,
	CUSTOM_ELEMENTS_SCHEMA,
	AfterViewInit,
	ViewChild,
	ElementRef,
} from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { GeovisorSharedService } from '../../services/geovisor.service';
import { AuthStateService } from '../../../auth/shared/access/auth-state.service';
import { reactiveUtils } from '../../interfaces/arcgis-imports';

@Component({
	selector: 'app-navbar',
	imports: [RouterModule],
	templateUrl: './navbar.component.html',
	styleUrl: './navbar.component.scss',
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class NavbarComponent implements AfterViewInit {
	@ViewChild('arcgisSearch')
	private arcgisSearchEl!: ElementRef<HTMLArcgisSearchElement>;
	private _authState = inject(AuthStateService);
	private _router = inject(Router);

	public _geovisorSharedService = inject(GeovisorSharedService);

	async logout(): Promise<void> {
		await this._authState.logout();
		this._router.navigateByUrl('auth/welcome');
	}

	reajustarMapa(): void {
		this._geovisorSharedService.forceMapResize();
	}

	ngAfterViewInit(): void {
		if (!this.arcgisSearchEl) {
			return;
		}

		const searchElement = this.arcgisSearchEl.nativeElement;

		// Esperamos a que el componente <arcgis-search> esté completamente definido y listo.
		customElements.whenDefined('arcgis-search').then(() => {
			// El <input> real está dentro del "shadow DOM" del componente.
			const searchInput = searchElement.shadowRoot?.querySelector('input');

			if (searchInput) {
				// Escuchamos el evento 'blur', que se dispara cuando el input pierde el foco.
				// Esto ocurre cuando el usuario selecciona un resultado o toca fuera del buscador.
				searchInput.addEventListener('blur', () => {
					const view = this._geovisorSharedService.view;
					if (!view) return;

					// --- SOLUCIÓN AGRESIVA PARA BUG DE RENDERIZADO EN SAFARI ---
					// Safari no recalcula el tamaño de la página correctamente después de ocultar
					// el teclado y el panel de sugerencias. Esta secuencia fuerza un redibujado.
					setTimeout(() => {
						const mapContainer = view.container as HTMLElement;

						// 1. Ocultamos el mapa para forzar al navegador a recalcular el layout.
						mapContainer.style.visibility = 'hidden';

						// 2. Forzamos un "reflow" del DOM. Leer una propiedad como offsetWidth es un truco conocido para esto.
						document.body.offsetWidth;

						// 3. Llamamos al método resize() de la API de ArcGIS.
						(view as any).resize();

						// 4. Volvemos a hacer visible el mapa. Usamos requestAnimationFrame
						//    para asegurarnos de que esto ocurra en el siguiente ciclo de pintado.
						requestAnimationFrame(() => mapContainer.style.visibility = 'visible');

					}, 400); // Aumentamos el retardo a 400ms para dar más tiempo a las animaciones de iOS.
				});
			}
		});
	}
}

interface HTMLArcgisSearchElement extends HTMLElement {
	view?: __esri.MapView;
}
