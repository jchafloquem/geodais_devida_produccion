import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';
import { isRequired } from '../../utils/validators';
import { Usuario } from '../../interfaces/usuario';
import { toast } from 'ngx-sonner';
import { CommonModule } from '@angular/common';

@Component({
    imports: [CommonModule, RouterModule, ReactiveFormsModule, HttpClientModule],
    templateUrl: './login.component.html',
    styleUrls: ['./login.component.scss']
})
export default class LoginComponent {
	private _formBuilder = inject(FormBuilder);
	private _router = inject(Router);
	private _http = inject(HttpClient);

	isRequired(field: 'usuario' | 'password'): boolean | null {
		return isRequired(field, this.form);
	}

	public form = this._formBuilder.nonNullable.group({
		usuario: this._formBuilder.nonNullable.control('', [Validators.required]),
		password: this._formBuilder.nonNullable.control('', [Validators.required])
	});

  async submit(): Promise<void> {
    if (this.form.invalid) {
      toast.warning('Por favor, complete todos los campos.');
      return;
    }
    try {
      const { usuario, password } = this.form.value;
      if (!usuario || !password) return;

      // URL relativa para que sea interceptada por el proxy (local y en Netlify).
      const apiUrl = 'https://wsautenticacionside.devida.gob.pe/api/Seguridad/AutenticarSIGA';
      const body = {
        login: usuario,
        clave: password
      };

      const response = await lastValueFrom(this._http.post<Usuario>(apiUrl, body));

      if (response && response.Autenticado) {
        // Guardar solo el token y la información no sensible del usuario en localStorage.
        localStorage.setItem('authToken', response.Token);

        // Se crea un objeto solo con los datos necesarios para la UI, evitando exponer datos sensibles.
        const userSession = {
          NombreCompleto: response.NombreCompleto,
        };
        localStorage.setItem('userSessionData', JSON.stringify(userSession));

        toast.success(`Bienvenido, ${response.NombreCompleto}`);

        const redirectUrl = localStorage.getItem('redirectUrl') || '/geovisor/map';
        localStorage.removeItem('redirectUrl');
        this._router.navigateByUrl(redirectUrl);
      } else {
        toast.error(response.Mensaje || 'Credenciales incorrectas.');
      }
    } catch (error) {
      toast.error('Error de conexión. No se pudo autenticar.');
    }
  }

}
