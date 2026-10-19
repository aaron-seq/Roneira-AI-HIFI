"""Frozen-input, bounded research training; never changes deployed artifacts.

Run from ml/: python research.py --config research/real-world-2026-10-19.json
Raw prices, per-origin returns and candidate models stay in ignored .cache/.
Only derived aggregate evidence/configuration is intended for publication.
"""
from __future__ import annotations

import argparse
from dataclasses import asdict, dataclass
from datetime import date, datetime, timezone
import hashlib
from importlib.metadata import version
import json
import logging
from pathlib import Path
import re

import numpy as np
import pandas as pd
import yfinance as yf

from app.models.gradient_boost import save_artifact
from backtest import Backtester, MEMBERS, ensemble_variants, json_ready, make_folds, summarise

ROOT = Path(__file__).resolve().parent
CACHE_ROOT = ROOT / ".cache" / "research"
LOGGER = logging.getLogger("roneira-ml.research")
HISTORY_ARGS = {"interval": "1d", "auto_adjust": True, "back_adjust": False,
                "actions": False, "repair": False, "keepna": True}


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write_json(path: Path, value) -> None:
    path.write_text(json.dumps(json_ready(value), indent=2, allow_nan=False) + "\n", encoding="utf-8")


@dataclass(frozen=True)
class ResearchConfig:
    name: str
    tickers: list[str]
    start: str
    end_exclusive: str
    horizons_sessions: list[int]
    folds: int
    min_history_sessions: int
    max_origins_per_fold: int
    seed: int
    threads: int

    def validate(self) -> None:
        if not re.fullmatch(r"[a-z0-9-]{1,80}", self.name):
            raise ValueError("Use a plain lowercase research name.")
        start, end = date.fromisoformat(self.start), date.fromisoformat(self.end_exclusive)
        if start >= end or end > datetime.now(timezone.utc).date():
            raise ValueError("Use an ordered historical interval excluding the current daily session.")
        if (not self.tickers or len(set(self.tickers)) != len(self.tickers)
                or not all(re.fullmatch(r"[A-Z0-9^][A-Z0-9.^=-]{0,30}", t) for t in self.tickers)):
            raise ValueError("Ticker symbols must be distinct provider identifiers.")
        values = [*self.horizons_sessions, self.folds, self.min_history_sessions,
                  self.max_origins_per_fold, self.threads]
        if not self.horizons_sessions or any(type(v) is not int or v < 1 for v in values):
            raise ValueError("Horizons, folds, history, sample limit and threads must be positive integers.")
        if len(set(self.horizons_sessions)) != len(self.horizons_sessions):
            raise ValueError("Each session horizon must appear once.")
        if not 1 <= self.threads <= 4 or type(self.seed) is not int or self.seed < 0:
            raise ValueError("Research uses1–4 threads and a nonnegative integer seed.")
        if self.min_history_sessions < 1500:
            raise ValueError("Sequence evaluation requires at least1500 pre-origin sessions.")


def clean_history(frame: pd.DataFrame, config: ResearchConfig) -> pd.DataFrame:
    required = ["Open", "High", "Low", "Close", "Volume"]
    if frame.empty or not set(required).issubset(frame.columns):
        raise ValueError("Provider returned no complete OHLCV schema.")
    frame = frame[required].copy()
    frame.index = pd.to_datetime(frame.index, utc=True)
    if (frame.index.hasnans or not frame.index.is_unique or not frame.index.is_monotonic_increasing):
        raise ValueError("Provider history must have unique ordered session timestamps.")
    numeric = frame.to_numpy(dtype=float)
    valid = (np.isfinite(numeric).all(axis=1)
             & (frame[["Open", "High", "Low", "Close"]] > 0).all(axis=1)
             & (frame["Volume"] >= 0)
             & (frame["High"] >= frame[["Open", "Close", "Low"]].max(axis=1))
             & (frame["Low"] <= frame[["Open", "Close", "High"]].min(axis=1)))
    frame = frame.loc[valid]
    if len(frame) < config.min_history_sessions + max(config.horizons_sessions) + 60:
        raise ValueError("Provider history is too short after invalid rows are excluded.")
    return frame


