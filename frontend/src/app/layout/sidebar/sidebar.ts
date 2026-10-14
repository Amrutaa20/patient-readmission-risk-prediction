
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
  readonly navigation = [
    { label: 'Dashboard', path: '/dashboard', icon: '⌂' },
    { label: 'Patients', path: '/patients', icon: '♙' },
    { label: 'New Prediction', path: '/prediction/new', icon: '✚' },
    { label: 'Prediction History', path: '/history', icon: '◷' },
    { label: 'Analytics', path: '/analytics', icon: '▥' },
    { label: 'Model Performance', path: '/model-performance', icon: '▤' },
    { label: 'AI Assistant', path: '/assistant', icon: '✧' },
    { label: 'Settings', path: '/settings', icon: '⚙' },
    { label: 'About Project', path: '/about', icon: 'ⓘ' }
  ];
}
