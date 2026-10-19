"""Validate public registry metadata and locally accessible daily OHLCV files.

Standard library only. No download, repair, imputation or raw-row output.
"""
from __future__ import annotations

import argparse
import csv
from datetime import date, datetime, time, timedelta
from decimal import Decimal, InvalidOperation
import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import sys
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

COLUMNS = ["Date", "Open", "High", "Low", "Close", "Volume"]
KINDS = {"synthetic", "provider_snapshot"}
REPO_ROOT = Path(__file__).resolve().parents[1]


class DataValidationError(ValueError):
    """Data cannot satisfy the declared source/schema/quality contract."""


def require(condition: bool, message: str) -> None:
    if not condition:
        raise DataValidationError(message)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def local_path(root: Path, reference: str) -> Path:
    path = PurePosixPath(reference)
    require(not path.is_absolute() and ".." not in path.parts and bool(path.parts),
            "References must be repository-relative paths without traversal.")
    resolved = (root / reference).resolve()
    require(resolved.is_relative_to(root.resolve()), "Reference resolves outside the repository.")
    return resolved


def session_date(text: str) -> date:
    try:
        parsed = date.fromisoformat(text)
    except (ValueError, TypeError) as exc:
        raise DataValidationError("Session dates must use YYYY-MM-DD.") from exc
    require(parsed.isoformat() == text, "Session dates must use canonical YYYY-MM-DD.")
    return parsed


def unique_by_id(items: list, label: str) -> dict:
    require(isinstance(items, list) and len(items) > 0, f"{label} must be a nonempty list.")
    require(all(isinstance(item, dict) and isinstance(item.get("id"), str) and item["id"] for item in items),
            f"{label} require nonempty IDs.")
    indexed = {item["id"]: item for item in items}
    require(len(indexed) == len(items), f"Duplicate {label} IDs.")
    return indexed


