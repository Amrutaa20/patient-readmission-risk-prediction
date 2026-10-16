from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
import json
import csv
import io
import sqlite3
import uuid
from datetime import datetime, timezone
from threading import Lock
import re

import joblib
import pandas as pd

from fastapi import FastAPI, HTTPException, Query, Header
from pydantic import BaseModel, Field, StrictInt, StrictStr
from typing import Literal


# --------------------------------------------------
# PATHS
# --------------------------------------------------

BASE_DIR = Path(__file__).resolve().parent.parent

MODEL_PATH = BASE_DIR / "models" / "xgboost_model.pkl"
MODEL_METADATA_PATH = BASE_DIR / "models" / "champion_model_metadata.json"
DATA_PATH = (
    BASE_DIR
    / "data"
    / "processed"
    / "readmission_cleaned.csv"
)
RAW_DATA_PATH = BASE_DIR / "data" / "raw" / "diabetic_data.csv"
ID_MAPPING_PATH = BASE_DIR / "data" / "raw" / "IDS_mapping.csv"
HISTORY_DB_PATH = BASE_DIR / "data" / "prediction_history.sqlite3"

# Dataset browsing deliberately exposes only non-identifying encounter fields.
# In particular, encounter_id and patient_nbr are never selected or serialized.
PATIENT_LIST_COLUMNS = [
    "race", "gender", "age", "admission_type_id",
    "discharge_disposition_id", "admission_source_id", "time_in_hospital",
    "num_lab_procedures", "num_procedures", "num_medications",
    "number_inpatient", "medical_specialty", "readmitted",
]
PATIENT_CACHE_COLUMNS = [*PATIENT_LIST_COLUMNS, "diag_1"]
PATIENT_SEARCH_COLUMNS = [
    "race", "gender", "age", "medical_specialty", "readmitted",
    "admission_type_id", "discharge_disposition_id", "admission_source_id",
    "time_in_hospital", "num_lab_procedures", "num_procedures",
    "num_medications", "number_inpatient",
    "admission_type_label", "discharge_disposition_label", "admission_source_label",
]
PATIENT_FILTER_COLUMNS = {"race", "gender", "age"}
ID_MAPPING_COLUMNS = {
    "admission_type_id", "discharge_disposition_id", "admission_source_id",
}
PATIENT_BROWSE_LIMIT = 50


def _load_id_mappings():
    """Read the project's bundled official descriptions for coded fields."""
    mappings = {column: {} for column in ID_MAPPING_COLUMNS}
    if not ID_MAPPING_PATH.is_file():
        return mappings
    current_column = None
    with ID_MAPPING_PATH.open(encoding="utf-8-sig", newline="") as mapping_file:
        for row in csv.reader(mapping_file):
            if len(row) < 2:
                continue
            first, second = row[0].strip(), row[1].strip()
            if first in mappings and second.lower() == "description":
                current_column = first
            elif current_column and first.isdigit():
                mappings[current_column][int(first)] = second
    return mappings


ID_MAPPINGS = _load_id_mappings()

_patient_dataset_cache = None
_patient_dataset_cache_signature = None
_patient_dataset_cache_lock = Lock()
_processed_row_index_cache = None
_processed_row_index_signature = None
_processed_row_index_lock = Lock()
_analytics_cache = None
_analytics_cache_signature = None
_analytics_cache_lock = Lock()
_dataset_summary_cache = None
_dataset_summary_cache_signature = None
_dataset_summary_cache_lock = Lock()


def _load_patient_records():
    """Load only the explicitly approved dataset columns, once per process."""
    global _patient_dataset_cache, _patient_dataset_cache_signature
    if not RAW_DATA_PATH.is_file():
        raise HTTPException(status_code=503, detail="Patient dataset is unavailable.")
    stat = RAW_DATA_PATH.stat()
    signature = (stat.st_mtime_ns, stat.st_size)
    if _patient_dataset_cache is None or _patient_dataset_cache_signature != signature:
        with _patient_dataset_cache_lock:
            if _patient_dataset_cache is None or _patient_dataset_cache_signature != signature:
                try:
                    records = pd.read_csv(RAW_DATA_PATH, usecols=PATIENT_CACHE_COLUMNS)
                except ValueError as exc:
                    raise RuntimeError("The raw dataset is missing required browsing columns.") from exc
                records.insert(0, "row_index", range(len(records)))
                _patient_dataset_cache = records.replace({"?": "Unknown"})
                for column, mapping in ID_MAPPINGS.items():
                    label_column = column.removesuffix("_id") + "_label"
                    _patient_dataset_cache[label_column] = [
                        f"{mapping.get(int(code), 'Code ' + str(int(code)))} (code {int(code)})"
                        for code in _patient_dataset_cache[column]
                    ]
                _patient_dataset_cache_signature = signature
    return _patient_dataset_cache


def _load_processed_row_index():
    """Index physical CSV row offsets once without parsing the full model matrix."""
    global _processed_row_index_cache, _processed_row_index_signature
    if not DATA_PATH.is_file():
        raise HTTPException(status_code=503, detail="Processed dataset is unavailable.")
    stat = DATA_PATH.stat()
    signature = (stat.st_mtime_ns, stat.st_size)
    if _processed_row_index_cache is None or _processed_row_index_signature != signature:
        with _processed_row_index_lock:
            if _processed_row_index_cache is None or _processed_row_index_signature != signature:
                with DATA_PATH.open("rb") as source:
                    header = source.readline()
                    offsets = []
                    while True:
                        offset = source.tell()
                        if not source.readline():
                            break
                        offsets.append(offset)
                _processed_row_index_cache = {"header": header, "offsets": offsets}
                _processed_row_index_signature = signature
    return _processed_row_index_cache


