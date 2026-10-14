import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PredictionHistory } from './prediction-history';

describe('PredictionHistory', () => {
  let component: PredictionHistory;
  let fixture: ComponentFixture<PredictionHistory>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PredictionHistory],
    }).compileComponents();

    fixture = TestBed.createComponent(PredictionHistory);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
