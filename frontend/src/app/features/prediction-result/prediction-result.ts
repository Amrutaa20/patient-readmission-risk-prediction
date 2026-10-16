import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { PredictionResponse } from '../../core/services/prediction-api';
import { PredictionApi } from '../../core/services/prediction-api';

interface Factor {
  name: string;
  weight: number;
  barClass: string;
}

@Component({
  selector: 'app-prediction-result',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './prediction-result.html',
  styleUrl: './prediction-result.css'
})
export class PredictionResult implements OnInit {
  patientId = 'Custom encounter';
  probability = 0.72;
  riskCategory: 'High' | 'Medium' | 'Low' = 'High';
  modelUsed = 'Unavailable';
  version = 'Metadata unavailable';
  timestamp = '';
  threshold = 0.40;

  factors: Factor[] = [];

  clinicalConsiderations = [
    'Review previous admission history and frequent readmission causes',
    'Verify medication compliance and reconcile discharge prescriptions',
    'Consider follow-up arrangements within 7 days of discharge',
    'Review with treating healthcare professional prior to sign-off'
  ];

  unavailable = false;
  unavailableMessage = 'This prediction is unavailable. Generate a new prediction or open a record from Prediction History.';
  prediction: PredictionResponse | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private predictionApi: PredictionApi
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id && id !== 'custom') {
      this.patientId = id;
    }

    const nav = this.router.getCurrentNavigation();
    const state = nav?.extras?.state || history.state;
    const prediction = state?.prediction as PredictionResponse | undefined;
    if (prediction) {
      this.setPrediction(prediction, state?.patientId);
    } else if (id && id !== 'custom') {
      this.predictionApi.getPredictionHistoryItem(id).subscribe({
        next: (record) => this.setPrediction({
          ...record,
          row_index: null,
          actual_label: null,
          history_id: record.id,
          history_status: 'persisted',
          note: 'Loaded from backend prediction history.'
        }),
        error: () => {
          this.unavailable = true;
          this.unavailableMessage = 'This prediction could not be loaded from backend history. Retry from Prediction History or generate a new estimate.';
        }
      });
    } else {
      this.unavailable = true;
    }
  }

  private setPrediction(prediction: PredictionResponse, patientId?: string): void {
    this.prediction = prediction;
    this.patientId = patientId || 'Completed assessment';
    this.probability = prediction.readmission_probability;
    this.riskCategory = this.probability < 0.30 ? 'Low' : this.probability <= 0.60 ? 'Medium' : 'High';
    this.threshold = prediction.threshold;
    this.modelUsed = prediction.model;
    this.version = prediction.model_version || 'Version not supplied';
    this.timestamp = new Date(prediction.prediction_timestamp).toLocaleString();
    this.unavailable = false;
  }

  printReport(): void {
    window.print();
  }
}
