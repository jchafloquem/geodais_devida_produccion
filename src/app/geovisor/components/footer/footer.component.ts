import { Component } from '@angular/core';

@Component({
  selector: 'app-footer',
  imports: [],
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.scss'
})
export class FooterComponent {
  public anioencurso : number;

  constructor() {
    this.anioencurso = new Date().getFullYear();
    }

}
