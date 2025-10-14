import { inject, Injectable } from '@angular/core';
import { Auth, authState, signOut, User } from '@angular/fire/auth';
import { Observable, map } from 'rxjs';
import { Usuario } from '../../interface/usuario';
import { GeovisorSharedService } from '../../../geovisor/services/geovisor.service';


@Injectable({
  providedIn: 'root'
})
export class AuthStateService {

  private _auth = inject(Auth);
  private _geovisorSharedService = inject(GeovisorSharedService);


  // Emitimos un Usuario propio (nombre, email, foto, uid)
  public get authState$(): Observable<Usuario | null> {
    return authState(this._auth).pipe(
      map((user: User | null) => {
        if (!user) return null;
        return {
          nombre: user.displayName ?? '',
          email: user.email ?? '',
          foto: user.photoURL ?? '',
          uid: user.uid
        } as Usuario;
      })
    );
  }

  async logout(): Promise<void> {
    // Reseteamos completamente el estado del servicio del mapa.
    // Esto destruye la vista, el mapa y los watchers actuales, y crea un mapa
    // nuevo y limpio para la próxima sesión, simulando un refresco de la aplicación.
    // Esto soluciona los errores de "map is already destroyed" y "cannot read 'scale' of null".
    this._geovisorSharedService.resetMapState();

    await signOut(this._auth);
    // Limpiamos el storage para eliminar cualquier dato en memoria del navegador.
    localStorage.clear();
    sessionStorage.clear();
  }
}
