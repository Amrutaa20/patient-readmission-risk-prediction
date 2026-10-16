import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { PredictionHistory } from './prediction-history';
import { PredictionApi } from '../../core/services/prediction-api';
import { PredictionHistoryStore } from '../../core/services/prediction-history-store';

describe('PredictionHistory', () => {
  let component: PredictionHistory;
  let fixture: ComponentFixture<PredictionHistory>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PredictionHistory],
      providers: [
        provideRouter([]),
        { provide: PredictionApi, useValue: {
          getPredictionHistory: () => of({ items: [], total: 0, page: 1, page_size: 25, total_pages: 0, summary: { total: 0, higher_risk: 0, lower_risk: 0 }, available_models: [] }),
          importLegacyHistory: () => of({ imported: 0 })
        } },
        { provide: PredictionHistoryStore, useValue: { migrateLegacyHistory: () => of(undefined), lastReadError: false } }
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PredictionHistory);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('explains that predictions appear automatically and offers a new prediction action', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('recorded automatically');
    expect(fixture.nativeElement.textContent).toContain('New Prediction');
    expect(fixture.nativeElement.textContent).toContain('No completed predictions match');
  });
});
