import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { GeovisorSharedService } from '../../../geovisor/services/geovisor.service';

export interface LoginData {
  LOGIN: string;
  clave: string;
  id_sistema: number;
  coordenada_ingreso?: string | null;
}

export interface LoginResponse {
  token: string;
  user: any;
}

@Injectable({
  providedIn: 'root'
})
export class AuthStateService {
  private _geovisorSharedService = inject(GeovisorSharedService);
  private _httpClient = inject(HttpClient);

  login(loginData: LoginData): Observable<LoginResponse> {
    return this._httpClient.post<LoginResponse>('http://localhost:8080/api/auth/login', loginData)
      .pipe(
        tap(response => {
          console.log('Respuesta del login recibida del backend:', response); // Log para depurar la respuesta del login
          localStorage.setItem('authToken', response.token);
          if (response.user) {
            console.log('Guardando userSessionData en localStorage:', response.user);
            localStorage.setItem('userSessionData', JSON.stringify(response.user));
          } else {
            // WORKAROUND: Si el backend no devuelve el usuario,
            // guardamos al menos la información de login que tenemos.
            console.warn('La respuesta del login no contenía el objeto `user`. ' +
                         'Guardando un objeto de sesión parcial solo con el LOGIN.');
            const partialUser = { LOGIN: loginData.LOGIN };
            localStorage.setItem('userSessionData', JSON.stringify(partialUser));
          }
        })
      );
  }

  logout(): Observable<any> {
    const userSession = localStorage.getItem('userSessionData');
    let loginValue: string | null = null;

    if (userSession) {
      try {
        const parsedUser = JSON.parse(userSession);
        // FIX: La propiedad en localStorage es probablemente 'login' en minúsculas.
        // Se corrige a 'LOGIN' en mayúsculas para que coincida con la estructura de LoginData.
        if (parsedUser && typeof parsedUser.LOGIN === 'string') {
          loginValue = parsedUser.LOGIN.trim();
        } else {
          console.warn('userSessionData encontrado en localStorage, pero la propiedad "login" está ausente o no es una cadena de texto.', parsedUser);
        }
      } catch (e) {
        console.error('Error al parsear userSessionData de localStorage:', e);
      }
    } else {
      console.warn('userSessionData no encontrado en localStorage. El logout se enviará con login nulo.');
    }

    // FIX: No enviar la solicitud si el valor de login es nulo o vacío.
    // Esto previene el error 400 (Bad Request) del backend.
    if (!loginValue) {
      console.error('No se pudo obtener un nombre de usuario válido para el logout. Abortando la solicitud al backend.');
      this.clearLocalSession(); // Limpiamos la sesión local de todas formas.
      return of(null); // Devolvemos un observable exitoso para que la UI pueda continuar.
    }

    const payload = {
      login: loginValue
    };

    console.log('Intentando enviar solicitud de logout con payload:', payload); // Log de depuración

    // Idealmente, el token de autorización se adjuntaría a través de un HttpInterceptor.
    // Este método asume que el backend invalida el token que recibe.
    return this._httpClient.post('http://localhost:8080/api/auth/logout', payload, { responseType: 'text' }).pipe(
      tap((response) => {
        console.log('Respuesta del backend al cerrar sesión:', response);
        console.log('Logout exitoso en el backend. Limpiando sesión local.'); // Log de depuración
        this.clearLocalSession();
      }),
      catchError(error => {
        console.error('Error al cerrar sesión en el backend, limpiando sesión local de todas formas.', error);
        // Es importante limpiar la sesión local incluso si el backend falla
        // para que el usuario no se quede "atascado" en un estado de sesión inválido.
        this.clearLocalSession();
        return of(null); // Continuar el flujo como si fuera exitoso para el cliente.
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