def _read_processed_sample(row_index: int):
    row_index_data = _load_processed_row_index()
    offsets = row_index_data["offsets"]
    if row_index >= len(offsets):
        return None
    with DATA_PATH.open("rb") as source:
        source.seek(offsets[row_index])
        row = source.readline()
    # Only the requested row is parsed by pandas. The source file has one CSV record per line.
    return pd.read_csv(io.BytesIO(row_index_data["header"] + row))


def _history_connection():
    HISTORY_DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(HISTORY_DB_PATH, timeout=10)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA journal_mode=WAL")
    connection.execute("""
        CREATE TABLE IF NOT EXISTS prediction_history (
            id TEXT PRIMARY KEY,
            request_id TEXT NOT NULL UNIQUE,
            created_at TEXT NOT NULL,
            model TEXT NOT NULL,
            model_version TEXT NOT NULL,
            predicted_class INTEGER NOT NULL,
            predicted_label TEXT NOT NULL,
            probability REAL NOT NULL,
            threshold REAL NOT NULL,
            source TEXT NOT NULL
        )
    """)
    connection.execute("CREATE INDEX IF NOT EXISTS idx_prediction_history_created ON prediction_history(created_at DESC)")
    connection.execute("CREATE INDEX IF NOT EXISTS idx_prediction_history_class ON prediction_history(predicted_class)")
    return connection


