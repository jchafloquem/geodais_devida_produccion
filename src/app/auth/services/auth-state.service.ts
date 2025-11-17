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
  token?: string; // Para compatibilidad con la respuesta anterior
  Token?: string; // Para la nueva respuesta del backend
  user?: any; // Para compatibilidad con la respuesta anterior
  NombreCompleto?: string; // Para la nueva respuesta del backend
  [key: string]: any; // Para otras propiedades
}

@Injectable({
  providedIn: 'root'
})
export class AuthStateService {
  private _geovisorSharedService = inject(GeovisorSharedService);
  private _httpClient = inject(HttpClient);

  login(loginData: LoginData): Observable<LoginResponse> {
    // Apuntamos directamente a la IP del backend, ya que el servicio en localhost está desactivado.
    const loginUrl = 'https://sisqa.devida.gob.pe/geodais/api/auth/login';
    return this._httpClient.post<LoginResponse>(loginUrl, loginData)
      .pipe(
        tap(response => {
          //console.log('Respuesta del login recibida del backend:', response);

          // Manejo del token: se adapta para manejar 'Token' (nueva respuesta) o 'token' (anterior).
          const token = response.Token || response.token;
          if (token) {
            localStorage.setItem('authToken', token);
          }

          let userToStore: any = {};

          // Copiamos todas las propiedades de la respuesta directamente al objeto de sesión.
          // Esto incluye 'Operacion', 'Autenticado', 'Mensaje', 'NombreCompleto', 'COD_PERSONA', etc.
          Object.assign(userToStore, response);

          // Si la respuesta incluye un objeto 'user' anidado (para compatibilidad con estructuras antiguas),
          // fusionamos sus propiedades, pero las propiedades de la raíz tienen prioridad.
          if (response.user) {
            Object.assign(userToStore, response.user);
          }

          // FIX: Aseguramos que 'NombreCompleto' (PascalCase) exista para la UI,
          // mapeándolo desde las posibles propiedades que puede enviar el backend.
          // Prioridad: 1. NombreCompleto (raíz), 2. nombre_completo (raíz), 3. nombre_completo (anidado), 4. LOGIN (fallback).
          if (!userToStore.NombreCompleto) {
            userToStore.NombreCompleto = userToStore.nombre_completo || (response.user && response.user.nombre_completo);
            if (!userToStore.NombreCompleto) {
              // Como último recurso, si no se encontró ningún nombre, usamos el LOGIN.
              userToStore.NombreCompleto = loginData.LOGIN;
              //console.warn('No se encontró "NombreCompleto" o "nombre_completo" en la respuesta del login. Usando "LOGIN" como fallback.');
            }
          }

          // Aseguramos que la propiedad 'LOGIN' de los datos de inicio de sesión siempre esté disponible.
          if (!userToStore.LOGIN) { // Solo si no se ha establecido ya por Object.assign(userToStore, response)
            userToStore.LOGIN = loginData.LOGIN;
          }

          //console.log('Guardando userSessionData en localStorage:', userToStore);
          localStorage.setItem('userSessionData', JSON.stringify(userToStore));
        })
      );
  }

  logout(): Observable<any> {
    const userSession = localStorage.getItem('userSessionData');
    let loginValue: string | null = null;

    // 1. Extraer y estandarizar el login (obligatoriamente a MAYÚSCULAS)
    if (userSession) {
      try {
        const parsedUser = JSON.parse(userSession);

        // El login en el localStorage debe llamarse 'LOGIN'
        if (parsedUser && typeof parsedUser.LOGIN === 'string') {
          // CORRECCIÓN CLAVE: Convertir a mayúsculas para coincidir con la base de datos.
          loginValue = parsedUser.LOGIN.trim().toUpperCase();
        }
      } catch (e) {
        // En un entorno real, usaría un logger o el servicio de notificaciones.
        //console.error('Error al parsear userSessionData de localStorage:', e);
      }
    }

    // 2. Abortar la solicitud si no se encuentra un login válido
    if (!loginValue) {
      //console.error('No se pudo obtener un identificador de usuario válido (LOGIN) para el logout. Abortando la solicitud al backend.');
      this.clearLocalSession(); // Limpiamos la sesión local de todas formas.
      return of(null); // Retorna un observable "exitoso" para que el flujo de UI continúe.
    }

    // 3. Crear el payload minimalista
    // El backend (LogoutRequest) solo espera el campo 'login'.
    const payload = {
      login: loginValue
    };

    // 4. Definir la URL
    // Basado en: http://localhost:8080/{artifactId}/api/auth/logout
    // donde artifactId = geodais
    const logoutUrl = 'https://sisqa.devida.gob.pe/geodais/api/auth/logout';

    // 5. Enviar la solicitud POST
    return this._httpClient.post(logoutUrl, payload, { responseType: 'text' }).pipe(
      tap((response) => {
        //console.log('Respuesta del backend al cerrar sesión:', response);
        this.clearLocalSession();
      }),
      catchError(error => {
        //console.error('Error al cerrar sesión en el backend, limpiando sesión local de todas formas.', error);
        this.clearLocalSession(); // Limpiamos la sesión local
        return of(null); // Permite que el programa siga si el error no es crítico
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
