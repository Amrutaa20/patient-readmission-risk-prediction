import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { Mock, vi } from 'vitest';
import { PredictionApi, DatasetPatientPage, DatasetPatientQuery } from '../../core/services/prediction-api';
import { Patients } from './patients';

describe('Patients', () => {
  let component: Patients;
  let fixture: ComponentFixture<Patients>;
  let api: Pick<PredictionApi, 'getDatasetPatientFilters' | 'getDatasetPatients'>;
  let getDatasetPatients: Mock<(query: DatasetPatientQuery) => Observable<DatasetPatientPage>>;
  const response: DatasetPatientPage = {
    items: [{
      row_index: 0, race: 'Caucasian', gender: 'Female', age: '[50-60)', admission_type_id: 1,
      admission_type_label: 'Emergency (code 1)', discharge_disposition_id: 1,
      discharge_disposition_label: 'Discharged to home (code 1)', admission_source_id: 7,
      admission_source_label: 'Emergency Room (code 7)', time_in_hospital: 3,
      num_lab_procedures: 20, num_procedures: 0, num_medications: 8, number_inpatient: 0,
      medical_specialty: 'Unknown', readmitted: 'NO'
    }],
    total: 50, page: 1, page_size: 50, total_pages: 1
  };

  beforeEach(async () => {
    getDatasetPatients = vi.fn<(query: DatasetPatientQuery) => Observable<DatasetPatientPage>>().mockReturnValue(of(response));
    api = {
      getDatasetPatientFilters: vi.fn().mockReturnValue(of({ age: ['[50-60)'], gender: ['Female'], race: ['Caucasian'] })),
      getDatasetPatients
    };

    await TestBed.configureTestingModule({
      imports: [Patients],
      providers: [
        provideRouter([]),
        { provide: PredictionApi, useValue: api },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Patients);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('loads dataset records by default without requiring a search', () => {
    expect(getDatasetPatients).toHaveBeenCalledWith({
      page: 1, pageSize: 50, search: undefined, age: undefined, gender: undefined, race: undefined
    });
    expect(component.totalRecords).toBe(50);
    expect(component.records[0].row_index).toBe(0);
  });

  it('always requests one bounded 50-record sample', () => {
    expect(component.pageSize).toBe(50);
    expect(fixture.nativeElement.textContent).toContain('Maximum 50 records');
  });

  it('unsubscribes from an in-flight dataset request before starting the next one', () => {
    let previousRequestCancelled = false;
    const pendingRequest = new Observable<DatasetPatientPage>(() => () => {
      previousRequestCancelled = true;
    });
    getDatasetPatients.mockReturnValue(pendingRequest);
    component.loadDatasetRecords();
    component.loadDatasetRecords();
    expect(previousRequestCancelled).toBe(true);
  });

  it('sends search and selected filters to the server and resets pagination', () => {
    component.search = 'cardiology';
    component.selectedAge = '[50-60)';
    component.loadDatasetRecords();
    expect(getDatasetPatients).toHaveBeenCalledWith({
      page: 1, pageSize: 50, search: 'cardiology', age: '[50-60)', gender: undefined, race: undefined
    });
  });

  it('resets all dataset filters and returns to the first page', () => {
    component.search = 'cardiology';
    component.selectedAge = '[50-60)';
    component.selectedGender = 'Female';
    component.selectedRace = 'Caucasian';
    component.clearDatasetFilters();
    expect(component.search).toBe('');
    expect(component.selectedAge).toBe('');
    expect(component.selectedGender).toBe('');
    expect(component.selectedRace).toBe('');
    expect(getDatasetPatients).toHaveBeenLastCalledWith({
      page: 1, pageSize: 50, search: undefined, age: undefined, gender: undefined, race: undefined
    });
  });

  it('shows an API error instead of an empty-results message', () => {
    getDatasetPatients.mockReturnValue(throwError(() => ({ error: { detail: 'Dataset unavailable' } })));
    component.loadDatasetRecords();
    expect(component.errorMessage).toBe('Dataset unavailable');
    expect(component.records).toEqual([]);
    expect(component.loading).toBe(false);
  });

  it('links to the dedicated prediction history page', () => {
    expect(fixture.nativeElement.textContent).toContain('Prediction History');
    expect(getDatasetPatients).toHaveBeenCalledTimes(1);
  });
});