def _save_history_item(item: dict, request_id: str | None = None) -> dict:
    """Persist only prediction output and non-identifying metadata; dedupe by request key."""
    stable_request_id = (request_id or str(uuid.uuid4())).strip()[:100]
    record_id = f"PH-{uuid.uuid4()}"
    source = item.get("source") or ("dataset sample" if item.get("row_index") is not None else "clinical form")
    try:
        connection = _history_connection()
        try:
            connection.execute("""
                INSERT OR IGNORE INTO prediction_history
                (id, request_id, created_at, model, model_version, predicted_class,
                 predicted_label, probability, threshold, source)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                record_id, stable_request_id, item["prediction_timestamp"], item["model"],
                item.get("model_version", MODEL_VERSION), int(item["predicted_class"]),
                item["predicted_label"], float(item["readmission_probability"]),
                float(item["threshold"]), source,
            ))
            connection.commit()
            saved = connection.execute(
                "SELECT * FROM prediction_history WHERE request_id = ?", (stable_request_id,)
            ).fetchone()
            return dict(saved)
        finally:
            connection.close()
    except (sqlite3.Error, OSError) as exc:
        raise RuntimeError("Prediction history could not be persisted.") from exc


def _prediction_response_with_history(item: dict, request_id: str | None) -> dict:
    try:
        history = _save_history_item(item, request_id)
        return {
            **item,
            "model": history["model"],
            "model_version": history["model_version"],
            "predicted_class": int(history["predicted_class"]),
            "predicted_label": history["predicted_label"],
            "readmission_probability": float(history["probability"]),
            "threshold": float(history["threshold"]),
            "prediction_timestamp": history["created_at"],
            "history_id": history["id"],
            "history_status": "persisted",
        }
    except RuntimeError:
        return {**item, "history_id": None, "history_status": "unavailable"}
# --------------------------------------------------
# LOAD MODEL AND FEATURE SCHEMA
# --------------------------------------------------

with MODEL_METADATA_PATH.open(encoding="utf-8") as metadata_file:
    model_metadata = json.load(metadata_file)
if model_metadata.get("model_file") != MODEL_PATH.name:
    raise RuntimeError("Champion metadata does not identify the configured XGBoost model artifact.")
MODEL_NAME = model_metadata.get("model_name", model_metadata.get("champion_model", "XGBoost"))
MODEL_VERSION = model_metadata.get("model_version", MODEL_PATH.stem)
THRESHOLD = float(model_metadata["operating_threshold"])
if not 0 <= THRESHOLD <= 1:
    raise RuntimeError("The saved model threshold must be between 0 and 1.")

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

# pandas.get_dummies(..., drop_first=True) used these lexical baselines when
# the notebook encoded the full training dataset. Reuse those baselines for
# each individual inference request instead of deriving them from one row.
CATEGORICAL_BASELINES = {
    "race": "AfricanAmerican",
    "gender": "Female",
    "age": "[0-10)",
    "diag_1": "Circulatory",
    "diag_2": "Circulatory",
    "diag_3": "Circulatory",
    "max_glu_serum": ">200",
    "A1Cresult": ">7",
    "change": "Ch",
    "diabetesMed": "No",
}

ALL_DIABETES_MEDICATIONS = {
    "metformin", "repaglinide", "nateglinide", "chlorpropamide", "glimepiride",
    "glipizide", "glyburide", "pioglitazone", "rosiglitazone", "acarbose",
    "miglitol", "insulin", "glyburide-metformin",
}
MEDICATION_BASELINES = {
    name: ("Down" if name in ALL_DIABETES_MEDICATIONS else "No")
    for name in (
        "metformin", "repaglinide", "nateglinide", "chlorpropamide", "glimepiride",
        "acetohexamide", "glipizide", "glyburide", "tolbutamide", "pioglitazone",
        "rosiglitazone", "acarbose", "miglitol", "troglitazone", "tolazamide",
        "examide", "citoglipton", "insulin", "glyburide-metformin",
        "glipizide-metformin", "glimepiride-pioglitazone",
        "metformin-rosiglitazone", "metformin-pioglitazone",
    )
}

model = None
_model_load_lock = Lock()


def _get_model():
    """Load the deployed artifact once on first inference, not during API startup."""
    global model
    if model is None:
        with _model_load_lock:
            if model is None:
                try:
                    loaded_model = joblib.load(MODEL_PATH)
                except Exception as exc:
                    raise RuntimeError("The deployed model artifact is unavailable.") from exc
                if len(MODEL_FEATURE_NAMES) != loaded_model.n_features_in_:
                    raise RuntimeError(
                        f"Expected {loaded_model.n_features_in_} features, "
                        f"but found {len(MODEL_FEATURE_NAMES)}."
                    )
                model = loaded_model
    return model


# --------------------------------------------------
# FASTAPI APPLICATION
# --------------------------------------------------

app = FastAPI(
    title="Patient Readmission Risk Prediction API",
    description=(
        f"Academic prototype using the existing {MODEL_NAME} model "
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

class SamplePredictionRequest(BaseModel):
    row_index: StrictInt = Field(
        ge=0,
        le=101765,
        description="Zero-based row index in the processed dataset."
    )


class LegacyHistoryEntry(BaseModel):
    request_id: StrictStr = Field(min_length=1, max_length=100)
    prediction_timestamp: StrictStr
    model: StrictStr = Field(min_length=1, max_length=100)
    model_version: StrictStr = Field(default="legacy", max_length=100)
    predicted_class: Literal[0, 1]
    predicted_label: StrictStr = Field(min_length=1, max_length=100)
    readmission_probability: float = Field(ge=0, le=1)
    threshold: float = Field(ge=0, le=1)
    source: StrictStr = Field(default="legacy prediction", max_length=40)


class LegacyHistoryImportRequest(BaseModel):
    items: list[LegacyHistoryEntry]


class AssistantQuestionRequest(BaseModel):
    question: StrictStr = Field(min_length=1, max_length=500)


class ClinicalPredictionRequest(BaseModel):
    """Raw encounter fields used by notebooks/02_data_preprocessing.ipynb."""
    class Config:
        extra = "forbid"

    race: Literal["AfricanAmerican", "Asian", "Caucasian", "Hispanic", "Other", "Unknown"]
    gender: Literal["Female", "Male", "Unknown/Invalid"]
    age: Literal["[0-10)", "[10-20)", "[20-30)", "[30-40)", "[40-50)", "[50-60)", "[60-70)", "[70-80)", "[80-90)", "[90-100)"]
    admission_type_id: Literal[1, 2, 3, 4, 5, 6, 7, 8]
    discharge_disposition_id: Literal[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 22, 23, 24, 25, 27, 28]
    admission_source_id: Literal[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 14, 17, 20, 22, 25]
    time_in_hospital: StrictInt = Field(ge=1, le=14)
    num_lab_procedures: StrictInt = Field(ge=1, le=132)
    num_procedures: StrictInt = Field(ge=0, le=6)
    num_medications: StrictInt = Field(ge=1, le=81)
    number_outpatient: StrictInt = Field(ge=0, le=42)
    number_emergency: StrictInt = Field(ge=0, le=76)
    number_inpatient: StrictInt = Field(ge=0, le=21)
    diag_1: StrictStr = Field(min_length=1, max_length=8)
    diag_2: StrictStr = Field(min_length=1, max_length=8)
    diag_3: StrictStr = Field(min_length=1, max_length=8)
    number_diagnoses: StrictInt = Field(ge=1, le=16)
    max_glu_serum: Literal["None", "Norm", ">200", ">300"]
    A1Cresult: Literal["None", "Norm", ">7", ">8"]
    metformin: Literal["Down", "No", "Steady", "Up"]
    repaglinide: Literal["Down", "No", "Steady", "Up"]
    nateglinide: Literal["Down", "No", "Steady", "Up"]
    chlorpropamide: Literal["Down", "No", "Steady", "Up"]
    glimepiride: Literal["Down", "No", "Steady", "Up"]
    acetohexamide: Literal["No", "Steady"]
    glipizide: Literal["Down", "No", "Steady", "Up"]
    glyburide: Literal["Down", "No", "Steady", "Up"]
    tolbutamide: Literal["No", "Steady"]
    pioglitazone: Literal["Down", "No", "Steady", "Up"]
    rosiglitazone: Literal["Down", "No", "Steady", "Up"]
    acarbose: Literal["Down", "No", "Steady", "Up"]
    miglitol: Literal["Down", "No", "Steady", "Up"]
    troglitazone: Literal["No", "Steady"]
    tolazamide: Literal["No", "Steady", "Up"]
    examide: Literal["No"]
    citoglipton: Literal["No"]
    insulin: Literal["Down", "No", "Steady", "Up"]
    glyburide_metformin: Literal["Down", "No", "Steady", "Up"] = Field(alias="glyburide-metformin")
    glipizide_metformin: Literal["No", "Steady"] = Field(alias="glipizide-metformin")
    glimepiride_pioglitazone: Literal["No", "Steady"] = Field(alias="glimepiride-pioglitazone")
    metformin_rosiglitazone: Literal["No", "Steady"] = Field(alias="metformin-rosiglitazone")
    metformin_pioglitazone: Literal["No", "Steady"] = Field(alias="metformin-pioglitazone")
    change: Literal["Ch", "No"]
    diabetesMed: Literal["No", "Yes"]

    def dataset_values(self) -> dict:
        values = self.dict(by_alias=True)
        visits = values["number_outpatient"] + values["number_emergency"] + values["number_inpatient"]
        values["total_previous_visits"] = visits
        for column in ("diag_1", "diag_2", "diag_3"):
            values[column] = categorize_diagnosis(values[column])
        return values


# --------------------------------------------------
# HEALTH CHECK
# --------------------------------------------------

@app.get("/")
def home():
    return {
        "message": "Patient Readmission Risk Prediction API",
        "status": "running",
        "model": MODEL_NAME,
        "model_version": MODEL_VERSION,
        "input_features": len(MODEL_FEATURE_NAMES),
        "threshold": THRESHOLD,
        "selection_status": model_metadata.get("selection_status", "provisional"),
    }


@app.get("/patients")
def list_patients(
    page: int = Query(1, ge=1),
    page_size: int = Query(PATIENT_BROWSE_LIMIT, ge=1, le=PATIENT_BROWSE_LIMIT),
    search: str = Query("", max_length=100),
    age: str | None = Query(None, max_length=20),
    gender: str | None = Query(None, max_length=30),
    race: str | None = Query(None, max_length=30),
):
    """Browse a deterministic sample of at most 50 raw encounters."""
    try:
        if page != 1:
            raise HTTPException(status_code=422, detail="The Patients page is limited to one 50-record sample.")
        if page_size != PATIENT_BROWSE_LIMIT:
            raise HTTPException(status_code=422, detail="The Patients page returns a fixed sample of 50 records.")
        records = _load_patient_records()
        sample = records.iloc[:PATIENT_BROWSE_LIMIT]
        mask = pd.Series(True, index=sample.index)
        for column, value in (("age", age), ("gender", gender), ("race", race)):
            if value:
                if value not in set(sample[column].astype(str).unique()):
                    raise HTTPException(status_code=422, detail=f"Unsupported {column} filter.")
                mask &= sample[column].astype(str).eq(value)

        term = search.strip().casefold()
        if term:
            matches = pd.Series(False, index=records.index)
            for column in PATIENT_SEARCH_COLUMNS:
                matches |= sample[column].astype(str).str.casefold().str.contains(term, regex=False, na=False)
            matches |= sample["row_index"].astype(str).str.contains(term, regex=False, na=False)
            mask &= matches

        matching_positions = mask.to_numpy().nonzero()[0]
        total = int(len(matching_positions))
        start = (page - 1) * page_size
        page_records = sample.iloc[matching_positions[start:start + page_size]]
        # Keep the response allowlisted even if the source dataset changes.
        output_columns = ["row_index", *PATIENT_LIST_COLUMNS]
        output_columns += [
            column.removesuffix("_id") + "_label"
            for column in sorted(ID_MAPPING_COLUMNS)
        ]
        page_values = page_records[output_columns].astype(object)
        items = page_values.where(pd.notna(page_values), None).to_dict(orient="records")
        return {
            "items": items,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": 1 if total else 0,
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Unable to read patient dataset records.") from exc


@app.get("/patients/filters")
def patient_filter_options():
    """Return actual values for supported browse filters."""
    try:
        records = _load_patient_records().iloc[:PATIENT_BROWSE_LIMIT]
        return {
            column: sorted(records[column].astype(str).unique().tolist())
            for column in sorted(PATIENT_FILTER_COLUMNS)
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Unable to read patient dataset filters.") from exc


@app.get("/dashboard/summary")
def dashboard_summary():
    """Return current statistics from the local dataset without exposing records."""
    try:
        data = _get_cached_dataset_summary()
        total = int(data["dataset_records"])
        outcomes = data["outcomes"]
        within_30_days = int(outcomes.get("<30", 0))
        return {
            "dataset_records": total,
            "browsable_sample_records": min(PATIENT_BROWSE_LIMIT, total),
            "historical_readmissions_within_30_days": within_30_days,
            "historical_readmission_rate": within_30_days / total if total else 0,
            "historical_outcomes": {
                "within_30_days": within_30_days,
                "after_30_days": int(outcomes.get(">30", 0)),
                "no_readmission": int(outcomes.get("NO", 0)),
            },
            "as_of": datetime.now(timezone.utc).isoformat(),
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Dashboard dataset summary is unavailable.") from exc


def _public_history_record(row):
    return {
        "id": row["id"],
        "history_id": row["id"],
        "history_status": "persisted",
        "prediction_timestamp": row["created_at"],
        "model": row["model"],
        "model_version": row["model_version"],
        "predicted_class": int(row["predicted_class"]),
        "predicted_label": row["predicted_label"],
        "readmission_probability": float(row["probability"]),
        "threshold": float(row["threshold"]),
        "source": row["source"],
        "actual_label": None,
        "row_index": None,
        "note": "Automatically recorded prediction; prediction inputs are not stored.",
    }


@app.get("/prediction-history")
def list_prediction_history(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    search: str = Query("", max_length=100),
    risk: str | None = Query(None),
    model_name: str | None = Query(None, alias="model"),
    days: int | None = Query(None, ge=1, le=3650),
):
    clauses, parameters = [], []
    if search.strip():
        clauses.append("(model LIKE ? OR model_version LIKE ? OR predicted_label LIKE ? OR source LIKE ?)")
        token = f"%{search.strip()}%"
        parameters.extend([token] * 4)
    if risk:
        if risk not in ("higher", "lower"):
            raise HTTPException(status_code=422, detail="Risk filter must be higher or lower.")
        clauses.append("predicted_class = ?")
        parameters.append(1 if risk == "higher" else 0)
    if model_name:
        clauses.append("model = ?")
        parameters.append(model_name)
    if days is not None:
        cutoff = (datetime.now(timezone.utc).timestamp() - days * 86400)
        cutoff_iso = datetime.fromtimestamp(cutoff, timezone.utc).isoformat()
        clauses.append("created_at >= ?")
        parameters.append(cutoff_iso)
    where = f" WHERE {' AND '.join(clauses)}" if clauses else ""
    offset = (page - 1) * page_size
    try:
        connection = _history_connection()
        try:
            total = int(connection.execute(f"SELECT COUNT(*) FROM prediction_history{where}", parameters).fetchone()[0])
            all_count = connection.execute("""
                SELECT COUNT(*) AS total,
                    COALESCE(SUM(predicted_class = 1), 0) AS higher,
                    COALESCE(SUM(predicted_class = 0), 0) AS lower
                FROM prediction_history
            """).fetchone()
            available_models = [row[0] for row in connection.execute(
                "SELECT DISTINCT model FROM prediction_history ORDER BY model"
            ).fetchall()]
            rows = connection.execute(
                f"SELECT * FROM prediction_history{where} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?",
                [*parameters, page_size, offset],
            ).fetchall()
            return {
                "items": [_public_history_record(row) for row in rows],
                "total": total,
                "page": page,
                "page_size": page_size,
                "total_pages": (total + page_size - 1) // page_size,
                "summary": {"total": int(all_count["total"]), "higher_risk": int(all_count["higher"]), "lower_risk": int(all_count["lower"])},
                "available_models": available_models,
            }
        finally:
            connection.close()
    except sqlite3.Error as exc:
        raise HTTPException(status_code=503, detail="Prediction history is unavailable.") from exc


@app.get("/prediction-history/{history_id}")
def get_prediction_history_item(history_id: str):
    try:
        connection = _history_connection()
        try:
            row = connection.execute("SELECT * FROM prediction_history WHERE id = ?", (history_id,)).fetchone()
            if row is None:
                raise HTTPException(status_code=404, detail="Prediction history record was not found.")
            return _public_history_record(row)
        finally:
            connection.close()
    except sqlite3.Error as exc:
        raise HTTPException(status_code=503, detail="Prediction history is unavailable.") from exc


@app.post("/prediction-history/import")
def import_legacy_prediction_history(request: LegacyHistoryImportRequest):
    if len(request.items) > 1000:
        raise HTTPException(status_code=413, detail="Import at most 1000 legacy records per request.")
    imported = 0
    try:
        for legacy in request.items:
            item = legacy.model_dump()
            request_id = f"legacy:{legacy.request_id}"
            _save_history_item(item, request_id)
            imported += 1
        return {"imported": imported}
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail="Legacy prediction history could not be migrated.") from exc


@app.delete("/prediction-history")
def clear_prediction_history():
    try:
        connection = _history_connection()
        try:
            connection.execute("DELETE FROM prediction_history")
            connection.commit()
        finally:
            connection.close()
        return {"deleted": True}
    except sqlite3.Error as exc:
        raise HTTPException(status_code=503, detail="Prediction history could not be cleared.") from exc


@app.get("/model-comparison")
def get_model_comparison():
    """Serve the repository's recorded evaluation results and their caveat."""
    comparison_path = BASE_DIR / "models" / "model_comparison_metadata.json"
    try:
        with comparison_path.open(encoding="utf-8") as comparison_file:
            comparison = json.load(comparison_file)
        champion_metrics = {
            "name": MODEL_NAME,
            "threshold": THRESHOLD,
            "roc_auc": model_metadata["roc_auc"],
            "pr_auc": model_metadata["pr_auc"],
            "precision": model_metadata["precision"],
            "recall": model_metadata["recall"],
            "f1_score": model_metadata["f1_score"],
            "accuracy": model_metadata["accuracy"],
            "true_negative": model_metadata["true_negative"],
            "false_positive": model_metadata["false_positive"],
            "false_negative": model_metadata["false_negative"],
            "true_positive": model_metadata["true_positive"],
        }
        comparison["deployment_model"] = MODEL_NAME
        comparison["model_version"] = MODEL_VERSION
        comparison["target_definition"] = "Binary readmission within 30 days: raw readmitted == '<30'."
        comparison["evaluation_type"] = "Historical stratified test split; used during model selection/threshold tuning, not an untouched final test."
        comparison["validation_split_available"] = False
        comparison["selection_status"] = model_metadata.get("selection_status", "provisional")
        comparison["selection_note"] = model_metadata.get(
            "selection_note",
            comparison.get("selection_note", "Model selection is provisional."),
        )
        comparison["models"] = [champion_metrics, *[
            result for result in comparison["models"] if result["name"] != MODEL_NAME
        ]]
        return comparison
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Model comparison metadata is unavailable.") from exc


# --------------------------------------------------
# SAMPLE PREDICTION
# --------------------------------------------------

@app.post("/predict/sample")
def predict_sample(
    request: SamplePredictionRequest,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key", max_length=100),
):
    try:
        # Read model-ready records once per process, then select the requested row.
        sample = _read_processed_sample(request.row_index)

        if sample is None or sample.empty:
            raise HTTPException(
                status_code=404,
                detail="No dataset record exists at that row index.",
            )

        # Keep only model input columns.
        X = sample[FEATURE_COLUMNS].copy()

        # Apply the same feature names used during training.
        X.columns = MODEL_FEATURE_NAMES

        # Generate probability and apply the existing threshold.
        probability = float(_get_model().predict_proba(X)[0, 1])

        prediction = int(probability >= THRESHOLD)

        return _prediction_response_with_history({
            "row_index": request.row_index,
            "model": MODEL_NAME,
            "model_version": MODEL_VERSION,
            "predicted_class": prediction,
            "predicted_label": (
                "Higher estimated readmission risk"
                if prediction == 1
                else "Lower estimated readmission risk"
            ),
            "readmission_probability": round(probability, 4),
            "threshold": THRESHOLD,
            "actual_label": int(sample[TARGET_COLUMN].iloc[0]),
            "prediction_timestamp": datetime.now(timezone.utc).isoformat(),
            "note": (
                "Academic demonstration only. This prediction is "
                "not clinically validated and must not guide patient care."
            ),
        }, idempotency_key)

    except HTTPException:
        raise
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail="The deployed model is unavailable or incompatible with the saved feature schema.") from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Prediction failed: {str(exc)}",
        ) from exc


