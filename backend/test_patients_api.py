import unittest
import tempfile
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

from backend import app as backend


class DatasetPatientsApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(backend.app)

    def test_default_page_uses_real_dataset_and_excludes_identifiers(self):
        response = self.client.get("/patients")
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["total"], 50)
        self.assertEqual(body["page"], 1)
        self.assertEqual(body["page_size"], 50)
        self.assertEqual(body["total_pages"], 1)
        self.assertEqual(len(body["items"]), 50)
        self.assertEqual(body["items"][0]["row_index"], 0)
        self.assertNotIn("encounter_id", body["items"][0])
        self.assertNotIn("patient_nbr", body["items"][0])
        self.assertIn("readmitted", body["items"][0])
        self.assertIn("admission_type_label", body["items"][0])
        self.assertIn("discharge_disposition_label", body["items"][0])
        self.assertIn("admission_source_label", body["items"][0])
        self.assertIn("(code ", body["items"][0]["admission_type_label"])

    def test_official_admission_labels_are_searchable(self):
        response = self.client.get("/patients", params={"search": "Emergency"})
        self.assertEqual(response.status_code, 200)
        self.assertGreater(response.json()["total"], 0)
        self.assertTrue(all("Emergency" in row["admission_type_label"] for row in response.json()["items"]))

    def test_patients_browse_is_limited_to_one_deterministic_sample(self):
        next_page = self.client.get("/patients", params={"page": 2})
        self.assertEqual(next_page.status_code, 422)
        all_rows = self.client.get("/patients").json()["items"]
        self.assertEqual(all_rows[-1]["row_index"], 49)

    def test_dataset_is_parsed_once_per_process(self):
        previous_cache = backend._patient_dataset_cache
        backend._patient_dataset_cache = None
        original_read_csv = backend.pd.read_csv
        try:
            with patch.object(backend.pd, "read_csv", wraps=original_read_csv) as read_csv:
                self.assertEqual(self.client.get("/patients").status_code, 200)
                self.assertEqual(self.client.get("/dashboard/summary").status_code, 200)
                self.assertEqual(read_csv.call_count, 1)
        finally:
            backend._patient_dataset_cache = previous_cache

    def test_page_size_50_and_dataset_row_search(self):
        response = self.client.get("/patients", params={"page_size": 50})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["page_size"], 50)
        self.assertEqual(len(response.json()["items"]), 50)
        searched = self.client.get("/patients", params={"search": "49"})
        self.assertEqual(searched.status_code, 200)
        self.assertTrue(any(item["row_index"] == 49 for item in searched.json()["items"]))
        outside_sample = self.client.get("/patients", params={"search": "101765"}).json()
        self.assertEqual(outside_sample["items"], [])

    def test_search_and_demographic_filter_use_actual_records(self):
        first_page = self.client.get("/patients").json()
        age = first_page["items"][0]["age"]
        filtered = self.client.get("/patients", params={"age": age, "search": age})
        self.assertEqual(filtered.status_code, 200)
        body = filtered.json()
        self.assertGreater(body["total"], 0)
        self.assertTrue(all(item["age"] == age for item in body["items"]))

    def test_no_matches_and_invalid_pagination_are_distinct(self):
        empty = self.client.get("/patients", params={"search": "no-real-dataset-value-9zq"})
        self.assertEqual(empty.status_code, 200)
        self.assertEqual(empty.json()["items"], [])
        self.assertEqual(empty.json()["total"], 0)
        self.assertEqual(self.client.get("/patients", params={"page_size": 26}).status_code, 422)

    def test_missing_source_file_returns_service_unavailable(self):
        previous_cache = backend._patient_dataset_cache
        backend._patient_dataset_cache = None
        try:
            with patch.object(backend, "RAW_DATA_PATH", Path("missing-patient-data.csv")):
                response = self.client.get("/patients")
        finally:
            backend._patient_dataset_cache = previous_cache
        self.assertEqual(response.status_code, 503)

    def test_filter_options_are_from_dataset_values(self):
        response = self.client.get("/patients/filters")
        self.assertEqual(response.status_code, 200)
        self.assertIn("[50-60)", response.json()["age"])
        self.assertIn("Female", response.json()["gender"])

    def test_dashboard_summary_uses_full_dataset_statistics(self):
        response = self.client.get("/dashboard/summary")
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["dataset_records"], 101766)
        self.assertEqual(body["browsable_sample_records"], 50)
        self.assertEqual(body["historical_readmissions_within_30_days"], 11357)
        self.assertAlmostEqual(body["historical_readmission_rate"], 11357 / 101766)
        self.assertIn("as_of", body)

    def test_prediction_is_saved_automatically_and_idempotently(self):
        with tempfile.TemporaryDirectory() as directory:
            with patch.object(backend, "HISTORY_DB_PATH", Path(directory) / "history.sqlite3"):
                first = self.client.post("/predict/sample", json={"row_index": 0}, headers={"Idempotency-Key": "same-request"})
                second = self.client.post("/predict/sample", json={"row_index": 0}, headers={"Idempotency-Key": "same-request"})
                self.assertEqual(first.status_code, 200)
                self.assertEqual(first.json()["history_status"], "persisted")
                self.assertEqual(first.json()["history_id"], second.json()["history_id"])
                self.assertEqual(first.json()["prediction_timestamp"], second.json()["prediction_timestamp"])
                history = self.client.get("/prediction-history", params={"page": 1, "page_size": 25})
                self.assertEqual(history.status_code, 200)
                self.assertEqual(history.json()["total"], 1)
                self.assertEqual(history.json()["items"][0]["source"], "dataset sample")
                self.assertIsNone(history.json()["items"][0]["actual_label"])

    def test_prediction_reports_when_history_persistence_is_unavailable(self):
        with tempfile.TemporaryDirectory() as directory:
            with patch.object(backend, "HISTORY_DB_PATH", Path(directory)):
                response = self.client.post("/predict/sample", json={"row_index": 0})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["history_status"], "unavailable")
        self.assertIsNone(response.json()["history_id"])

    def test_processed_row_offsets_are_indexed_once_across_sample_predictions(self):
        old_cache, old_signature = backend._processed_row_index_cache, backend._processed_row_index_signature
        backend._processed_row_index_cache = None
        backend._processed_row_index_signature = None
        original_read_csv = backend.pd.read_csv
        try:
            with tempfile.TemporaryDirectory() as directory, patch.object(backend, "HISTORY_DB_PATH", Path(directory) / "history.sqlite3"):
                with patch.object(backend.pd, "read_csv", wraps=original_read_csv) as read_csv:
                    first = self.client.post("/predict/sample", json={"row_index": 0})
                    second = self.client.post("/predict/sample", json={"row_index": 1})
                    self.assertEqual(first.status_code, 200)
                    self.assertEqual(second.status_code, 200)
                    self.assertEqual(read_csv.call_count, 2)  # One requested row per request, never the full CSV.
                    self.assertEqual(len(backend._processed_row_index_cache["offsets"]), 101766)
        finally:
            backend._processed_row_index_cache = old_cache
            backend._processed_row_index_signature = old_signature

    def test_history_import_does_not_store_legacy_patient_identifiers(self):
        with tempfile.TemporaryDirectory() as directory:
            with patch.object(backend, "HISTORY_DB_PATH", Path(directory) / "history.sqlite3"):
                imported = self.client.post("/prediction-history/import", json={"items": [{
                    "request_id": "legacy-one", "prediction_timestamp": "2026-10-16T00:00:00+00:00",
                    "model": "XGBoost", "model_version": "xgboost_model.pkl", "predicted_class": 1,
                    "predicted_label": "Higher estimated readmission risk", "readmission_probability": 0.7,
                    "threshold": 0.4, "source": "legacy clinical form", "patientId": "patient-private"
                }]})
                self.assertEqual(imported.status_code, 200)
                history = self.client.get("/prediction-history")
                item = history.json()["items"][0]
                self.assertNotIn("patientId", item)
                self.assertNotIn("patient-private", str(item))

    def test_dataset_analytics_aggregates_actual_outcomes(self):
        response = self.client.get("/analytics")
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["dataset_records"], 101766)
        self.assertEqual(sum(group["readmissions"] for group in body["by_age"]), 11357)
        self.assertEqual(sum(group["records"] for group in body["by_gender"]), 101766)
        self.assertIn("target_definition", body)

    def test_model_comparison_uses_saved_evaluation_metadata(self):
        response = self.client.get("/model-comparison")
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["deployment_model"], "XGBoost")
        self.assertEqual(body["evaluation_split"]["test_rows"], 20354)
        catboost = next(model for model in body["models"] if model["name"] == "CatBoost")
        self.assertAlmostEqual(catboost["roc_auc"], 0.687060, places=6)

    def test_model_artifact_loads_once_on_first_prediction_not_api_health(self):
        previous_model = backend.model
        original_load = backend.joblib.load
        backend.model = None
        try:
            with patch.object(backend.joblib, "load", wraps=original_load) as load_model:
                self.assertEqual(self.client.get("/").status_code, 200)
                load_model.assert_not_called()
                backend._get_model()
                backend._get_model()
                self.assertEqual(load_model.call_count, 1)
        finally:
            backend.model = previous_model

    def test_assistant_answers_dataset_outcomes_from_authoritative_source(self):
        response = self.client.post("/assistant/query", json={"question": "How many were readmitted within 30 days?"})
        self.assertEqual(response.status_code, 200)
        self.assertIn("11,357", response.json()["answer"])
        self.assertIn("90,409", response.json()["answer"])
        self.assertIn("101,766", response.json()["answer"])
        self.assertIn("Current raw dataset", response.json()["source"])

    def test_assistant_does_not_claim_unique_patient_count(self):
        response = self.client.post("/assistant/query", json={"question": "How many unique patients are in the dataset?"})
        self.assertEqual(response.status_code, 200)
        self.assertIn("encounter records", response.json()["answer"])
        self.assertIn("unique-person count is not provided", response.json()["answer"])

    def test_assistant_distinguishes_history_from_dataset_and_clarifies_ambiguous_risk(self):
        with tempfile.TemporaryDirectory() as directory:
            with patch.object(backend, "HISTORY_DB_PATH", Path(directory) / "history.sqlite3"):
                answer = self.client.post("/assistant/query", json={"question": "How many predictions have been made?"}).json()["answer"]
                clarification = self.client.post("/assistant/query", json={"question": "How many are at risk?"}).json()["answer"]
        self.assertIn("0 completed predictions", answer)
        self.assertIn("Do you mean", clarification)
        self.assertIn("separate counts", clarification)

    def test_assistant_prediction_risk_breakdown_uses_saved_history(self):
        with tempfile.TemporaryDirectory() as directory:
            with patch.object(backend, "HISTORY_DB_PATH", Path(directory) / "history.sqlite3"):
                for number, category, label, probability in [
                    (1, 1, "Higher estimated readmission risk", 0.72),
                    (2, 0, "Lower estimated readmission risk", 0.16),
                ]:
                    backend._save_history_item({
                        "prediction_timestamp": f"2026-10-16T00:00:0{number}+00:00", "model": "XGBoost",
                        "model_version": "xgboost_model.pkl", "predicted_class": category,
                        "predicted_label": label, "readmission_probability": probability,
                        "threshold": 0.4, "source": "clinical form",
                    }, f"assistant-risk-{number}")
                response = self.client.post("/assistant/query", json={"question": "How many predictions are high risk?"})
        self.assertEqual(response.status_code, 200)
        self.assertIn("2 completed predictions", response.json()["answer"])
        self.assertIn("1 are classified as higher estimated risk", response.json()["answer"])
        self.assertIn("1 as lower estimated risk", response.json()["answer"])

    def test_assistant_uses_verified_model_metrics_and_handles_unknowns(self):
        metric = self.client.post("/assistant/query", json={"question": "What is the model's accuracy?"}).json()
        unknown = self.client.post("/assistant/query", json={"question": "Tell me tomorrow's hospital census"}).json()
        self.assertIn("0.467", metric["answer"])
        self.assertIn("historical test split", metric["answer"])
        self.assertIn("can't verify", unknown["answer"])

    def test_assistant_prediction_lookup_uses_only_saved_prediction_metadata(self):
        with tempfile.TemporaryDirectory() as directory:
            with patch.object(backend, "HISTORY_DB_PATH", Path(directory) / "history.sqlite3"):
                backend._save_history_item({
                    "prediction_timestamp": "2026-10-16T00:00:00+00:00", "model": "XGBoost",
                    "model_version": "xgboost_model.pkl", "predicted_class": 1,
                    "predicted_label": "Higher estimated readmission risk", "readmission_probability": 0.73,
                    "threshold": 0.4, "source": "clinical form",
                }, "assistant-history-test")
                connection = backend._history_connection()
                row = connection.execute("SELECT id FROM prediction_history").fetchone()
                prediction_id = row[0]
                connection.close()
                answer = self.client.post("/assistant/query", json={"question": f"What was the risk probability for {prediction_id}?"})
        self.assertEqual(answer.status_code, 200)
        self.assertIn("73.0%", answer.json()["answer"])
        self.assertIn("not a recorded outcome", answer.json()["answer"])
        self.assertNotIn("patient", answer.json()["answer"].casefold())


if __name__ == "__main__":
    unittest.main()
