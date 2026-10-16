import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { PredictionApi } from '../../core/services/prediction-api';
import { PredictionHistoryStore } from '../../core/services/prediction-history-store';
import { Dashboard } from './dashboard';

describe('Dashboard', () => {
  let component: Dashboard;
  let fixture: ComponentFixture<Dashboard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Dashboard],
      providers: [
        provideRouter([]),
        { provide: PredictionApi, useValue: {
          checkHealth: () => of({ model: 'XGBoost', model_version: 'xgboost_model', threshold: 0.4, selection_status: 'provisional' }),
          getDashboardSummary: () => of({ dataset_records: 101766, browsable_sample_records: 50, historical_readmissions_within_30_days: 11357, historical_readmission_rate: 11357 / 101766, historical_outcomes: { within_30_days: 11357, after_30_days: 35545, no_readmission: 54864 }, as_of: '2026-10-16T00:00:00Z' }),
          getPredictionHistory: () => of({ items: [], total: 0, page: 1, page_size: 5, total_pages: 0, summary: { total: 0, higher_risk: 0, lower_risk: 0 }, available_models: [] }),
          getModelComparison: () => of({ deployment_model: 'XGBoost', selection_note: 'Provisional evaluation.', models: [{ name: 'XGBoost', threshold: 0.4, roc_auc: 0.687475, pr_auc: 0.234115, recall: 0.813298, precision: 0.150554, f1_score: 0.254075, accuracy: 0.467181, true_negative: 7662, false_positive: 10421, false_negative: 424, true_positive: 1847 }] })
        } },
        { provide: PredictionHistoryStore, useValue: { migrateLegacyHistory: () => of(undefined) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Dashboard);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows active backend model metadata and a useful empty state', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Currently deployed: XGBoost / xgboost_model');
    expect(fixture.nativeElement.textContent).toContain('Historical Readmission Outcomes');
    expect(fixture.nativeElement.textContent).not.toContain('How to read this chart');
    expect(fixture.nativeElement.textContent).not.toContain("The distribution uses the raw dataset's recorded readmission outcomes");
    expect(fixture.nativeElement.textContent).toContain('No predictions have completed yet');
    expect(fixture.nativeElement.textContent).toContain('New Prediction');
    expect(fixture.nativeElement.textContent).toContain('0.687');
    expect(component.metrics[0].value.replaceAll(',', '')).toBe('101766');
    expect(fixture.nativeElement.textContent).toContain('11,357');
    expect(fixture.nativeElement.textContent).toContain('50');
  });
});
