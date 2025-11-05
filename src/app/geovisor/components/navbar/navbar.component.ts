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


  }}

interface HTMLArcgisSearchElement extends HTMLElement {
	view?: __esri.MapView;
}
