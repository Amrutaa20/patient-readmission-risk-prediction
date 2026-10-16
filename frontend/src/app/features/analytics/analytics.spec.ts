import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { PredictionApi } from '../../core/services/prediction-api';
import { Analytics } from './analytics';

describe('Analytics', () => {
  let component: Analytics;
  let fixture: ComponentFixture<Analytics>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Analytics],
      providers: [{ provide: PredictionApi, useValue: { getDatasetAnalytics: () => of({
        dataset_records: 101766,
        target_definition: "<30 days is positive",
        source: 'data/raw/diabetic_data.csv',
        by_age: [{ label: '[50-60)', records: 20000, readmissions: 2500, rate: 0.125 }],
        by_gender: [{ label: 'Female', records: 50000, readmissions: 5600, rate: 0.112 }],
        by_primary_diagnosis_group: [{ label: 'Diabetes', records: 10000, readmissions: 1300, rate: 0.13 }],
        by_prior_inpatient_visits: [{ label: '0', records: 70000, readmissions: 7000, rate: 0.1 }],
        by_admission_type: [{ label: 'Emergency (code 1)', records: 40000, readmissions: 5000, rate: 0.125 }],
        by_length_of_stay: [{ label: '1-3 days', records: 30000, readmissions: 3000, rate: 0.1 }]
      }) } }],
    }).compileComponents();

    fixture = TestBed.createComponent(Analytics);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders rates and counts returned by the dataset analytics API', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Historical Dataset Analytics');
    expect(fixture.nativeElement.textContent).toContain('12.5%');
    expect(fixture.nativeElement.textContent).toContain('2500/20000');
  });
});