def load_dataset(config: ResearchConfig, dataset_dir: Path, refresh: bool = False) -> tuple[dict, dict]:
    """Reuse exact bytes; a hash mismatch fails instead of silently redownloading."""
    dataset_dir.mkdir(parents=True, exist_ok=True)
    manifest_path = dataset_dir / "manifest.json"
    expected_request = {"start": config.start, "end": config.end_exclusive, **HISTORY_ARGS}
    if manifest_path.exists() and not refresh:
        manifest = json.loads(manifest_path.read_text())
        if manifest["request"] != expected_request or list(manifest["datasets"]) != config.tickers:
            raise ValueError("Cached dataset request differs from this research configuration.")
        frames = {}
        for ticker, entry in manifest["datasets"].items():
            expected_filename = ticker.replace("^", "_") + ".csv"
            if entry["file"] != expected_filename:
                raise ValueError("Unexpected cached history filename.")
            path = dataset_dir / expected_filename
            if digest(path) != entry["sha256"]:
                raise ValueError(f"Cached dataset hash mismatch for {ticker}; restore the original bytes or explicitly refresh.")
            frame = pd.read_csv(path, index_col=0)
            frame.index = pd.to_datetime(frame.index, utc=True)
            frames[ticker] = clean_history(frame, config)
        return frames, manifest

    yf.set_tz_cache_location(str(dataset_dir / "yfinance"))
    frames, entries = {}, {}
    for ticker in config.tickers:
        LOGGER.info("Downloading frozen daily input %s", ticker)
        history = yf.Ticker(ticker).history(**expected_request, raise_errors=True)
        rows_received = len(history)
        source_timezone = str(history.index.tz)
        if not history.empty:
            local_dates = history.index.date
            if min(local_dates) < date.fromisoformat(config.start) or max(local_dates) >= date.fromisoformat(config.end_exclusive):
                raise ValueError("Provider returned a session outside the requested exclusive interval.")
        frame = clean_history(history, config)
        filename = ticker.replace("^", "_") + ".csv"
        path = dataset_dir / filename
        frame.to_csv(path)
        # Fit what a subsequent cache reader fits, including CSV round-trip.
        frames[ticker] = pd.read_csv(path, index_col=0)
        frames[ticker].index = pd.to_datetime(frames[ticker].index, utc=True)
        entries[ticker] = {
            "file": filename, "sha256": digest(path), "sessions": len(frame),
            "rows_received": rows_received, "invalid_rows_excluded": rows_received - len(frame),
            "start_timestamp": frame.index[0].isoformat(), "end_timestamp": frame.index[-1].isoformat(),
            "source_timezone": source_timezone,
        }
    manifest = {"provider": "Yahoo Finance via yfinance", "request": expected_request,
                "downloaded_at": datetime.now(timezone.utc).isoformat(), "datasets": entries,
                "point_in_time": False,
                "redistribution": "Raw market data excluded; provider rights are separate from the source-code license."}
    write_json(manifest_path, manifest)
    return frames, manifest


