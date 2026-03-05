import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReniecService } from '../../../../services/reniec.service';
import { switchMap } from 'rxjs';

@Component({
  selector: 'app-reniec',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reniec.component.html',
  styleUrl: './reniec.component.scss'
})
export class ReniecComponent {
  // Datos iniciales
  dni: string = '10645147';

  // Variables de estado para la vista
  resultado: any = null;
  error: string = '';
  cargando: boolean = false;

  constructor(private reniecService: ReniecService) {}

  buscar() {
    // Validación simple
    if (!this.dni || this.dni.trim().length !== 8) {
      this.error = 'Por favor, ingrese un DNI válido de 8 dígitos.';
      return;
    }

    this.cargando = true;
    this.error = '';
    this.resultado = null;

    // Flujo encadenado: 1. Obtener token -> 2. Consultar DNI
    this.reniecService.obtenerToken().pipe(
      switchMap(tokenObtenido => {
        if (!tokenObtenido || typeof tokenObtenido !== 'string') {
          throw new Error('No se recibió un token válido del servidor de autenticación.');
        }
        return this.reniecService.consultarDni(this.dni, tokenObtenido);
      })
    ).subscribe({
      next: (data) => {
        this.resultado = data;
        this.cargando = false;
      },
      error: (err) => {
        this.cargando = false;
        if (err.message.includes('No se recibió un token válido')) {
          this.error = err.message;
        } else {
          const msg = err.error?.message || (typeof err.error === 'string' ? err.error : '') || err.message;
          this.error = `Error del servidor (${err.status}): ${msg}. Verifique las credenciales o la conexión.`;
        }
      }
    });
  }
}
