import { bootstrapApplication } from '@angular/platform-browser';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { HTTP_INTERCEPTORS } from '@angular/common/http';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';


import '@arcgis/map-components/dist/loader';
import { defineCustomElements } from '@arcgis/map-components/loader';
import { AuthInterceptor } from './app/auth/interceptors/auth.interceptor';


defineCustomElements(window); // ✅ Registro de los Web Components

bootstrapApplication(AppComponent, {
  ...appConfig,
  providers: [
    ...(appConfig.providers || []),
    provideHttpClient(withInterceptorsFromDi()),
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
  ],
})
