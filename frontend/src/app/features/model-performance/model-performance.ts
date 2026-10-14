import { Component } from '@angular/core';

interface ModelMetric {
  name: string;
  isChampion?: boolean;
  rocAuc: number;
  f1Score: number;
  recall: number;
}

interface FeatureImp {
  feature: string;
  importance: number;
}

@Component({
  selector: 'app-model-performance',
  standalone: true,
  imports: [],
  templateUrl: './model-performance.html',
  styleUrl: './model-performance.css'
})
export class ModelPerformance {
  models: ModelMetric[] = [
    { name: 'Logistic Regression', rocAuc: 0.782, f1Score: 0.641, recall: 0.687 },
    { name: 'Random Forest', rocAuc: 0.841, f1Score: 0.728, recall: 0.781 },
    { name: 'XGBoost', isChampion: true, rocAuc: 0.856, f1Score: 0.742, recall: 0.708 }
  ];

  features: FeatureImp[] = [
    { feature: 'Previous Admissions', importance: 0.31 },
    { feature: 'Length of Stay', importance: 0.24 },
    { feature: 'Diagnosis Category', importance: 0.18 },
    { feature: 'Medication Count', importance: 0.12 },
    { feature: 'Age', importance: 0.08 }
  ];
}
