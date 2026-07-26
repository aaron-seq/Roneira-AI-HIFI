"""
Pure-function tests for export_stock_screener.py's filter logic.

No live network calls -- fetch_row/build_dataset hit yfinance and aren't
covered here; this locks down the screening criteria themselves against
synthetic rows so a threshold typo fails CI instead of silently changing
what "fundamentally strong" means.
"""
import pandas as pd

from export_stock_screener import (
    screen_dividend_payers,
    screen_fundamentally_strong,
    screen_undervalued_growth,
)


def _row(**overrides):
    base = {
        "ticker": "TEST.NS", "tier": "Large", "revenueGrowth": 0.1,
        "debtToEquity": 30.0, "returnOnEquity": 0.2, "profitMargins": 0.1,
        "dividendYield": 1.0, "pegRatio": 1.0, "earningsGrowth": 0.1,
    }
    base.update(overrides)
    return base


def test_fundamentally_strong_excludes_high_debt():
    df = pd.DataFrame([_row(ticker="OK"), _row(ticker="LEVERAGED", debtToEquity=500)])
    result = screen_fundamentally_strong(df)
    assert list(result["ticker"]) == ["OK"]


def test_fundamentally_strong_excludes_shrinking_revenue():
    df = pd.DataFrame([_row(ticker="OK"), _row(ticker="SHRINKING", revenueGrowth=-0.05)])
    result = screen_fundamentally_strong(df)
    assert list(result["ticker"]) == ["OK"]


def test_fundamentally_strong_falls_back_to_profit_margin_when_roe_missing():
    df = pd.DataFrame([_row(ticker="ROE_MISSING", returnOnEquity=None, profitMargins=0.2)])
    result = screen_fundamentally_strong(df)
    assert list(result["ticker"]) == ["ROE_MISSING"]


def test_dividend_payers_sorted_descending_and_excludes_zero():
    df = pd.DataFrame([
        _row(ticker="LOW", dividendYield=1.0),
        _row(ticker="HIGH", dividendYield=5.0),
        _row(ticker="NONE", dividendYield=None),
    ])
    result = screen_dividend_payers(df)
    assert list(result["ticker"]) == ["HIGH", "LOW"]


def test_undervalued_growth_requires_positive_earnings_growth():
    df = pd.DataFrame([
        _row(ticker="SHRINKING", pegRatio=0.5, earningsGrowth=-0.1),
        _row(ticker="GROWING", pegRatio=0.5, earningsGrowth=0.1),
    ])
    result = screen_undervalued_growth(df)
    assert list(result["ticker"]) == ["GROWING"]


def test_undervalued_growth_excludes_expensive_peg():
    df = pd.DataFrame([_row(ticker="EXPENSIVE", pegRatio=3.0)])
    result = screen_undervalued_growth(df)
    assert result.empty
