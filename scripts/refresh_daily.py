#!/usr/bin/env python3
"""DAILY job (run after US market close, or before the next open).

1. Read the >$10B universe (dashboard/data/universe.csv).
2. Pull the latest OHLCV from Yahoo (incremental: a short overlap window on
   normal runs, full backfill from WARMUP_START on the first run) and upsert
   the raw panel dashboard/data/stock_data.csv.
3. Recompute avg20 (trailing 20d, excl. today), per-day market cap, and the
   volume signal across the full per-ticker history.
4. Regenerate home.json (latest-day snapshot) and history.json (every signal
   event) fresh from the panel -- both are idempotent.

Per-day market cap = shares x close, where shares = current_cap / latest_close
(reuses the OHLCV already downloaded; no extra per-ticker API calls).
"""
import json

import pandas as pd
import yfinance as yf

from common import (
    UNIVERSE_CSV, STOCK_CSV, HOME_JSON, HISTORY_JSON,
    WARMUP_START, DISPLAY_START, AVG_WINDOW, SIG_WINDOW, VOL_MULT,
    tier_of, yahoo_url, add_avg20,
)

BATCH = 200
OVERLAP_DAYS = 30   # re-pull this many days on incremental runs, then dedupe


def load_universe():
    uni = pd.read_csv(UNIVERSE_CSV)
    cap_now = dict(zip(uni["ticker"], uni["market_cap"]))
    name = dict(zip(uni["ticker"], uni["name"]))
    tier = dict(zip(uni["ticker"], uni["tier"]))
    return uni["ticker"].astype(str).tolist(), cap_now, name, tier


def download_long(tickers, start, end):
    """Return a long DataFrame: ticker, date, open, close, volume."""
    frames = []
    for i in range(0, len(tickers), BATCH):
        chunk = tickers[i:i + BATCH]
        raw = yf.download(chunk, start=start, end=end, auto_adjust=True,
                          progress=False, group_by="ticker", threads=True)
        if raw is None or raw.empty:
            continue
        # normalise to a per-ticker long frame
        if isinstance(raw.columns, pd.MultiIndex):
            for t in chunk:
                if t not in raw.columns.get_level_values(0):
                    continue
                sub = raw[t][["Open", "Close", "Volume"]].dropna(how="all")
                if sub.empty:
                    continue
                sub = sub.reset_index().rename(columns={
                    "Date": "date", "Open": "open",
                    "Close": "close", "Volume": "volume"})
                sub["ticker"] = t
                frames.append(sub)
        else:  # single ticker came back flat
            sub = raw[["Open", "Close", "Volume"]].dropna(how="all")
            sub = sub.reset_index().rename(columns={
                "Date": "date", "Open": "open",
                "Close": "close", "Volume": "volume"})
            sub["ticker"] = chunk[0]
            frames.append(sub)
        print(f"  ...{min(i + BATCH, len(tickers))}/{len(tickers)} downloaded")
    if not frames:
        return pd.DataFrame(columns=["ticker", "date", "open", "close", "volume"])
    out = pd.concat(frames, ignore_index=True)
    out["date"] = pd.to_datetime(out["date"]).dt.strftime("%Y-%m-%d")
    return out[["ticker", "date", "open", "close", "volume"]]


def upsert_panel(tickers):
    """Merge fresh Yahoo data into stock_data.csv's raw OHLCV, return long df."""
    today = pd.Timestamp.today().normalize()
    end = (today + pd.Timedelta(days=1)).strftime("%Y-%m-%d")

    if STOCK_CSV.exists():
        old = pd.read_csv(STOCK_CSV, dtype={"ticker": str})
        old = old[["ticker", "date", "open", "close", "volume"]]
        last = pd.to_datetime(old["date"]).max()
        start = (last - pd.Timedelta(days=OVERLAP_DAYS)).strftime("%Y-%m-%d")
        print(f"Incremental pull from {start} (last panel date {last.date()})")
    else:
        old = pd.DataFrame(columns=["ticker", "date", "open", "close", "volume"])
        start = WARMUP_START
        print(f"First run: backfilling from {start}")

    fresh = download_long(tickers, start, end)
    merged = pd.concat([old, fresh], ignore_index=True)
    merged = merged.drop_duplicates(subset=["ticker", "date"], keep="last")
    merged = merged.sort_values(["ticker", "date"]).reset_index(drop=True)
    return merged


