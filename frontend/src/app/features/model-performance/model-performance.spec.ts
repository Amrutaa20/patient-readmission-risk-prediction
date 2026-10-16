import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ModelPerformance } from './model-performance';
import { PredictionApi } from '../../core/services/prediction-api';

describe('ModelPerformance', () => {
  let component: ModelPerformance;
  let fixture: ComponentFixture<ModelPerformance>;
  const comparison = {
    source: 'models/model_comparison_metadata.json',
    evaluation_split: { method: 'stratified', random_state: 42, train_rows: 81412, test_rows: 20354, test_positive_rows: 2271, test_negative_rows: 18083, features: 111 },
    deployment_model: 'XGBoost',
    model_version: 'xgboost_model',
    target_definition: "Binary readmission within 30 days: raw readmitted == '<30'.",
    evaluation_type: 'Recorded test split used during selection.',
    validation_split_available: false,
    selection_status: 'provisional',
    selection_note: 'Existing results need a separate validation set.',
    models: [{ name: 'XGBoost', threshold: 0.4, roc_auc: 0.687475, pr_auc: 0.234115, precision: 0.150554, recall: 0.813298, f1_score: 0.254075, accuracy: 0.467181, true_negative: 7662, false_positive: 10421, false_negative: 424, true_positive: 1847 }]
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ModelPerformance],
      providers: [{ provide: PredictionApi, useValue: { getModelComparison: () => of(comparison) } }],
    }).compileComponents();

    fixture = TestBed.createComponent(ModelPerformance);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows model comparison data from the backend metadata source', () => {
    expect(component.comparison?.models[0].name).toBe('XGBoost');
    expect(component.comparison?.models[0].true_positive).toBe(1847);
    expect(fixture.nativeElement.textContent).toContain('ROC-AUC');
    expect(fixture.nativeElement.textContent).toContain('Decision Threshold');
  });
});
