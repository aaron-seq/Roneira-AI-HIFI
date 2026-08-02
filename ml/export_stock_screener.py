"""
Live stock-fundamentals screener -- exports real yfinance data to XLSX.

Not investment advice. Pulls whatever Yahoo Finance actually reports per
ticker; smaller/less-covered names are often missing fields (ROE, PEG, etc.)
-- the "Read Me First" sheet in the output flags this rather than silently
treating a missing field as zero.

Screens below are objective, disclosed criteria applied to live numbers
(revenue growth, debt/equity, profit margin, dividend yield, PEG). They do
NOT encode "good management" or "government project exposure" -- that needs
research this script has no data source for. It surfaces real numbers and
leaves that judgment to you.

Run: cd ml && python export_stock_screener.py
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
import yfinance as yf

from app.models.technical_analysis import TechnicalAnalyzer

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("roneira-ml.screener")

EXPORT_DIR = Path(__file__).resolve().parent / "exports"

# Starter universe: long-established, liquid NSE names per market-cap tier.
# Verified live against yfinance before shipping this file -- not a snapshot
# of official NSE index membership, which reshuffles periodically. Edit
# freely; this is a reasonable default, not a fixed list.
LARGE_CAP = [
    "RELIANCE.NS", "TCS.NS", "HDFCBANK.NS", "ICICIBANK.NS", "INFY.NS",
    "HINDUNILVR.NS", "ITC.NS", "SBIN.NS", "BHARTIARTL.NS", "LT.NS",
    "KOTAKBANK.NS", "AXISBANK.NS", "MARUTI.NS", "SUNPHARMA.NS",
]
MID_CAP = [
    "PAGEIND.NS", "COFORGE.NS", "PERSISTENT.NS", "AUBANK.NS", "POLYCAB.NS",
    "TRENT.NS", "CUMMINSIND.NS", "ASTRAL.NS", "SUNDARMFIN.NS", "APLAPOLLO.NS",
    "SCHAEFFLER.NS", "SUPREMEIND.NS", "FEDERALBNK.NS", "INDHOTEL.NS",
]
SMALL_CAP = [
    "CAMS.NS", "ROUTE.NS", "LATENTVIEW.NS", "HAPPSTMNDS.NS", "KIRLOSENG.NS",
    "RATNAMANI.NS", "GRINDWELL.NS", "JKPAPER.NS", "TIPSMUSIC.NS",
    "ELGIEQUIP.NS", "CENTURYPLY.NS", "GARFIBRES.NS", "VINATIORGA.NS",
    "ZFCVINDIA.NS",
]

FUNDAMENTAL_FIELDS = [
    "longName", "sector", "industry", "marketCap", "trailingPE", "forwardPE",
    "returnOnEquity", "debtToEquity", "profitMargins", "dividendYield",
    "revenueGrowth", "earningsGrowth", "pegRatio",
]


def fetch_row(ticker: str, tier: str) -> dict:
    """One ticker's live fundamentals, plus a real rule-based technical
    signal from TechnicalAnalyzer -- not the LSTM/GAN slots, which measure
    zero skill vs. a no-change baseline (see ARCHITECTURE.md) and have no
    business informing a "quality stock" screen."""
    info = yf.Ticker(ticker).info
    row: dict = {"ticker": ticker, "tier": tier}
    row.update({field: info.get(field) for field in FUNDAMENTAL_FIELDS})

    try:
        history = yf.Ticker(ticker).history(period="6mo")
        # Yahoo's trailing placeholder row (NaN OHLC) -- see ARCHITECTURE.md.
        history = history.dropna(subset=["Close"])
        if len(history) >= 30:
            analysis = TechnicalAnalyzer().analyze(history, horizon_days=30)
            row["technical_signal"] = analysis["short_term_signal"]["signal"]
        else:
            row["technical_signal"] = None
    except Exception as exc:
        logger.warning("Technical signal failed for %s: %s", ticker, exc)
        row["technical_signal"] = None

    return row


def build_dataset() -> pd.DataFrame:
    rows = []
    for tier, tickers in (("Large", LARGE_CAP), ("Mid", MID_CAP), ("Small", SMALL_CAP)):
        for ticker in tickers:
            logger.info("Fetching %s (%s cap)", ticker, tier)
            try:
                rows.append(fetch_row(ticker, tier))
            except Exception as exc:
                logger.warning("Skipping %s: %s", ticker, exc)
    return pd.DataFrame(rows)


def screen_fundamentally_strong(df: pd.DataFrame) -> pd.DataFrame:
    """Positive revenue growth, debt under equity, and a quality proxy above
    threshold -- ROE where reported, profit margin where it isn't (ROE is
    frequently unreported for smaller caps on Yahoo)."""
    # Columns built from a list of dicts with mixed None/float values land as
    # object dtype, which makes fillna's downcast-to-float ambiguous -- force
    # numeric first so the fillna below has no dtype guessing to do.
    roe = pd.to_numeric(df["returnOnEquity"], errors="coerce")
    margin = pd.to_numeric(df["profitMargins"], errors="coerce")
    quality = roe.fillna(margin)
    mask = (
        (df["revenueGrowth"].fillna(-1) > 0)
        & (df["debtToEquity"].fillna(999) < 100)
        & (quality.fillna(-1) > 0.15)
    )
    result = df[mask].copy()
    result["quality_metric"] = quality[mask]
    return result.sort_values("quality_metric", ascending=False)


def screen_dividend_payers(df: pd.DataFrame, top_n: int = 15) -> pd.DataFrame:
    result = df[df["dividendYield"].fillna(0) > 0]
    return result.sort_values("dividendYield", ascending=False).head(top_n)


def screen_undervalued_growth(df: pd.DataFrame) -> pd.DataFrame:
    """Classic growth-at-reasonable-price screen: PEG under 1.5, and actually
    growing earnings (a low PEG with shrinking earnings is a value trap, not
    a growth stock)."""
    mask = (
        (df["pegRatio"].fillna(999) > 0)
        & (df["pegRatio"].fillna(999) < 1.5)
        & (df["earningsGrowth"].fillna(-1) > 0)
    )
    return df[mask].sort_values("pegRatio")


def export(df: pd.DataFrame) -> Path:
    EXPORT_DIR.mkdir(exist_ok=True)
    timestamp = datetime.now(timezone.utc)
    path = EXPORT_DIR / f"stock_screener_{timestamp.strftime('%Y%m%d_%H%M')}.xlsx"

    notes = pd.DataFrame({"Note": [
        f"Generated {timestamp.isoformat()} from live Yahoo Finance data via yfinance.",
        "Not investment advice. Screens are objective filters on reported numbers, not qualitative judgment.",
        "Blank cells mean Yahoo does not report that field for that ticker (common for smaller caps) -- not zero.",
        "revenueGrowth / earningsGrowth / profitMargins / returnOnEquity are fractional (0.15 = 15%).",
        "dividendYield's unit depends on Yahoo's current convention for that field -- verify against the company's own filings before relying on it.",
        "Technical Signal is from a rule-based indicator engine (RSI/MACD/Bollinger/EMA/Stochastic/ADX), evaluated live -- not the LSTM/GAN prediction models, which have no measured edge (see ARCHITECTURE.md).",
        "Ticker universe is a starter list of established names per tier, not a snapshot of official NSE index membership.",
    ]})

    with pd.ExcelWriter(path, engine="openpyxl") as writer:
        notes.to_excel(writer, sheet_name="Read Me First", index=False)
        df.to_excel(writer, sheet_name="All Data (Live)", index=False)
        for tier in ("Large", "Mid", "Small"):
            screen_fundamentally_strong(df[df["tier"] == tier]).to_excel(
                writer, sheet_name=f"{tier} Cap - Strong", index=False
            )
        screen_dividend_payers(df).to_excel(writer, sheet_name="Dividend Payers", index=False)
        screen_undervalued_growth(df).to_excel(writer, sheet_name="Undervalued Growth", index=False)

    return path


def main():
    df = build_dataset()
    if df.empty:
        raise SystemExit("No data fetched -- check network access / yfinance status.")
    path = export(df)
    logger.info("Wrote %s (%d tickers)", path, len(df))
    print(f"\n{path}")


if __name__ == "__main__":
    main()
