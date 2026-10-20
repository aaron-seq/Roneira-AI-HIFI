"""Causal numerical indicators shared by models fitted at request time."""
from __future__ import annotations

import numpy as np
import pandas as pd


def rolling_rsi(close: pd.Series, period: int = 14) -> pd.Series:
    """Simple rolling RSI after ``period`` observed, finite price changes.

    Gains without losses give100, losses without gains give0 and no movement
    gives50. Missing input and warm-up stay unavailable. This deliberately
    keeps the existing simple-mean definition rather than changing to Wilder
    smoothing at the same time as repairing its zero-denominator boundaries.
    Persisted sequence artifacts retain their versioned feature definition.
    """
    if period < 1:
        raise ValueError("RSI period must be positive.")
    delta = close.replace([np.inf, -np.inf], np.nan).diff()
    gain = delta.clip(lower=0).rolling(period, min_periods=period).mean()
    loss = (-delta.clip(upper=0)).rolling(period, min_periods=period).mean()
    result = 100 - 100 / (1 + gain / loss.replace(0, np.nan))
    result = result.mask((gain > 0) & (loss == 0), 100.0)
    return result.mask((gain == 0) & (loss == 0), 50.0)
