import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css'
})
export class Sidebar {
  readonly navItems = [
    { label: 'Dashboard', path: '/dashboard', icon: 'dashboard' },
    { label: 'Patients', path: '/patients', icon: 'patients' },
    { label: 'New Prediction', path: '/prediction/new', icon: 'new-pred' },
    { label: 'Prediction History', path: '/history', icon: 'history' },
    { label: 'Analytics', path: '/analytics', icon: 'analytics' },
    { label: 'Model Performance', path: '/model-performance', icon: 'performance' },
    { label: 'AI Assistant', path: '/assistant', icon: 'assistant' },
    { label: 'About', path: '/about', icon: 'about' },
    { label: 'Settings', path: '/settings', icon: 'settings' }
  ];
}
