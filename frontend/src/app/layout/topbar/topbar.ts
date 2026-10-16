import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './topbar.html',
  styleUrl: './topbar.css'
})
export class Topbar {
  searchQuery = '';

  constructor(private router: Router) {}

  submitSearch(): void {
    const query = this.searchQuery.trim();
    if (query) this.router.navigate(['/history'], { queryParams: { q: query } });
  }
}
