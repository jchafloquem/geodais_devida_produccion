import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ObservaComponent } from './observa.component';

describe('ObservaComponent', () => {
  let component: ObservaComponent;
  let fixture: ComponentFixture<ObservaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ObservaComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ObservaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
