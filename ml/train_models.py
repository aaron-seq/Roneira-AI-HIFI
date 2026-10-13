"""
Offline training entrypoint for bundled ML artifacts.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import logging
from datetime import datetime, timezone
from typing import Iterable

import yfinance as yf

from app.models.gan import GANPredictor
from app.models.lstm import LSTMPredictor
from app.models.artifacts import save_metadata

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("roneira-ml.train")

DEFAULT_TICKERS = [
    "^NSEI",
    "^GSPC",
    "^IXIC",
    "AAPL",
    "MSFT",
    "NVDA",
    "RELIANCE.NS",
    "TCS.NS",
    "INFY.NS",
]


def fetch_training_frames(tickers: Iterable[str], period: str):
    frames = []
    for ticker in tickers:
        logger.info("Fetching %s (%s)", ticker, period)
        history = yf.Ticker(ticker).history(period=period)

        # Yahoo appends a placeholder row with NaN OHLC for the most recent
        # session. Training labels are forward returns, so a single NaN close
        # propagates into the label vector and the fit aborts outright
        # ("Label contains NaN"). app/main.py:fetch_stock_data does the same
        # drop for the serving path; this is the training-side equivalent.
        if not history.empty:
            history = history.dropna(subset=["Open", "High", "Low", "Close"])

        if history.empty or len(history) < 240:
            logger.warning("Skipping %s because the training history is too short", ticker)
            continue
        history.attrs["ticker"] = ticker
        frames.append(history)
    return frames


def main():
    parser = argparse.ArgumentParser(description="Train bundled Roneira ML artifacts.")
    parser.add_argument("--models", default="all", choices=["all", "lstm", "gan"])
    parser.add_argument("--period", default="max")
    parser.add_argument("--tickers", default=",".join(DEFAULT_TICKERS))
    parser.add_argument("--horizon", type=int, default=30, help="Positive count of observed trading sessions")
    parser.add_argument("--epochs", type=int, default=15)
    parser.add_argument(
        "--backend",
        default="auto",
        choices=["auto", "gradient-boost", "tensorflow"],
        help=(
            "auto (default) uses the validated gradient-boost pipeline. "
            "The optional TensorFlow trainers are experimental and disabled "
            "until their preprocessing and validation contracts are corrected."
        ),
    )
    args = parser.parse_args()
    if args.horizon < 1:
        parser.error("--horizon must be a positive trading-session count")

    backend = args.backend
    if backend == "tensorflow":
        raise SystemExit("TensorFlow training is experimental and disabled: use --backend gradient-boost.")
    backend = "gradient-boost"

    logger.info("Training backend: %s", backend)

    tickers = [ticker.strip() for ticker in args.tickers.split(",") if ticker.strip()]
    frames = fetch_training_frames(tickers, args.period)
    if not frames:
        raise SystemExit("No training frames were fetched.")

    logger.info("Fetched %d usable training frames", len(frames))

    summary = {}
    if args.models in {"all", "lstm"}:
        lstm = LSTMPredictor(epochs=args.epochs)
        summary["lstm"] = lstm.train_gradient_boost(frames, horizon_days=args.horizon)

    if args.models in {"all", "gan"}:
        gan = GANPredictor(epochs=max(5, min(args.epochs, 15)))
        summary["gan"] = gan.train_gradient_boost(frames, horizon_days=args.horizon)

    # These are inputs to the purged assessment fit, not a claim that the
    # artifact was fitted through the final session. train_label_end records
    # the latest label actually used; validation dates remain held out.
    dataset = [{
        "ticker": frame.attrs["ticker"],
        "sessions": len(frame),
        "start": frame.index[0].isoformat(),
        "end": frame.index[-1].isoformat(),
        "sha256": hashlib.sha256(frame.to_csv().encode("utf-8")).hexdigest(),
    } for frame in frames]
    for slot, metrics in summary.items():
        metrics.update({
            "training_period_requested": args.period,
            "training_dataset": dataset,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        save_metadata(f"{slot}_metadata.json", metrics)

    print(json.dumps(summary, indent=2, default=str))


if __name__ == "__main__":
    main()