def validate_registry(registry: dict, root: Path) -> dict:
    require(type(registry.get("schema_version")) is int and registry["schema_version"] == 1,
            "Unsupported registry schema version.")
    schema = registry.get("schemas", {}).get("daily-ohlcv-v1", {})
    require(schema.get("columns") == COLUMNS, "Unsupported OHLCV schema drift; version and review the contract.")
    require(schema.get("timestamp_semantics") == "utc-label-of-exchange-local-midnight",
            "Daily labels must declare exchange-session semantics.")
    require(schema.get("timestamp_is_observation_or_close_time") is False,
            "A daily session label must not be represented as an observed close time.")
    sources = unique_by_id(registry.get("sources"), "source")
    instruments = unique_by_id(registry.get("instruments"), "instrument")
    datasets = unique_by_id(registry.get("datasets"), "dataset")
    currencies = registry.get("currency_definitions", {})
    require(isinstance(currencies, dict) and {"INR", "USD"}.issubset(currencies), "Missing currency definitions.")
    for instrument in instruments.values():
        require(instrument.get("source_id") in sources, "Instrument has unknown source/provider lineage.")
        require(instrument.get("currency") in currencies, "Instrument has undefined currency.")
        require(isinstance(instrument.get("provider_symbol"), str) and bool(instrument["provider_symbol"]),
                "Instrument requires its provider identifier.")
        try:
            ZoneInfo(instrument["exchange_timezone"])
        except (KeyError, ZoneInfoNotFoundError, TypeError) as exc:
            raise DataValidationError("Instrument needs a valid exchange timezone.") from exc
    for source in sources.values():
        require(source.get("kind") in KINDS and isinstance(source.get("provider"), str) and source["provider"],
                "Source requires kind and provider lineage.")
        require(source.get("retention", {}).get("automatic_enforcement") is False,
                "Registry retention is an operator policy, not an implemented automatic job.")
        rights = source.get("rights", {})
        if source["kind"] == "provider_snapshot":
            require(rights.get("raw_redistribution") == "not-established"
                    and rights.get("trained_weights_redistribution") == "not-established",
                    "Provider rights require a separate reviewed permission record.")
        else:
            require(rights.get("raw_redistribution") == "MIT-authored-synthetic-only",
                    "Synthetic source must declare its authored-data license.")
    seen = set()
    for dataset in datasets.values():
        source = sources.get(dataset.get("source_id"))
        instrument = instruments.get(dataset.get("instrument_id"))
        require(source is not None and instrument is not None, "Dataset has unknown source/instrument lineage.")
        require(dataset["source_id"] == instrument["source_id"], "Dataset provider/instrument lineage mismatch.")
        require(dataset.get("currency") == instrument["currency"], "Dataset currency differs from the instrument contract.")
        require(dataset.get("exchange_timezone") == instrument["exchange_timezone"], "Dataset timezone differs from its instrument.")
        require(dataset.get("schema_id") == "daily-ohlcv-v1", "Unknown dataset schema.")
        require(type(dataset.get("rows")) is int and dataset["rows"] > 0, "Dataset requires a positive row count.")
        require(isinstance(dataset.get("sha256"), str) and re.fullmatch("[0-9a-f]{64}", dataset["sha256"]), "Dataset needs a SHA-256 digest.")
        start, end = session_date(dataset["local_session_start"]), session_date(dataset["local_session_end"])
        require(start <= end, "Dataset session bounds must be ordered.")
        request = dataset.get("requested_range", {})
        require(session_date(request["start"]) <= start <= end < session_date(request["end_exclusive"]),
                "Dataset bounds must fit the requested exclusive interval.")
        prefix = "data/synthetic/" if source["kind"] == "synthetic" else "ml/.cache/research/"
        require(dataset.get("csv_path", "").startswith(prefix), "Dataset path violates its public/local boundary.")
        local_path(root, dataset["csv_path"])
        identity = (dataset["source_id"], dataset["instrument_id"], dataset["csv_path"])
        require(identity not in seen, "Duplicate instrument dataset registration.")
        seen.add(identity)
    evidence = registry.get("research_evidence", {})
    for key in ["config", "aggregate_report"]:
        record = evidence.get(key, {})
        path = local_path(root, record.get("path", ""))
        require(path.is_file() and sha256(path) == record.get("sha256"),
                f"Research {key} reference/hash drift.")
    report = json.loads(local_path(root, evidence["aggregate_report"]["path"]).read_text(encoding="utf-8"))
    for dataset in datasets.values():
        source = sources[dataset["source_id"]]
        lineage = dataset["lineage"]
        if source["kind"] == "provider_snapshot":
            provider_symbol = instruments[dataset["instrument_id"]]["provider_symbol"]
            snapshot = report["dataset"]["datasets"].get(provider_symbol)
            require(snapshot is not None, "Dataset instrument is absent from the actual research evidence.")
            require(snapshot["sha256"] == dataset["sha256"] and snapshot["sessions"] == dataset["rows"]
                    and snapshot["source_timezone"] == dataset["exchange_timezone"],
                    "Registry dataset identity differs from the actual research evidence.")
            require(lineage["retrieved_at_utc"] == report["dataset"]["downloaded_at"]
                    and lineage["history_request"] == report["dataset"]["request"],
                    "Provider retrieval/request lineage differs from the actual research evidence.")
            request = lineage["history_request"]
            require(request["start"] == dataset["requested_range"]["start"]
                    and request["end"] == dataset["requested_range"]["end_exclusive"]
                    and request["interval"] == "1d" and request["auto_adjust"] is True,
                    "Registry provider interval/adjustment lineage differs from its declared request.")
            manifest = local_path(root, lineage["source_manifest"])
            if manifest.exists():
                require(sha256(manifest) == lineage["source_manifest_sha256"], "Local source manifest hash drift.")
        else:
            for field in ["generator", "manifest"]:
                path = local_path(root, lineage[field])
                require(path.is_file() and sha256(path) == lineage[field + "_sha256"],
                        "Authored synthetic generator/manifest hash drift.")
            manifest = json.loads(local_path(root, lineage["manifest"]).read_text(encoding="utf-8"))
            require(manifest["real_market_data"] is False and manifest["license"] == "MIT",
                    "Synthetic fixture manifest must identify authored non-market data.")
            entries = [entry for entry in manifest["datasets"] if entry["instrument"] == dataset["instrument_id"]]
            require(len(entries) == 1 and entries[0]["sha256"] == dataset["sha256"]
                    and entries[0]["rows"] == dataset["rows"] and entries[0]["currency"] == dataset["currency"],
                    "Synthetic dataset lineage differs from its authored manifest.")
    return {"sources": sources, "instruments": instruments, "datasets": datasets}


