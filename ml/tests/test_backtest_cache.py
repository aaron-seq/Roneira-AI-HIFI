"""Backtest input recovery, chronology and preservation; no provider access."""
from types import SimpleNamespace
from unittest.mock import Mock

import numpy as np
import pandas as pd
import pytest
import yfinance as yf

import backtest


def history(rows=900, shift=0):
    close = np.linspace(100, 200, rows) + shift
    return pd.DataFrame({
        "Open": close, "High": close + 1, "Low": close - 1,
        "Close": close, "Volume": 1000.0,
    }, index=pd.bdate_range("2000-01-03", periods=rows, tz="America/New_York"))


INVALID = ["empty", "short", "incomplete", "schema", "infinite", "zero",
           "volume", "range", "date", "nat", "reversed", "duplicate", "numeric_index",
           "object_numeric_index", "mixed_numeric_index"]


def invalid_history(kind):
    frame = history(0 if kind == "empty" else 599 if kind == "short" else 600 if kind == "incomplete" else 900)
    if kind == "incomplete":
        frame.iloc[-1, frame.columns.get_loc("Close")] = np.nan
    elif kind == "schema":
        frame = frame.drop(columns="Close")
    elif kind in {"infinite", "zero"}:
        frame.iloc[-1, frame.columns.get_loc("Close")] = np.inf if kind == "infinite" else 0
    elif kind == "volume":
        frame.iloc[-1, frame.columns.get_loc("Volume")] = -1
    elif kind == "range":
        frame.iloc[-1, frame.columns.get_loc("High")] = 1
    elif kind in {"date", "nat"}:
        stamps = list(frame.index)
        stamps[-1] = "not-a-date" if kind == "date" else pd.NaT
        frame.index = pd.Index(stamps)
    elif kind == "reversed":
        frame = frame.iloc[::-1]
    elif kind == "duplicate":
        stamps = list(frame.index)
        stamps[-1] = stamps[-2]
        frame.index = pd.DatetimeIndex(stamps)
    elif kind == "numeric_index":
        frame = frame.reset_index(drop=True)
    elif kind == "object_numeric_index":
        frame.index = pd.Index(np.arange(len(frame), dtype=object), dtype=object)
    elif kind == "mixed_numeric_index":
        frame.index = pd.Index([0.0, *frame.index[1:]], dtype=object)
    return frame


@pytest.fixture
def download(tmp_path, monkeypatch):
    monkeypatch.setattr(backtest, "CACHE_DIR", tmp_path)
    monkeypatch.setattr(yf, "set_tz_cache_location", lambda _: None)
    request = Mock(return_value=history())
    monkeypatch.setattr(yf, "Ticker", lambda ticker: SimpleNamespace(
        history=lambda **kwargs: request(ticker, **kwargs),
    ))
    return request


@pytest.mark.parametrize("kind", INVALID)
def test_unusable_download_is_not_cached_and_ordinary_retry_recovers(kind, tmp_path, download):
    download.side_effect = [invalid_history(kind), history()]
    assert backtest.load_frames(["TEST"], "max", False) == {}
    assert not (tmp_path / "TEST_max.csv").exists()
    recovered = backtest.load_frames(["TEST"], "max", False)
    assert len(recovered["TEST"]) == 900
    assert download.call_count == 2
    assert recovered["TEST"].index.is_monotonic_increasing
    assert recovered["TEST"].index.tz is not None


@pytest.mark.parametrize("kind", INVALID + ["empty_file", "malformed_csv"])
def test_unusable_existing_cache_gets_one_download_and_recovers(kind, tmp_path, download):
    path = tmp_path / "TEST_max.csv"
    if kind == "empty_file":
        path.write_text("")
    elif kind == "malformed_csv":
        path.write_text('Date,Close\n"unterminated')
    else:
        invalid_history(kind).to_csv(path)
    recovered = backtest.load_frames(["TEST"], "max", False)
    assert len(recovered["TEST"]) == 900
    download.assert_called_once_with("TEST", period="max")
    assert len(pd.read_csv(path)) == 900