def enrich(panel, cap_now):
    """Add avg20, per-day market_cap, and the signal flag per ticker."""
    parts = []
    for t, g in panel.groupby("ticker", sort=False):
        g = g.sort_values("date").copy()
        g["avg20"] = add_avg20(g["volume"])
        # shares implied by the current cap and the latest close we have
        latest_close = g["close"].dropna().iloc[-1] if g["close"].notna().any() else None
        cap = cap_now.get(t)
        if latest_close and latest_close > 0 and cap and cap > 0:
            shares = cap / latest_close
            g["market_cap"] = g["close"] * shares
        else:
            g["market_cap"] = pd.NA
        g["signal"] = (g["avg20"] > 0) & (g["volume"] >= VOL_MULT * g["avg20"])
        parts.append(g)
    return pd.concat(parts, ignore_index=True)


def save_panel(panel):
    cols = ["ticker", "date", "open", "close", "volume", "market_cap", "avg20"]
    out = panel[cols].copy()
    out.to_csv(STOCK_CSV, index=False)
    print(f"Saved {len(out)} rows -> {STOCK_CSV.name}")


def build_home(panel, name, tier):
    """Latest-day snapshot per ticker."""
    disp = panel[panel["date"] >= DISPLAY_START]
    global_date = disp["date"].max()
    rows = []
    for t, g in disp.groupby("ticker", sort=False):
        g = g.sort_values("date")
        last = g.iloc[-1]
        if pd.isna(last["avg20"]) or last["avg20"] <= 0:
            continue
        sig180 = int(g["signal"].tail(SIG_WINDOW).sum())
        rows.append({
            "ticker": t,
            "name": name.get(t, ""),
            "tier": tier.get(t, ""),
            "date": last["date"],
            "volume": None if pd.isna(last["volume"]) else int(last["volume"]),
            "avg20": None if pd.isna(last["avg20"]) else round(float(last["avg20"])),
            "vpct": round(float(last["volume"] / last["avg20"] - 1) * 100, 1),
            "market_cap": None if pd.isna(last["market_cap"]) else float(last["market_cap"]),
            "sig180": sig180,
            "yahoo_url": yahoo_url(t),
        })
    payload = {"date": global_date, "generated": pd.Timestamp.now().isoformat(timespec="seconds"),
               "rows": rows}
    HOME_JSON.write_text(json.dumps(payload, indent=None))
    print(f"home.json: {len(rows)} names, as of {global_date}")


def build_history(panel, tier):
    """Every signal event from DISPLAY_START onward."""
    events = []
    for t, g in panel.groupby("ticker", sort=False):
        g = g.sort_values("date").reset_index(drop=True)
        # signals in the 180 trading days BEFORE each day
        before = g["signal"].rolling(SIG_WINDOW, min_periods=1).sum().shift(1)
        for i, r in g.iterrows():
            if not r["signal"] or r["date"] < DISPLAY_START:
                continue
            events.append({
                "date": r["date"],
                "ticker": t,
                "tier": tier.get(t, ""),
                "avg20": None if pd.isna(r["avg20"]) else round(float(r["avg20"])),
                "volume": None if pd.isna(r["volume"]) else int(r["volume"]),
                "vpct": round(float(r["volume"] / r["avg20"] - 1) * 100, 1),
                "market_cap": None if pd.isna(r["market_cap"]) else float(r["market_cap"]),
                "sig180_before": int(0 if pd.isna(before.iloc[i]) else before.iloc[i]),
            })
    events.sort(key=lambda e: (e["date"], e["ticker"]), reverse=True)
    payload = {"generated": pd.Timestamp.now().isoformat(timespec="seconds"),
               "count": len(events), "rows": events}
    HISTORY_JSON.write_text(json.dumps(payload, indent=None))
    print(f"history.json: {len(events)} signal events")


def main():
    tickers, cap_now, name, tier = load_universe()
    print(f"Universe: {len(tickers)} tickers")
    panel = upsert_panel(tickers)
    panel = enrich(panel, cap_now)
    save_panel(panel)
    build_home(panel, name, tier)
    build_history(panel, tier)
    print("DONE.")


if __name__ == "__main__":
    main()