def run(config: ResearchConfig, output: Path, refresh: bool = False) -> dict:
    config.validate()
    output = output.resolve()
    if not output.is_relative_to(CACHE_ROOT.resolve()) or output == CACHE_ROOT.resolve():
        raise ValueError("Research output must be inside ml/.cache/research/ to protect deployed artifacts and raw-data rights.")
    output.mkdir(parents=True, exist_ok=True)
    config_payload = asdict(config)
    config_hash = hashlib.sha256(json.dumps(config_payload, sort_keys=True).encode()).hexdigest()
    frames, manifest = load_dataset(config, output / "dataset", refresh)
    sources = sorted([ROOT / "research.py", ROOT / "backtest.py", ROOT / "app" / "horizons.py",
                      *(ROOT / "app" / "models").glob("*.py")])
    protocol = {"config": config_payload, "config_sha256": config_hash,
                "sources_sha256": {str(p.relative_to(ROOT)): digest(p) for p in sources},
                "models": MEMBERS, "estimator": {"sequence": "build_estimator defaults; bounded n_jobs", "random_forest": "serving defaults; bounded n_jobs"},
                "fold_policy": "calendar-ordered expanding train; label end strictly before fold start; nonoverlapping per-ticker labels",
                "selection_policy": "No tuning or model selection on evaluation folds. Final sequence fits end before the last chronological fold; RF refits per origin using then-resolved labels (prequential assessment). Candidates remain research only.",
                "versions": {p: version(p) for p in ["numpy", "pandas", "scikit-learn", "xgboost", "yfinance"]},
                "dataset": manifest}
    # Frozen before any prediction is scored. Re-running changed code creates
    # explicit different source hashes instead of claiming an identical repeat.
    write_json(output / "protocol.json", protocol)
    results = {}
    for horizon in config.horizons_sessions:
        LOGGER.info("Training/evaluating %s-session task", horizon)
        tester = Backtester(frames, horizon, n_jobs=config.threads)
        folds = make_folds(frames, config.folds, horizon, horizon, config.min_history_sessions)
        if len(folds) != config.folds:
            raise ValueError("Requested dataset cannot support every chronological fold.")
        rng = np.random.default_rng(config.seed)
        for fold in folds:
            if len(fold.origins) > config.max_origins_per_fold:
                picks = rng.choice(len(fold.origins), config.max_origins_per_fold, replace=False)
                fold.origins = [fold.origins[i] for i in sorted(picks)]
        records = ensemble_variants(pd.DataFrame(tester.run(folds, MEMBERS)))
        columns = [c for c in records if c in MEMBERS or c.startswith("ENSEMBLE_")]
        horizon_dir = output / f"{horizon}-sessions"
        horizon_dir.mkdir(exist_ok=True)
        records.to_csv(horizon_dir / "origins.csv", index=False)
        candidates = {}
        for slot, predictor, artifact in [("lstm", tester.lstm, tester.lstm._model), ("gan", tester.gan, tester.gan._generator)]:
            path = save_artifact(artifact, horizon_dir / f"{slot}_gbm.joblib")
            metadata = {**predictor._metadata, "confidence": 0.0, "research_only": True,
                        "confidence_calibrated": False, "config_sha256": config_hash,
                        "dataset_sha256": {t: d["sha256"] for t, d in manifest["datasets"].items()},
                        "fit": next(r for r in reversed(tester.fit_records) if r["sequence_length"] == predictor.sequence_length),
                        "validation": "Final chronological fold only; no subsequent fit or promotion."}
            write_json(horizon_dir / f"{slot}_metadata.json", metadata)
            candidates[slot] = {"file": path.name, "sha256": digest(path), "fit": metadata["fit"], "promoted": False}
        results[str(horizon)] = {
            "horizon_sessions": horizon, "serving_lookback": tester.lookback,
            "origins_sha256": digest(horizon_dir / "origins.csv"),
            "summary": summarise(records, columns),
            "by_ticker": {t: summarise(g, columns) for t, g in records.groupby("ticker")},
            "final_temporal_fold": {"index": folds[-1].index,
                                    "summary": summarise(records[records["fold"] == folds[-1].index], columns)},
            "fit_records": tester.fit_records, "candidates": candidates,
        }
        write_json(horizon_dir / "summary.json", results[str(horizon)])
    report = {**protocol, "completed_at": datetime.now(timezone.utc).isoformat(), "results": results,
              "promotion": "None. Research does not establish a stable out-of-sample edge or trading profitability.",
              "limitations": ["Present-day surviving large-cap selection; no unseen-instrument holdout.",
                              "Adjusted Yahoo history can be revised; not a point-in-time market replay.",
                              "Cross-stock outcomes share regimes; directional fractions are not independent probability estimates.",
                              "No fees, spreads, slippage, liquidity, position sizing, portfolio strategy or prospective paper trading.",
                              "7/90-session refitted sequence candidates are not the deployed 30-session bundles.",
                              "Confidence scores are uncalibrated heuristics, not measured accuracy."]}
    write_json(output / "report.json", report)
    return report


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--refresh", action="store_true", help="Explicitly replace cached provider inputs, changing their hashes")
    args = parser.parse_args()
    config = ResearchConfig(**json.loads(args.config.read_text()))
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
    report = run(config, args.output or CACHE_ROOT / config.name, args.refresh)
    print(json.dumps({"output": str(args.output or CACHE_ROOT / config.name), "promotion": report["promotion"]}))


if __name__ == "__main__":
    main()