def categorize_diagnosis(code: str) -> str:
    """Mirror the diagnosis grouping in the saved preprocessing notebook."""
    try:
        if code.startswith("250"):
            return "Diabetes"
        number = float(code)
        if 390 <= number <= 459 or number == 785:
            return "Circulatory"
        if 460 <= number <= 519 or number == 786:
            return "Respiratory"
        if 520 <= number <= 579 or number == 787:
            return "Digestive"
        if 580 <= number <= 629 or number == 788:
            return "Genitourinary"
        if 140 <= number <= 239:
            return "Neoplasms"
        if 710 <= number <= 739:
            return "Musculoskeletal"
        if 800 <= number <= 999:
            return "Injury"
        return "Other"
    except (TypeError, ValueError):
        return "Unknown"


def _outcome_rates(categories, positive):
    grouped = {}
    for category, label in zip(categories, positive):
        entry = grouped.setdefault(str(category), {"label": str(category), "records": 0, "readmissions": 0})
        entry["records"] += 1
        entry["readmissions"] += int(bool(label))
    return [
        {**entry, "rate": entry["readmissions"] / entry["records"] if entry["records"] else 0}
        for entry in grouped.values()
    ]


def _outcome_distribution(categories, outcomes):
    grouped = {}
    for category, outcome in zip(categories, outcomes):
        entry = grouped.setdefault(str(category), {"label": str(category), "within_30_days": 0, "after_30_days": 0, "no_readmission": 0})
        if outcome == "<30":
            entry["within_30_days"] += 1
        elif outcome == ">30":
            entry["after_30_days"] += 1
        elif outcome == "NO":
            entry["no_readmission"] += 1
    return [{**entry, "records": entry["within_30_days"] + entry["after_30_days"] + entry["no_readmission"]} for entry in grouped.values()]


