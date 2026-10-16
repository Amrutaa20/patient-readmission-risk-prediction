import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { PredictionApi, ModelComparisonResponse } from '../../core/services/prediction-api';

@Component({
  selector: 'app-model-performance',
  standalone: true,
  imports: [],
  templateUrl: './model-performance.html',
  styleUrl: './model-performance.css'
})
export class ModelPerformance implements OnInit {
  comparison?: ModelComparisonResponse;
  loading = false;
  errorMessage = '';

  constructor(private predictionApi: PredictionApi, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.loadComparison();
  }

  loadComparison(): void {
    this.loading = true;
    this.errorMessage = '';
    this.predictionApi.getModelComparison().subscribe({
      next: (comparison) => {
        this.comparison = comparison;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.errorMessage = 'Model evaluation metadata is unavailable.';
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }
}
