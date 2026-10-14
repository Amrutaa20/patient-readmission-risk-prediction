import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PredictionApi } from '../../core/services/prediction-api';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class Dashboard implements OnInit {
  apiStatus = 'Checking connection...';
  apiModel = '';

  readonly metrics = [
    { label: 'Total Patients', value: '—', detail: 'Unique patient records', icon: '♙', color: 'blue' },
    { label: 'Predictions Generated', value: '0', detail: 'Saved assessments', icon: '↗', color: 'teal' },
    { label: 'High-Risk Predictions', value: '0', detail: 'Requires clinical review', icon: '!', color: 'red' },
    { label: 'Average Predicted Risk', value: '—', detail: 'Across saved predictions', icon: '%', color: 'purple' }
  ];

  constructor(private predictionApi: PredictionApi) {}

  ngOnInit(): void {
    this.predictionApi.checkHealth().subscribe({
      next: (response) => {
        this.apiStatus = 'Connected';
        this.apiModel = response.model;
      },
      error: () => {
        this.apiStatus = 'Disconnected';
        this.apiModel = '';
      }
    });
  }
}