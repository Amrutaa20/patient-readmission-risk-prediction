
import { Routes } from '@angular/router';
import { MainLayout } from './layout/main-layout/main-layout';

export const routes: Routes = [
  {
    path: '',
    component: MainLayout,
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard')
            .then(m => m.Dashboard)
      },
      {
        path: 'patients',
        loadComponent: () =>
          import('./features/patients/patients')
            .then(m => m.Patients)
      },
      {
        path: 'prediction/new',
        loadComponent: () =>
          import('./features/prediction-form/prediction-form')
            .then(m => m.PredictionForm)
      },
      {
        path: 'prediction/:id',
        loadComponent: () =>
          import('./features/prediction-result/prediction-result')
            .then(m => m.PredictionResult)
      },
      {
        path: 'history',
        loadComponent: () =>
          import('./features/prediction-history/prediction-history')
            .then(m => m.PredictionHistory)
      },
      {
        path: 'analytics',
        loadComponent: () =>
          import('./features/analytics/analytics')
            .then(m => m.Analytics)
      },
      {
        path: 'model-performance',
        loadComponent: () =>
          import('./features/model-performance/model-performance')
            .then(m => m.ModelPerformance)
      },
      {
        path: 'assistant',
        loadComponent: () =>
          import('./features/ai-assistant/ai-assistant')
            .then(m => m.AiAssistant)
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./features/settings/settings')
            .then(m => m.Settings)
      },
      {
        path: 'about',
        loadComponent: () =>
          import('./features/about/about')
            .then(m => m.About)
      }
    ]
  },
  {
    path: '**',
    redirectTo: 'dashboard'
  }
];
