import {ApplicationConfig, importProvidersFrom, provideZoneChangeDetection} from '@angular/core';
import {provideRouter} from '@angular/router';
import { NgxSpinnerModule } from "ngx-spinner";
import { HTTP_INTERCEPTORS } from '@angular/common/http';

import {routes} from './app.routes';
import {provideAnimationsAsync} from '@angular/platform-browser/animations/async';
import {BrowserAnimationsModule, provideAnimations} from '@angular/platform-browser/animations';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';


import { AuthInterceptor } from './auth/shared/interceptors/auth.interceptor';

export const appConfig: ApplicationConfig = {
	providers: [
		provideZoneChangeDetection({eventCoalescing: true}),
		provideRouter(routes),
		provideAnimations(),
		provideAnimationsAsync(),
		importProvidersFrom(NgxSpinnerModule.forRoot()),
		importProvidersFrom(BrowserAnimationsModule),
		provideAnimationsAsync(), // Este provideAnimationsAsync está duplicado, puedes eliminar uno si no es intencional.
    provideHttpClient(withInterceptorsFromDi()),
    // Registrar el AuthInterceptor
    {
      provide: HTTP_INTERCEPTORS,
      useClass: AuthInterceptor,
      multi: true
    }
	],
};
