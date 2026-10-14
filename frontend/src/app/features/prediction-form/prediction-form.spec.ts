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
});
