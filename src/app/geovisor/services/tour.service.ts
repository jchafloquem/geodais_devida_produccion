import { Injectable } from '@angular/core';
import { MapView } from '../interfaces/arcgis-imports';

@Injectable({
  providedIn: 'root',
})
export class TourService {
  private masterTourSteps: any[] = [];
  private tourSteps: any[] = [];
  private currentTourStep = -1;
  private tourOverlay: HTMLDivElement | null = null;
  private tourPopover: HTMLDivElement | null = null;
  private originalElementStyles: Map<
    HTMLElement,
    { zIndex: string; position: string; boxShadow: string }
  > = new Map();

  public setMasterSteps(steps: any[]): void {
    this.masterTourSteps = steps;
  }

  public createTourButton(view: MapView): void {
    const tourBtn = document.createElement('button');
    tourBtn.innerHTML = '💡'; // Icono de bombilla para "guía" o "tips"
    tourBtn.className = 'esri-widget--button esri-widget';
    tourBtn.title = 'Iniciar Tour Guiado';
    tourBtn.style.width = '45px';
    tourBtn.style.height = '45px';
    tourBtn.style.fontSize = '1.5rem';
    tourBtn.addEventListener('click', () => this.startTour());
    view.ui.add(tourBtn, { position: 'top-right', index: 0 });
  }

  public startTour(): void {
    if (this.currentTourStep !== -1) {
      return; // El tour ya está en ejecución
    }

    // Filtra los pasos del tour para incluir solo los elementos que están visibles en la pantalla.
    this.tourSteps = this.masterTourSteps.filter(step => {
      let targetElement: HTMLElement | null = null;
      if (typeof step.element === 'string') {
        targetElement = document.querySelector(step.element);
      } else {
        targetElement = step.element;
      }
      return targetElement && getComputedStyle(targetElement).display !== 'none';
    });

    if (this.tourSteps.length === 0) {
      //console.warn("No hay pasos del tour visibles para mostrar.");
      return;
    }
    // Crear overlay
    this.tourOverlay = document.createElement('div');
    this.tourOverlay.id = 'tour-overlay';
    Object.assign(this.tourOverlay.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100vw',
      height: '100vh',
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      zIndex: '10001',
      display: 'block',
    });
    document.body.appendChild(this.tourOverlay);
    this.tourOverlay.addEventListener('click', () => this.endTour());

