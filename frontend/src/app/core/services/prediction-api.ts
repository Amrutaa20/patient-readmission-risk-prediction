import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface PredictionResponse {
  row_index: number;
  predicted_class: number;
  predicted_label: string;
  readmission_probability: number;
  threshold: number;
  actual_label: number;
  note: string;
}

export interface ApiHealthResponse {
  message: string;
  status: string;
  model: string;
  input_features: number;
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
    return this.http.post<PredictionResponse>(
      `${this.apiUrl}/predict/sample`,
      { row_index: rowIndex }
    );
  }
}