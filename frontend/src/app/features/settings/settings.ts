import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './settings.html',
  styleUrl: './settings.css'
})
export class Settings {
  name = 'Dr. Sharma';
  role = 'Doctor';
  theme = 'light';
  defaultModel = 'XGBoost';
  showExplanations = true;
  dataRetention = '30';
  isSaved = false;

  saveSettings(): void {
    this.isSaved = true;
    setTimeout(() => {
      this.isSaved = false;
    }, 2500);
  }
}
