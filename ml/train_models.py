"""
Offline training entrypoint for bundled ML artifacts.
"""
from __future__ import annotations

import argparse
import json
import logging
from typing import Iterable

import yfinance as yf

from app.models.gan import GANPredictor
from app.models.lstm import LSTMPredictor

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
        frames.append(history)
    return frames


def main():
    parser = argparse.ArgumentParser(description="Train bundled Roneira ML artifacts.")
    parser.add_argument("--models", default="all", choices=["all", "lstm", "gan"])
    parser.add_argument("--period", default="max")
    parser.add_argument("--tickers", default=",".join(DEFAULT_TICKERS))
    parser.add_argument("--horizon", type=int, default=30)
    parser.add_argument("--epochs", type=int, default=15)
    parser.add_argument(
        "--backend",
        default="auto",
        choices=["auto", "gradient-boost", "tensorflow"],
        help=(
            "auto (default) picks gradient-boost unless TensorFlow is installed. "
            "TensorFlow is not in requirements.txt, so 'tensorflow' only works if "
            "you installed it yourself."
        ),
    )
    args = parser.parse_args()

    backend = args.backend
    if backend == "auto":
        try:
            import tensorflow  # noqa: F401

            backend = "tensorflow"
        except ImportError:
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
        summary["lstm"] = (
            lstm.train(frames, horizon_days=args.horizon)
            if backend == "tensorflow"
            else lstm.train_gradient_boost(frames, horizon_days=args.horizon)
        )

    if args.models in {"all", "gan"}:
        gan = GANPredictor(epochs=max(5, min(args.epochs, 15)))
        summary["gan"] = (
            gan.train(frames, horizon_days=args.horizon)
            if backend == "tensorflow"
            else gan.train_gradient_boost(frames, horizon_days=args.horizon)
        )

    print(json.dumps(summary, indent=2, default=str))


if __name__ == "__main__":
    main()
