import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './analytics.html',
  styleUrl: './analytics.css'
})
export class Analytics {
  ageGroup = 'All';
  diagnosis = 'All';
  gender = 'All';
  prevAdmissions = 'All';
  encounterType = 'All';

  ageBars = [
    { label: '18-30', rate: 10, height: 24 },
    { label: '31-45', rate: 18, height: 43 },
    { label: '46-60', rate: 32, height: 76 },
    { label: '61-75', rate: 42, height: 100 },
    { label: '75+', rate: 36, height: 85 }
  ];

  diagnosisBars = [
    { label: 'Diabetes', rate: 28, height: 60 },
    { label: 'Hypertension', rate: 22, height: 48 },
    { label: 'COPD', rate: 34, height: 74 },
    { label: 'CHF', rate: 46, height: 100 },
    { label: 'Others', rate: 18, height: 39 }
  ];

  losBars = [
    { label: '1-3', rate: 12, height: 28 },
    { label: '4-7', rate: 20, height: 48 },
    { label: '8-14', rate: 36, height: 86 },
    { label: '15-30', rate: 42, height: 100 },
    { label: '31+', rate: 38, height: 90 }
  ];
}
