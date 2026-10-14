import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PredictionResult } from './prediction-result';

describe('PredictionResult', () => {
  let component: PredictionResult;
  let fixture: ComponentFixture<PredictionResult>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PredictionResult],
    }).compileComponents();

    fixture = TestBed.createComponent(PredictionResult);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
