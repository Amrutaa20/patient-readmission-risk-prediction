import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';

interface PredictionResult {
  row_index: number;
  predicted_class: number;
  predicted_label: string;
  readmission_probability: number;
  threshold: number;
  actual_label: number;
  note: string;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  activeSection = 'dashboard';

  rowIndex = 0;
  prediction: PredictionResult | null = null;
  loading = false;
  errorMessage = '';

  private readonly apiUrl = 'http://127.0.0.1:8000';

  constructor(private http: HttpClient) {}

  setActiveSection(section: string): void {
    this.activeSection = section;
  }

  predictReadmission(): void {
    this.loading = true;
    this.errorMessage = '';
    this.prediction = null;

    this.http
      .post<PredictionResult>(`${this.apiUrl}/predict/sample`, {
        row_index: Number(this.rowIndex),
      })
      .subscribe({
        next: (result) => {
          this.prediction = result;
          this.loading = false;
        },
        error: (error) => {
          this.loading = false;
          this.errorMessage =
            error.error?.detail ??
            'Unable to get a prediction. Check that the backend is running.';
          console.error('Prediction request failed:', error);
        },
      });
  }
}