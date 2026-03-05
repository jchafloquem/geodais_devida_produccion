import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ReniecComponent } from './reniec.component';

describe('ReniecComponent', () => {
  let component: ReniecComponent;
  let fixture: ComponentFixture<ReniecComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReniecComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ReniecComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
