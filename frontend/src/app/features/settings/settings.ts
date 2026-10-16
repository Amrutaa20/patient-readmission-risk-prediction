import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PredictionHistoryStore } from '../../core/services/prediction-history-store';
import { PredictionApi } from '../../core/services/prediction-api';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './settings.html',
  styleUrl: './settings.css'
})
export class Settings implements OnInit {
  name = 'Dr. Sharma';
  role = 'Doctor';
  theme = 'light';
  defaultModel = 'Unavailable';
  modelThreshold: number | null = null;
  modelSelectionStatus = 'provisional';
  modelStatus = 'Checking prediction service…';
  showExplanations = true;
  dataRetention = '30';
  isSaved = false;
  saveError = '';
  clearMessage = '';

  constructor(private historyStore: PredictionHistoryStore, private predictionApi: PredictionApi) {
    try {
      const stored = localStorage.getItem('patient-readmission-settings');
      if (stored) Object.assign(this, JSON.parse(stored));
    } catch {
      // Keep usable defaults if browser storage is unavailable or invalid.
    }
    this.applyTheme();
  }

  ngOnInit(): void {
    this.predictionApi.checkHealth().subscribe({
      next: (health) => {
        this.defaultModel = health.model;
        this.modelThreshold = health.threshold;
        this.modelSelectionStatus = health.selection_status;
        this.modelStatus = 'Connected to the active prediction service.';
      },
      error: () => {
        this.defaultModel = 'Unavailable';
        this.modelThreshold = null;
        this.modelStatus = 'Prediction service unavailable. Start the backend to load deployment details.';
      }
    });
  }

  saveSettings(): void {
    this.saveError = '';
    try {
      localStorage.setItem('patient-readmission-settings', JSON.stringify({
        name: this.name,
        role: this.role,
        theme: this.theme,
        defaultModel: this.defaultModel,
        showExplanations: this.showExplanations,
        dataRetention: this.dataRetention
      }));
      this.applyTheme();
    } catch {
      this.saveError = 'Could not save settings in this browser.';
      return;
    }
    this.isSaved = true;
    setTimeout(() => {
      this.isSaved = false;
    }, 2500);
  }

  clearSavedPredictions(): void {
    this.historyStore.clear();
    this.clearMessage = 'Clearing saved backend predictions...';
    this.predictionApi.clearPredictionHistory().subscribe({
      next: () => { this.clearMessage = 'Prediction history cleared.'; },
      error: () => { this.clearMessage = 'Legacy browser data was cleared, but backend prediction history could not be cleared.'; }
    });
  }

  private applyTheme(): void {
    document.documentElement.classList.toggle('dark-theme', this.theme === 'dark');
  }
}
