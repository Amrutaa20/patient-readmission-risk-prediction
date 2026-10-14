import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ModelPerformance } from './model-performance';

describe('ModelPerformance', () => {
  let component: ModelPerformance;
  let fixture: ComponentFixture<ModelPerformance>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ModelPerformance],
    }).compileComponents();

    fixture = TestBed.createComponent(ModelPerformance);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
