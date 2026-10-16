import { Injectable } from '@angular/core';
import { Observable, catchError, concatMap, from, map, of, shareReplay, tap, throwError, toArray } from 'rxjs';
import { PredictionApi } from './prediction-api';
import { PredictionResponse } from './prediction-api';

export interface StoredPrediction extends PredictionResponse {
  id: string;
  patientId: string;
  createdAt: string;
  model: string;
}

@Injectable({ providedIn: 'root' })
export class PredictionHistoryStore {
  private readonly storageKey = 'patient-readmission-predictions';
  private migrationRequest?: Observable<void>;
  lastReadError = false;

  constructor(private predictionApi: PredictionApi) {}

  getAll(): StoredPrediction[] {
    this.lastReadError = false;
    try {
      const value = localStorage.getItem(this.storageKey);
      if (!value) return [];
      const parsed: unknown = JSON.parse(value);
      if (!Array.isArray(parsed)) return [];
      let retentionDays = 30;
      try {
        const retentionValue = JSON.parse(localStorage.getItem('patient-readmission-settings') || '{}')?.dataRetention;
        const configuredDays = Number(retentionValue);
        if ([7, 30, 90].includes(configuredDays)) retentionDays = configuredDays;
      } catch {
        // Invalid preference data uses the documented default retention.
      }
      const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
      const retained = (parsed as StoredPrediction[]).filter((item) => {
        const created = Date.parse(item.createdAt);
        return Number.isFinite(created) && created >= cutoff;
      });
      if (retained.length !== parsed.length) {
        localStorage.setItem(this.storageKey, JSON.stringify(retained));
      }
      return retained;
    } catch {
      this.lastReadError = true;
      return [];
    }
  }

  clear(): void {
    try {
      localStorage.removeItem(this.storageKey);
      this.lastReadError = false;
    } catch {
      this.lastReadError = true;
    }
  }

  migrateLegacyHistory(): Observable<void> {
    if (this.migrationRequest) return this.migrationRequest;
    const legacy = this.getAll();
    if (this.lastReadError) return throwError(() => new Error('Legacy browser history could not be read.'));
    if (!legacy.length) {
      this.migrationRequest = of(undefined).pipe(shareReplay({ bufferSize: 1, refCount: false }));
      return this.migrationRequest;
    }
    const items = legacy.map((item) => ({
      request_id: item.id,
      prediction_timestamp: item.prediction_timestamp || item.createdAt,
      model: item.model,
      model_version: item.model_version || 'legacy artifact version unavailable',
      predicted_class: item.predicted_class,
      predicted_label: item.predicted_label,
      readmission_probability: item.readmission_probability,
      threshold: item.threshold,
      source: item.row_index === null ? 'legacy clinical form' : 'legacy dataset sample'
    }));
    const batches = Array.from({ length: Math.ceil(items.length / 1000) }, (_, index) => items.slice(index * 1000, (index + 1) * 1000));
    this.migrationRequest = from(batches).pipe(
      concatMap((batch) => this.predictionApi.importLegacyHistory(batch)),
      toArray(),
      tap(() => this.clear()),
      map(() => undefined),
      catchError((error) => {
        this.migrationRequest = undefined;
        return throwError(() => error);
      }),
      shareReplay({ bufferSize: 1, refCount: false })
    );
    return this.migrationRequest;
  }
}
