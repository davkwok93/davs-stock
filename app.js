"use strict";

// ---------- formatting ----------
const fmtVol = v => v == null ? "—" :
  v >= 1e9 ? (v / 1e9).toFixed(2) + "B" :
  v >= 1e6 ? (v / 1e6).toFixed(1) + "M" :
  v >= 1e3 ? (v / 1e3).toFixed(0) + "K" : String(v);
const fmtCap = c => c == null ? "—" :
  c >= 1e12 ? "$" + (c / 1e12).toFixed(2) + "T" :
  c >= 1e9 ? "$" + (c / 1e9).toFixed(1) + "B" : "$" + (c / 1e6).toFixed(0) + "M";
const fmtPct = p => (p == null) ? "—" : (p >= 0 ? "+" : "") + p.toFixed(1) + "%";
const fmtDate = s => { const [y, m, d] = s.split("-"); return `${m}/${d}/${y}`; };
const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const weekday = s => { const [y, m, d] = s.split("-").map(Number); return WD[new Date(y, m - 1, d).getDay()]; };

// dashboard color rule: yellow +100..200, green >=200
function pctClass(p) { return p >= 200 ? "green" : "yellow"; }
function vpctCell(p) { return `<span class="vpct ${pctClass(p)}">${fmtPct(p)}</span>`; }
function sigBadge(n) { return `<span class="sig-badge ${n > 0 ? "on" : ""}">${n}</span>`; }
function tierPill(t) { return `<span class="pill ${t}">${t}</span>`; }
function tickerLink(t, url) {
  return `<a href="${url}" target="_blank" rel="noopener">${t}<span class="ext">↗</span></a>`;
}
function yUrl(r) { return r.yahoo_url || ("https://finance.yahoo.com/quote/" + r.ticker); }
// ＋ add-to-favorites button (Dashboard + History)
function favBtn(t) {
  const on = FAV.fav.has(t);
  return `<button type="button" class="fav-btn${on ? " on" : ""}" data-act="fav" data-ticker="${t}" title="${on ? "Remove from favorites" : "Add to favorites"}" aria-label="favorite">${on ? "✓" : "＋"}</button>`;
}
// ★ star-toggle + ✕ remove buttons (Favorites page)
function favActions(t) {
  const s = FAV.star.has(t);
  return `<button type="button" class="star-btn${s ? " on" : ""}" data-act="star" data-ticker="${t}" title="${s ? "Unstar" : "Star (care more)"}" aria-label="star">${s ? "★" : "☆"}</button>`
       + `<button type="button" class="rm-btn" data-act="rm" data-ticker="${t}" title="Remove from favorites" aria-label="remove">✕</button>`;
}
function tickerCell(r) { return favBtn(r.ticker) + tickerLink(r.ticker, yUrl(r)); }
function histTickerCell(r) { return favBtn(r.ticker) + tickerLink(r.ticker, yUrl(r)); }
function favTickerCell(r) { return favActions(r.ticker) + tickerLink(r.ticker, yUrl(r)); }

// ---------- single "you-are-here" row highlight ----------
// One highlighted row across the whole app; clicking any row moves it here.
let selectedRowKey = null;

