import pandas as pd
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent

DATA_PATH = (
    BASE_DIR
    / "data"
    / "processed"
    / "readmission_cleaned.csv"
)

print("Loading processed dataset...")

df = pd.read_csv(DATA_PATH)

print("\nDataset shape:")
print(df.shape)

print("\nColumn names:")
for index, column in enumerate(df.columns, start=1):
    print(f"{index}. {column}")

print("\nData types:")
print(df.dtypes.value_counts())

print("\nFirst 5 rows:")
print(df.head())

print("\nMissing values:")
missing = df.isnull().sum()
print(missing[missing > 0])

print("\nTarget distribution:")
print(df["readmitted_30_days"].value_counts(dropna=False))

print("\nDataset inspection completed.")