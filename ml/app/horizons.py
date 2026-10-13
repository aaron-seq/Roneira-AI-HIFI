"""Session horizons and the history policy shared by serving and evaluation.

API timeframe names are legacy aliases, not calendar durations. Keep their
explicit session counts until a separately validated migration changes them.
"""

TIMEFRAME_SESSIONS = {
    "tomorrow": 1,
    "1week": 7,
    "1month": 30,
    "3month": 90,
    "6month": 180,
    "1year": 365,
    "1year_plus": 400,
}


def serving_lookback(horizon: int) -> int:
    """Allow feature warm-up and enough resolved labels for RF validation."""
    if horizon < 1:
        raise ValueError("The horizon must be a positive session count.")
    return max(504, 4 * horizon + 200)


def history_period(horizon: int) -> str:
    """Yahoo periods are approximate; never pad short or suspended histories."""
    sessions = serving_lookback(horizon)
    # Two calendar years commonly contain fewer than 504 observed sessions.
    # Fetch a buffer, then serving/evaluation use the same bounded suffix.
    return "5y" if sessions <= 1260 else "10y"
