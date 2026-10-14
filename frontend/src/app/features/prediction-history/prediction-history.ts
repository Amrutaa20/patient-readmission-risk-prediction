import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

interface HistoryItem {
  id: string;
  patientId: string;
  date: string;
  model: string;
  probability: number;
  category: 'High' | 'Medium' | 'Low';
}

@Component({
  selector: 'app-prediction-history',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './prediction-history.html',
  styleUrl: './prediction-history.css'
})
export class PredictionHistory {
  dateRange = 'Last 30 days';
  riskCategory = 'All';
  modelFilter = 'All';
  searchQuery = '';

  summaryCards = [
    { label: 'Total Predictions', count: 128, color: 'blue', icon: 'total' },
    { label: 'High Risk', count: 32, color: 'red', icon: 'high' },
    { label: 'Medium Risk', count: 41, color: 'yellow', icon: 'medium' },
    { label: 'Low Risk', count: 55, color: 'green', icon: 'low' }
  ];

  allHistory: HistoryItem[] = [
    { id: 'PR-001', patientId: 'P-1001', date: '2025-04-12', model: 'RF', probability: 0.72, category: 'High' },
    { id: 'PR-002', patientId: 'P-1002', date: '2025-04-10', model: 'RF', probability: 0.24, category: 'Low' },
    { id: 'PR-003', patientId: 'P-1003', date: '2025-04-08', model: 'XGBoost', probability: 0.48, category: 'Medium' },
    { id: 'PR-004', patientId: 'P-1004', date: '2025-04-06', model: 'RF', probability: 0.63, category: 'High' },
    { id: 'PR-005', patientId: 'P-1005', date: '2025-04-05', model: 'LR', probability: 0.21, category: 'Low' },
    { id: 'PR-006', patientId: 'P-1006', date: '2025-04-04', model: 'XGBoost', probability: 0.35, category: 'Medium' }
  ];

  filteredHistory = [...this.allHistory];

  applyFilters(): void {
    this.filteredHistory = this.allHistory.filter((item) => {
      const matchPatient = !this.searchQuery || item.patientId.toLowerCase().includes(this.searchQuery.toLowerCase());
      const matchRisk = this.riskCategory === 'All' || item.category === this.riskCategory;
      const matchModel = this.modelFilter === 'All' || item.model === this.modelFilter;
      return matchPatient && matchRisk && matchModel;
    });
  }
}
