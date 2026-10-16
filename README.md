# Patient Re-admission Risk Prediction

A machine learning-based web application for predicting the likelihood of a patient's hospital readmission after discharge.

The system analyzes patient demographic, medical, and hospitalization-related information...

# 🏥 30-Day Patient Readmission Risk Prediction

[![Python 3.10+](https://img.shields.io/badge/python-3.10+-blue.svg)](https://www.python.org/downloads/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Scikit-Learn](https://img.shields.io/badge/scikit--learn-1.3+-orange.svg)](https://scikit-learn.org/)
[![XGBoost](https://img.shields.io/badge/XGBoost-2.0+-red.svg)](https://xgboost.readthedocs.io/)
[![CatBoost](https://img.shields.io/badge/CatBoost-1.2+-yellow.svg)](https://catboost.ai/)

An end-to-end machine learning system for predicting **30-day hospital readmission risk** in diabetic patients using clinical electronic health record (EHR) data.

This project explores, preprocesses, and evaluates four distinct machine learning architectures—**Logistic Regression**, **Random Forest**, **XGBoost**, and **CatBoost**—with rigorous class-imbalance mitigation and probability threshold optimization for clinical decision support.

---

## 📌 Project Overview

Under the **Hospital Readmissions Reduction Program (HRRP)**, unplanned 30-day readmissions cost healthcare systems billions annually while serving as a key indicator of post-discharge care quality.

- **Target Variable**: `readmitted_30_days`
  - `1`: Patient was readmitted within 30 days of discharge (High Risk)
  - `0`: Patient was readmitted after 30 days or not readmitted (Low Risk)
- **Primary Clinical Goal**: Identify vulnerable patients before discharge to enable targeted interventions (pharmacist reconciliation, specialized discharge planning, home health coordination, and follow-up telehealth).
- **Core ML Challenge**: Severe class imbalance (~11.16% positive rate) across high-dimensional clinical categorical and count features.

---

## 📊 Dataset Description

- **Source**: _Diabetes 130-US Hospitals (1999–2008)_ dataset from the UCI Machine Learning Repository.
- **Volume**: **101,766 inpatient encounters** across 130 medical centers.
- **Features (Preprocessed)**: **111 clinical predictors** including:
  - Patient demographics (age groups, race, gender)
  - Hospital utilization (`time_in_hospital`, `num_lab_procedures`, `num_procedures`, `num_medications`)
  - Prior care history (`number_inpatient`, `number_emergency`, `number_outpatient`, `total_previous_visits`)
  - Diagnostic categories mapped from ICD-9 codes (Circulatory, Respiratory, Digestive, Diabetes, Neoplasms, Genitourinary, Musculoskeletal, Injury)
  - Diabetic medications & regimen changes (insulin, metformin, sulfonylureas, dosage titration)
  - Glycemic testing indicators (`A1Cresult`, `max_glu_serum`)

---

## 📂 Repository Structure

```
patient-readmission-risk-prediction/
├── backend/                             # FastAPI prediction API
│   ├── app.py                           # API endpoints and model inference
│   └── requirements.txt                 # Backend Python dependencies
├── frontend/                            # Angular web application
│   ├── src/
│   │   ├── app/
│   │   │   ├── core/services/           # API client
│   │   │   ├── features/                # Dashboard, predictions, analytics, etc.
│   │   │   └── layout/                  # Shared navigation and page layout
│   │   ├── index.html
│   │   └── main.ts                      # Angular entry point
│   ├── package.json                     # Frontend scripts and dependencies
│   └── README.md                        # Angular CLI notes
├── data/
│   ├── raw/                             # Original dataset and mapping files
│   └── processed/                       # Cleaned model input dataset
├── models/                              # Trained models and threshold metadata
├── notebooks/                           # Exploration, preprocessing, and model training
├── reports/                             # Generated evaluation reports and figures
├── inspect_dataset.py                   # Dataset inspection helper
├── inspect_model.py                     # Model inspection helper
├── requirements.txt                     # Notebook and model development dependencies
└── README.md
```

---

## Modeling Pipeline & Evaluation Audit

The checked-in preprocessing notebook reads 101,766 raw encounters (50 columns). It creates `readmitted_30_days` as `1` only for raw `readmitted == "<30"`; `NO` and `>30` become `0` (90,409 negatives / 11,357 positives). It removes six columns (`encounter_id`, `patient_nbr`, `weight`, `medical_specialty`, `payer_code`, and raw `readmitted`) and adds the target, producing 45 columns without dropping rows. It fills missing race/diagnosis values as `Unknown`, fills missing glucose and A1C results as `None`, groups diagnosis codes, and adds `total_previous_visits` from the three prior-visit counts. The cleaned frame has 46 columns and zero missing values. One-hot encoding with `drop_first=True` produces 101,766 rows x 112 columns: 111 model inputs and the target. No row filtering occurs in the executed notebook.

The saved XGBoost and CatBoost notebooks use the same stratified 80/20 split (`random_state=42`): 81,412 training encounters and 20,354 test encounters (2,271 positive, 18,083 negative), with 111 inputs. The saved models load and accept that feature schema. The notebooks do not create a distinct validation split. CatBoost uses the test set as its early-stopping evaluation set, and the notebooks tune operating thresholds against test results. Therefore these are historical comparisons, not unbiased final estimates. Do not describe the selection as a validated champion until a validation set is used for selection and a fresh held-out test set is reserved for final evaluation.

The backend currently deploys the existing XGBoost artifact and uses its saved 0.40 threshold. At the shared 0.40 cutoff on the repository's recorded test split, XGBoost measured ROC-AUC 0.687475, PR-AUC 0.234115, precision 0.150554, recall 0.813298, F1 0.254075, and accuracy 0.467181. CatBoost measured ROC-AUC 0.687060, PR-AUC 0.233427, precision 0.149422, recall 0.819022, F1 0.252735, and accuracy 0.459615. XGBoost is the current deployment because the existing saved comparison metadata selects it on ROC-AUC; it also edges CatBoost in ROC-AUC, PR-AUC, precision, and F1 at the shared cutoff. The difference is small and the evaluation limitations above mean neither result establishes a validated clinical champion. The exact recorded values and confusion counts are served from `models/model_comparison_metadata.json` to the Model Comparison page.

Existing feature-importance outputs support prior inpatient visits, discharge disposition, total previous visits, hospital stay, medication and lab counts, diagnosis counts/categories, and admission type/source as useful signals. The preprocessing/model pipeline does not use SHAP or a separate feature-selection step to reduce inputs: the deployed artifacts require all 111 encoded columns, so the app preserves that complete schema rather than dropping low-ranked features without retraining and validation.

The 111 model inputs are the existing encoded pipeline schema; the app does not arbitrarily remove columns from the saved models. Identifiers and target-derived columns are excluded. `total_previous_visits` is computed only from the prior outpatient, emergency, and inpatient visit counts. The clinical prediction form represents an assessment point immediately before discharge, when discharge disposition and in-hospital treatment information are available. This timing must be respected when interpreting the model; those fields would be future information for an earlier admission-time prediction.

## 🩺 Top Consensus Clinical Risk Drivers

Across all four architectures, the strongest consensus predictors of 30-day readmissions are:

1. **Prior Hospitalization Frequency**: `number_inpatient`, `total_previous_visits`, and `number_emergency` dominate feature importance.
2. **Discharge Disposition**: Discharges to skilled nursing facilities (SNFs) or specialized home health services strongly correlate with elevated readmission risk.
3. **Hospitalization Acuity**: Higher `time_in_hospital`, multi-morbidity (`number_diagnoses`), and high medication counts (`num_medications`).
4. **Medication Regimen Changes**: Patients undergoing diabetic medication alterations during admission face higher readmission risk than stable patients.

---

## 🚀 Run the Web Application (Windows)

The application has two parts: the FastAPI backend (port `8000`) and the Angular frontend (port `4200`). Run each in a separate terminal from the repository root.

### 1. Start the backend

In the first PowerShell terminal:

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r backend\requirements.txt
cd backend
python -m uvicorn app:app --reload
```

If PowerShell blocks virtual-environment activation, run this once in that terminal and activate again:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\.venv\Scripts\Activate.ps1
```

Confirm the API is running at `http://127.0.0.1:8000/`. Interactive API documentation is at `http://127.0.0.1:8000/docs`.

### 2. Start the frontend

Open a second terminal:

```powershell
cd frontend
npm install
npm start
```

Open `http://localhost:4200/` in your browser. The dashboard is the home page; use **New Prediction** or visit `http://localhost:4200/prediction/new` to try a sample prediction. The backend must be running for the UI to show its API connection and for predictions to work.

> **Note:** The prediction form accepts encounter inputs and applies the saved one-hot feature schema in the backend. The separate sample endpoint can score an existing processed row. This is an academic demonstration and is not clinically validated.

## 📓 Run the Jupyter Notebooks

```bash
pip install -r requirements.txt
jupyter notebook notebooks/
```

You can execute the notebooks in sequence from `01` through `07`.

---

## 📦 Model Artifacts & Deployment

The trained models and threshold metadata are exported in `models/`:

- `catboost_model.pkl` & `catboost_model.cbm`: Existing comparison artifact; not deployed
- `xgboost_model.pkl`: XGBoost model
- `random_forest_model.pkl`: Random Forest model
- `logistic_regression_model.pkl`: Logistic Regression model
- `scaler.pkl`: Fitted `StandardScaler` for inference
- `champion_model_metadata.json`: Existing XGBoost deployment threshold and metrics
- `model_comparison_metadata.json`: Recorded model metrics and evaluation limitations served to the UI