def _get_cached_dataset_summary():
    """Cache only the compact outcome counts needed by Dashboard and count questions."""
    global _dataset_summary_cache, _dataset_summary_cache_signature
    stat = RAW_DATA_PATH.stat()
    signature = (stat.st_mtime_ns, stat.st_size)
    if _dataset_summary_cache is not None and _dataset_summary_cache_signature == signature:
        return _dataset_summary_cache
    with _dataset_summary_cache_lock:
        if _dataset_summary_cache is not None and _dataset_summary_cache_signature == signature:
            return _dataset_summary_cache
        records = _load_patient_records()
        outcomes = records["readmitted"].astype(str).value_counts().to_dict()
        _dataset_summary_cache = {"dataset_records": int(len(records)), "outcomes": outcomes}
        _dataset_summary_cache_signature = signature
    return _dataset_summary_cache


def _get_cached_dataset_analytics():
    """Share aggregate results across Dashboard, Analytics, and Assistant requests."""
    global _analytics_cache, _analytics_cache_signature
    stat = RAW_DATA_PATH.stat()
    signature = (stat.st_mtime_ns, stat.st_size)
    if _analytics_cache is not None and _analytics_cache_signature == signature:
        return _analytics_cache
    with _analytics_cache_lock:
        if _analytics_cache is not None and _analytics_cache_signature == signature:
            return _analytics_cache
        records = _load_patient_records()
        readmitted = records["readmitted"].astype(str).eq("<30")
        prior = records["number_inpatient"].map(lambda n: "3+" if n >= 3 else str(int(n)))
        stay = records["time_in_hospital"].map(
            lambda n: "1-3 days" if n <= 3 else "4-6 days" if n <= 6 else "7-10 days" if n <= 10 else "11-14 days"
        )
        admissions = records["admission_type_id"].map(
            lambda code: f"{ID_MAPPINGS['admission_type_id'].get(int(code), 'Code ' + str(int(code)))} (code {int(code)})"
        )
        diagnoses = records["diag_1"].astype(str).map(categorize_diagnosis)
        _analytics_cache = {
            "dataset_records": int(len(records)),
            "target_definition": "Readmitted within 30 days: raw readmitted == '<30'; all other recorded outcomes are negative.",
            "source": "data/raw/diabetic_data.csv",
            "by_age": _outcome_rates(records["age"], readmitted),
            "by_gender": _outcome_rates(records["gender"], readmitted),
            "by_primary_diagnosis_group": _outcome_rates(diagnoses, readmitted),
            "by_prior_inpatient_visits": _outcome_rates(prior, readmitted),
            "by_admission_type": _outcome_rates(admissions, readmitted),
            "by_length_of_stay": _outcome_rates(stay, readmitted),
            "outcomes": records["readmitted"].astype(str).value_counts().to_dict(),
            "outcome_breakdown_by_age": _outcome_distribution(records["age"], records["readmitted"].astype(str)),
            "outcome_breakdown_by_gender": _outcome_distribution(records["gender"], records["readmitted"].astype(str)),
        }
        _analytics_cache_signature = signature
    return _analytics_cache


