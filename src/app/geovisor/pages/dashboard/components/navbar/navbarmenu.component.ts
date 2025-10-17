import { Component, inject } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { AuthStateService } from '../../../../../auth/shared/access/auth-state.service';
import { GeovisorSharedService } from '../../../../services/geovisor.service';

@Component({
  selector: 'app-navbarmenu',
  imports: [RouterModule],
  templateUrl: './navbarmenu.component.html',
  styleUrl: './navbarmenu.component.scss'
})
export class NavbarmenuComponent {
  private _authState = inject(AuthStateService);
	private _router = inject(Router);

	public _geovisorSharedService = inject(GeovisorSharedService);

	// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
	async logout() {
		await this._authState.logout();
		this._router.navigateByUrl('auth/welcome')
	}

}


