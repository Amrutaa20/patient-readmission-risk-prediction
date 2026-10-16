import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { DatasetPatientFilters, DatasetPatientRecord, PredictionApi } from '../../core/services/prediction-api';

@Component({
  selector: 'app-patients',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './patients.html',
  styleUrl: './patients.css'
})
export class Patients implements OnInit, OnDestroy {
  records: DatasetPatientRecord[] = [];
  filters: DatasetPatientFilters = { age: [], gender: [], race: [] };
  search = '';
  selectedAge = '';
  selectedGender = '';
  selectedRace = '';
  readonly pageSize = 50;
  totalRecords = 0;
  loading = false;
  errorMessage = '';
  private appliedSearch = '';
  private appliedAge = '';
  private appliedGender = '';
  private appliedRace = '';

  private datasetRequest?: Subscription;

  constructor(private predictionApi: PredictionApi) {}

  ngOnInit(): void {
    this.loadDatasetFilters();
    this.loadDatasetRecords();
  }

  ngOnDestroy(): void {
    this.datasetRequest?.unsubscribe();
  }

  get hasUnappliedDatasetChanges(): boolean {
    return this.search.trim() !== this.appliedSearch || this.selectedAge !== this.appliedAge ||
      this.selectedGender !== this.appliedGender || this.selectedRace !== this.appliedRace;
  }

  get hasAppliedDatasetCriteria(): boolean {
    return !!(this.appliedSearch || this.appliedAge || this.appliedGender || this.appliedRace);
  }

  loadDatasetFilters(): void {
    this.predictionApi.getDatasetPatientFilters().subscribe({
      next: (filters) => { this.filters = filters; },
      // Browsing remains available if filter metadata cannot be fetched.
      error: () => { this.filters = { age: [], gender: [], race: [] }; }
    });
  }

  loadDatasetRecords(): void {
    this.datasetRequest?.unsubscribe();
    this.loading = true;
    this.errorMessage = '';
    this.appliedSearch = this.search.trim();
    this.appliedAge = this.selectedAge;
    this.appliedGender = this.selectedGender;
    this.appliedRace = this.selectedRace;
    this.datasetRequest = this.predictionApi.getDatasetPatients({
      page: 1,
      pageSize: this.pageSize,
      search: this.search.trim() || undefined,
      age: this.selectedAge || undefined,
      gender: this.selectedGender || undefined,
      race: this.selectedRace || undefined
    }).subscribe({
      next: (response) => {
        this.records = response.items;
        this.totalRecords = response.total;
        this.loading = false;
      },
      error: (error) => {
        this.records = [];
        this.totalRecords = 0;
        this.errorMessage = error?.error?.detail || 'Could not load dataset records. Check that the backend and dataset are available.';
        this.loading = false;
      }
    });
  }

  applyDatasetFilters(): void {
    this.loadDatasetRecords();
  }

  clearDatasetFilters(): void {
    this.search = '';
    this.selectedAge = '';
    this.selectedGender = '';
    this.selectedRace = '';
    this.applyDatasetFilters();
  }

}
