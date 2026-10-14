import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

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
  patientId = 'P-1001';
  probability = 0.72;
  riskCategory: 'High' | 'Medium' | 'Low' = 'High';
  modelUsed = 'Random Forest';
  version = 'v1.0.0';
  timestamp = '2025-04-12 14:30';
  threshold = 0.40;

  factors: Factor[] = [
    { name: 'Previous Admissions', weight: 0.28, barClass: 'high' },
    { name: 'Length of Stay', weight: 0.21, barClass: 'medium' },
    { name: 'Diagnosis Category', weight: 0.18, barClass: 'medium' },
    { name: 'Medication Count', weight: 0.12, barClass: 'low' },
    { name: 'Age', weight: 0.11, barClass: 'low' }
  ];

  clinicalConsiderations = [
    'Review previous admission history and frequent readmission causes',
    'Verify medication compliance and reconcile discharge prescriptions',
    'Consider follow-up arrangements within 7 days of discharge',
    'Review with treating healthcare professional prior to sign-off'
  ];

  isSaved = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.patientId = id.startsWith('P-') ? id : `P-${id}`;
    }

    // Check if state was passed from prediction-form
    const nav = this.router.getCurrentNavigation();
    const state = nav?.extras?.state || history.state;
    if (state?.prediction) {
      const pred = state.prediction;
      this.probability = pred.readmission_probability;
      this.riskCategory = pred.predicted_class === 1 ? 'High' : 'Low';
      this.threshold = pred.threshold;
    }
  }

  savePrediction(): void {
    this.isSaved = true;
    setTimeout(() => {
      this.isSaved = false;
    }, 2500);
  }

  printReport(): void {
    window.print();
  }
}
