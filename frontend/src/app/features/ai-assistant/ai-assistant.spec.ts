import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AiAssistant } from './ai-assistant';
import { PredictionApi } from '../../core/services/prediction-api';
import { of, throwError } from 'rxjs';

describe('AiAssistant', () => {
  let component: AiAssistant;
  let fixture: ComponentFixture<AiAssistant>;

  beforeEach(async () => {
    const api = {
      checkHealth: vi.fn(() => of({})),
      askAssistant: vi.fn(() => of({ answer: 'Verified answer', source: 'Current dataset', as_of: '2026-10-16T00:00:00Z' }))
    };
    await TestBed.configureTestingModule({
      imports: [AiAssistant],
      providers: [{ provide: PredictionApi, useValue: api }]
    }).compileComponents();

    fixture = TestBed.createComponent(AiAssistant);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('sends questions to the data-backed assistant and displays source context', () => {
    component.sendQuestion('How many records?');
    expect(component.messages.at(-1)?.text).toBe('Verified answer');
    expect(component.messages.at(-1)?.source).toContain('Current dataset');
  });

  it('does not invent an answer when backend data is unavailable', () => {
    const api = TestBed.inject(PredictionApi) as unknown as { askAssistant: ReturnType<typeof vi.fn> };
    api.askAssistant.mockReturnValue(throwError(() => new Error('offline')));
    component.sendQuestion('How many records?');
    expect(component.messages.at(-1)?.text).toContain('will not guess');
  });
});
