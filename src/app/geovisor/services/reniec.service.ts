import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpBackend } from '@angular/common/http';
import { Observable, map } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ReniecService {
  // URL del endpoint proporcionado
  // NOTA: Si usas proxy.conf.json para evitar CORS, usa la ruta relativa:
  private apiUrl = '/sispide-backend/pide/reniec/consultar-dni';
  private authUrl = '/sispide-backend/seguridad/validarUsuario';
  private httpWithoutInterceptors: HttpClient;

  constructor(private http: HttpClient, handler: HttpBackend) {
    // Se crea una instancia de HttpClient que omite los interceptores.
    // Esto es crucial para evitar que el AuthInterceptor global interfiera con estas peticiones específicas.
    this.httpWithoutInterceptors = new HttpClient(handler);
  }

  /**
   * Obtiene un token de autenticación.
   */
  obtenerToken(): Observable<string> {
    const body = {
      "usuario": "GEOVISOR",
      "clave": "D3v1d42026"
    };
    const headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });
    // El servicio de autenticación devuelve un objeto JSON que contiene el token.
    // Hacemos la petición esperando un JSON, y luego extraemos la propiedad 'token'.
    return this.httpWithoutInterceptors.post<{ token: string }>(this.authUrl, body, { headers }).pipe(
      map(response => {
        if (response && response.token) {
          return response.token;
        }
        throw new Error('La respuesta de autenticación no tiene el formato esperado (falta la propiedad "token").');
      })
    );
  }

  /**
   * Consulta los datos de un DNI.
   * @param dni El número de DNI a consultar.
   * @param token El token Bearer para la autorización.
   */
  consultarDni(dni: string, token: string): Observable<any> {
    // Configuración de las cabeceras (Headers)
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    });

    // Cuerpo de la solicitud (Payload)
    const body = {
      dniConsulta: dni
    };

    // Realizamos la petición POST
    return this.httpWithoutInterceptors.post<any>(this.apiUrl, body, { headers });
  }
}
