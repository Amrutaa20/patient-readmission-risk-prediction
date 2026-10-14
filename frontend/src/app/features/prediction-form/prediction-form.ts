import { Component, NgZone } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  PredictionApi,
  PredictionResponse
} from '../../core/services/prediction-api';

@Component({
  selector: 'app-prediction-form',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './prediction-form.html',
  styleUrl: './prediction-form.css'
})
export class PredictionForm {
  rowIndex = 0;
  loading = false;
  errorMessage = '';
  result: PredictionResponse | null = null;

  constructor(
    private predictionApi: PredictionApi,
    private ngZone: NgZone
  ) {}

  predict(): void {
    this.loading = true;
    this.errorMessage = '';
    this.result = null;

    this.predictionApi.predictSample(Number(this.rowIndex)).subscribe({
      next: (response) => {
        this.ngZone.run(() => {
          this.result = response;
          this.loading = false;
        });
      },
      error: (error) => {
        this.ngZone.run(() => {
          this.errorMessage =
            error?.error?.detail ||
            error?.message ||
            'Prediction failed.';
          this.loading = false;
        });
      }
    });
  }
}