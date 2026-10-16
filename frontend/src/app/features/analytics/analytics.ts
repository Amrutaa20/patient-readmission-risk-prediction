import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { DatasetAnalytics, DatasetAnalyticsGroup, PredictionApi } from '../../core/services/prediction-api';

@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [],
  templateUrl: './analytics.html',
  styleUrl: './analytics.css'
})
export class Analytics implements OnInit {
  analytics: DatasetAnalytics | null = null;
  loading = true;
  errorMessage = '';

  constructor(private predictionApi: PredictionApi, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.loadAnalytics();
  }

  loadAnalytics(): void {
    this.loading = true;
    this.errorMessage = '';
    this.predictionApi.getDatasetAnalytics().subscribe({
      next: (analytics) => {
        this.analytics = analytics;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.errorMessage = 'Dataset analytics could not be loaded. Check the backend and retry.';
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  barHeight(rate: number, groups: DatasetAnalyticsGroup[]): number {
    const maximum = Math.max(...groups.map((group) => group.rate), 0);
    return maximum > 0 ? rate / maximum * 100 : 0;
  }
}