// ---------- generic sortable table ----------
// columns: {key,label,group,sepLeft,sortable,cell(row),sortVal(row),tdClass}
// rowKey(row) -> unique string; enables the click-to-highlight "current row".
function makeTable(tableEl, columns, rows, initialSort, emptyMsg, limit, rowKey) {
  let sortKey = initialSort.key, sortDir = initialSort.dir; // dir: -1 desc, 1 asc

  function headHTML() {
    return "<thead><tr>" + columns.map(c => {
      const cls = [c.group ? "g-" + c.group : "", c.sepLeft ? "sep-left" : "",
                   c.sortable ? "sortable" : "", c.key === sortKey ? "active" : ""]
        .filter(Boolean).join(" ");
      const arrow = c.sortable
        ? `<span class="arrow">${(c.key === sortKey && sortDir > 0) ? "▲" : "▼"}</span>` : "";
      return `<th data-key="${c.key}"${cls ? ` class="${cls}"` : ""}>${c.label}${arrow}</th>`;
    }).join("") + "</tr></thead>";
  }
  function bodyHTML(sorted) {
    if (!sorted.length)
      return `<tbody><tr><td colspan="${columns.length}" class="empty">${emptyMsg}</td></tr></tbody>`;
    const shown = (limit && sorted.length > limit) ? sorted.slice(0, limit) : sorted;
    let body = "<tbody>" + shown.map(r => {
      const rk = rowKey ? rowKey(r) : null;
      const trAttr = rk ? ` data-rk="${rk}"${rk === selectedRowKey ? ' class="row-current"' : ""}` : "";
      return `<tr${trAttr}>` + columns.map(c => {
        const cls = [c.group ? "g-" + c.group : "", c.sepLeft ? "sep-left" : "", c.tdClass || ""]
          .filter(Boolean).join(" ");
        return `<td${cls ? ` class="${cls}"` : ""}>${c.cell(r)}</td>`;
      }).join("") + "</tr>";
    }).join("");
    if (limit && sorted.length > limit)
      body += `<tr><td colspan="${columns.length}" class="empty">`
            + `Showing first ${limit} of ${sorted.length} — narrow with the filters above.</td></tr>`;
    return body + "</tbody>";
  }
  function sortRows() {
    const val = columns.find(c => c.key === sortKey).sortVal;
    return [...rows].sort((a, b) => {
      let av = val(a), bv = val(b);
      if (typeof av === "string") return sortDir * av.localeCompare(bv);
      if (av == null) av = -Infinity; if (bv == null) bv = -Infinity;
      return sortDir * (av - bv);
    });
  }
  function render() {
    tableEl.innerHTML = headHTML() + bodyHTML(sortRows());
    tableEl.querySelectorAll("th.sortable").forEach(th => th.onclick = () => {
      const k = th.dataset.key;
      if (k === sortKey) sortDir = -sortDir;        // toggle
      else { sortKey = k; sortDir = -1; }           // new column -> big to small
      render();
    });
  }
  tableEl.onclick = e => {
    const act = e.target.closest("[data-act]");
    if (act) { handleFavAction(act.dataset.act, act.dataset.ticker); return; }  // ＋/★/✕ — no highlight
    if (!rowKey) return;
    // click anywhere else on a data row -> make it the single highlighted "current" row
    const tr = e.target.closest("tr[data-rk]");
    if (!tr || !tableEl.contains(tr)) return;
    selectedRowKey = tr.dataset.rk;
    document.querySelectorAll("tr.row-current").forEach(x => x.classList.remove("row-current"));
    tr.classList.add("row-current");
  };
  render();
}

