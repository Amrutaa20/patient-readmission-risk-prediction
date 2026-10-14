import { ChangeDetectorRef, Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  PredictionApi,
  PredictionResponse
} from '../../core/services/prediction-api';

@Component({
  selector: 'app-prediction-form',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './prediction-form.html',
  styleUrl: './prediction-form.css'
})
export class PredictionForm {
  // 1. Patient Information
  patientId = 'P-1001';
  ageRange = '[60-70)';
  gender = 'Male';

  // 2. Diagnosis Information
  primaryDiagnosis = 'Diabetes';
  secondaryDiagnosis = 'Circulatory';
  numDiagnoses = 9;

  // 3. Treatment and Medication History
  medication = 'Insulin';
  numMedications = 18;
  medicationChanges = 'Yes';

  // 4. Previous Hospital Utilization
  previousAdmissions = 2;
  emergencyVisits = 1;
  lengthOfStay = 5;

  // Dataset row index (0 to 101765)
  rowIndex = 0;

  loading = false;
  errorMessage = '';
  result: PredictionResponse | null = null;

  constructor(
    private predictionApi: PredictionApi,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  loadSamplePatient(): void {
    this.patientId = 'P-1001';
    this.ageRange = '[70-80)';
    this.gender = 'Female';
    this.primaryDiagnosis = 'Circulatory';
    this.secondaryDiagnosis = 'Diabetes';
    this.numDiagnoses = 9;
    this.medication = 'Insulin';
    this.numMedications = 21;
    this.medicationChanges = 'Yes';
    this.previousAdmissions = 3;
    this.emergencyVisits = 2;
    this.lengthOfStay = 7;
    this.rowIndex = 1;
    this.result = null;
    this.errorMessage = '';
    this.cdr.markForCheck();
  }

  clearForm(): void {
    this.patientId = '';
    this.ageRange = '';
    this.gender = '';
    this.primaryDiagnosis = '';
    this.secondaryDiagnosis = '';
    this.numDiagnoses = 1;
    this.medication = '';
    this.numMedications = 1;
    this.medicationChanges = 'No';
    this.previousAdmissions = 0;
    this.emergencyVisits = 0;
    this.lengthOfStay = 1;
    this.rowIndex = 0;
    this.result = null;
    this.errorMessage = '';
    this.cdr.markForCheck();
  }

  predict(): void {
    this.loading = true;
    this.errorMessage = '';
    this.result = null;

    const row = Math.max(0, Math.min(101765, Number(this.rowIndex) || 0));

    this.predictionApi.predictSample(row).subscribe({
      next: (response) => {
        this.result = response;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.errorMessage =
          error?.error?.detail ||
          error?.message ||
          'Prediction failed. Please ensure the backend is running.';
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  viewDetails(): void {
    if (this.result) {
      this.router.navigate(['/prediction', this.patientId || 'PR-001'], {
        state: { prediction: this.result }
      });
    }
  }
}