def validate_csv(dataset: dict, path: Path) -> dict:
    require(path.is_file(), "Dataset file is unavailable locally; acquire it through the documented source workflow.")
    require(sha256(path) == dataset["sha256"], "Dataset hash drift; restore frozen bytes or register a new reviewed version.")
    tz = ZoneInfo(dataset["exchange_timezone"])
    previous, seen_dates, first, last = None, set(), None, None
    rows = 0
    with path.open(encoding="utf-8", newline="") as stream:
        reader = csv.DictReader(stream)
        require(reader.fieldnames == COLUMNS, "CSV schema drift: ordered Date/Open/High/Low/Close/Volume columns required.")
        for rows, row in enumerate(reader, start=1):
            require(set(row) == set(COLUMNS) and all(value is not None for value in row.values()),
                    f"Malformed CSV row {rows}.")
            try:
                raw = row["Date"]
                require(raw.endswith(("+00:00", "Z")), f"Row {rows}: timestamp must explicitly use UTC.")
                stamp = datetime.fromisoformat(raw.replace("Z", "+00:00"))
                require(stamp.utcoffset() == timedelta(0), f"Row {rows}: timestamp must use UTC.")
                local = stamp.astimezone(tz)
                require(local.time() == time.min, f"Row {rows}: daily label must identify exchange-local midnight.")
                current_session = local.date()
                require(previous is None or stamp > previous, f"Row {rows}: timestamps must be strictly increasing and unique.")
                require(current_session not in seen_dates, f"Row {rows}: duplicate instrument session.")
                values = {name: Decimal(row[name]) for name in COLUMNS[1:]}
                require(all(value.is_finite() for value in values.values()), f"Row {rows}: numeric values must be finite.")
                require(all(values[name] > 0 for name in ["Open", "High", "Low", "Close"]), f"Row {rows}: OHLC must be positive.")
                require(values["Volume"] >= 0, f"Row {rows}: volume must be nonnegative.")
                require(values["High"] >= max(values["Open"], values["Low"], values["Close"])
                        and values["Low"] <= min(values["Open"], values["High"], values["Close"]),
                        f"Row {rows}: inconsistent OHLC high/low bounds.")
            except (ValueError, InvalidOperation) as exc:
                if isinstance(exc, DataValidationError):
                    raise
                raise DataValidationError(f"Row {rows}: invalid timestamp or numeric encoding.") from exc
            previous, last = stamp, current_session
            first = current_session if first is None else first
            seen_dates.add(current_session)
    require(rows == dataset["rows"], "Dataset row count differs from the frozen registry.")
    require(first == session_date(dataset["local_session_start"]) and last == session_date(dataset["local_session_end"]),
            "Dataset exchange-session coverage differs from the frozen registry.")
    return {"id": dataset["id"], "rows": rows, "sha256": dataset["sha256"], "valid": True,
            "local_session_start": first.isoformat(), "local_session_end": last.isoformat()}


def validate(registry_path: Path, root: Path, kind: str = "synthetic", metadata_only: bool = False) -> dict:
    try:
        registry = json.loads(registry_path.read_text(encoding="utf-8"))
        contracts = validate_registry(registry, root)
        results = []
        if not metadata_only:
            for dataset in contracts["datasets"].values():
                source = contracts["sources"][dataset["source_id"]]
                if kind == "all" or source["kind"] == kind:
                    try:
                        results.append(validate_csv(dataset, local_path(root, dataset["csv_path"])))
                    except DataValidationError as exc:
                        raise DataValidationError(f"{dataset['id']}: {exc}") from exc
        return {"registry_valid": True, "metadata_only": metadata_only, "datasets": results}
    except (KeyError, TypeError, AttributeError, OSError, UnicodeError, json.JSONDecodeError) as exc:
        raise DataValidationError("Registry/file encoding is invalid or a required contract field is absent.") from exc


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--registry", type=Path, default=REPO_ROOT / "data" / "registry.json")
    parser.add_argument("--root", type=Path, default=REPO_ROOT)
    parser.add_argument("--kind", choices=["synthetic", "provider_snapshot", "all"], default="synthetic")
    parser.add_argument("--metadata-only", action="store_true")
    args = parser.parse_args()
    try:
        print(json.dumps(validate(args.registry, args.root, args.kind, args.metadata_only), indent=2))
    except DataValidationError as exc:
        print(json.dumps({"valid": False, "error": str(exc)}), file=sys.stderr)
        raise SystemExit(1)
