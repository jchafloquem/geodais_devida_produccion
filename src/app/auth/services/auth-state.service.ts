import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { catchError, finalize, tap } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import { GeovisorSharedService } from 'src/app/geovisor/services/geovisor.service';

export interface LoginData {
  LOGIN: string;
  clave: string;
  id_sistema: number;
  coordenada_ingreso?: string | null;
}

export interface LoginResponse {
  token?: string;
  Token?: string;
  user?: any;
  NombreCompleto?: string;
  [key: string]: any;
}

@Injectable({
  providedIn: 'root'
})
export class AuthStateService {
  private _geovisorSharedService = inject(GeovisorSharedService);
  private _httpClient = inject(HttpClient);

  private authApiUrl = `${environment.apiUrl}/auth`;

  login(loginData: LoginData): Observable<LoginResponse> {
    const loginUrl = `${this.authApiUrl}/login`;

    return this._httpClient.post<LoginResponse>(loginUrl, loginData)
      .pipe(
        catchError(error => {
          // If there's an error, re-throw it directly without trying QA
          return throwError(() => error);
        }),
        tap(response => {
          const token = response.Token || response.token;
          if (token) {
            localStorage.setItem('authToken', token);
          }
          let userToStore: any = {};

          Object.assign(userToStore, response);

          if (response.user) {
            Object.assign(userToStore, response.user);
          }

          if (!userToStore.NombreCompleto) {
            userToStore.NombreCompleto = userToStore.nombre_completo || (response.user && response.user.nombre_completo);
            if (!userToStore.NombreCompleto) {

              userToStore.NombreCompleto = loginData.LOGIN;

            }
          }

          if (!userToStore.LOGIN) {
            userToStore.LOGIN = loginData.LOGIN;
          }

          localStorage.setItem('userSessionData', JSON.stringify(userToStore));
        })
      );
  }

  logout(): Observable<any> {
    const loginValue = this.getLoginFromSession();

    if (!loginValue) {
      this.clearLocalSession();
      return of(null);
    }

    const payload = { login: loginValue };
    const logoutUrl = `${this.authApiUrl}/logout`;

    return this._httpClient.post(logoutUrl, payload, { responseType: 'text' }).pipe(
      catchError((error) => {
        // En caso de error en la petición de logout (ej. red caída),
        // no propagamos el error. `finalize` se encargará de limpiar la sesión local
        // para que el usuario vea que la sesión se cerró en la UI.
        return of(null);
      }),
      finalize(() => this.clearLocalSession())
    );
  }

  private getLoginFromSession(): string | null {
    const userSession = localStorage.getItem('userSessionData');
    if (!userSession) {
      return null;
    }
    try {
      const parsedUser = JSON.parse(userSession);
      const login = parsedUser?.LOGIN;
      return typeof login === 'string' ? login.trim() : null;
    } catch (e) {
      console.error('Error al parsear los datos de sesión del localStorage', e);
      return null;
    }
  }

  private clearLocalSession(): void {
    localStorage.removeItem('authToken');
    localStorage.removeItem('redirectUrl');
    localStorage.removeItem('userSessionData');
    this._geovisorSharedService.resetMapState();
  }
}
