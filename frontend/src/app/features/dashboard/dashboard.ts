import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DashboardSummary, ModelComparisonMetric, PredictionApi, PredictionHistoryPage } from '../../core/services/prediction-api';
import { PredictionHistoryStore } from '../../core/services/prediction-history-store';

interface MetricCard {
  label: string;
  value: string;
  subtext: string;
  icon: string;
  color: 'blue' | 'teal' | 'red' | 'cyan';
}

interface RecentPrediction {
  id: string;
  source: string;
  riskScore: number;
  category: 'High' | 'Medium' | 'Low';
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class Dashboard implements OnInit {
  apiStatus: 'checking' | 'connected' | 'unavailable' = 'checking';
  apiModel = '';
  apiModelVersion = '';
  modelThreshold: number | null = null;
  modelSelectionStatus = 'provisional';
  apiError = '';
  evaluationStatus: 'loading' | 'ready' | 'unavailable' = 'loading';
  deployedEvaluation?: ModelComparisonMetric;
  evaluationNote = '';
  summaryStatus: 'loading' | 'ready' | 'unavailable' = 'loading';
  summaryError = '';
  summaryAsOf = '';
  historyStatus: 'loading' | 'ready' | 'unavailable' = 'loading';
  historyError = '';
  historyWarning = '';

  metrics: MetricCard[] = [
    { label: 'Dataset Encounters', value: 'Loading', subtext: 'Current local dataset', icon: 'users', color: 'blue' },
    { label: 'Patients Page Sample', value: 'Loading', subtext: 'Maximum records shown in Patients', icon: 'check-doc', color: 'teal' },
    { label: 'Historical Readmissions <30 Days', value: 'Loading', subtext: 'Recorded dataset outcomes', icon: 'alert', color: 'red' },
    { label: 'Completed Predictions', value: 'Loading', subtext: 'Stored by the backend', icon: 'percent', color: 'cyan' }
  ];

  recentPredictions: RecentPrediction[] = [];
  totalSaved = 0;
  higherRiskCount = 0;
  lowerRiskCount = 0;
  outcomeWithin30 = 0;
  outcomeAfter30 = 0;
  outcomeNoReadmission = 0;
  totalHistoricalOutcomes = 0;
  outcomeWithin30Arc = '0 339';
  outcomeAfter30Arc = '0 339';
  outcomeNoReadmissionArc = '0 339';

  constructor(
    private predictionApi: PredictionApi,
    private historyStore: PredictionHistoryStore,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.checkApi();
  }

  checkApi(): void {
    this.apiStatus = 'checking';
    this.apiError = '';
    this.predictionApi.checkHealth().subscribe({
      next: (res) => {
        this.apiStatus = 'connected';
        this.apiModel = res.model;
        this.apiModelVersion = res.model_version;
        this.modelThreshold = res.threshold;
        this.modelSelectionStatus = res.selection_status;
        this.cdr.markForCheck();
      },
      error: () => {
        this.apiStatus = 'unavailable';
        this.apiError = 'The prediction service is unavailable. Start the backend to check its active model and submit predictions.';
        this.cdr.markForCheck();
      }
    });

    this.evaluationStatus = 'loading';
    this.predictionApi.getModelComparison().subscribe({
      next: (comparison) => {
        this.deployedEvaluation = comparison.models.find((entry) => entry.name === comparison.deployment_model);
        this.evaluationNote = comparison.selection_note;
        this.evaluationStatus = this.deployedEvaluation ? 'ready' : 'unavailable';
        this.cdr.markForCheck();
      },
      error: () => {
        this.deployedEvaluation = undefined;
        this.evaluationStatus = 'unavailable';
        this.cdr.markForCheck();
      }
    });

    this.summaryStatus = 'loading';
    this.predictionApi.getDashboardSummary().subscribe({
      next: (summary) => {
        this.updateDatasetSummary(summary);
        this.summaryStatus = 'ready';
        this.summaryAsOf = new Date(summary.as_of).toLocaleString();
        this.cdr.markForCheck();
      },
      error: () => {
        this.summaryStatus = 'unavailable';
        this.summaryError = 'Dataset summary is unavailable. Retry after the backend and dataset are ready.';
        this.metrics.slice(0, 3).forEach((metric) => metric.value = 'Unavailable');
        this.cdr.markForCheck();
      }
    });

    this.historyStatus = 'loading';
    this.historyStore.migrateLegacyHistory().subscribe({
      next: () => this.loadRecentHistory(),
      error: () => {
        this.historyWarning = 'Older browser history could not be migrated; showing backend history only.';
        this.loadRecentHistory();
      }
    });
  }

  private loadRecentHistory(): void {
    this.predictionApi.getPredictionHistory({ page: 1, pageSize: 5 }).subscribe({
      next: (history) => {
        this.updatePredictionHistory(history);
        this.historyStatus = 'ready';
        this.cdr.markForCheck();
      },
      error: () => {
        this.historyStatus = 'unavailable';
        this.historyError = 'Prediction history is unavailable. Retry to check saved assessments.';
        this.metrics[3].value = 'Unavailable';
        this.cdr.markForCheck();
      }
    });
  }

  private updateDatasetSummary(summary: DashboardSummary): void {
    this.metrics[0].value = summary.dataset_records.toLocaleString();
    this.metrics[1].value = summary.browsable_sample_records.toLocaleString();
    this.metrics[2].value = summary.historical_readmissions_within_30_days.toLocaleString();
    this.metrics[2].subtext = `Historical rate ${(summary.historical_readmission_rate * 100).toFixed(1)}% in this dataset`;
    this.outcomeWithin30 = summary.historical_outcomes.within_30_days;
    this.outcomeAfter30 = summary.historical_outcomes.after_30_days;
    this.outcomeNoReadmission = summary.historical_outcomes.no_readmission;
    this.totalHistoricalOutcomes = this.outcomeWithin30 + this.outcomeAfter30 + this.outcomeNoReadmission;
    const circumference = 339;
    const ratio = (count: number) => this.totalHistoricalOutcomes ? count / this.totalHistoricalOutcomes * circumference : 0;
    this.outcomeWithin30Arc = `${ratio(this.outcomeWithin30)} ${circumference}`;
    this.outcomeAfter30Arc = `${ratio(this.outcomeAfter30)} ${circumference}`;
    this.outcomeNoReadmissionArc = `${ratio(this.outcomeNoReadmission)} ${circumference}`;
  }

  private updatePredictionHistory(history: PredictionHistoryPage): void {
    this.totalSaved = history.summary.total;
    this.higherRiskCount = history.summary.higher_risk;
    this.lowerRiskCount = history.summary.lower_risk;
    this.metrics[3].value = history.summary.total.toLocaleString();
    this.recentPredictions = history.items.map((item) => ({
      id: item.id,
      source: item.source,
      riskScore: item.readmission_probability,
      category: item.predicted_class === 1 ? 'High' : 'Low'
    }));
  }
}
