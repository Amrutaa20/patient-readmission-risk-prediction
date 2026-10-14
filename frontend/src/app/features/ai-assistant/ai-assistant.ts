import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';

interface ChatMessage {
  sender: 'ai' | 'user';
  text: string;
  time: string;
}

@Component({
  selector: 'app-ai-assistant',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './ai-assistant.html',
  styleUrl: './ai-assistant.css'
})
export class AiAssistant {
  userQuestion = '';

  suggestedQuestions = [
    'What does the predicted probability mean?',
    'Why is this a high-risk prediction?',
    'Which features contributed to this prediction?',
    'Explain the Random Forest model',
    'Explain ROC-AUC'
  ];

  messages: ChatMessage[] = [
    {
      sender: 'ai',
      text: "Hello! I'm MediAssist AI, your readmission risk assistant. I can help you understand predictions, explain model results, answer questions about the dataset and metrics, or provide insights from the current patient. How can I help you today?",
      time: '14:30'
    }
  ];

  patientContext = {
    predictionId: 'PR-001',
    patientId: 'P-1001',
    probability: 0.72,
    category: 'High',
    model: 'Random Forest',
    timestamp: '2025-04-12 14:30'
  };

  sendQuestion(q?: string): void {
    const query = q || this.userQuestion;
    if (!query.trim()) return;

    this.messages.push({
      sender: 'user',
      text: query,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });

    this.userQuestion = '';

    // Generate responsive clinical explanation
    setTimeout(() => {
      let reply = "This is a demonstration AI explanation based on the current XGBoost and Random Forest evaluation data.";

      if (query.includes('probability')) {
        reply = "A predicted probability of 0.72 means the model estimates a 72% likelihood of patient readmission within 30 days based on historical discharge patterns.";
      } else if (query.includes('high-risk') || query.includes('High')) {
        reply = "This patient is categorized as High Risk because the 0.72 probability exceeds the clinical decision threshold of 0.40. Key drivers include multiple previous admissions and high length of stay.";
      } else if (query.includes('features') || query.includes('contributed')) {
        reply = "The top contributing factors in this encounter are: 1. Previous Admissions (weight 0.31), 2. Length of Stay (0.24), and 3. Primary Diagnosis Category (0.18).";
      } else if (query.includes('ROC') || query.includes('AUC')) {
        reply = "ROC-AUC (Receiver Operating Characteristic - Area Under Curve) evaluates how well the model separates readmitted from non-readmitted patients across all thresholds. Our champion model achieves an AUC of 0.856.";
      } else if (query.includes('model') || query.includes('Forest')) {
        reply = "The Random Forest ensemble constructs multiple decision trees during training to output balanced classification probabilities, minimizing individual tree overfitting.";
      }

      this.messages.push({
        sender: 'ai',
        text: reply,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });
    }, 400);
  }

  clearChat(): void {
    this.messages = [
      {
        sender: 'ai',
        text: "Chat cleared. How can I help you explore patient readmission predictions today?",
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ];
  }
}
