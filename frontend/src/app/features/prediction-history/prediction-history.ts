import { Component, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { PredictionApi, PredictionHistoryRecord } from '../../core/services/prediction-api';
import { PredictionHistoryStore } from '../../core/services/prediction-history-store';

@Component({
  selector: 'app-prediction-history',
  standalone: true,
  imports: [DatePipe, FormsModule, RouterLink],
  templateUrl: './prediction-history.html',
  styleUrl: './prediction-history.css'
})
export class PredictionHistory implements OnInit {
  dateRange = 'Last 30 days';
  riskCategory = 'All';
  modelFilter = 'All';
  availableModels: string[] = [];
  searchQuery = '';
  items: PredictionHistoryRecord[] = [];
  total = 0;
  currentPage = 1;
  readonly pageSize = 25;
  totalPages = 0;
  summary = { total: 0, higher_risk: 0, lower_risk: 0 };
  loading = false;
  errorMessage = '';
  migrationWarning = '';
  private migrationAttempted = false;

  constructor(
    private predictionApi: PredictionApi,
    private historyStore: PredictionHistoryStore,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.route.queryParamMap.subscribe((params) => {
      this.searchQuery = params.get('q') || '';
      this.ensureLegacyMigration();
    });
  }

  private ensureLegacyMigration(): void {
    if (this.migrationAttempted) {
      this.loadHistory();
      return;
    }
    this.migrationAttempted = true;
    this.historyStore.migrateLegacyHistory().subscribe({
      next: () => {
        this.migrationWarning = this.historyStore.lastReadError
          ? 'Legacy predictions were migrated, but old browser copies could not be removed.'
          : '';
        this.loadHistory();
      },
      error: () => {
        this.migrationWarning = 'Older browser predictions could not be migrated. They remain in this browser; new predictions are stored by the backend.';
        this.loadHistory();
      }
    });
  }

  retry(): void {
    this.errorMessage = '';
    this.migrationAttempted = false;
    this.ensureLegacyMigration();
  }

  applyFilters(): void {
    this.currentPage = 1;
    this.loadHistory();
  }

  changePage(page: number): void {
    if (page >= 1 && page <= this.totalPages && page !== this.currentPage) {
      this.currentPage = page;
      this.loadHistory();
    }
  }

  private loadHistory(): void {
    this.loading = true;
    this.errorMessage = '';
    const days = this.dateRange === 'Last 7 days' ? 7 : this.dateRange === 'Last 30 days' ? 30 : this.dateRange === 'Last 90 days' ? 90 : undefined;
    this.predictionApi.getPredictionHistory({
      page: this.currentPage,
      pageSize: this.pageSize,
      search: this.searchQuery.trim() || undefined,
      risk: this.riskCategory === 'All' ? undefined : this.riskCategory === 'High' ? 'higher' : 'lower',
      model: this.modelFilter === 'All' ? undefined : this.modelFilter,
      days
    }).subscribe({
      next: (response) => {
        this.items = response.items;
        this.total = response.total;
        this.currentPage = response.page;
        this.totalPages = response.total_pages;
        this.summary = response.summary;
        this.availableModels = response.available_models;
        this.loading = false;
      },
      error: (error) => {
        this.items = [];
        this.errorMessage = error?.error?.detail || 'Prediction history could not be loaded.';
        this.loading = false;
      }
    });
  }
}
