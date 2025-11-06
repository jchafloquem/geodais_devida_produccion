import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-login',
    standalone: true,
    imports: [CommonModule, RouterModule, ReactiveFormsModule],
    templateUrl: './login.component.html',
    styleUrls: ['./login.component.scss']
})
export default class LoginComponent implements OnInit, OnDestroy {
	private _formBuilder = inject(FormBuilder);
	private _router = inject(Router);

	public form = this._formBuilder.nonNullable.group({
		usuario: this._formBuilder.nonNullable.control('', [Validators.required]),
		password: this._formBuilder.nonNullable.control('', [Validators.required])
	});

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

    this.intervalId = setInterval(() => {
      this.imageIndex = (this.imageIndex + 1) % this.backgroundImages.length;
      const nextBgIndex = (this.activeBgIndex + 1) % 2;
      this.backgrounds[nextBgIndex].url = `url('${this.backgroundImages[this.imageIndex]}')`;
      this.backgrounds[this.activeBgIndex].fade = true;
      this.backgrounds[nextBgIndex].fade = false;
      this.activeBgIndex = nextBgIndex;
    }, intervalDuration);
  }

  private startColumnImageCarousel(): void {
    const columnIntervalDuration = 4000; // 4 segundos por imagen, 8 en total

    this.columnImageInterval = setInterval(() => {
      this.currentColumnImageIndex = (this.currentColumnImageIndex + 1) % this.columnImages.length;
      this.currentColumnImage = `url('${this.columnImages[this.currentColumnImageIndex]}')`;
    }, columnIntervalDuration);
  }

  submit(): void {
    // Por ahora, solo navega al visor al hacer clic en "Ingresar".
    // La lógica de autenticación se añadirá más adelante.
    this._router.navigateByUrl('/geovisor/map');
  }

  isRequired(fieldName: string): boolean {
    const field = this.form.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched) && field.hasError('required'));
  }
}
