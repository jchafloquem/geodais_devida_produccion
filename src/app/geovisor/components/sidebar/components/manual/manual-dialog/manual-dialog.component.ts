import { Component, Inject } from '@angular/core';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { SafeResourceUrl } from '@angular/platform-browser';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-manual-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <div class="manual-dialog-header">
      <h2 mat-dialog-title>Manual de Usuario</h2>
      <button mat-icon-button (click)="onClose()" aria-label="Cerrar manual">
        <mat-icon>close</mat-icon>
      </button>
    </div>
    <mat-dialog-content class="manual-dialog-content">
      <iframe class="pdf-viewer" [src]="data.safeUrl" title="Manual de Usuario"></iframe>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <a mat-stroked-button [href]="data.rawUrl" download="Manual_de_Usuario_GeoCULTIVOS.pdf">
        <mat-icon>download</mat-icon>
        Descargar
      </a>
      <button mat-raised-button color="primary" (click)="onClose()">Cerrar</button>
    </mat-dialog-actions>
  `,
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      overflow: hidden;
    }
    .manual-dialog-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-shrink: 0;
      padding: 12px 24px;
      border-bottom: 1px solid #e0e0e0;
    }
    h2[mat-dialog-title] { margin: 0; }
    mat-dialog-content { flex-grow: 1; padding: 0 !important; margin: 0 !important; overflow: hidden; }
    .pdf-viewer { width: 100%; height: 100%; border: none; }
    mat-dialog-actions { padding: 8px 16px !important; border-top: 1px solid #e0e0e0; }
  `]
})
export class ManualDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<ManualDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { safeUrl: SafeResourceUrl, rawUrl: string }
  ) {}

  onClose(): void {
    this.dialogRef.close();
  }
}
