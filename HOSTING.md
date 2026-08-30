# Hosting Dav's Stock on GitHub (free, auto-refreshing)

The `dashboard/` folder is a self-contained git repo: the web page, the Python
pipeline, and two scheduled workflows. GitHub runs the fetches in the cloud and
GitHub Pages serves the page — your computer does not need to be on.

## One-time setup

### 1. Create an empty PUBLIC repo on github.com
- New repo, name it e.g. `davs-stock`, **Public**, **do not** add a README /
  .gitignore / license (this folder already has commits).

### 2. Connect and push (run from this folder)
```bash
cd "/Users/david/Documents/Projects/stocks/dashboard"
git remote add origin https://github.com/YOUR-USERNAME/davs-stock.git
git push -u origin main
```
(Authenticate in the browser window git opens, or with a personal access token.)

### 3. Let the cron jobs push data back
Repo → **Settings → Actions → General → Workflow permissions** →
select **Read and write permissions** → Save.
(Without this the daily job can't commit the refreshed data.)

### 4. Turn on Pages
Repo → **Settings → Pages** → Source: **Deploy from a branch** →
Branch: **main**, folder **/ (root)** → Save.
After ~1 minute your site is live at:
`https://YOUR-USERNAME.github.io/davs-stock/`

### 5. (Optional) test the refresh now
Repo → **Actions → daily-refresh → Run workflow**. When it finishes you'll see a
new "daily data …" commit, and the page updates.

## Day-to-day

- **Data**: refreshes automatically — weekdays ~8-9pm ET (`daily-refresh`) and
  Sundays (`weekly-universe`). Nothing to do.
- **Changing the UI/code**: edit locally, then:
  ```bash
  git add -A && git commit -m "tweak UI" && git push
  ```
  Pages redeploys in ~1 minute. That single push IS the upload.
- **Roll back**: every change is versioned; you can revert any commit.

## Notes / gotchas
- Cron is UTC and best-effort (can fire a few minutes late) — fine for a daily
  close pull. DST shifts the ET time by an hour twice a year; the schedule has
  enough buffer that it still lands well after the close.
- If `yfinance` or the NASDAQ screener ever gets rate-limited from GitHub's
  shared IPs, a run may fail; just re-run it, or we switch to a keyed data API.
- The site and its data are public (public repo). It's plain market data, but
  anyone with the URL can view it.
