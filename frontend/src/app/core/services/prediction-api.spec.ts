import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PredictionApi } from './prediction-api';

describe('PredictionApi', () => {
  let service: PredictionApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(PredictionApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('posts clinical inputs and accepts a consistent model response', () => {
    let result: unknown;
    service.predictClinical({ time_in_hospital: 4 }).subscribe((response) => result = response);
    const request = http.expectOne('http://127.0.0.1:8000/predict');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ time_in_hospital: 4 });
    expect(request.request.headers.get('Idempotency-Key')).toBeTruthy();
    request.flush({
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
      note: 'Model response'
    });
    expect(result).toEqual(expect.objectContaining({ predicted_class: 0, readmission_probability: 0.0764 }));
  });

  it('rejects malformed prediction responses rather than passing them to the UI', () => {
    let error: Error | undefined;
    service.predictClinical({}).subscribe({ error: (value) => error = value });
    http.expectOne('http://127.0.0.1:8000/predict').flush({
      row_index: null,
      model: 'XGBoost',
      model_version: 'xgboost_model.pkl',
      history_id: 'PH-test',
      history_status: 'persisted',
      predicted_class: 1,
      predicted_label: 'Higher estimated readmission risk',
      readmission_probability: 0.2,
      threshold: 0.4,
      actual_label: null,
      prediction_timestamp: '2026-10-15T10:00:00+00:00',
      note: 'Invalid class/probability pair'
    });
    expect(error?.message).toContain('invalid prediction result');
  });

  it('passes through a prediction with an explicit persistence failure status', () => {
    let result: unknown;
    service.predictClinical({ time_in_hospital: 4 }).subscribe((response) => result = response);
    http.expectOne('http://127.0.0.1:8000/predict').flush({
      row_index: null, model: 'XGBoost', model_version: 'xgboost_model.pkl',
      history_id: null, history_status: 'unavailable', predicted_class: 0,
      predicted_label: 'Lower estimated readmission risk', readmission_probability: 0.1,
      threshold: 0.4, actual_label: null, prediction_timestamp: '2026-10-15T10:00:00+00:00',
      note: 'Model response'
    });
    expect(result).toEqual(expect.objectContaining({ history_status: 'unavailable', history_id: null }));
  });

  it('propagates a backend-unavailable error', () => {
    let error: Error | undefined;
    service.predictSample(0).subscribe({ error: (value) => error = value });
    http.expectOne('http://127.0.0.1:8000/predict/sample').error(new ProgressEvent('error'));
    expect(error).toBeTruthy();
  });

  it('requests the bounded sample with server-side search and filters', () => {
    let result: unknown;
    service.getDatasetPatients({
      page: 1, pageSize: 50, search: 'female', age: '[50-60)', gender: 'Female'
    }).subscribe((response) => result = response);
    const request = http.expectOne((req) =>
      req.url === 'http://127.0.0.1:8000/patients' &&
      req.params.get('page') === '1' &&
      req.params.get('page_size') === '50' &&
      req.params.get('search') === 'female' &&
      req.params.get('age') === '[50-60)' &&
      req.params.get('gender') === 'Female'
    );
    expect(request.request.method).toBe('GET');
    request.flush({ items: [], total: 0, page: 1, page_size: 50, total_pages: 0 });
    expect(result).toEqual(expect.objectContaining({ total: 0, page: 1 }));
  });

  it('loads live dataset summary statistics for the dashboard', () => {
    let result: unknown;
    service.getDashboardSummary().subscribe((summary) => result = summary);
    const request = http.expectOne('http://127.0.0.1:8000/dashboard/summary');
    request.flush({ dataset_records: 101766, browsable_sample_records: 50, historical_readmissions_within_30_days: 11357, historical_readmission_rate: 11357 / 101766, as_of: '2026-10-16T00:00:00Z' });
    expect(result).toEqual(expect.objectContaining({ dataset_records: 101766, browsable_sample_records: 50 }));
  });

  it('sends assistant questions to the deterministic backend data query', () => {
    let result: unknown;
    service.askAssistant('How many encounters are in the dataset?').subscribe((answer) => result = answer);
    const request = http.expectOne('http://127.0.0.1:8000/assistant/query');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ question: 'How many encounters are in the dataset?' });
    request.flush({ answer: '101,766 encounter records.', source: 'Current raw dataset', as_of: '2026-10-16T00:00:00Z' });
    expect(result).toEqual(expect.objectContaining({ source: 'Current raw dataset' }));
  });
});
