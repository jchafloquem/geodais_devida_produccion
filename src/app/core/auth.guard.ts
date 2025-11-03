import { inject } from "@angular/core";
import { CanActivateFn, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from "@angular/router";

export const privateGuard = (): CanActivateFn => {
  return (route: ActivatedRouteSnapshot, state: RouterStateSnapshot) => {
    const router = inject(Router);
    const isAuthenticated = !!localStorage.getItem('authToken');

    if (!isAuthenticated) {
      // Guarda la URL a la que el usuario intentó acceder
      localStorage.setItem('redirectUrl', state.url);
      router.navigateByUrl('/auth/login');
      return false;
    }
    return true;
  };
};

export const publicGuard = (): CanActivateFn => {
  return () => {
    const router = inject(Router);
    const isAuthenticated = !!localStorage.getItem('authToken');

    if (isAuthenticated) {
      // Si está logueado, redirige al geovisor
      router.navigateByUrl('/geovisor/map');
      return false;
    }
    return true;
  };
};
