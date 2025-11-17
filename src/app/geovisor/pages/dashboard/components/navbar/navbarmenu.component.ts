import { isPlatformBrowser, Location } from '@angular/common';
import { Component, EventEmitter, inject, Inject, Output, PLATFORM_ID } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { AuthStateService } from '../../../../../auth/services/auth-state.service';
import { GeovisorSharedService } from '../../../../services/geovisor.service';

@Component({
  selector: 'app-navbarmenu',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './navbarmenu.component.html',
  styleUrl: './navbarmenu.component.scss'
})
export class NavbarmenuComponent {
  @Output() menuToggle = new EventEmitter<void>();

  /** Ruta base para los assets (imágenes, etc.), calculada dinámicamente. */
  public assetPath = '';

  /**
   * @constructor
   * @description
   * Inyecta dependencias y calcula la ruta base para los assets de forma dinámica.
   */
  constructor(@Inject(PLATFORM_ID) private platformId: Object, private location: Location) {
    if (isPlatformBrowser(this.platformId)) {
      // `prepareExternalUrl` antepone el `base-href` a la ruta proporcionada ('assets').
      this.assetPath = this.location.prepareExternalUrl('assets');
    }
  }

  private _authState = inject(AuthStateService);
	private _router = inject(Router);

	public _geovisorSharedService = inject(GeovisorSharedService);

	// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  logout(): void {
		this._authState.logout().subscribe(() => {
			this._router.navigateByUrl('auth/welcome');
		});
	}

}
