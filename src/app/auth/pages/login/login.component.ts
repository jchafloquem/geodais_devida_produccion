import { Component, inject, OnInit, OnDestroy, NgZone, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { Observable, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { AuthStateService, LoginResponse } from '../../shared/access/auth-state.service';


@Component({

    selector: 'app-login',
    standalone: true,
    imports: [CommonModule, RouterModule, ReactiveFormsModule],
    templateUrl: './login.component.html',
    styleUrls: ['./login.component.scss']
})
export default class LoginComponent implements OnInit, OnDestroy {
	private _formBuilder = inject(FormBuilder);
  private _authState = inject(AuthStateService);
	private _router = inject(Router);
	private _zone = inject(NgZone);
	private _cdr = inject(ChangeDetectorRef);

	public form = this._formBuilder.nonNullable.group({
		usuario: this._formBuilder.nonNullable.control('', [Validators.required]),
		password: this._formBuilder.nonNullable.control('', [Validators.required])
	});

  public loginError: string | null = null;

  private readonly backgroundImages = [
    'assets/images/wallpapers/wallpaper1.png',
    'assets/images/wallpapers/wallpaper2.png',
    'assets/images/wallpapers/wallpaper3.png',
    'assets/images/wallpapers/wallpaper2.png' // Se repite para el efecto de ida y vuelta
  ];

  private readonly columnImages: string[] = [
    'assets/images/logos/cacao.png',
    'assets/images/logos/cafe.png'
  ];

  public backgrounds = [
    { url: '', fade: false },
    { url: '', fade: false }
  ];

  public currentColumnImage!: string;

  private intervalId: any;
  private columnImageInterval: any;
  private imageIndex = 0;
  private currentColumnImageIndex = 0;
  private activeBgIndex = 0;

  constructor() {
    // Inicializamos la primera imagen para la columna
    this.currentColumnImage = `url('${this.columnImages[this.currentColumnImageIndex]}')`;
  }

  ngOnInit(): void {
    this.startImageCarousel();
    this.startColumnImageCarousel();
  }

  ngOnDestroy(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    if (this.columnImageInterval) {
      clearInterval(this.columnImageInterval);
    }
  }

  private startImageCarousel(): void {
    this.backgrounds[0].url = `url('${this.backgroundImages[this.imageIndex]}')`;
    this.backgrounds[1].url = '';
    this.backgrounds[0].fade = false; // Visible
    this.backgrounds[1].fade = true;  // Oculto
    this.activeBgIndex = 0;

    const intervalDuration = 8750; // 8.75 segundos por imagen

    this._zone.runOutsideAngular(() => {
      this.intervalId = setInterval(() => {
        this.imageIndex = (this.imageIndex + 1) % this.backgroundImages.length;
        const nextBgIndex = (this.activeBgIndex + 1) % 2;
        this.backgrounds[nextBgIndex].url = `url('${this.backgroundImages[this.imageIndex]}')`;
        this.backgrounds[this.activeBgIndex].fade = true;
        this.backgrounds[nextBgIndex].fade = false;
        this.activeBgIndex = nextBgIndex;
        // Forzamos la detección de cambios para actualizar la vista
        this._cdr.detectChanges();
      }, intervalDuration);
    });
  }

  private startColumnImageCarousel(): void {
    const columnIntervalDuration = 4000; // 4 segundos por imagen, 8 en total

    this._zone.runOutsideAngular(() => {
      this.columnImageInterval = setInterval(() => {
        this.currentColumnImageIndex = (this.currentColumnImageIndex + 1) % this.columnImages.length;
        this.currentColumnImage = `url('${this.columnImages[this.currentColumnImageIndex]}')`;
        // Forzamos la detección de cambios para actualizar la vista
        this._cdr.detectChanges();
      }, columnIntervalDuration);
    });
  }

  /**
   * Obtiene las coordenadas geográficas del navegador y las devuelve como un Observable.
   * Emite una cadena "lat,lon" en caso de éxito, o null si el usuario deniega el permiso o hay un error.
   */
  private _getCoordinates(): Observable<string | null> {
    return new Observable(subscriber => {
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const coords = `${position.coords.latitude},${position.coords.longitude}`;
            subscriber.next(coords);
            subscriber.complete();
          },
          (error) => {
            console.warn(`No se pudo obtener la geolocalización: ${error.message}`);
            subscriber.next(null); // Continuar sin coordenadas
            subscriber.complete();
          }
        );
      } else {
        console.warn('La geolocalización no es compatible con este navegador.');
        subscriber.next(null); // Continuar sin coordenadas
        subscriber.complete();
      }
    });
  }

  submit(): void {
    if (this.form.valid) {
      this.loginError = null; // Limpiar errores previos al enviar

      // 1. Obtener coordenadas primero
      this._getCoordinates().pipe(
        // 2. Usar switchMap para encadenar con la llamada de login
        switchMap(coords => {
          const loginData = {
            LOGIN: this.form.value.usuario!,
            clave: this.form.value.password!,
            id_sistema: 21,
            coordenada_ingreso: coords // Añadir las coordenadas (o null)
          };
          console.log('Enviando datos de login:', loginData);
          return this._authState.login(loginData);
        })
      ).subscribe({
        next: (response: LoginResponse) => this._handleLoginSuccess(response),
        error: (err: unknown) => this._handleLoginError(err)
        });
    }
  }

  isRequired(fieldName: string): boolean {
    const field = this.form.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched) && field.hasError('required'));
  }

  private _handleLoginSuccess(response: LoginResponse): void {
    this._zone.run(() => {
      const redirectUrl = localStorage.getItem('redirectUrl') || '/geovisor/map';
      localStorage.removeItem('redirectUrl');
      this._router.navigateByUrl(redirectUrl);
    });
  }

  private _handleLoginError(err: unknown): void {
    console.error('Fallo en el login, manejado en el componente:', err);
    if (err instanceof HttpErrorResponse) {
      this.loginError = `Error de autenticación (código: ${err.status}). Por favor, verifique su usuario y contraseña.`;
    } else {
      this.loginError = 'Ocurrió un error inesperado. Por favor, intente más tarde.';
    }
    this._cdr.detectChanges();
  }
}
