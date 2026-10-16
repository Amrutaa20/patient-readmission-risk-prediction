import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PredictionForm } from './prediction-form';

describe('PredictionForm', () => {
  let component: PredictionForm;
  let fixture: ComponentFixture<PredictionForm>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PredictionForm],
    }).compileComponents();

    fixture = TestBed.createComponent(PredictionForm);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('blocks submission when required model inputs are missing', () => {
    component.predict();
    expect(component.result).toBeNull();
    expect(component.errorMessage).toContain('Complete all encounter fields');
  });
});
