"""Generate authored test prices; no provider download, real instrument or user data."""
from __future__ import annotations

import argparse
import csv
from datetime import date, datetime, time, timezone
from decimal import Decimal
import hashlib
import io
import json
from pathlib import Path
from zoneinfo import ZoneInfo

COLUMNS = ["Date", "Open", "High", "Low", "Close", "Volume"]
SESSION_DATES = ["2024-10-28", "2024-10-29", "2024-10-30", "2024-10-31",
                 "2024-11-01", "2024-11-04", "2024-11-05", "2024-11-06"]
INSTRUMENTS = [
    {"instrument": "SYNTH_INR", "currency": "INR", "exchange_timezone": "Asia/Kolkata"},
    {"instrument": "SYNTH_USD", "currency": "USD", "exchange_timezone": "America/New_York"},
]


def csv_bytes(instrument: dict) -> bytes:
    """Exact decimal arithmetic and fixed dates make bytes platform independent."""
    stream = io.StringIO(newline="")
    writer = csv.writer(stream, lineterminator="\n")
    writer.writerow(COLUMNS)
    for index, session in enumerate(SESSION_DATES):
        label = datetime.combine(date.fromisoformat(session), time.min,
                                 ZoneInfo(instrument["exchange_timezone"])).astimezone(timezone.utc)
        open_price = Decimal("100") + Decimal(index * 2)
        close = open_price + (Decimal("0.50") if index % 2 == 0 else Decimal("-0.50"))
        high, low = max(open_price, close) + Decimal("0.75"), min(open_price, close) - Decimal("0.75")
        writer.writerow([label.isoformat(sep=" "), *(f"{p:.2f}" for p in [open_price, high, low, close]),
                         1000 + index * 100])
    return stream.getvalue().encode("utf-8")


def generate(output: Path) -> dict:
    output.mkdir(parents=True, exist_ok=True)
    datasets = []
    for instrument in INSTRUMENTS:
        filename = instrument["instrument"] + ".csv"
        payload = csv_bytes(instrument)
        (output / filename).write_bytes(payload)
        datasets.append({**instrument, "file": filename, "rows": len(SESSION_DATES),
                         "local_session_start": SESSION_DATES[0], "local_session_end": SESSION_DATES[-1],
                         "sha256": hashlib.sha256(payload).hexdigest()})
    manifest = {"schema_version": 1, "source_id": "roneira-synthetic", "license": "MIT",
                "generator": "data/generate_synthetic.py", "real_market_data": False,
                "purpose": "Numerical/schema tests only; not forecasting or investment evidence.",
                "datasets": datasets}
    (output / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    return manifest


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args()
    generate(args.output_dir)
