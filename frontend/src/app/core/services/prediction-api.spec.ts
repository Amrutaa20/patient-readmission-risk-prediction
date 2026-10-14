import { TestBed } from '@angular/core/testing';
import { PredictionApi } from './prediction-api';

describe('PredictionApi', () => {
  let service: PredictionApi;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PredictionApi);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
