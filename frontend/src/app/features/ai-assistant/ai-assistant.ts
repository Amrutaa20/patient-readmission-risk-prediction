import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PredictionApi } from '../../core/services/prediction-api';

interface ChatMessage {
  sender: 'ai' | 'user';
  text: string;
  time: string;
  source?: string;
}

@Component({
  selector: 'app-ai-assistant',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './ai-assistant.html',
  styleUrl: './ai-assistant.css'
})
export class AiAssistant implements OnInit {
  userQuestion = '';
  loading = false;
  backendStatus: 'checking' | 'available' | 'unavailable' = 'checking';

  suggestedQuestions = [
    'How many encounters are in the dataset?',
    'What percentage were readmitted within 30 days?',
    'Which admission types have higher historical readmission rates?',
    'How many predictions have been made?',
    "What is the deployed model's accuracy?",
    'What features does the deployed model use?'
  ];

  messages: ChatMessage[] = [{
    sender: 'ai',
    text: 'Ask about the current dataset, historical outcomes, deployed model, or saved predictions. Answers use verified local project data; historical outcomes and model estimates are reported separately.',
    time: this.timeNow()
  }];

  constructor(private predictionApi: PredictionApi, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.predictionApi.checkHealth().subscribe({
      next: () => { this.backendStatus = 'available'; this.cdr.markForCheck(); },
      error: () => { this.backendStatus = 'unavailable'; this.cdr.markForCheck(); }
    });
  }

  sendQuestion(suggested?: string): void {
    const query = (suggested ?? this.userQuestion).trim();
    if (!query || this.loading) return;
    this.messages.push({ sender: 'user', text: query, time: this.timeNow() });
    this.userQuestion = '';
    this.loading = true;
    this.predictionApi.askAssistant(query).subscribe({
      next: (result) => {
        this.messages.push({ sender: 'ai', text: result.answer, source: `${result.source} · ${new Date(result.as_of).toLocaleString()}`, time: this.timeNow() });
        this.loading = false;
        this.backendStatus = 'available';
        this.cdr.markForCheck();
      },
      error: () => {
        this.messages.push({
          sender: 'ai',
          text: 'I could not retrieve a verified answer because the backend or requested data is unavailable. Start or check the backend and try again; I will not guess a count or metric.',
          time: this.timeNow()
        });
        this.loading = false;
        this.backendStatus = 'unavailable';
        this.cdr.markForCheck();
      }
    });
  }

  clearChat(): void {
    this.messages = [{ sender: 'ai', text: 'Chat cleared. Ask about the current dataset, historical outcomes, deployed model, or saved predictions.', time: this.timeNow() }];
  }

  private timeNow(): string {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}
