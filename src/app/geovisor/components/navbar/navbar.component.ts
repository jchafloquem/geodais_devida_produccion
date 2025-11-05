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
				// Esto ocurre cuando el usuario selecciona un resultado o simplemente toca fuera del buscador.
				searchInput.addEventListener('blur', () => {
					const view = this._geovisorSharedService.view;
					if (!view) return;

					// Usamos un pequeño retardo. Esto es CRUCIAL para Safari.
					// Le da al navegador un instante para terminar de ocultar el teclado
					// y el panel de sugerencias ANTES de forzar el redibujado del mapa.
					setTimeout(() => {
						// Forzamos el redibujado. Usamos `as any` para evitar el error de TypeScript, ya que
						// el método `resize()` sí existe en el objeto real en tiempo de ejecución.
						(view as any).resize();
					}, 300); // 300ms es un valor más seguro para dar tiempo a las animaciones de iOS.
				});
			}
		});
	}
}

interface HTMLArcgisSearchElement extends HTMLElement {
	view?: __esri.MapView;
}
