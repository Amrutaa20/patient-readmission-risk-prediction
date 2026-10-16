import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface PredictionResponse {
  row_index: number | null;
  model: string;
  model_version: string;
  history_id: string | null;
  history_status: 'persisted' | 'unavailable';
  predicted_class: number;
  predicted_label: string;
  readmission_probability: number;
  threshold: number;
  actual_label: number | null;
  prediction_timestamp: string;
  note: string;
}

export interface ApiHealthResponse {
  message: string;
  status: string;
  model: string;
  model_version: string;
  input_features: number;
  threshold: number;
  selection_status: string;
}

export interface DatasetPatientRecord {
  row_index: number;
  race: string;
  gender: string;
  age: string;
  admission_type_id: number;
  admission_type_label: string;
  discharge_disposition_id: number;
  discharge_disposition_label: string;
  admission_source_id: number;
  admission_source_label: string;
  time_in_hospital: number;
  num_lab_procedures: number;
  num_procedures: number;
  num_medications: number;
  number_inpatient: number;
  medical_specialty: string;
  readmitted: '<30' | '>30' | 'NO' | string;
}

export interface DatasetPatientPage {
  items: DatasetPatientRecord[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface DashboardSummary {
  dataset_records: number;
  browsable_sample_records: number;
  historical_readmissions_within_30_days: number;
  historical_readmission_rate: number;
  historical_outcomes: { within_30_days: number; after_30_days: number; no_readmission: number };
  as_of: string;
}

export interface PredictionHistoryRecord extends PredictionResponse {
  id: string;
  model_version: string;
  source: string;
  row_index: null;
  actual_label: null;
}

export interface PredictionHistoryPage {
  items: PredictionHistoryRecord[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  summary: { total: number; higher_risk: number; lower_risk: number };
  available_models: string[];
}

export interface DatasetAnalyticsGroup {
  label: string;
  records: number;
  readmissions: number;
  rate: number;
}

export interface DatasetAnalytics {
  dataset_records: number;
  target_definition: string;
  source: string;
  by_age: DatasetAnalyticsGroup[];
  by_gender: DatasetAnalyticsGroup[];
  by_primary_diagnosis_group: DatasetAnalyticsGroup[];
  by_prior_inpatient_visits: DatasetAnalyticsGroup[];
  by_admission_type: DatasetAnalyticsGroup[];
  by_length_of_stay: DatasetAnalyticsGroup[];
}

export interface DatasetPatientFilters {
  age: string[];
  gender: string[];
  race: string[];
}

export interface DatasetPatientQuery {
  page: number;
  pageSize: number;
  search?: string;
  age?: string;
  gender?: string;
  race?: string;
}

export interface ModelComparisonMetric {
  name: string;
  threshold: number;
  roc_auc: number;
  pr_auc: number;
  precision: number;
  recall: number;
  f1_score: number;
  accuracy: number;
  true_negative: number;
  false_positive: number;
  false_negative: number;
  true_positive: number;
}

export interface ModelComparisonResponse {
  source: string;
  evaluation_split: {
    method: string;
    random_state: number;
    train_rows: number;
    test_rows: number;
    test_positive_rows: number;
    test_negative_rows: number;
    features: number;
  };
  deployment_model: string;
  model_version: string;
  target_definition: string;
  evaluation_type: string;
  validation_split_available: boolean;
  selection_status: string;
  selection_note: string;
  models: ModelComparisonMetric[];
}

export interface AssistantAnswer {
  answer: string;
  source: string;
  as_of: string;
}

@Injectable({
  providedIn: 'root'
})
export class PredictionApi {
  private readonly apiUrl = 'http://127.0.0.1:8000';

  constructor(private http: HttpClient) {}

  checkHealth(): Observable<ApiHealthResponse> {
    return this.http.get<ApiHealthResponse>(this.apiUrl);
  }

  predictSample(rowIndex: number): Observable<PredictionResponse> {
    return this.http.post<unknown>(
      `${this.apiUrl}/predict/sample`,
      { row_index: rowIndex },
      { headers: { 'Idempotency-Key': this.createRequestId() } }
    ).pipe(map((response) => this.validatePrediction(response)));
  }

  predictClinical(input: Record<string, string | number>): Observable<PredictionResponse> {
    return this.http.post<unknown>(`${this.apiUrl}/predict`, input, {
      headers: { 'Idempotency-Key': this.createRequestId() }
    })
      .pipe(map((response) => this.validatePrediction(response)));
  }

  getPredictionHistory(query: { page: number; pageSize: number; search?: string; risk?: string; model?: string; days?: number }): Observable<PredictionHistoryPage> {
    let params = new HttpParams().set('page', query.page).set('page_size', query.pageSize);
    for (const key of ['search', 'risk', 'model', 'days'] as const) {
      const value = query[key];
      if (value !== undefined && value !== '') params = params.set(key, value);
    }
    return this.http.get<PredictionHistoryPage>(`${this.apiUrl}/prediction-history`, { params });
  }

  getPredictionHistoryItem(id: string): Observable<PredictionHistoryRecord> {
    return this.http.get<PredictionHistoryRecord>(`${this.apiUrl}/prediction-history/${encodeURIComponent(id)}`);
  }

  importLegacyHistory(items: unknown[]): Observable<{ imported: number }> {
    return this.http.post<{ imported: number }>(`${this.apiUrl}/prediction-history/import`, { items });
  }

  clearPredictionHistory(): Observable<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(`${this.apiUrl}/prediction-history`);
  }

  getDatasetPatients(query: DatasetPatientQuery): Observable<DatasetPatientPage> {
    let params = new HttpParams()
      .set('page', query.page)
      .set('page_size', query.pageSize);
    for (const key of ['search', 'age', 'gender', 'race'] as const) {
      const value = query[key];
      if (value) params = params.set(key, value);
    }
    return this.http.get<DatasetPatientPage>(`${this.apiUrl}/patients`, { params });
  }

  getDatasetPatientFilters(): Observable<DatasetPatientFilters> {
    return this.http.get<DatasetPatientFilters>(`${this.apiUrl}/patients/filters`);
  }

  getDashboardSummary(): Observable<DashboardSummary> {
    return this.http.get<DashboardSummary>(`${this.apiUrl}/dashboard/summary`);
  }

  getDatasetAnalytics(): Observable<DatasetAnalytics> {
    return this.http.get<DatasetAnalytics>(`${this.apiUrl}/analytics`);
  }

  askAssistant(question: string): Observable<AssistantAnswer> {
    return this.http.post<AssistantAnswer>(`${this.apiUrl}/assistant/query`, { question });
  }

  private createRequestId(): string {
    return globalThis.crypto?.randomUUID?.() ?? `req-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  getModelComparison(): Observable<ModelComparisonResponse> {
    return this.http.get<ModelComparisonResponse>(`${this.apiUrl}/model-comparison`);
  }

  private validatePrediction(value: unknown): PredictionResponse {
    if (typeof value !== 'object' || value === null) {
      throw new Error('Prediction API returned a malformed response.');
    }
    const response = value as Partial<PredictionResponse>;
    const validBinary = (n: unknown): n is 0 | 1 => n === 0 || n === 1;
    const validNullableBinary = (n: unknown): n is 0 | 1 | null => n === null || validBinary(n);
    const probability = response.readmission_probability;
    const threshold = response.threshold;
    const validRow = response.row_index === null ||
      (Number.isInteger(response.row_index) && Number(response.row_index) >= 0);

    if (
      !validBinary(response.predicted_class) ||
      typeof response.model !== 'string' || response.model.trim() === '' ||
      typeof response.model_version !== 'string' || response.model_version.trim() === '' ||
      !['persisted', 'unavailable'].includes(String(response.history_status)) ||
      (response.history_status === 'persisted' && (typeof response.history_id !== 'string' || response.history_id.trim() === '')) ||
      (response.history_status === 'unavailable' && response.history_id !== null) ||
      !validNullableBinary(response.actual_label) ||
      typeof probability !== 'number' || !Number.isFinite(probability) || probability < 0 || probability > 1 ||
      typeof threshold !== 'number' || !Number.isFinite(threshold) || threshold < 0 || threshold > 1 ||
      response.predicted_class !== Number(probability >= threshold) ||
      response.predicted_label !== (response.predicted_class === 1 ? 'Higher estimated readmission risk' : 'Lower estimated readmission risk') ||
      !validRow ||
      typeof response.prediction_timestamp !== 'string' || !Number.isFinite(Date.parse(response.prediction_timestamp)) ||
      typeof response.predicted_label !== 'string' ||
      typeof response.note !== 'string' || response.note.trim() === '' ||
      (response.row_index === null && response.actual_label !== null) ||
      (response.row_index !== null && response.actual_label === null)
    ) {
      throw new Error('Prediction API returned an invalid prediction result.');
    }
    return response as PredictionResponse;
  }
}
