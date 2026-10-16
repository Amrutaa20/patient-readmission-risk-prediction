import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { PredictionApi } from '../../core/services/prediction-api';
import { PredictionHistoryStore } from '../../core/services/prediction-history-store';
import { Settings } from './settings';

describe('Settings', () => {
  let component: Settings;
  let fixture: ComponentFixture<Settings>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Settings],
      providers: [
        { provide: PredictionHistoryStore, useValue: { clear: () => undefined } },
        { provide: PredictionApi, useValue: {
          checkHealth: () => of({ model: 'CatBoost', model_version: 'catboost', threshold: 0.35, selection_status: 'provisional' }),
          clearPredictionHistory: () => of({ deleted: true })
        } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Settings);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
