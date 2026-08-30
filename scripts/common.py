#!/usr/bin/env python3
"""Shared helpers for the volume-spike dashboard pipeline.

Signal definition (volume-only): a stock "fires" on day d when that day's
volume is >= +200% of its trailing 20-day average volume (i.e. >= 3x), where
the 20-day average EXCLUDES day d itself (rolling(20).mean().shift(1)),
matching research/scripts/rise_maxprice_excel.py.
"""
from pathlib import Path

# ---- paths ---------------------------------------------------------------
DASH = Path(__file__).resolve().parent.parent          # .../stocks/dashboard
DATA = DASH / "data"
UNIVERSE_CSV = DATA / "universe.csv"
STOCK_CSV = DATA / "stock_data.csv"
HOME_JSON = DATA / "home.json"
HISTORY_JSON = DATA / "history.json"

# ---- thresholds ----------------------------------------------------------
MIN_CAP = 10_000_000_000          # $10B  -> in the universe at all
MEGA_CAP = 200_000_000_000        # $200B -> "mega" tier, else "large"
VOL_MULT = 3.0                    # volume >= 3x avg20  == +200%
AVG_WINDOW = 20                   # trailing days for the volume average
SIG_WINDOW = 180                  # trading-day window for the signal count

# ---- backfill horizon ----------------------------------------------------
WARMUP_START = "2025-11-01"       # pull from here so avg20 is warm for Jan 2026
DISPLAY_START = "2026-01-01"      # keep / show from here onward


def tier_of(market_cap: float) -> str:
    """mega for >= $200B, else large (caller guarantees >= $10B)."""
    return "mega" if market_cap >= MEGA_CAP else "large"


def yahoo_url(ticker: str) -> str:
    return f"https://finance.yahoo.com/quote/{ticker}"


def add_avg20(vol_series):
    """Trailing 20-day mean volume, excluding the current day."""
    return vol_series.rolling(AVG_WINDOW).mean().shift(1)


def vpct(volume, avg20):
    """Percent the day's volume sits above its 20-day average."""
    if avg20 is None or avg20 == 0 or avg20 != avg20:   # NaN-safe
        return None
    return (volume / avg20 - 1.0) * 100.0


def is_signal(volume, avg20) -> bool:
    if avg20 is None or avg20 != avg20 or avg20 <= 0:
        return False
    return volume >= VOL_MULT * avg20
