import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

interface PatientRecord {
  id: string;
  age: string;
  gender: string;
  diagnosis: string;
  prevAdmissions: number;
  lastPrediction: string;
  riskCategory: 'High' | 'Medium' | 'Low';
  predictionId: string;
}

@Component({
  selector: 'app-patients',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './patients.html',
  styleUrl: './patients.css'
})
export class Patients {
  searchId = '';
  selectedAge = 'All';
  selectedGender = 'All';
  selectedDiagnosis = 'All';
  selectedPrevAdmissions = 'All';
  selectedRisk = 'All';

  allPatients: PatientRecord[] = [
    { id: 'P-1001', age: '65-75', gender: 'Male', diagnosis: 'Diabetes', prevAdmissions: 2, lastPrediction: '2025-04-12', riskCategory: 'High', predictionId: 'PR-001' },
    { id: 'P-1002', age: '45-55', gender: 'Female', diagnosis: 'Hypertension', prevAdmissions: 0, lastPrediction: '2025-04-10', riskCategory: 'Low', predictionId: 'PR-002' },
    { id: 'P-1003', age: '55-65', gender: 'Male', diagnosis: 'COPD', prevAdmissions: 1, lastPrediction: '2025-04-08', riskCategory: 'Medium', predictionId: 'PR-003' },
    { id: 'P-1004', age: '35-45', gender: 'Female', diagnosis: 'Diabetes', prevAdmissions: 0, lastPrediction: '2025-04-07', riskCategory: 'Low', predictionId: 'PR-004' },
    { id: 'P-1005', age: '75+', gender: 'Male', diagnosis: 'CHF', prevAdmissions: 3, lastPrediction: '2025-04-06', riskCategory: 'High', predictionId: 'PR-005' },
    { id: 'P-1006', age: '55-65', gender: 'Female', diagnosis: 'Circulatory', prevAdmissions: 1, lastPrediction: '2025-04-05', riskCategory: 'Medium', predictionId: 'PR-006' },
    { id: 'P-1007', age: '65-75', gender: 'Male', diagnosis: 'Hypertension', prevAdmissions: 0, lastPrediction: '2025-04-03', riskCategory: 'Low', predictionId: 'PR-007' }
  ];

  filteredPatients = [...this.allPatients];
  currentPage = 1;

  applyFilters(): void {
    this.filteredPatients = this.allPatients.filter((p) => {
      const matchId = !this.searchId || p.id.toLowerCase().includes(this.searchId.toLowerCase());
      const matchAge = this.selectedAge === 'All' || p.age === this.selectedAge;
      const matchGender = this.selectedGender === 'All' || p.gender === this.selectedGender;
      const matchDiagnosis = this.selectedDiagnosis === 'All' || p.diagnosis === this.selectedDiagnosis;
      const matchRisk = this.selectedRisk === 'All' || p.riskCategory === this.selectedRisk;
      return matchId && matchAge && matchGender && matchDiagnosis && matchRisk;
    });
  }
}