@pytest.mark.parametrize("rows", [600, 900])
def test_valid_cache_is_reused_without_download_or_rewrite(rows, tmp_path, download):
    path = tmp_path / "TEST_max.csv"
    history(rows).to_csv(path)
    original = path.read_bytes()
    frames = backtest.load_frames(["TEST"], "max", False)
    assert len(frames["TEST"]) == rows
    assert str(frames["TEST"].index.tz) == "UTC"
    assert path.read_bytes() == original
    download.assert_not_called()


def test_failed_retry_keeps_unusable_cache_for_inspection_and_next_run_recovers(tmp_path, download):
    path = tmp_path / "TEST_max.csv"
    path.write_text("unusable original bytes")
    original = path.read_bytes()
    download.side_effect = [history(599), history()]
    assert backtest.load_frames(["TEST"], "max", False) == {}
    assert path.read_bytes() == original
    assert len(backtest.load_frames(["TEST"], "max", False)["TEST"]) == 900
    assert download.call_count == 2


def test_successful_refresh_replaces_valid_cache(tmp_path, download):
    path = tmp_path / "TEST_max.csv"
    history().to_csv(path)
    original = path.read_bytes()
    download.return_value = history(shift=5)
    frames = backtest.load_frames(["TEST"], "max", True)
    download.assert_called_once_with("TEST", period="max")
    assert frames["TEST"]["Close"].iloc[0] == 105
    assert path.read_bytes() != original
    assert list(tmp_path.glob(".backtest-*")) == []


@pytest.mark.parametrize("kind", ["empty", "short", "schema", "reversed", "infinite", "exception"])
def test_failed_refresh_preserves_previous_valid_bytes(kind, tmp_path, download):
    path = tmp_path / "TEST_max.csv"
    history().to_csv(path)
    original = path.read_bytes()
    if kind == "exception":
        download.side_effect = RuntimeError("synthetic provider failure")
    else:
        download.return_value = invalid_history(kind)
    assert backtest.load_frames(["TEST"], "max", True) == {}
    assert path.read_bytes() == original
    assert list(tmp_path.glob(".backtest-*")) == []


@pytest.mark.parametrize("failure", ["write", "replace"])
def test_failed_atomic_refresh_keeps_previous_cache(failure, tmp_path, download, monkeypatch):
    path = tmp_path / "TEST_max.csv"
    history().to_csv(path)
    original = path.read_bytes()
    if failure == "write":
        def broken_write(_frame, destination):
            if hasattr(destination, "write"):
                destination.write("partial")
            else:
                destination.write_text("partial")
            raise OSError("synthetic interrupted write")
        monkeypatch.setattr(pd.DataFrame, "to_csv", broken_write)
    else:
        monkeypatch.setattr(type(path), "replace", Mock(side_effect=OSError("synthetic replace failure")))
    assert backtest.load_frames(["TEST"], "max", True) == {}
    assert path.read_bytes() == original
    assert list(tmp_path.glob(".backtest-*")) == []


def test_one_download_failure_does_not_hide_another_tickers_history(download):
    download.side_effect = [RuntimeError("synthetic provider failure"), history()]
    assert set(backtest.load_frames(["BAD", "GOOD"], "max", False)) == {"GOOD"}
    assert download.call_count == 2


@pytest.mark.parametrize("refresh", [False, True])
@pytest.mark.parametrize("failed", [False, True])
def test_duplicate_tickers_get_only_one_download_attempt_per_invocation(refresh, failed, download):
    if failed:
        download.side_effect = RuntimeError("synthetic provider failure")
    frames = backtest.load_frames(["TEST", "TEST"], "max", refresh)
    assert set(frames) == (set() if failed else {"TEST"})
    download.assert_called_once_with("TEST", period="max")
