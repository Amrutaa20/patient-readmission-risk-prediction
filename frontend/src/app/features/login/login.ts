import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class Login {
  email = 'doctor@hospital.com';
  password = '••••••••••••';
  rememberMe = true;
  isLoading = false;
  errorMessage = '';

  onSignIn(): void {
    this.errorMessage = 'Authentication is not configured. No sign-in was performed.';
  }
}

