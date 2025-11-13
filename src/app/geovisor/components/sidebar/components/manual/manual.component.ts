import { Component, OnInit } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { CommonModule } from '@angular/common';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ManualDialogComponent } from './manual-dialog/manual-dialog.component';

@Component({
  selector: 'app-manual',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  templateUrl: './manual.component.html',
  styleUrl: './manual.component.scss'
})
export class ManualComponent implements OnInit {

  manualUrl = 'assets/manual/ManualGeoVisor.pdf';
  safeManualUrl: SafeResourceUrl | null = null;

  constructor(private sanitizer: DomSanitizer, private dialog: MatDialog) { }

  ngOnInit(): void {
    this.safeManualUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.manualUrl);
  }

  openManualModal(): void {
    this.dialog.open(ManualDialogComponent, {
      width: '90vw',
      height: '90vh',
      maxWidth: '1200px',
      data: {
        safeUrl: this.safeManualUrl,
        rawUrl: this.manualUrl
      }
    });
  }
}
