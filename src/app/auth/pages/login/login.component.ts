import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';
import { isRequired } from '../../utils/validators';
import { toast } from 'ngx-sonner';
import { CommonModule } from '@angular/common';

interface AuthResponse {
  Operacion: number;
  Autenticado: boolean;
  Token: string;
  Mensaje: string;
  NombreCompleto: string;
  // ... puedes agregar el resto de las propiedades si las necesitas
}

@Component({
    imports: [CommonModule, RouterModule, ReactiveFormsModule, HttpClientModule],
    templateUrl: './login.component.html',
    styleUrls: ['./login.component.scss']
})
export default class LoginComponent {
	private _formBuilder = inject(FormBuilder);
	private _router = inject(Router);
	private _http = inject(HttpClient);

	// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
	isRequired(field: 'usuario' | 'password') {
		return isRequired(field, this.form);
	}

	public form = this._formBuilder.nonNullable.group({
		usuario: this._formBuilder.nonNullable.control('', [Validators.required]),
		password: this._formBuilder.nonNullable.control('', [Validators.required])
	});
	//eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  async submit(): Promise<void> {
    if (this.form.invalid) {
      toast.warning('Por favor, complete todos los campos.');
      return;
    }
    try {
      const { usuario, password } = this.form.value;
      if (!usuario || !password) return;

      // URL completa del servicio de autenticación. Requiere que el servidor de destino tenga CORS configurado.
      const apiUrl = 'https://wsautenticacionside.devida.gob.pe/api/Seguridad/AutenticarSIGA';
      const body = {
        login: usuario,
        clave: password
      };

      const response = await lastValueFrom(this._http.post<AuthResponse>(apiUrl, body));

      if (response && response.Autenticado) {
        // Guardar el token y el nombre del usuario en localStorage
        localStorage.setItem('authToken', response.Token);
        localStorage.setItem('userName', response.NombreCompleto);

        toast.success(`Bienvenido, ${response.NombreCompleto}`);

        const redirectUrl = localStorage.getItem('redirectUrl') || '/geovisor/map';
        localStorage.removeItem('redirectUrl');
        this._router.navigateByUrl(redirectUrl);
      } else {
        toast.error(response.Mensaje || 'Credenciales incorrectas.');
      }
    } catch (error) {
      console.error('Authentication error:', error);
      toast.error('Error de conexión. No se pudo autenticar.');
    }
  }

}
