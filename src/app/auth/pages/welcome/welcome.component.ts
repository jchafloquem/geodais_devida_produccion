import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

import { driver } from "driver.js";
import "driver.js/dist/driver.css";

@Component({
  selector: 'app-welcome',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './welcome.component.html',
  styleUrls: ['./welcome.component.scss']
})
export default class WelcomeComponent implements OnInit, OnDestroy {

  public botones = [
    { link: '/auth/login', icono: 'assets/images/logos/geoico1.png', alt: 'Ícono de acceso al visor GIS', label: 'Ingresar al Geovisor', texto: 'VISOR' },
    { link: '/geovisor/dashboard', icono: 'assets/images/logos/geoico3.png', alt: 'Ícono de acceso al dashboard', label: 'Ingresar al Dashboard', texto: 'DASHBOARD' },
    { link: '/geovisor/reportes', icono: 'assets/images/logos/geoico5.png', alt: 'Ícono de acceso a reportes', label: 'Ingresar a Reportes', texto: 'REPORTES' },
    { link: '/geovisor/repositorio', icono: 'assets/images/logos/geoico2.png', alt: 'Ícono de acceso a documentación', label: 'Ingresar a Documentacion', texto: 'REPOSITORIO' },
    { link: '/geovisor/metadata', icono: 'assets/images/logos/geoico4.png', alt: 'Ícono de acceso a metadatos', label: 'Ingresar a Metadatos', texto: 'METADATA' }
  ];

  private readonly backgroundImages = [
    'assets/images/wallpapers/wallpaper1.png',
    'assets/images/wallpapers/wallpaper2.png',
    'assets/images/wallpapers/wallpaper3.png',
    'assets/images/wallpapers/wallpaper2.png' // Se repite para el efecto de ida y vuelta
  ];

  public backgrounds = [
    { url: '', fade: false },
    { url: '', fade: false }
  ];

  private intervalId: any;
  private imageIndex = 0;
  private activeBgIndex = 0;

  constructor() { }

  ngOnInit(): void {
    this.startImageCarousel();
  }

  ngOnDestroy(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }

  private startImageCarousel(): void {
    // Configuración inicial: la primera imagen en el primer div, el segundo div está oculto.
    this.backgrounds[0].url = `url('${this.backgroundImages[this.imageIndex]}')`;
    this.backgrounds[1].url = '';
    this.backgrounds[0].fade = false; // Visible
    this.backgrounds[1].fade = true;  // Oculto
    this.activeBgIndex = 0;

    // Duración basada en la animación original de 35s con 4 pasos (0, 25, 50, 75)
    const intervalDuration = 35000 / 4; // 8750ms por imagen

    this.intervalId = setInterval(() => {
      // Avanza a la siguiente imagen
      this.imageIndex = (this.imageIndex + 1) % this.backgroundImages.length;
      // Elige el div que está actualmente oculto para poner la nueva imagen
      const nextBgIndex = (this.activeBgIndex + 1) % 2;

      this.backgrounds[nextBgIndex].url = `url('${this.backgroundImages[this.imageIndex]}')`;

      // Inicia la transición: oculta el div activo y muestra el siguiente
      this.backgrounds[this.activeBgIndex].fade = true;
      this.backgrounds[nextBgIndex].fade = false;

      // El div que acabamos de mostrar es ahora el activo
      this.activeBgIndex = nextBgIndex;
    }, intervalDuration);
  }

  startTourWelcome() {
    const driverObj = driver({
      showProgress: true,
      nextBtnText: 'Siguiente →',
      prevBtnText: '← Anterior',
      doneBtnText: 'Finalizar',
      steps: [
        {
          element: '#welcome-title',
          popover: { title: '¡Bienvenido al GeoVisor!', description: 'Esta es nuestra plataforma central. Te daremos un breve recorrido por sus funciones principales.' }
        },
        {
          element: '#main-buttons',
          popover: { title: 'Accesos Directos', description: 'Desde aquí puedes navegar a las secciones más importantes de la aplicación.' }
        },
        {
          element: '#button-visor',
          popover: { title: 'Visor Geográfico', description: 'El corazón de la plataforma. Ingresa aquí para interactuar con los mapas y datos georreferenciados.' }
        },
        {
          element: '#button-dashboard',
          popover: { title: 'Dashboard de Estadísticas', description: 'Visualiza los datos y metas de manera gráfica e interactiva. Un resumen completo del progreso.' }
        },
        {
          element: '#button-reportes',
          popover: { title: 'Generador de Reportes', description: 'Crea y descarga reportes personalizados en formato PDF con la información que necesites. En este momento se encuentra en elaboración.' }
        },
        {
          element: '#button-repositorio',
          popover: { title: 'Repositorio Documental', description: 'Accede a toda la documentación técnica, manuales y guías relacionadas con la plataforma.' }
        },
        {
          element: '#button-metadata',
          popover: { title: 'Catálogo de Metadatos', description: 'Consulta la información detallada sobre el origen, calidad y características de nuestros datos geográficos.' }
        },
        {
          element: '#social-media-links',
          popover: { title: 'Mantente Conectado', description: 'Síguenos en nuestras redes sociales para no perderte ninguna novedad.' }
        }
      ]
    });

    driverObj.drive();
  }
}