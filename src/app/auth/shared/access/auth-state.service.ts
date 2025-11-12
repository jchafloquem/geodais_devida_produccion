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
    const isLocal = window.location.hostname === 'localhost';
    const loginUrl = isLocal
      ? 'http://localhost:8080/api/auth/login'
      : 'http://192.168.1.55:6019/api/auth/login';
    return this._httpClient.post<LoginResponse>(loginUrl, loginData)
      .pipe(
        tap(response => {
          console.log('Respuesta del login recibida del backend:', response);

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
              console.warn('No se encontró "NombreCompleto" o "nombre_completo" en la respuesta del login. Usando "LOGIN" como fallback.');
            }
          }

          // Aseguramos que la propiedad 'LOGIN' de los datos de inicio de sesión siempre esté disponible.
          if (!userToStore.LOGIN) { // Solo si no se ha establecido ya por Object.assign(userToStore, response)
            userToStore.LOGIN = loginData.LOGIN;
          }

          console.log('Guardando userSessionData en localStorage:', userToStore);
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
        // Se utiliza 'LOGIN' para el logout, que es el identificador único del usuario.
        if (parsedUser && typeof parsedUser.LOGIN === 'string') {
          loginValue = parsedUser.LOGIN.trim();
        } else {
          console.warn('userSessionData encontrado en localStorage, pero la propiedad "LOGIN" está ausente o no es una cadena de texto.', parsedUser);
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
      console.error('No se pudo obtener un identificador de usuario válido (LOGIN) para el logout. Abortando la solicitud al backend.');
      this.clearLocalSession(); // Limpiamos la sesión local de todas formas.
      return of(null); // Devolvemos un observable exitoso para que la UI pueda continuar.
    }

    const now = new Date();
    // FIX: Se ajusta la obtención de la fecha y hora para que siempre use la zona horaria local del cliente,
    // evitando inconsistencias por conversiones a UTC que afectaban al backend.
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const fecha_logout = `${year}-${month}-${day}`; // Formato YYYY-MM-DD

    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');
    const hora_logout = `${hours}:${minutes}:${seconds}`; // Formato HH:MM:SS

    const payload = {
      login: loginValue,
      fecha_logout,
      hora_logout
    };

    console.log('Intentando enviar solicitud de logout con payload:', payload); // Log de depuración

    // Idealmente, el token de autorización se adjuntaría a través de un HttpInterceptor.
    // Este método asume que el backend invalida el token que recibe.
    const isLocal = window.location.hostname === 'localhost';
    const logoutUrl = isLocal
      ? 'http://localhost:8080/api/auth/logout' // Asumiendo http para desarrollo local
      : 'https://192.168.1.55:6019/api/auth/logout';
    return this._httpClient.post(logoutUrl, payload, { responseType: 'text' }).pipe(
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
