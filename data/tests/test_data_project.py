"""Data contract failures and deterministic authored fixtures; no network access."""
from __future__ import annotations

import copy
import csv
import hashlib
import io
import json
from pathlib import Path
import tempfile
import unittest

from data.generate_synthetic import generate
from data.validate import DataValidationError, validate, validate_csv, validate_registry

ROOT = Path(__file__).resolve().parents[2]
REGISTRY = json.loads((ROOT / "data/registry.json").read_text())


class DataQualityTests(unittest.TestCase):
    def setUp(self):
        self.dataset = copy.deepcopy(next(d for d in REGISTRY["datasets"] if d["instrument_id"] == "SYNTH_USD"))
        self.original = (ROOT / self.dataset["csv_path"]).read_text()

    def validate_changed(self, *, field=None, value=None, transform=None, refresh_hash=True):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "fixture.csv"
            reader = csv.DictReader(io.StringIO(self.original))
            fieldnames, rows = list(reader.fieldnames), list(reader)
            if field is not None:
                rows[0][field] = value
            if transform is not None:
                fieldnames, rows = transform(fieldnames, rows)
            with path.open("w", newline="") as stream:
                writer = csv.DictWriter(stream, fieldnames=fieldnames, lineterminator="\n")
                writer.writeheader()
                writer.writerows(rows)
            dataset = copy.deepcopy(self.dataset)
            if refresh_hash:
                dataset["sha256"] = hashlib.sha256(path.read_bytes()).hexdigest()
            return validate_csv(dataset, path)

    def test_synthetic_files_and_public_lineage_validate_without_provider_cache(self):
        result = validate(ROOT / "data/registry.json", ROOT)
        self.assertEqual(len(result["datasets"]), 2)
        self.assertTrue(all(d["rows"] == 8 for d in result["datasets"]))

    def test_authored_generator_reproduces_fixture_and_manifest_bytes(self):
        with tempfile.TemporaryDirectory() as directory:
            generate(Path(directory))
            for path in (ROOT / "data/synthetic").iterdir():
                if path.is_file():
                    self.assertEqual(path.read_bytes(), (Path(directory) / path.name).read_bytes(), path.name)

    def test_indian_session_label_is_previous_utc_day_without_becoming_previous_local_session(self):
        dataset = next(d for d in REGISTRY["datasets"] if d["instrument_id"] == "SYNTH_INR")
        path = ROOT / dataset["csv_path"]
        with path.open() as stream:
            first = next(csv.DictReader(stream))
        self.assertTrue(first["Date"].startswith("2024-10-27 18:30:00+00:00"))
        self.assertEqual(validate_csv(dataset, path)["local_session_start"], "2024-10-28")

    def test_us_exchange_midnight_labels_follow_dst_without_fixed_offset_assumption(self):
        rows = list(csv.DictReader(io.StringIO(self.original)))
        self.assertIn("04:00:00+00:00", rows[4]["Date"])
        self.assertIn("05:00:00+00:00", rows[5]["Date"])
        self.assertTrue(validate_csv(self.dataset, ROOT / self.dataset["csv_path"])["valid"])

    def test_naive_or_non_utc_timestamp_is_rejected(self):
        for stamp in ["2024-10-28 04:00:00", "2024-10-28T00:00:00-04:00"]:
            with self.subTest(stamp=stamp), self.assertRaisesRegex(DataValidationError, "explicitly use UTC"):
                self.validate_changed(field="Date", value=stamp)

    def test_intraday_or_utc_midnight_mislabel_is_rejected(self):
        with self.assertRaisesRegex(DataValidationError, "exchange-local midnight"):
            self.validate_changed(field="Date", value="2024-10-28 00:00:00+00:00")

    def test_duplicate_and_reordered_sessions_are_rejected(self):
        def duplicate(fields, rows):
            rows[1] = rows[0]
            return fields, rows
        def reverse(fields, rows):
            rows[0], rows[1] = rows[1], rows[0]
            return fields, rows
        for transform in [duplicate, reverse]:
            with self.subTest(transform=transform.__name__), self.assertRaisesRegex(DataValidationError, "increasing and unique"):
                self.validate_changed(transform=transform)

    def test_nonfinite_and_nonpositive_prices_are_rejected_without_imputation(self):
        for value in ["NaN", "Infinity", "-Infinity", "0", "-1"]:
            with self.subTest(value=value), self.assertRaisesRegex(DataValidationError, "finite|positive"):
                self.validate_changed(field="Close", value=value)

    def test_inconsistent_high_low_are_rejected(self):
        for field, value in [("High", "99"), ("Low", "102")]:
            with self.subTest(field=field), self.assertRaisesRegex(DataValidationError, "high/low"):
                self.validate_changed(field=field, value=value)

    def test_negative_or_nonfinite_volume_is_rejected_and_zero_is_valid(self):
        for value in ["-1", "NaN", "Infinity"]:
            with self.subTest(value=value), self.assertRaisesRegex(DataValidationError, "finite|nonnegative"):
                self.validate_changed(field="Volume", value=value)
        self.assertTrue(self.validate_changed(field="Volume", value="0")["valid"])

    def test_content_and_schema_drift_are_rejected_separately(self):
        with self.assertRaisesRegex(DataValidationError, "hash drift"):
            self.validate_changed(field="Volume", value="9999", refresh_hash=False)
        def change_header(fields, rows):
            for row in rows:
                row["Timestamp"] = row.pop("Date")
            fields[0] = "Timestamp"
            return fields, rows
        with self.assertRaisesRegex(DataValidationError, "CSV schema drift"):
            self.validate_changed(transform=change_header)

    def test_missing_column_value_and_empty_data_are_rejected(self):
        with self.assertRaisesRegex(DataValidationError, "numeric encoding"):
            self.validate_changed(field="Close", value="")
        with self.assertRaisesRegex(DataValidationError, "row count"):
            self.validate_changed(transform=lambda fields, rows: (fields, []))

    def test_declared_row_count_and_session_coverage_are_enforced(self):
        path = ROOT / self.dataset["csv_path"]
        self.dataset["rows"] = 7
        with self.assertRaisesRegex(DataValidationError, "row count"):
            validate_csv(self.dataset, path)
        self.dataset["rows"] = 8
        self.dataset["local_session_start"] = "2024-10-29"
        with self.assertRaisesRegex(DataValidationError, "exchange-session coverage"):
            validate_csv(self.dataset, path)

    def test_metadata_currency_provider_timezone_and_schema_contracts_are_enforced(self):
        changes = [
            (lambda x: x["datasets"][0].update(currency="USD"), "currency"),
            (lambda x: x["datasets"][0].update(source_id="roneira-synthetic"), "lineage"),
            (lambda x: x["datasets"][0].update(exchange_timezone="UTC"), "timezone"),
            (lambda x: x["instruments"][0].update(currency="ZZZ"), "currency"),
            (lambda x: x["schemas"]["daily-ohlcv-v1"]["columns"].append("CloseAdj"), "schema drift"),
            (lambda x: x.update(schema_version=True), "schema version"),
        ]
        for mutate, expected in changes:
            registry = copy.deepcopy(REGISTRY)
            mutate(registry)
            with self.subTest(expected=expected), self.assertRaisesRegex(DataValidationError, expected):
                validate_registry(registry, ROOT)

    def test_provider_registry_is_bound_to_actual_frozen_research_hash_and_request(self):
        for key, value in [("sha256", "0" * 64), ("rows", 100)]:
            registry = copy.deepcopy(REGISTRY)
            registry["datasets"][0][key] = value
            with self.subTest(key=key), self.assertRaisesRegex(DataValidationError, "actual research evidence"):
                validate_registry(registry, ROOT)
        registry = copy.deepcopy(REGISTRY)
        registry["datasets"][0]["lineage"]["history_request"]["auto_adjust"] = False
        with self.assertRaisesRegex(DataValidationError, "lineage"):
            validate_registry(registry, ROOT)

    def test_no_path_traversal_or_accidental_public_provider_raw_path(self):
        for path in ["data/synthetic/../../private.csv", "data/synthetic/raw-yahoo.csv", "/tmp/raw.csv"]:
            registry = copy.deepcopy(REGISTRY)
            registry["datasets"][0]["csv_path"] = path
            with self.subTest(path=path), self.assertRaisesRegex(DataValidationError, "boundary|traversal"):
                validate_registry(registry, ROOT)

    def test_rights_and_automatic_retention_claims_cannot_silently_change(self):
        registry = copy.deepcopy(REGISTRY)
        registry["sources"][0]["rights"]["raw_redistribution"] = "MIT"
        with self.assertRaisesRegex(DataValidationError, "permission record"):
            validate_registry(registry, ROOT)
        registry = copy.deepcopy(REGISTRY)
        registry["sources"][0]["retention"]["automatic_enforcement"] = True
        with self.assertRaisesRegex(DataValidationError, "operator policy"):
            validate_registry(registry, ROOT)

    def test_research_report_drift_cannot_be_registered_silently(self):
        registry = copy.deepcopy(REGISTRY)
        registry["research_evidence"]["aggregate_report"]["sha256"] = "0" * 64
        with self.assertRaisesRegex(DataValidationError, "reference/hash drift"):
            validate_registry(registry, ROOT)


if __name__ == "__main__":
    unittest.main()
