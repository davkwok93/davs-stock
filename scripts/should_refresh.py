#!/usr/bin/env python3
"""Hourly evening gate for the daily refresh.

The workflow fires every hour from ~6pm ET to ~2am ET. This prints go=true until
home.json holds the latest finished trading day from a run at/after 8pm ET (so
late volume prints have settled); after that every remaining hourly run skips.
On a market holiday the expected day never shows up, so it just keeps running.
"""
import json
import os

import pandas as pd

from common import HOME_JSON, finalized_cutoff

SETTLED_HOUR_ET = 20   # a pull at/after 8pm ET is treated as final for the day


def expected_day():
    d = pd.Timestamp(finalized_cutoff()) - pd.Timedelta(days=1)
    while d.weekday() >= 5:                      # back up over the weekend
        d -= pd.Timedelta(days=1)
    return d.strftime("%Y-%m-%d")


def main():
    want = expected_day()
    go, why = True, f"latest finished day {want} not in home.json yet"
    try:
        home = json.loads(HOME_JSON.read_text())
        gen = pd.Timestamp(home["generated"])
        gen = (gen.tz_localize("UTC") if gen.tzinfo is None else gen).tz_convert("America/New_York")
        have = min(home.get("date", ""), home.get("vol_date") or home.get("date", ""))
        settled = gen >= pd.Timestamp(want, tz="America/New_York") + pd.Timedelta(hours=SETTLED_HOUR_ET)
        if have >= want and settled:
            go, why = False, f"already have {want} (pulled {gen:%m/%d %H:%M} ET)"
        elif have >= want:
            why = f"have {want} but pulled early ({gen:%H:%M} ET); refreshing again"
    except Exception as e:
        why = f"could not read home.json ({e}); refreshing"
    print(why)
    out = os.environ.get("GITHUB_OUTPUT")
    if out:
        with open(out, "a") as f:
            f.write(f"go={'true' if go else 'false'}\n")


if __name__ == "__main__":
    main()
