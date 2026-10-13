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
├── data/
│   ├── raw/
│   │   ├── diabetic_data.csv            # Raw EHR dataset (101,766 x 50)
│   │   └── IDS_mapping.csv              # Admission/discharge metadata mappings
│   └── processed/
│       └── readmission_cleaned.csv      # Cleaned, one-hot encoded dataset (101,766 x 112)
│
├── notebooks/
│   ├── 01_data_understanding.ipynb      # EDA, missing value audit, clinical distributions
│   ├── 02_data_preprocessing.ipynb      # Cleaning, ICD-9 categorization, dummy encoding
│   ├── 03_logistic_regression.ipynb     # Linear baseline with scaling, odds ratios & threshold tuning
│   ├── 04_random_forest.ipynb           # Bagging ensemble (300 trees) with balanced class weights
│   ├── 05_xgboost.ipynb                 # Gradient boosted trees with scale_pos_weight
│   ├── 06_catboost.ipynb                # Symmetric oblivious decision trees with native balancing
│   └── 07_model_comparison.ipynb        # Cross-model benchmark, diagnostic curves & champion selection
│
├── models/                              # Serialized model weights, scalers, and threshold configs
│   ├── scaler.pkl
│   ├── logistic_regression_model.pkl
│   ├── random_forest_model.pkl
│   ├── xgboost_model.pkl
│   ├── catboost_model.pkl
│   └── champion_model_metadata.json
│
├── app/
│   └── app.py                           # Interactive clinical risk assessment web application
│
├── requirements.txt                     # Python package dependencies
├── .gitattributes                       # Git LFS tracking for model weights
├── .gitignore                           # Git ignore definitions
└── README.md                            # Project documentation
```

---

## 🔬 Modeling Pipeline & Methodology

```
Raw EHR Data (101,766 rows)
       │
       ▼
01. Exploratory Data Analysis (EDA)
       │
       ▼
02. Feature Engineering & Preprocessing
    ├── Target encoding (<30 vs. NO/>30)
    ├── Clinical ICD-9 diagnosis clustering
    ├── Removal of leaky identifiers (encounter_id, patient_nbr)
    └── One-hot encoding (111 predictor columns)
       │
       ▼
Train / Test Stratified Split (80/20)
       │
       ├───► 03. Logistic Regression (L2 penalty, StandardScaler, Odds Ratios)
       ├───► 04. Random Forest (300 trees, class_weight='balanced')
       ├───► 05. XGBoost (scale_pos_weight=7.96, early stopping)
       └───► 06. CatBoost (Oblivious trees, auto_class_weights='Balanced')
       │
       ▼
07. Model Comparison & Threshold Optimization
       │
       ▼
Champion Model Selection (CatBoost) ──► Deployment (Streamlit App)
```

---

## 🏆 Benchmark Evaluation Results

All four models were evaluated on the **identical holdout test set** ($N = 20,354$ patients, 11.16% prevalence):

| Model Architecture      | Notebook |  ROC-AUC  |  PR-AUC   | Tuned Cutoff | Recall (Sensitivity) | Precision | F1 Score  | Inference Speed |
| :---------------------- | :------- | :-------: | :-------: | :----------: | :------------------: | :-------: | :-------: | :-------------: |
| **CatBoost** 🥇         | `06`     | **0.690** | **0.228** |   **0.40**   |      **60.5%**       | **18.9%** | **0.285** |      ~2 ms      |
| **XGBoost** 🥈          | `05`     |   0.688   |   0.224   |     0.40     |        59.5%         |   18.5%   |   0.282   |      ~2 ms      |
| **Logistic Regression** | `03`     |   0.660   |   0.201   |     0.45     |        59.2%         |   18.0%   |   0.273   |   **< 1 ms**    |
| **Random Forest**       | `04`     |   0.660   |   0.198   |     0.25     |        53.9%         |   18.2%   |   0.272   |     ~15 ms      |

### Key Findings:

1. **Gradient Boosting Outperforms**: CatBoost and XGBoost outperform Random Forest and Logistic Regression by **~3 AUC points**, capturing non-linear clinical feature interactions.
2. **Threshold Tuning is Essential**: At the default $0.50$ threshold, Random Forest achieved an unviable **4.98% recall** due to severe class imbalance. Tuning cutoffs to $0.25$–$0.40$ increased readmission detection to **~60%**.
3. **The Clinical Screening Ratio**: Achieving ~60% recall with ~19% precision means that **1 out of every 5 patients flagged as high risk will be readmitted**. In hospital operations, this provides a cost-effective triage ratio for proactive care management.

---

## 🩺 Top Consensus Clinical Risk Drivers

Across all four architectures, the strongest consensus predictors of 30-day readmissions are:

1. **Prior Hospitalization Frequency**: `number_inpatient`, `total_previous_visits`, and `number_emergency` dominate feature importance.
2. **Discharge Disposition**: Discharges to skilled nursing facilities (SNFs) or specialized home health services strongly correlate with elevated readmission risk.
3. **Hospitalization Acuity**: Higher `time_in_hospital`, multi-morbidity (`number_diagnoses`), and high medication counts (`num_medications`).
4. **Medication Regimen Changes**: Patients undergoing diabetic medication alterations during admission face higher readmission risk than stable patients.

---

## 🚀 Quickstart & Installation

### 1. Clone the Repository

```bash
git clone https://github.com/Amrutaa20/patient-readmission-risk-prediction.git
cd patient-readmission-risk-prediction
```

### 2. Set Up a Virtual Environment

```bash
# Windows
python -m venv .venv
.venv\Scripts\activate

# macOS / Linux
python3 -m venv .venv
source .venv/bin/activate
```

### 3. Install Dependencies

```bash
pip install -r requirements.txt
```

### 4. Run Jupyter Notebooks

```bash
jupyter notebook notebooks/
```

You can execute the notebooks in sequence from `01` through `07`.

---

## 📦 Model Artifacts & Deployment

The trained models and threshold metadata are exported in `models/`:

- `catboost_model.pkl` & `catboost_model.cbm`: Champion model
- `xgboost_model.pkl`: XGBoost model
- `random_forest_model.pkl`: Random Forest model
- `logistic_regression_model.pkl`: Logistic Regression model
- `scaler.pkl`: Fitted `StandardScaler` for inference
- `champion_model_metadata.json`: Calibrated thresholds and metric metadata

---

## 👥 Authors & Acknowledgments

- **Author**: [Amruta](https://github.com/Amrutaa20)
- **Dataset**: Strack, B., DeShazo, J. P., Gennings, C., et al. (2014). _Impact of HbA1c Measurement on Hospital Readmission Rates: Analysis of 70,000 Clinical Database Patient Records_. BioMed Research International.

---

## 📜 License

This project is licensed under the [MIT License](LICENSE).
