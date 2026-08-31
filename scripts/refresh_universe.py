#!/usr/bin/env python3
"""WEEKLY job: rebuild the >$10B universe from the free NASDAQ screener
(covers NASDAQ + NYSE + AMEX, ~6000 names, with market caps).

Writes dashboard/data/universe.csv with columns:
    ticker, name, market_cap, tier, last_checked

Reuses the screener approach from research/scripts/fetch_universe_full.py.
"""
import datetime as dt

import pandas as pd
import requests

from common import UNIVERSE_CSV, MIN_CAP, tier_of

HDRS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 "
                  "Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://www.nasdaq.com/",
}

# share classes / non-tradables we don't want as duplicates
DROP = {"GOOG", "GOOGM", "GOOGN", "BRK-A", "CCZ"}


def fetch_screener() -> pd.DataFrame:
    url = ("https://api.nasdaq.com/api/screener/stocks"
           "?tableonly=true&limit=10000&download=true")
    r = requests.get(url, headers=HDRS, timeout=60)
    r.raise_for_status()
    rows = r.json()["data"]["rows"]
    df = pd.DataFrame(rows)
    df["market_cap"] = pd.to_numeric(df["marketCap"], errors="coerce")
    df["sector"] = df.get("sector", "").fillna("").astype(str).str.strip()
    df = df[["symbol", "name", "market_cap", "sector"]].dropna(subset=["market_cap"])
    df = df[df["market_cap"] > 0]
    # Yahoo-friendly tickers (BRK/B -> BRK-B)
    df["symbol"] = df["symbol"].str.strip().str.replace("/", "-", regex=False)
    df = df[~df["symbol"].isin(DROP)]
    return df.sort_values("market_cap", ascending=False)


def main():
    print("Downloading NASDAQ/NYSE/AMEX screener ...")
    uni = fetch_screener()
    members = uni[uni["market_cap"] >= MIN_CAP].copy()
    members = members.rename(columns={"symbol": "ticker"})
    members["tier"] = members["market_cap"].map(tier_of)
    members["last_checked"] = dt.date.today().isoformat()
    members = members[["ticker", "name", "market_cap", "tier", "sector", "last_checked"]]
    members.to_csv(UNIVERSE_CSV, index=False)

    n_mega = (members["tier"] == "mega").sum()
    n_large = (members["tier"] == "large").sum()
    print(f"  {len(members)} names > $10B  ->  {UNIVERSE_CSV.name}")
    print(f"  mega (>=$200B): {n_mega}   large ($10B-$200B): {n_large}")


if __name__ == "__main__":
    main()
