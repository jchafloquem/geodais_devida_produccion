import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { GeovisorSharedService } from '../../geovisor/services/geovisor.service';

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

  private prodApiUrl = 'https://sistemas.devida.gob.pe/geodais/api/auth';

  login(loginData: LoginData): Observable<LoginResponse> {
    const prodLoginUrl = `${this.prodApiUrl}/login`;

    return this._httpClient.post<LoginResponse>(prodLoginUrl, loginData)
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
    const userSession = localStorage.getItem('userSessionData');
    let loginValue: string | null = null;

    if (userSession) {
      try {
        const parsedUser = JSON.parse(userSession);

        if (parsedUser && typeof parsedUser.LOGIN === 'string') {
          loginValue = parsedUser.LOGIN.trim().toUpperCase();
        }
      } catch (e) { /* No hacer nada si hay un error al parsear */ }
    }

    if (!loginValue) {
      this.clearLocalSession();
      return of(null);
    }

    const payload = {
      login: loginValue
    };

    const prodLogoutUrl = `${this.prodApiUrl}/logout`;

    return this._httpClient.post(prodLogoutUrl, payload, { responseType: 'text' }).pipe(
      catchError(error => {
        // If there's an error during logout, clear session anyway and return null
        this.clearLocalSession();
        return of(null);
      }),
      tap((response) => {

        this.clearLocalSession();
      }),
      catchError(error => {
        this.clearLocalSession();
        return of(null);
      })
    );
}

  private clearLocalSession(): void {
    localStorage.removeItem('authToken');
    localStorage.removeItem('redirectUrl');
    localStorage.removeItem('userSessionData');
    this._geovisorSharedService.resetMapState();
  }
}