    this.showTourStep(0);
  }

  private endTour(): void {
    this.tourOverlay?.remove();
    this.tourPopover?.remove();

    // Restaurar estilos originales de los elementos resaltados
    this.originalElementStyles.forEach((
      style: { zIndex: string; position: string; boxShadow: string },
      element: HTMLElement
    ) => {
      element.style.zIndex = style.zIndex;
      element.style.position = style.position;
      element.style.boxShadow = style.boxShadow;
    });

    this.originalElementStyles.clear();
    this.tourOverlay = null;
    this.tourPopover = null;
    this.currentTourStep = -1;
  }

  private nextTourStep(): void {
    if (this.currentTourStep < this.tourSteps.length - 1) {
      this.showTourStep(this.currentTourStep + 1);
    } else {
      this.endTour();
    }
  }

  private prevTourStep(): void {
    if (this.currentTourStep > 0) {
      this.showTourStep(this.currentTourStep - 1);
    }
  }

  private async showTourStep(stepIndex: number): Promise<void> {
    if (stepIndex < 0 || stepIndex >= this.tourSteps.length) {
      this.endTour();
      return;
    }

    // Limpiar resaltado del paso anterior
    this.originalElementStyles.forEach((
      style: { zIndex: string; position: string; boxShadow: string },
      element: HTMLElement
    ) => {
      element.style.zIndex = style.zIndex;
      element.style.position = style.position;
      element.style.boxShadow = style.boxShadow;
    });
    this.originalElementStyles.clear();

    if (this.tourPopover) this.tourPopover.remove();

    this.currentTourStep = stepIndex;
    const step = this.tourSteps[stepIndex];

    let targetElement: HTMLElement | null = null;
    if (typeof step.element === 'string') {
      targetElement = document.querySelector(step.element);
    } else {
      targetElement = step.element;
    }

    if (!targetElement) {
      //console.warn(`Elemento del tour no encontrado: ${step.element}`);
      this.nextTourStep(); // Saltar al siguiente paso
      return;
    }

    // Guardar estilos originales y resaltar el elemento
    this.originalElementStyles.set(targetElement, {
      zIndex: targetElement.style.zIndex,
      position: targetElement.style.position,
      boxShadow: targetElement.style.boxShadow,
    });
    targetElement.style.position = 'relative';
    targetElement.style.zIndex = '10002';
    targetElement.style.boxShadow = '0 0 0 4px rgba(37, 99, 235, 0.7)';
    targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Crear Popover
    this.tourPopover = document.createElement('div');
    this.tourPopover.id = 'tour-popover';
    Object.assign(this.tourPopover.style, {
      position: 'absolute',
      visibility: 'hidden', // Ocultar para calcular dimensiones
      backgroundColor: 'white',
      padding: '15px',
      borderRadius: '8px',
      boxShadow: '0 5px 15px rgba(0,0,0,0.3)',
      zIndex: '10003',
      width: '300px',
      maxWidth: '90vw',
    });

    const isLastStep = stepIndex === this.tourSteps.length - 1;
    const isFirstStep = stepIndex === 0;

    this.tourPopover.innerHTML = `
      <h3 style="margin-top:0; font-size: 1.1rem; font-weight: bold; color: #1e40af;">${step.title}</h3>
      <p style="font-size: 0.9rem; color: #334155;">${step.content}</p>
      <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 15px;">
        <button id="tour-prev" style="background: none; border: 1px solid #ccc; border-radius: 4px; padding: 5px 10px; cursor: pointer; visibility: ${isFirstStep ? 'hidden' : 'visible'};">Anterior</button>
        <span style="font-size: 0.8rem; color: #64748b;">${stepIndex + 1} / ${this.tourSteps.length}</span>
        <button id="tour-next" style="background-color: #2563eb; color: white; border: none; border-radius: 4px; padding: 5px 10px; font-weight: bold; cursor: pointer;">${isLastStep ? 'Finalizar' : 'Siguiente'}</button>
      </div>
      <button id="tour-end" title="Finalizar Tour" style="position: absolute; top: 8px; right: 8px; background: none; border: none; font-size: 1.2rem; cursor: pointer; color: #64748b;">&times;</button>
    `;

    document.body.appendChild(this.tourPopover);

    // Añadir listeners
    document.getElementById('tour-next')?.addEventListener('click', () => this.nextTourStep());
    document.getElementById('tour-prev')?.addEventListener('click', () => this.prevTourStep());
    document.getElementById('tour-end')?.addEventListener('click', () => this.endTour());

    // --- Lógica de Posicionamiento del Popover ---
    const targetRect = targetElement.getBoundingClientRect();
    const popoverRect = this.tourPopover.getBoundingClientRect();
    const margin = 10; // Espacio entre el elemento y el popover

    let top = 0;
    let left = 0;
    const stepPosition = step.position || 'bottom'; // 'bottom' por defecto

    switch (stepPosition) {
      case 'top-left':
        top = targetRect.top + window.scrollY - popoverRect.height - margin;
        left = targetRect.left + window.scrollX;
        break;
      case 'top':
        top = targetRect.top + window.scrollY - popoverRect.height - margin;
        left = targetRect.left + window.scrollX + (targetRect.width - popoverRect.width) / 2;
        break;
      case 'bottom':
        top = targetRect.bottom + window.scrollY + margin;
        left = targetRect.left + window.scrollX + (targetRect.width - popoverRect.width) / 2;
        break;
      case 'left':
        top = targetRect.top + window.scrollY + (targetRect.height - popoverRect.height) / 2;
        left = targetRect.left + window.scrollX - popoverRect.width - margin;
        break;
      case 'right':
        top = targetRect.top + window.scrollY + (targetRect.height - popoverRect.height) / 2;
        left = targetRect.right + window.scrollX + margin;
        break;
      case 'center':
        top = (window.innerHeight / 2) - (popoverRect.height / 2) + window.scrollY;
        left = (window.innerWidth / 2) - (popoverRect.width / 2) + window.scrollX;
        break;
    }

    // Ajustar si se sale de la pantalla
    if (left < margin) left = margin;
    if (left + popoverRect.width > window.innerWidth - margin) left = window.innerWidth - popoverRect.width - margin;
    if (top < margin) top = margin;
    if (top + popoverRect.height > window.innerHeight - margin) top = window.innerHeight - popoverRect.height - margin;

    this.tourPopover.style.top = `${top}px`;
    this.tourPopover.style.left = `${left}px`;
    this.tourPopover.style.visibility = 'visible'; // Mostrar popover
  }
}
