import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ObservatorioComponent } from './observatorio.component';

describe('ObservatorioComponent', () => {
  let component: ObservatorioComponent;
  let fixture: ComponentFixture<ObservatorioComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ObservatorioComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ObservatorioComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