@app.get("/analytics")
def get_dataset_analytics():
    """Aggregate actual outcomes over the complete local dataset."""
    try:
        result = dict(_get_cached_dataset_analytics())
        result.pop("outcomes", None)
        return result
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Dataset analytics are unavailable.") from exc


@app.post("/assistant/query")
def query_project_assistant(request: AssistantQuestionRequest):
    """Answer supported project questions from authoritative local sources."""
    question = request.question
    if not question.strip():
        raise HTTPException(status_code=422, detail="Enter a question of up to 500 characters.")
    normalized = question.casefold()
    now = datetime.now(timezone.utc).isoformat()
    data_source = ""
    answer = ""

    try:
        # Ask for clarification instead of mixing historical outcomes and estimates.
        if "unique" in normalized and any(word in normalized for word in ("patient", "people", "person")):
            summary = _get_cached_dataset_summary()
            answer = (f"The dataset contains {summary['dataset_records']:,} encounter records, but this assistant reports encounters rather than unique people. "
                      "A verified unique-person count is not provided because person identifiers are not used in this data-query path.")
            data_source = "Current raw dataset row count; no unique-person deduplication"
        elif "at risk" in normalized and not any(word in normalized for word in ("prediction", "historical", "dataset", "readmission")):
            answer = "Do you mean historical encounters with a recorded readmission outcome, or completed model predictions classified as higher risk? Those are separate counts."
            data_source = "Clarification required"
        elif re.search(r"\b(prediction|predictions|estimates)\b", normalized) and any(word in normalized for word in ("how many", "count", "number", "distribution", "breakdown")):
            connection = _history_connection()
            try:
                summary = connection.execute("""
                    SELECT COUNT(*) AS total,
                      COALESCE(SUM(predicted_class = 1), 0) AS higher,
                      COALESCE(SUM(predicted_class = 0), 0) AS lower
                    FROM prediction_history
                """).fetchone()
            finally:
                connection.close()
            answer = (f"Prediction History currently contains {summary['total']:,} completed predictions. "
                      f"Using the saved model threshold of {THRESHOLD:.2f}, {summary['higher']:,} are classified as higher estimated risk "
                      f"and {summary['lower']:,} as lower estimated risk.")
            data_source = "Current local Prediction History (SQLite) and deployed threshold"
        elif re.search(r"\bPH-[0-9a-fA-F-]{8,}\b", question):
            history_id = re.search(r"\bPH-[0-9a-fA-F-]{8,}\b", question).group(0)
            connection = _history_connection()
            try:
                row = connection.execute("SELECT * FROM prediction_history WHERE id = ?", (history_id,)).fetchone()
            finally:
                connection.close()
            if row is None:
                answer = "I couldn't find that prediction ID in the current Prediction History. Check the ID or open the record from Prediction History."
            else:
                answer = (f"Prediction {row['id']} estimated {float(row['probability']):.1%} readmission probability "
                          f"(threshold {float(row['threshold']):.0%}; {row['predicted_label']}) using {row['model']} "
                          f"version {row['model_version']} at {row['created_at']}. This is a model estimate, not a recorded outcome.")
            data_source = "Current local Prediction History (SQLite)"
        elif any(term in normalized for term in ("how many records", "how many encounters", "how many patients", "dataset count", "dataset size", "number of records", "how many are in the dataset")):
            if any(term in normalized for term in ("processed", "preprocess", "after cleaning")):
                processed_count = len(_load_processed_row_index()["offsets"])
                answer = f"The current processed model dataset contains {processed_count:,} encounter records (data/processed/readmission_cleaned.csv)."
                data_source = "Current processed model dataset"
            else:
                summary = _get_cached_dataset_summary()
                answer = f"The raw diabetic readmission dataset contains {summary['dataset_records']:,} encounter records (data/raw/diabetic_data.csv). These are encounters, not a count of unique people."
                data_source = "Current raw dataset"
        elif any(word in normalized for word in ("age group", "by age", "gender", "admission type", "admission types")) and any(word in normalized for word in ("readmission", "rate", "distribution", "higher", "outcome")):
            summary = _get_cached_dataset_analytics()
            field = "by_age" if "age" in normalized else "by_gender" if "gender" in normalized else "by_admission_type"
            if field in ("by_age", "by_gender") and "distribution" in normalized and "rate" not in normalized:
                breakdown = summary[f"outcome_breakdown_{field}"]
                rendered = "; ".join(
                    f"{group['label']} (n={group['records']:,}): <30 days {group['within_30_days']:,}, >30 days {group['after_30_days']:,}, no readmission recorded {group['no_readmission']:,}"
                    for group in breakdown
                )
                answer = (f"Historical outcomes by {field.removeprefix('by_')} group in {summary['dataset_records']:,} raw dataset encounters: {rendered}. "
                          "Outcomes are historical records, not current patient risks.")
                data_source = "Current raw dataset; readmitted outcome categories"
                return {"answer": answer, "source": data_source, "as_of": now}
            groups = summary[field]
            if field == "by_admission_type":
                groups = sorted(groups, key=lambda group: group["rate"], reverse=True)
                groups = groups[:5]
            rendered = "; ".join(f"{group['label']}: {group['readmissions']:,}/{group['records']:,} ({group['rate']:.1%})" for group in groups)
            answer = (f"Historical readmission within 30 days by {field.removeprefix('by_').replace('_', ' ')} "
                      f"(raw readmitted == '<30'; denominator is all encounters in each group): {rendered}.")
            data_source = "Current raw dataset aggregates; historical outcomes, not model predictions"
        elif any(word in normalized for word in ("readmission", "readmitted", "outcome")) and any(word in normalized for word in ("how many", "count", "percentage", "percent", "rate", "no readmission")):
            summary = _get_cached_dataset_summary()
            outcomes = summary["outcomes"]
            total = summary["dataset_records"]
            within = int(outcomes.get("<30", 0))
            after = int(outcomes.get(">30", 0))
            no_readmission = int(outcomes.get("NO", 0))
            answer = (f"In {total:,} raw dataset encounters, {within:,} ({within / total:.1%}) have a recorded readmission within 30 days, "
                      f"{total - within:,} ({(total - within) / total:.1%}) do not have a within-30-day readmission recorded "
                      f"({after:,} were readmitted after 30 days; {no_readmission:,} have no readmission recorded at all). "
                      "The percentage denominator is all encounters with a recorded dataset row.")
            data_source = "Current raw dataset outcomes; target is raw readmitted == '<30'"
        elif "feature" in normalized or "inputs does" in normalized or "input variables" in normalized:
            raw_features = [column for column in FEATURE_COLUMNS]
            answer = (f"The deployed {MODEL_NAME} model uses {len(MODEL_FEATURE_NAMES)} transformed input features derived from "
                      f"{len(raw_features)} processed fields: {', '.join(raw_features)}. The API applies the saved feature order and preprocessing schema.")
            data_source = "Deployed model schema loaded from the processed dataset"
        elif any(word in normalized for word in ("accuracy", "roc", "auc", "precision", "recall", "f1", "performance", "metrics")):
            metrics = {"accuracy": "accuracy", "roc": "roc_auc", "auc": "roc_auc", "precision": "precision", "recall": "recall", "f1": "f1_score"}
            requested = next((value for key, value in metrics.items() if key in normalized), None)
            if requested is None:
                values = ", ".join(f"{key.replace('_', ' ')} {model_metadata[key]:.3f}" for key in ("accuracy", "roc_auc", "pr_auc", "precision", "recall", "f1_score"))
                answer = f"The deployed {MODEL_NAME} ({MODEL_VERSION}) has recorded metrics: {values}. These come from the historical test split used during model selection and threshold tuning; they are provisional, not an untouched final evaluation."
            else:
                answer = (f"The deployed {MODEL_NAME} ({MODEL_VERSION}) {requested.replace('_', ' ')} is {model_metadata[requested]:.3f}, "
                          "measured on the historical test split used during model selection/threshold tuning. This is provisional, not an untouched final evaluation.")
            data_source = "models/champion_model_metadata.json; same values as Model Performance"
        elif any(word in normalized for word in ("champion", "deployed model", "which model", "model deployed")):
            answer = f"The deployed champion is {MODEL_NAME}, version {MODEL_VERSION}, with operating threshold {THRESHOLD:.2f}. Metadata marks the selection as {model_metadata.get('selection_status', 'provisional')}."
            data_source = "Loaded champion artifact and models/champion_model_metadata.json"
        elif "probability" in normalized or "how does" in normalized and "risk" in normalized:
            answer = (f"The API transforms one submitted encounter using the model's saved feature order and preprocessing schema, then calls the deployed {MODEL_NAME} model for a probability. "
                      f"The probability is compared with the saved {THRESHOLD:.2f} threshold to label it higher or lower estimated risk. The app does not score the historical dataset to answer aggregate questions.")
            data_source = "Deployed prediction pipeline and champion metadata"
        else:
            answer = "I can answer dataset counts and historical outcomes, age/gender/admission breakdowns, deployed model features and metrics, completed prediction counts, and details for a prediction ID. I can't verify that request from the available project data."
            data_source = "Supported local project data only"
        return {"answer": answer, "source": data_source, "as_of": now}
    except HTTPException:
        raise
    except (OSError, sqlite3.Error, KeyError, ValueError) as exc:
        raise HTTPException(status_code=503, detail="The requested assistant data is unavailable right now.") from exc


