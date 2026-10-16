import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
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
export class PredictionForm implements OnInit {
  patientId = '';
  sampleRowIndex: number | null = null;
  input: Record<string, string | number> = {};
  readonly demographics = [
    { key: 'race', label: 'Race', options: ['AfricanAmerican', 'Asian', 'Caucasian', 'Hispanic', 'Other', 'Unknown'] },
    { key: 'gender', label: 'Gender', options: ['Female', 'Male', 'Unknown/Invalid'] },
    { key: 'age', label: 'Age range', options: ['[0-10)', '[10-20)', '[20-30)', '[30-40)', '[40-50)', '[50-60)', '[60-70)', '[70-80)', '[80-90)', '[90-100)'] }
  ];
  readonly numericFields = [
    { key: 'admission_type_id', label: 'Admission type ID', min: 1, max: 8, options: [1, 2, 3, 4, 5, 6, 7, 8] },
    { key: 'discharge_disposition_id', label: 'Discharge disposition ID', min: 1, max: 28, options: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 22, 23, 24, 25, 27, 28] },
    { key: 'admission_source_id', label: 'Admission source ID', min: 1, max: 25, options: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 14, 17, 20, 22, 25] },
    { key: 'time_in_hospital', label: 'Length of stay (days)', min: 1, max: 14 },
    { key: 'num_lab_procedures', label: 'Lab procedures', min: 1, max: 132 },
    { key: 'num_procedures', label: 'Procedures', min: 0, max: 6 },
    { key: 'num_medications', label: 'Medication count', min: 1, max: 81 },
    { key: 'number_outpatient', label: 'Previous outpatient visits', min: 0, max: 42 },
    { key: 'number_emergency', label: 'Previous emergency visits', min: 0, max: 76 },
    { key: 'number_inpatient', label: 'Previous inpatient visits', min: 0, max: 21 },
    { key: 'number_diagnoses', label: 'Number of diagnoses', min: 1, max: 16 }
  ];
  readonly diagnoses = [
    { key: 'diag_1', label: 'Primary diagnosis code' },
    { key: 'diag_2', label: 'Secondary diagnosis code' },
    { key: 'diag_3', label: 'Third diagnosis code' }
  ];
  readonly labFields = [
    { key: 'max_glu_serum', label: 'Maximum glucose serum', options: ['None', 'Norm', '>200', '>300'] },
    { key: 'A1Cresult', label: 'A1C result', options: ['None', 'Norm', '>7', '>8'] }
  ];
  readonly medicationNames = [
    'metformin', 'repaglinide', 'nateglinide', 'chlorpropamide', 'glimepiride', 'acetohexamide',
    'glipizide', 'glyburide', 'tolbutamide', 'pioglitazone', 'rosiglitazone', 'acarbose', 'miglitol',
    'troglitazone', 'tolazamide', 'examide', 'citoglipton', 'insulin', 'glyburide-metformin',
    'glipizide-metformin', 'glimepiride-pioglitazone', 'metformin-rosiglitazone', 'metformin-pioglitazone'
  ];
  readonly medicationOptions: Record<string, string[]> = {
    acetohexamide: ['No', 'Steady'], tolbutamide: ['No', 'Steady'], troglitazone: ['No', 'Steady'],
    tolazamide: ['No', 'Steady', 'Up'], examide: ['No'], citoglipton: ['No'],
    'glipizide-metformin': ['No', 'Steady'], 'glimepiride-pioglitazone': ['No', 'Steady'],
    'metformin-rosiglitazone': ['No', 'Steady'], 'metformin-pioglitazone': ['No', 'Steady']
  };

  loading = false;
  errorMessage = '';
  result: PredictionResponse | null = null;
  modelName = 'Current deployed model';
  modelThreshold: number | null = null;

  constructor(
    private predictionApi: PredictionApi,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {
    this.resetInput();
  }

  ngOnInit(): void {
    this.predictionApi.checkHealth().subscribe({
      next: (health) => {
        this.modelName = health.model;
        this.modelThreshold = health.threshold;
        this.cdr.markForCheck();
      }
    });
  }

  private resetInput(): void {
    this.input = {};
    for (const field of [...this.demographics, ...this.labFields]) this.input[field.key] = '';
    for (const field of this.numericFields) this.input[field.key] = '';
    for (const field of this.diagnoses) this.input[field.key] = '';
    for (const medication of this.medicationNames) this.input[medication] = '';
    this.input['change'] = '';
    this.input['diabetesMed'] = '';
  }

  loadSamplePatient(): void {
    this.patientId = '';
    this.resetInput();
    this.result = null;
    this.errorMessage = '';
    this.cdr.markForCheck();
  }

  clearForm(): void {
    this.patientId = '';
    this.resetInput();
    this.result = null;
    this.errorMessage = '';
    this.cdr.markForCheck();
  }

  predict(): void {
    const requiredKeys = [
      ...this.demographics.map((field) => field.key), ...this.numericFields.map((field) => field.key),
      ...this.diagnoses.map((field) => field.key), ...this.labFields.map((field) => field.key),
      ...this.medicationNames, 'change', 'diabetesMed'
    ];
    const missing = requiredKeys.filter((key) => String(this.input[key] ?? '').trim() === '');
    if (missing.length) {
      this.errorMessage = `Complete all encounter fields before scoring. Missing: ${missing.join(', ')}.`;
      this.result = null;
      return;
    }

    const payload: Record<string, string | number> = { ...this.input };
    for (const field of this.numericFields) {
      const value = Number(this.input[field.key]);
      if (!Number.isInteger(value) || value < field.min || value > field.max) {
        this.errorMessage = `${field.label} must be a whole number from ${field.min} to ${field.max}.`;
        this.result = null;
        return;
      }
      payload[field.key] = value;
    }

    this.loading = true;
    this.errorMessage = '';
    this.result = null;

    this.predictionApi.predictClinical(payload).subscribe({
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

  predictSample(): void {
    const row = Number(this.sampleRowIndex);
    if (this.sampleRowIndex === null || !Number.isInteger(row) || row < 0 || row > 101765) {
      this.errorMessage = 'Enter a whole dataset row index from 0 to 101765.';
      this.result = null;
      return;
    }
    this.loading = true;
    this.errorMessage = '';
    this.predictionApi.predictSample(row).subscribe({
      next: (response) => { this.result = response; this.loading = false; this.cdr.markForCheck(); },
      error: (error) => {
        this.errorMessage = error?.error?.detail || error?.message || 'Sample prediction failed. Check the backend connection.';
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  viewDetails(): void {
    if (this.result) {
      this.router.navigate(['/prediction', 'custom'], {
        state: { prediction: this.result, patientId: this.patientId }
      });
    }
  }
}
