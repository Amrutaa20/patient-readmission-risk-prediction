import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { PredictionApi } from '../../core/services/prediction-api';
import { About } from './about';

describe('About', () => {
  let component: About;
  let fixture: ComponentFixture<About>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [About],
      providers: [{ provide: PredictionApi, useValue: { getModelComparison: () => of({ deployment_model: 'XGBoost', models: [] }) } }],
    }).compileComponents();

    fixture = TestBed.createComponent(About);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