@app.post("/predict")
def predict_clinical(
    request: ClinicalPredictionRequest,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key", max_length=100),
):
    try:
        values = request.dataset_values()
        feature_values = {column: 0 for column in FEATURE_COLUMNS}
        categorical_values = {
            column: values[column]
            for column in CATEGORICAL_BASELINES
        }
        categorical_values.update({
            name: values[name]
            for name in MEDICATION_BASELINES
        })

        for column, value in values.items():
            if column not in categorical_values:
                if column not in feature_values:
                    raise RuntimeError(f"Input field '{column}' is missing from the saved model schema.")
                feature_values[column] = value

        baselines = {**CATEGORICAL_BASELINES, **MEDICATION_BASELINES}
        for column, value in categorical_values.items():
            dummy_column = f"{column}_{value}"
            if value == baselines[column]:
                continue
            if dummy_column not in feature_values:
                raise HTTPException(
                    status_code=422,
                    detail=f"Category '{value}' for '{column}' is not represented by the saved model schema.",
                )
            feature_values[dummy_column] = 1

        X = pd.DataFrame([[feature_values[column] for column in FEATURE_COLUMNS]], columns=FEATURE_COLUMNS)
        X.columns = MODEL_FEATURE_NAMES
        probability = float(_get_model().predict_proba(X)[0, 1])
        prediction = int(probability >= THRESHOLD)
        return _prediction_response_with_history({
            "row_index": None,
            "model": MODEL_NAME,
            "model_version": MODEL_VERSION,
            "predicted_class": prediction,
            "predicted_label": (
                "Higher estimated readmission risk"
                if prediction == 1
                else "Lower estimated readmission risk"
            ),
            "readmission_probability": round(probability, 4),
            "threshold": THRESHOLD,
            "actual_label": None,
            "prediction_timestamp": datetime.now(timezone.utc).isoformat(),
            "note": (
                "Scored from the supplied encounter fields with the existing saved model and "
                "preprocessing schema. Academic demonstration only; not clinically validated."
            ),
        }, idempotency_key)
    except HTTPException:
        raise
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail="The deployed model is unavailable or incompatible with the saved feature schema.") from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(exc)}") from exc
