from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path

import joblib
import pandas as pd

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field


# --------------------------------------------------
# PATHS
# --------------------------------------------------

BASE_DIR = Path(__file__).resolve().parent.parent

MODEL_PATH = BASE_DIR / "models" / "xgboost_model.pkl"
DATA_PATH = (
    BASE_DIR
    / "data"
    / "processed"
    / "readmission_cleaned.csv"
)


# --------------------------------------------------
# LOAD MODEL AND FEATURE SCHEMA
# --------------------------------------------------

model = joblib.load(MODEL_PATH)

# Read only the column names, not the entire dataset.
dataset_columns = pd.read_csv(DATA_PATH, nrows=0).columns.tolist()

TARGET_COLUMN = "readmitted_30_days"

FEATURE_COLUMNS = [
    column for column in dataset_columns
    if column != TARGET_COLUMN
]

# Apply the exact feature-name transformation used in training.
MODEL_FEATURE_NAMES = [
    column
    .replace("[", "_")
    .replace("]", "_")
    .replace("<", "_")
    .replace(">", "_")
    for column in FEATURE_COLUMNS
]

if len(MODEL_FEATURE_NAMES) != model.n_features_in_:
    raise RuntimeError(
        f"Expected {model.n_features_in_} features, "
        f"but found {len(MODEL_FEATURE_NAMES)}."
    )


# --------------------------------------------------
# FASTAPI APPLICATION
# --------------------------------------------------

app = FastAPI(
    title="Patient Readmission Risk Prediction API",
    description=(
        "Academic prototype using an existing XGBoost model "
        "to estimate 30-day readmission risk."
    ),
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:4200",
        "http://127.0.0.1:4200",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --------------------------------------------------
# REQUEST MODEL
# --------------------------------------------------

class PredictionRequest(BaseModel):
    row_index: int = Field(
        ge=0,
        description="Zero-based row index in the processed dataset."
    )


# --------------------------------------------------
# HEALTH CHECK
# --------------------------------------------------

@app.get("/")
def home():
    return {
        "message": "Patient Readmission Risk Prediction API",
        "status": "running",
        "model": "XGBoost",
        "input_features": len(MODEL_FEATURE_NAMES),
    }


# --------------------------------------------------
# SAMPLE PREDICTION
# --------------------------------------------------

@app.post("/predict/sample")
def predict_sample(request: PredictionRequest):
    try:
        # Load one existing processed encounter.
        sample = pd.read_csv(
            DATA_PATH,
            skiprows=range(1, request.row_index + 1),
            nrows=1,
        )

        if sample.empty:
            raise HTTPException(
                status_code=404,
                detail="No dataset record exists at that row index.",
            )

        # Keep only model input columns.
        X = sample[FEATURE_COLUMNS].copy()

        # Apply the same feature names used during training.
        X.columns = MODEL_FEATURE_NAMES

        # Generate probability and apply the existing threshold.
        probability = float(model.predict_proba(X)[0, 1])

        threshold = 0.40
        prediction = int(probability >= threshold)

        return {
            "row_index": request.row_index,
            "predicted_class": prediction,
            "predicted_label": (
                "Higher estimated readmission risk"
                if prediction == 1
                else "Lower estimated readmission risk"
            ),
            "readmission_probability": round(probability, 4),
            "threshold": threshold,
            "actual_label": int(sample[TARGET_COLUMN].iloc[0]),
            "note": (
                "Academic demonstration only. This prediction is "
                "not clinically validated and must not guide patient care."
            ),
        }

    except HTTPException:
        raise

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Prediction failed: {str(exc)}",
        ) from exc