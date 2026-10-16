import { Component, OnInit } from '@angular/core';
import { PredictionApi } from '../../core/services/prediction-api';

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [],
  templateUrl: './about.html',
  styleUrl: './about.css'
})
export class About implements OnInit {
  modelName = 'Loading model metadata';
  modelThreshold: number | null = null;
  modelMetadataUnavailable = false;

  constructor(private predictionApi: PredictionApi) {}

  ngOnInit(): void {
    this.predictionApi.getModelComparison().subscribe({
      next: (comparison) => {
        this.modelName = comparison.deployment_model;
        this.modelThreshold = comparison.models.find((model) => model.name === comparison.deployment_model)?.threshold ?? null;
      },
      error: () => {
        this.modelName = 'Unavailable';
        this.modelMetadataUnavailable = true;
      }
    });
  }
}
