import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Navigation, provideRouter, Router } from '@angular/router';
import { vi } from 'vitest';
import { of } from 'rxjs';
import { PredictionApi } from '../../core/services/prediction-api';
import { PredictionResult } from './prediction-result';

describe('PredictionResult', () => {
  let component: PredictionResult;
  let fixture: ComponentFixture<PredictionResult>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PredictionResult],
      providers: [provideRouter([]), { provide: PredictionApi, useValue: { getPredictionHistoryItem: () => of({}) } }],
    }).compileComponents();

  });

  it('should create', () => {
    fixture = TestBed.createComponent(PredictionResult);
    component = fixture.componentInstance;
    expect(component).toBeTruthy();
  });

  it('renders the backend estimate separately from an unavailable new-encounter outcome', () => {
    const response = {
      row_index: null,
      model: 'XGBoost',
      model_version: 'xgboost_model.pkl',
      history_id: 'PH-test',
      history_status: 'persisted',
      predicted_class: 0,
      predicted_label: 'Lower estimated readmission risk',
      readmission_probability: 0.0764,
      threshold: 0.4,
      actual_label: null,
      prediction_timestamp: '2026-10-15T10:00:00+00:00',
      note: 'Model estimate'
    };
    vi.spyOn(TestBed.inject(Router), 'getCurrentNavigation').mockReturnValue({
      extras: { state: { prediction: response, patientId: 'Custom encounter' } }
    } as unknown as Navigation);
    fixture = TestBed.createComponent(PredictionResult);
    component = fixture.componentInstance;
    fixture.detectChanges();

    const content = fixture.nativeElement.textContent as string;
    expect(content).toContain('7.6%');
    expect(content).toContain('No readmission within 30 days (class 0)');
    expect(content).toContain('Not available for a new encounter');
    expect(content).toContain('Class 0 below 40%');
  });
});