// ---------- column definitions ----------
const DASH_COLS = [
  { key: "ticker", label: "Ticker", tdClass: "ticker", cell: tickerCell, sortVal: r => r.ticker },
  { key: "sector", label: "Sector", tdClass: "sector-cell", cell: r => r.sector || "—", sortVal: r => r.sector || "" },
  { key: "avg20", label: "20d Avg", group: "vol", sepLeft: true, cell: r => fmtVol(r.avg20), sortVal: r => r.avg20 },
  { key: "volume", label: "Vol", group: "vol", cell: r => fmtVol(r.volume), sortVal: r => r.volume },
  { key: "vpct", label: "+V%", group: "vol", sortable: true, cell: r => vpctCell(r.vpct), sortVal: r => r.vpct },
  { key: "market_cap", label: "Mkt Cap", group: "cap", sepLeft: true, sortable: true, cell: r => fmtCap(r.market_cap), sortVal: r => r.market_cap },
  { key: "sig180", label: "#Signals 180d", group: "sig", sepLeft: true, sortable: true, cell: r => sigBadge(r.sig180), sortVal: r => r.sig180 },
];
const HIST_COLS = [
  { key: "date", label: "Day", sortable: true, cell: r => fmtDate(r.date), sortVal: r => r.date },
  { key: "ticker", label: "Ticker", tdClass: "ticker", cell: histTickerCell, sortVal: r => r.ticker },
  { key: "sector", label: "Sector", tdClass: "sector-cell", cell: r => r.sector || "—", sortVal: r => r.sector || "" },
  { key: "tier", label: "Tier", cell: r => tierPill(r.tier), sortVal: r => r.tier },
  { key: "avg20", label: "20d Avg", group: "vol", sepLeft: true, cell: r => fmtVol(r.avg20), sortVal: r => r.avg20 },
  { key: "volume", label: "Vol", group: "vol", cell: r => fmtVol(r.volume), sortVal: r => r.volume },
  { key: "vpct", label: "+V%", group: "vol", sortable: true, cell: r => vpctCell(r.vpct), sortVal: r => r.vpct },
  { key: "market_cap", label: "Mkt Cap", group: "cap", sepLeft: true, sortable: true, cell: r => fmtCap(r.market_cap), sortVal: r => r.market_cap },
  { key: "sig180_before", label: "#Signals prior 180d", group: "sig", sepLeft: true, sortable: true, cell: r => sigBadge(r.sig180_before), sortVal: r => r.sig180_before },
];

// Favorites page columns = the ★/✕ actions cell + the Dashboard data columns
const FAV_COLS = [
  { key: "ticker", label: "Ticker", tdClass: "ticker", cell: favTickerCell, sortVal: r => r.ticker },
  ...DASH_COLS.slice(1),
];

// ---------- favorites + Supabase sync ----------
const SB_URL = "https://xgntwwynbqgrfjtzarda.supabase.co";
const SB_KEY = "sb_publishable_0Q5YPRHw88ZdGUAEHblnAA_hJloliAs";
const SB_HEAD = { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY, "Content-Type": "application/json" };

let FAV = { fav: new Set(), star: new Set() };
const SHARED_CODE = "davs-shared";   // one shared list everyone on the link sees
let HOME_MAP = {};   // ticker -> latest home.json row (for Favorites page data)

function loadLocal() {
  try {
    const j = JSON.parse(localStorage.getItem("davs_fav") || "{}");
    FAV.fav = new Set(j.fav || []); FAV.star = new Set(j.star || []);
  } catch (e) { /* ignore */ }
}
function saveLocal() {
  localStorage.setItem("davs_fav", JSON.stringify({ fav: [...FAV.fav], star: [...FAV.star] }));
}
async function cloudGet(code) {
  const r = await fetch(`${SB_URL}/rest/v1/favorites?code=eq.${encodeURIComponent(code)}&select=data`, { headers: SB_HEAD });
  if (!r.ok) throw new Error("get " + r.status);
  const rows = await r.json();
  return rows.length ? rows[0].data : null;
}
async function cloudPut(code, data) {
  const r = await fetch(`${SB_URL}/rest/v1/favorites?on_conflict=code`, {
    method: "POST",
    headers: { ...SB_HEAD, Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ code, data }),
  });
  if (!r.ok) throw new Error("put " + r.status);
}
function setFrom(data) {
  FAV.fav = new Set((data && data.fav) || []);
  FAV.star = new Set((data && data.star) || []);
}
let pushT = null;
function schedulePush() {
  clearTimeout(pushT);
  setStatus("syncing");
  pushT = setTimeout(async () => {
    try { await cloudPut(SHARED_CODE, { fav: [...FAV.fav], star: [...FAV.star] }); setStatus("synced"); }
    catch (e) { setStatus("error"); }
  }, 600);
}

