import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PredictionApi } from '../../core/services/prediction-api';

interface MetricCard {
  label: string;
  value: string;
  subtext: string;
  icon: string;
  color: 'blue' | 'teal' | 'red' | 'cyan';
}

interface RecentPrediction {
  id: string;
  patientId: string;
  age: string;
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
  apiStatus = 'Checking...';
  apiModel = '';

  metrics: MetricCard[] = [
    { label: 'Total Patients', value: '442', subtext: 'From dataset', icon: 'users', color: 'blue' },
    { label: 'Predictions Generated', value: '128', subtext: 'This month', icon: 'check-doc', color: 'teal' },
    { label: 'High-Risk Predictions', value: '32', subtext: '25% of total', icon: 'alert', color: 'red' },
    { label: 'Average Predicted Risk', value: '0.34', subtext: 'Across all predictions', icon: 'percent', color: 'cyan' }
  ];

  recentPredictions: RecentPrediction[] = [
    { id: '1', patientId: 'P-1001', age: '65-75', riskScore: 0.72, category: 'High' },
    { id: '2', patientId: 'P-1002', age: '45-55', riskScore: 0.24, category: 'Low' },
    { id: '3', patientId: 'P-1003', age: '55-65', riskScore: 0.48, category: 'Medium' },
    { id: '4', patientId: 'P-1004', age: '35-45', riskScore: 0.18, category: 'Low' },
    { id: '5', patientId: 'P-1005', age: '75+', riskScore: 0.63, category: 'High' }
  ];

  constructor(
    private predictionApi: PredictionApi,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.predictionApi.checkHealth().subscribe({
      next: (res) => {
        this.apiStatus = 'Connected';
        this.apiModel = res.model;
        this.cdr.markForCheck();
      },
      error: () => {
        this.apiStatus = 'Disconnected';
        this.cdr.markForCheck();
      }
    });
  }
}