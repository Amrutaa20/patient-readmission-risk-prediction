import json
import joblib
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
MODEL_DIR = BASE_DIR / "models"

# Read the existing model-selection metadata
with open(
    MODEL_DIR / "champion_model_metadata.json",
    "r",
    encoding="utf-8"
) as file:
    metadata = json.load(file)

print("\n=== CHAMPION MODEL METADATA ===")
print(json.dumps(metadata, indent=4))

# Load the already-trained XGBoost model
model_path = MODEL_DIR / metadata["model_file"]

print("\nLoading model:", model_path.name)
model = joblib.load(model_path)

print("\n=== MODEL INFORMATION ===")
print("Model class:", type(model).__name__)

# Inspect the features known to the model
if hasattr(model, "n_features_in_"):
    print("Expected number of input features:", model.n_features_in_)

if hasattr(model, "feature_names_in_"):
    print("\nExpected feature names:")
    print(list(model.feature_names_in_))
else:
    print("\nThe model does not expose feature_names_in_.")

# Inspect the saved scaler without modifying it
scaler_path = MODEL_DIR / "scaler.pkl"

if scaler_path.exists():
    scaler = joblib.load(scaler_path)

    print("\n=== SCALER INFORMATION ===")
    print("Scaler class:", type(scaler).__name__)

    if hasattr(scaler, "n_features_in_"):
        print("Scaler input feature count:", scaler.n_features_in_)

    if hasattr(scaler, "feature_names_in_"):
        print("Scaler feature names:")
        print(list(scaler.feature_names_in_))

print("\nInspection completed.")