// mutations
function toggleFav(t) {
  if (FAV.fav.has(t)) { FAV.fav.delete(t); FAV.star.delete(t); }
  else FAV.fav.add(t);
  afterFavChange();
}
function toggleStar(t) {
  if (FAV.star.has(t)) FAV.star.delete(t);
  else { FAV.star.add(t); FAV.fav.add(t); }
  afterFavChange();
}
function removeFav(t) { FAV.fav.delete(t); FAV.star.delete(t); afterFavChange(); }
function handleFavAction(act, t) {
  if (act === "fav") toggleFav(t);
  else if (act === "star") toggleStar(t);
  else if (act === "rm") removeFav(t);
}
function afterFavChange() { saveLocal(); schedulePush(); rerenderCurrent(); }

// sync-bar status
function setStatus(s) {
  const el = document.getElementById("sync-status");
  if (!el) return;
  const map = {
    local: ["This device only", "s-local"],
    syncing: ["Syncing…", "s-syncing"],
    synced: ["✓ Synced across devices", "s-synced"],
    error: ["⚠ Sync error — saved locally", "s-error"],
  };
  const [txt, cls] = map[s] || map.local;
  el.textContent = txt;
  el.className = "sync-status " + cls;
}
// ---------- view switching ----------
function setView(name) {
  document.querySelectorAll(".nav-item").forEach(b => b.classList.toggle("active", b.dataset.view === name));
  document.getElementById("view-dashboard").classList.toggle("hidden", name !== "dashboard");
  document.getElementById("view-history").classList.toggle("hidden", name !== "history");
  document.getElementById("view-favorites").classList.toggle("hidden", name !== "favorites");
  if (name === "favorites") renderFavorites();
}
document.querySelectorAll(".nav-item").forEach(b => b.onclick = () => setView(b.dataset.view));

function currentView() {
  return document.querySelector(".nav-item.active")?.dataset.view || "dashboard";
}
function rerenderCurrent() {
  const v = currentView();
  if (v === "dashboard") renderDash();
  else if (v === "history") renderHistory();
  else if (v === "favorites") renderFavorites();
}

// ---------- favorites page ----------
function favRow(t) {
  return HOME_MAP[t] || { ticker: t, sector: "", avg20: null, volume: null, vpct: null, market_cap: null, sig180: 0 };
}
let favTier = "all";
function renderFavorites() {
  const tp = favTier === "all" ? (() => true) : (r => r.tier === favTier);
  const starred = [...FAV.star].map(favRow).filter(tp);
  const plain = [...FAV.fav].filter(t => !FAV.star.has(t)).map(favRow).filter(tp);
  const key = r => "d#" + r.ticker;
  document.getElementById("star-count").textContent = starred.length ? `${starred.length}` : "";
  document.getElementById("fav-count").textContent = plain.length ? `${plain.length}` : "";
  makeTable(document.getElementById("star-table"), FAV_COLS, starred, { key: "vpct", dir: -1 },
    "No starred stocks yet — tap ☆ on a favorite below to promote it here.", null, key);
  makeTable(document.getElementById("fav-table"), FAV_COLS, plain, { key: "vpct", dir: -1 },
    "No favorites yet — tap ＋ next to any stock on the Dashboard or History.", null, key);
}

// ---------- boot ----------
let HOME_ROWS = [];
let dashFilter = "both";
function renderDash() {
  const f = dashFilter;
  const pass = f === "g200" ? (r => r.vpct >= 200)
             : f === "y100" ? (r => r.vpct >= 100 && r.vpct < 200)
             : (r => r.vpct >= 100);                      // both
  const rows = HOME_ROWS.filter(r => r.vpct != null && pass(r));
  const mega = rows.filter(r => r.tier === "mega");
  const large = rows.filter(r => r.tier === "large");
  const empty = "Nothing to show at last close.";
  const dashKey = r => "d#" + r.ticker;
  makeTable(document.getElementById("mega-table"), DASH_COLS, mega, { key: "vpct", dir: -1 }, empty, null, dashKey);
  makeTable(document.getElementById("large-table"), DASH_COLS, large, { key: "vpct", dir: -1 }, empty, null, dashKey);
}

let HIST_ROWS = [];
let histTier = "all", histBand = "both", histRange = 90;  // range in days; 0 = all
function isoDaysAgo(days) {
  const t = new Date();
  t.setDate(t.getDate() - days);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
}
function renderHistory() {
  const tierPass = histTier === "all" ? (() => true) : (r => r.tier === histTier);
  const bandPass = histBand === "g200" ? (r => r.vpct >= 200)
                 : histBand === "y100" ? (r => r.vpct >= 100 && r.vpct < 200)
                 : (r => r.vpct >= 100);
  const cutoff = histRange > 0 ? isoDaysAgo(histRange) : null;
  const rangePass = cutoff ? (r => r.date >= cutoff) : (() => true);
  const rows = HIST_ROWS.filter(r => tierPass(r) && bandPass(r) && rangePass(r));
  document.getElementById("hist-count").textContent = `${rows.length} events`;
  makeTable(document.getElementById("hist-table"), HIST_COLS, rows,
    { key: "date", dir: -1 }, "No events.", 400, r => r.date + "#" + r.ticker);
}

async function boot() {
  const [home, hist] = await Promise.all([
    fetch("data/home.json").then(r => r.json()),
    fetch("data/history.json").then(r => r.json()),
  ]);

  // header rows: today's ACTUAL date (live from the viewer's clock),
  // then the latest market close (the date the data is from)
  const n = new Date();
  const pad = x => String(x).padStart(2, "0");
  const today = `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}`;
  document.getElementById("today").textContent =
    `Today ${fmtDate(today)} (${weekday(today)})`;
  document.getElementById("asof").textContent =
    `Last market close ${fmtDate(home.date)} (${weekday(home.date)})`;

  // dashboard tables, driven by the Both / +200% / +100% filter
  HOME_ROWS = home.rows;
  HOME_MAP = Object.fromEntries(home.rows.map(r => [r.ticker, r]));
  renderDash();
  const dashChips = document.querySelectorAll(".dash-filters .chip");
  dashChips.forEach(c => c.onclick = () => {
    dashFilter = c.dataset.f;
    dashChips.forEach(x => x.classList.toggle("active", x.dataset.f === dashFilter)); // sync both bars
    renderDash();
  });

  // history — two synced filter groups: tier (all/mega/large) and band (both/200/100)
  HIST_ROWS = hist.rows;
  renderHistory();
  const tierChips = document.querySelectorAll("#hist-tier .chip");
  tierChips.forEach(c => c.onclick = () => {
    histTier = c.dataset.filter;
    tierChips.forEach(x => x.classList.toggle("active", x === c));
    renderHistory();
  });
  const bandChips = document.querySelectorAll("#hist-band .chip");
  bandChips.forEach(c => c.onclick = () => {
    histBand = c.dataset.f;
    bandChips.forEach(x => x.classList.toggle("active", x === c));
    renderHistory();
  });
  const rangeChips = document.querySelectorAll("#hist-range .chip");
  rangeChips.forEach(c => c.onclick = () => {
    histRange = +c.dataset.days;
    rangeChips.forEach(x => x.classList.toggle("active", x === c));
    renderHistory();
  });

  // favorites: load local cache first (instant), then pull the one shared list
  loadLocal();
  setStatus("syncing");
  const favChips = document.querySelectorAll("#fav-filters .chip");
  favChips.forEach(c => c.onclick = () => {
    favTier = c.dataset.filter;
    favChips.forEach(x => x.classList.toggle("active", x === c));
    renderFavorites();
  });
  rerenderCurrent();
  try {
    const remote = await cloudGet(SHARED_CODE);
    if (remote) { setFrom(remote); saveLocal(); rerenderCurrent(); }
    setStatus("synced");
  } catch (e) { setStatus("error"); }
}
boot().catch(e => {
  document.querySelector(".content").innerHTML =
    `<div class="empty">Failed to load data. Run <code>python -m http.server</code> from the dashboard folder.<br><br>${e}</div>`;
});
