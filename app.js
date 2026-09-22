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
const fmtMoney = n => n == null ? "—" : (n < 0 ? "-" : "") + "$" + Math.abs(Math.round(n)).toLocaleString();
const fmtDate = s => { const [y, m, d] = s.split("-"); return `${m}/${d}/${y}`; };
const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const weekday = s => { const [y, m, d] = s.split("-").map(Number); return WD[new Date(y, m - 1, d).getDay()]; };

// dashboard color rule: yellow +100..200, green >=200
function pctClass(p) { return p >= 200 ? "green" : "yellow"; }
function vpctCell(p) { return `<span class="vpct ${pctClass(p)}">${fmtPct(p)}</span>`; }
function esc(s) { return String(s).replace(/"/g, "&quot;"); }
function sigBadge(n, ticker) {
  const clickable = n > 0 && ticker;
  return `<span class="sig-badge${n > 0 ? " on" : ""}${clickable ? " clickable" : ""}"`
       + `${clickable ? ` data-sig="${ticker}"` : ""}>${n}</span>`;
}
function indCell(s) {
  if (!s) return "—";
  return `<span class="ind-cell" data-ind title="${esc(s)}">${s}</span>`;
}
// combined "Sector – Industry" (drops a side if the other is blank)
function secInd(r) {
  const s = r.sector || "", i = r.industry || "";
  if (s && i) return `${s} – ${i}`;
  return s || i || "";
}
function tierPill(t) { return `<span class="pill ${t}">${t}</span>`; }

// ---------- Bollinger Band proximity helpers ----------
// gap % is signed: >0 = still that far from the band, <=0 = closed at/through it.
function bbPctClass(g) { return g == null ? "far" : g <= 0 ? "fired" : g <= 2 ? "near" : "far"; }
function priceCell(p) { return p == null ? "—" : "$" + p.toFixed(2); }
// which band a row is playing against, given the side chip ("low"/"high"/"both")
function bbSideGap(r, side) {
  const low = { gap: r.gap_low, band: r.bb_lower, side: "low", count: r.bb_low180 };
  const high = { gap: r.gap_high, band: r.bb_upper, side: "high", count: r.bb_high180 };
  if (side === "low") return low;
  if (side === "high") return high;
  if (low.gap == null) return high;
  if (high.gap == null) return low;
  return low.gap <= high.gap ? low : high;      // "both" -> the nearer band
}
function bbGapCell(gap, side) {
  if (gap == null) return "—";
  const arrow = side === "low" ? "↓" : "↑";
  return `<span class="bbpct ${bbPctClass(gap)}">${arrow} ${fmtPct(gap)}</span>`;
}
function bbBandCell(band, side) {
  if (band == null) return "—";
  return `<span class="bb-band ${side}">$${band.toFixed(2)}</span>`;
}
function bbSideLabel(side) {
  return side === "low"
    ? `<span class="bb-band low">↓ Lower</span>`
    : `<span class="bb-band high">↑ Upper</span>`;
}
// Yahoo chart layout (1-yr daily mountain + volume underlay + On-Balance-Volume). INTC appears only in
// the 3 symbol fields; swap it for the ticker and re-encode to get the same view.
const CHART_TPL_B64 = "eyJsYXlvdXQiOnsiaW50ZXJ2YWwiOiJkYXkiLCJwZXJpb2RpY2l0eSI6MSwidGltZVVuaXQiOm51bGwsImNhbmRsZVdpZHRoIjo2LjcyNTA5OTYwMTU5MzYyNiwiZmxpcHBlZCI6ZmFsc2UsInZvbHVtZVVuZGVybGF5Ijp0cnVlLCJhZGoiOnRydWUsImNyb3NzaGFpciI6dHJ1ZSwiY2hhcnRUeXBlIjoibW91bnRhaW4iLCJleHRlbmRlZCI6ZmFsc2UsIm1hcmtldFNlc3Npb25zIjp7fSwiYWdncmVnYXRpb25UeXBlIjoib2hsYyIsImNoYXJ0U2NhbGUiOiJsaW5lYXIiLCJzdHVkaWVzIjp7IuKAjHZvbCB1bmRy4oCMIjp7InR5cGUiOiJ2b2wgdW5kciIsImlucHV0cyI6eyJTZXJpZXMiOiJzZXJpZXMiLCJpZCI6IuKAjHZvbCB1bmRy4oCMIiwiZGlzcGxheSI6IuKAjHZvbCB1bmRy4oCMIn0sIm91dHB1dHMiOnsiVXAgVm9sdW1lIjoiIzBkYmQ2ZWVlIiwiRG93biBWb2x1bWUiOiIjZmY1NTQ3ZWUifSwicGFuZWwiOiJjaGFydCIsInBhcmFtZXRlcnMiOnsiY2hhcnROYW1lIjoiY2hhcnQiLCJlZGl0TW9kZSI6dHJ1ZSwicGFuZWxOYW1lIjoiY2hhcnQifSwiZGlzYWJsZWQiOmZhbHNlfSwi4oCMbWFjZOKAjCAoMTIsMjYsOSkiOnsidHlwZSI6Im1hY2QiLCJpbnB1dHMiOnsiRmFzdCBNQSBQZXJpb2QiOjEyLCJTbG93IE1BIFBlcmlvZCI6MjYsIlNpZ25hbCBQZXJpb2QiOjksImlkIjoi4oCMbWFjZOKAjCAoMTIsMjYsOSkiLCJkaXNwbGF5Ijoi4oCMbWFjZOKAjCAoMTIsMjYsOSkifSwib3V0cHV0cyI6eyJNQUNEIjoiYXV0byIsIlNpZ25hbCI6eyJjb2xvciI6IiNmZmYxMjZmZiJ9LCJJbmNyZWFzaW5nIEJhciI6IiMwMEREMDAiLCJEZWNyZWFzaW5nIEJhciI6IiNGRjAwMDAifSwicGFuZWwiOiLigIxtYWNk4oCMICgxMiwyNiw5KSIsInBhcmFtZXRlcnMiOnsiY2hhcnROYW1lIjoiY2hhcnQiLCJlZGl0TW9kZSI6dHJ1ZSwicGFuZWxOYW1lIjoi4oCMbWFjZOKAjCAoMTIsMjYsOSkifSwiZGlzYWJsZWQiOmZhbHNlfSwi4oCMQm9sbGluZ2VyIEJhbmRz4oCMICgyMCwyLG1hLHkpIjp7InR5cGUiOiJCb2xsaW5nZXIgQmFuZHMiLCJpbnB1dHMiOnsiUGVyaW9kIjoyMCwiRmllbGQiOiJmaWVsZCIsIlN0YW5kYXJkIERldmlhdGlvbnMiOjIsIk1vdmluZyBBdmVyYWdlIFR5cGUiOiJtYSIsIkNoYW5uZWwgRmlsbCI6dHJ1ZSwiaWQiOiLigIxCb2xsaW5nZXIgQmFuZHPigIwgKDIwLDIsbWEseSkiLCJkaXNwbGF5Ijoi4oCMQm9sbGluZ2VyIEJhbmRz4oCMICgyMCwyLG1hLHkpIn0sIm91dHB1dHMiOnsiQm9sbGluZ2VyIEJhbmRzIFRvcCI6eyJjb2xvciI6IiNmZmY2OWUzYyJ9LCJCb2xsaW5nZXIgQmFuZHMgTWVkaWFuIjp7ImNvbG9yIjoiI2ZmZjY5ZTNjIn0sIkJvbGxpbmdlciBCYW5kcyBCb3R0b20iOnsiY29sb3IiOiIjZmZmNjllNDQifX0sInBhbmVsIjoiY2hhcnQiLCJwYXJhbWV0ZXJzIjp7ImNoYXJ0TmFtZSI6ImNoYXJ0IiwiZWRpdE1vZGUiOnRydWUsInBhbmVsTmFtZSI6ImNoYXJ0In0sImRpc2FibGVkIjpmYWxzZX19LCJwYW5lbHMiOnsiY2hhcnQiOnsicGVyY2VudCI6MC44LCJkaXNwbGF5IjoiSU5UQyIsImNoYXJ0TmFtZSI6ImNoYXJ0IiwiaW5kZXgiOjAsInlBeGlzIjp7Im5hbWUiOiJjaGFydCIsInBvc2l0aW9uIjpudWxsfSwieWF4aXNMSFMiOltdLCJ5YXhpc1JIUyI6WyJjaGFydCIsIuKAjHZvbCB1bmRy4oCMIl19LCLigIxtYWNk4oCMICgxMiwyNiw5KSI6eyJwZXJjZW50IjowLjIsImRpc3BsYXkiOiLigIxtYWNk4oCMICgxMiwyNiw5KSIsImNoYXJ0TmFtZSI6ImNoYXJ0IiwiaW5kZXgiOjIsInlBeGlzIjp7Im5hbWUiOiLigIxtYWNk4oCMICgxMiwyNiw5KSIsInBvc2l0aW9uIjpudWxsfSwieWF4aXNMSFMiOltdLCJ5YXhpc1JIUyI6WyLigIxtYWNk4oCMICgxMiwyNiw5KSJdfX0sInNldFNwYW4iOnsibXVsdGlwbGllciI6MSwiYmFzZSI6InllYXIiLCJwZXJpb2RpY2l0eSI6eyJwZXJpb2QiOjEsInRpbWVVbml0IjoiZGF5In0sInNob3dFdmVudHNRdW90ZSI6dHJ1ZSwiZm9yY2VMb2FkIjp0cnVlfSwib3V0bGllcnMiOmZhbHNlLCJhbmltYXRpb24iOnRydWUsImhlYWRzVXAiOnsic3RhdGljIjp0cnVlLCJkeW5hbWljIjpmYWxzZSwiZmxvYXRpbmciOmZhbHNlfSwibGluZVdpZHRoIjoyLCJmdWxsU2NyZWVuIjp0cnVlLCJzdHJpcGVkQmFja2dyb3VuZCI6dHJ1ZSwiY29sb3IiOiIjMDA4MWYyIiwiY3Jvc3NoYWlyU3RpY2t5IjpmYWxzZSwiZG9udFNhdmVSYW5nZVRvTGF5b3V0Ijp0cnVlLCJzeW1ib2xzIjpbeyJzeW1ib2wiOiJJTlRDIiwic3ltYm9sT2JqZWN0Ijp7InN5bWJvbCI6IklOVEMiLCJtYXJrZXQiOiJ1c19tYXJrZXQiLCJxdW90ZVR5cGUiOiJFUVVJVFkiLCJleGNoYW5nZVRpbWVab25lIjoiQW1lcmljYS9OZXdfWW9yayIsInBlcmlvZDEiOjE2NjM1NjAwMDAsInBlcmlvZDIiOjE3OTAwMTAwMDB9LCJwZXJpb2RpY2l0eSI6MSwiaW50ZXJ2YWwiOiJkYXkiLCJ0aW1lVW5pdCI6bnVsbCwic2V0U3BhbiI6eyJtdWx0aXBsaWVyIjoxLCJiYXNlIjoieWVhciIsInBlcmlvZGljaXR5Ijp7InBlcmlvZCI6MSwidGltZVVuaXQiOiJkYXkifSwic2hvd0V2ZW50c1F1b3RlIjp0cnVlLCJmb3JjZUxvYWQiOnRydWV9fV0sInJlbmRlcmVycyI6W119LCJldmVudHMiOnsiZGl2cyI6dHJ1ZSwic3BsaXRzIjp0cnVlLCJ0cmFkaW5nSG9yaXpvbiI6Im5vbmUiLCJzaWdEZXZFdmVudHMiOltdfSwiZHJhd2luZ3MiOm51bGwsInByZWZlcmVuY2VzIjp7fX0=";
function buildChartUrl(t) {
  try {
    const j = decodeURIComponent(escape(atob(CHART_TPL_B64))).split("INTC").join(t);
    return "https://finance.yahoo.com/chart/" + t + "#" + btoa(unescape(encodeURIComponent(j)));
  } catch (e) { return "https://finance.yahoo.com/chart/" + t; }
}
function tickerLink(t) {
  return `<a href="https://finance.yahoo.com/chart/${t}" data-chart="${t}" target="_blank" rel="noopener">${t}<span class="ext">↗</span></a>`;
}
// ＋ add-to-favorites button (Dashboard + History)
function favBtn(t) {
  const on = FAV.fav.has(t);
  return `<button type="button" class="fav-btn${on ? " on" : ""}" data-act="fav" data-ticker="${t}" title="${on ? "Remove from favorites" : "Add to favorites"}" aria-label="favorite">${on ? "✓" : "＋"}</button>`;
}
// ◆ ready-to-buy + ★ star-toggle + ✕ remove buttons (Favorites page)
function favActions(t) {
  const rdy = FAV.ready.has(t);
  const s = FAV.star.has(t);
  return `<button type="button" class="ready-btn${rdy ? " on" : ""}" data-act="ready" data-ticker="${t}" title="${rdy ? "Not ready to buy" : "Ready to buy"}" aria-label="ready">${rdy ? "◆" : "◇"}</button>`
       + `<button type="button" class="star-btn${s ? " on" : ""}" data-act="star" data-ticker="${t}" title="${s ? "Unstar" : "Star (care more)"}" aria-label="star">${s ? "★" : "☆"}</button>`
       + `<button type="button" class="rm-btn" data-act="rm" data-ticker="${t}" title="Remove from favorites" aria-label="remove">✕</button>`;
}
let PREDICT = {};   // ticker -> [ {date:"YYYY-MM-DD", text} ]  (newest first)
function escHtml(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
function predictBtn(t) {
  const has = Array.isArray(PREDICT[t]) && PREDICT[t].length;
  return `<button type="button" class="predict-btn${has ? " on" : ""}" data-predict="${t}" title="${has ? "Prediction notes" : "Add prediction"}" aria-label="prediction">✎</button>`;
}
function tickerCell(r) { return favBtn(r.ticker) + tickerLink(r.ticker); }
function histTickerCell(r) { return favBtn(r.ticker) + tickerLink(r.ticker); }
function favTickerCell(r) { return favActions(r.ticker) + tickerLink(r.ticker) + predictBtn(r.ticker); }
function portfavTickerCell(r) { return tickerLink(r.ticker) + predictBtn(r.ticker); }

// ---------- single "you-are-here" row highlight ----------
// One highlighted row across the whole app; clicking any row moves it here.
let selectedRowKey = null;

// ---------- generic sortable table ----------
// columns: {key,label,group,sepLeft,sortable,cell(row),sortVal(row),tdClass}
// rowKey(row) -> unique string; enables the click-to-highlight "current row".
// pager (optional) = { perPage, perPageOptions:[...], pagerEls:[el,...], onPerPage(n) }
// groupBy (optional) = { key, value(row) } -> thicker divider between groups when sorted by key
function makeTable(tableEl, columns, rows, initialSort, emptyMsg, limit, rowKey, pager, groupBy) {
  let sortKey = initialSort.key, sortDir = initialSort.dir; // dir: -1 desc, 1 asc
  let page = 1;

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
  function bodyHTML(view, note, grouping) {
    if (!view.length)
      return `<tbody><tr><td colspan="${columns.length}" class="empty">${emptyMsg}</td></tr></tbody>`;
    let prevG = null;
    let body = "<tbody>" + view.map(r => {
      const rk = rowKey ? rowKey(r) : null;
      let sep = false;
      if (grouping) { const g = groupBy.value(r); if (prevG !== null && g !== prevG) sep = true; prevG = g; }
      const trCls = [rk === selectedRowKey ? "row-current" : "", sep ? "day-sep" : ""].filter(Boolean).join(" ");
      const trAttr = (rk ? ` data-rk="${rk}"` : "") + (trCls ? ` class="${trCls}"` : "");
      return `<tr${trAttr}>` + columns.map(c => {
        const cls = [c.group ? "g-" + c.group : "", c.sepLeft ? "sep-left" : "", c.tdClass || ""]
          .filter(Boolean).join(" ");
        return `<td${cls ? ` class="${cls}"` : ""}>${c.cell(r)}</td>`;
      }).join("") + "</tr>";
    }).join("");
    if (note) body += `<tr><td colspan="${columns.length}" class="empty">${note}</td></tr>`;
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
  // ---- pagination controls ----
  function pageNums(cur, pages) {
    const set = new Set([1, pages, cur - 1, cur, cur + 1].filter(n => n >= 1 && n <= pages));
    const arr = [...set].sort((a, b) => a - b);
    const out = []; let prev = 0;
    for (const n of arr) { if (n - prev > 1) out.push("…"); out.push(n); prev = n; }
    return out;
  }
  function pagerHTML(total) {
    const per = pager.perPage;
    const pages = Math.max(1, Math.ceil(total / per));
    const from = total ? (page - 1) * per + 1 : 0;
    const to = Math.min(page * per, total);
    const nums = pageNums(page, pages).map(n => n === "…"
      ? `<span class="pg-ellip">…</span>`
      : `<button class="pg-num${n === page ? " active" : ""}" data-pg="${n}">${n}</button>`).join("");
    const opts = (pager.perPageOptions || [100, 250, 500]).map(o =>
      `<option value="${o}"${o === per ? " selected" : ""}>${o} / page</option>`).join("");
    return `<span class="pg-count">Showing ${from}–${to} of ${total}</span>`
      + `<span class="pg-controls">`
      + `<button class="pg-btn" data-pg="prev"${page <= 1 ? " disabled" : ""}>‹ Prev</button>`
      + nums
      + `<button class="pg-btn" data-pg="next"${page >= pages ? " disabled" : ""}>Next ›</button></span>`
      + `<select class="pg-per">${opts}</select>`;
  }
  function wirePager(el, total) {
    const pages = Math.max(1, Math.ceil(total / pager.perPage));
    el.querySelectorAll("[data-pg]").forEach(b => b.onclick = () => {
      const v = b.dataset.pg;
      if (v === "prev") page = Math.max(1, page - 1);
      else if (v === "next") page = Math.min(pages, page + 1);
      else page = +v;
      render();
      tableEl.scrollIntoView({ block: "start", behavior: "smooth" });
    });
    const sel = el.querySelector(".pg-per");
    if (sel) sel.onchange = () => {
      pager.perPage = +sel.value; page = 1;
      if (pager.onPerPage) pager.onPerPage(pager.perPage);
      render();
    };
  }
  function render() {
    const sorted = sortRows();
    let view = sorted, note = "";
    if (pager) {
      const pages = Math.max(1, Math.ceil(sorted.length / pager.perPage));
      if (page > pages) page = pages;
      view = sorted.slice((page - 1) * pager.perPage, page * pager.perPage);
    } else if (limit && sorted.length > limit) {
      view = sorted.slice(0, limit);
      note = `Showing first ${limit} of ${sorted.length} — narrow with the filters above.`;
    }
    const grouping = groupBy && sortKey === groupBy.key;
    tableEl.innerHTML = headHTML() + bodyHTML(view, note, grouping);
    tableEl.querySelectorAll("th.sortable").forEach(th => th.onclick = () => {
      const k = th.dataset.key;
      if (k === sortKey) sortDir = -sortDir;        // toggle
      else { sortKey = k; sortDir = -1; }           // new column -> big to small
      page = 1;                                     // new sort -> back to page 1
      render();
    });
    if (pager) pager.pagerEls.forEach(el => { if (el) { el.innerHTML = pagerHTML(sorted.length); wirePager(el, sorted.length); } });
  }
  tableEl.onclick = e => {
    const act = e.target.closest("[data-act]");
    if (act) { handleFavAction(act.dataset.act, act.dataset.ticker); return; }  // ＋/★/✕ — no highlight
    const sig = e.target.closest("[data-sig]");
    if (sig) { openSignalModal(sig.dataset.sig); return; }                      // #Signals -> popup
    const pred = e.target.closest("[data-predict]");
    if (pred) { openPredictModal(pred.dataset.predict); return; }               // ✎ -> prediction note
    const ind = e.target.closest("[data-ind]");
    if (ind) { ind.classList.toggle("expanded"); return; }                      // Industry -> expand/collapse
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
  { key: "industry", label: "Industry", tdClass: "industry-cell", cell: r => indCell(secInd(r)), sortVal: r => secInd(r) },
  { key: "avg20", label: "20d Avg", group: "vol", sepLeft: true, cell: r => fmtVol(r.avg20), sortVal: r => r.avg20 },
  { key: "volume", label: "Vol", group: "vol", cell: r => fmtVol(r.volume), sortVal: r => r.volume },
  { key: "vpct", label: "+V%", group: "vol", sortable: true, cell: r => vpctCell(r.vpct), sortVal: r => r.vpct },
  { key: "market_cap", label: "Mkt Cap", group: "cap", sepLeft: true, sortable: true, cell: r => fmtCap(r.market_cap), sortVal: r => r.market_cap },
  { key: "sig180", label: "#Signals 180d", group: "sig", sepLeft: true, sortable: true, cell: r => sigBadge(r.sig180, r.ticker), sortVal: r => r.sig180 },
];
const HIST_COLS = [
  { key: "date", label: "Day", sortable: true, cell: r => fmtDate(r.date), sortVal: r => r.date },
  { key: "ticker", label: "Ticker", tdClass: "ticker", cell: histTickerCell, sortVal: r => r.ticker },
  { key: "industry", label: "Industry", tdClass: "industry-cell", cell: r => indCell(secInd(r)), sortVal: r => secInd(r) },
  { key: "tier", label: "Tier", cell: r => tierPill(r.tier), sortVal: r => r.tier },
  { key: "avg20", label: "20d Avg", group: "vol", sepLeft: true, cell: r => fmtVol(r.avg20), sortVal: r => r.avg20 },
  { key: "volume", label: "Vol", group: "vol", cell: r => fmtVol(r.volume), sortVal: r => r.volume },
  { key: "vpct", label: "+V%", group: "vol", sortable: true, cell: r => vpctCell(r.vpct), sortVal: r => r.vpct },
  { key: "market_cap", label: "Mkt Cap", group: "cap", sepLeft: true, sortable: true, cell: r => fmtCap(r.market_cap), sortVal: r => r.market_cap },
  { key: "sig180_before", label: "#Signals prior 180d", group: "sig", sepLeft: true, sortable: true, cell: r => sigBadge(r.sig180_before, r.ticker), sortVal: r => r.sig180_before },
];

// "% to Lower" band column, appended to the Favorites tables (their buy focus)
const BB_LOWER_COL = {
  key: "gap_low", label: "% to Lower", group: "sig", sepLeft: true, sortable: true,
  cell: r => bbGapCell(r.gap_low, "low"), sortVal: r => r.gap_low,
};
// Favorites page columns = the ★/✕ actions cell + the Dashboard data columns + % to Lower
const FAV_COLS = [
  { key: "ticker", label: "Ticker", tdClass: "ticker", cell: favTickerCell, sortVal: r => r.ticker },
  ...DASH_COLS.slice(1),
  BB_LOWER_COL,
];
const PORTFAV_COLS = [
  { key: "ticker", label: "Ticker", tdClass: "ticker", cell: portfavTickerCell, sortVal: r => r.ticker },
  ...DASH_COLS.slice(1),
  BB_LOWER_COL,
];

// Dashboard BB sub-view: proximity ladder (the band it's playing is chosen per side chip)
const DASH_BB_COLS = [
  { key: "ticker", label: "Ticker", tdClass: "ticker", cell: tickerCell, sortVal: r => r.ticker },
  { key: "industry", label: "Industry", tdClass: "industry-cell", cell: r => indCell(secInd(r)), sortVal: r => secInd(r) },
  { key: "price", label: "Price", group: "vol", sepLeft: true, sortable: true, cell: r => priceCell(r.price), sortVal: r => r.price },
  { key: "_band", label: "Band", group: "vol", cell: r => bbBandCell(r._band, r._side), sortVal: r => r._band },
  { key: "_gap", label: "% to band", group: "vol", sortable: true, cell: r => bbGapCell(r._gap, r._side), sortVal: r => r._gap },
  { key: "market_cap", label: "Mkt Cap", group: "cap", sepLeft: true, sortable: true, cell: r => fmtCap(r.market_cap), sortVal: r => r.market_cap },
  { key: "_count", label: "#Cross 180d", group: "sig", sepLeft: true, sortable: true, cell: r => `<span class="bbcount">${r._count || 0}</span>`, sortVal: r => r._count },
];

// History BB sub-view: log of past band crossings
const BB_HIST_COLS = [
  { key: "date", label: "Day", sortable: true, cell: r => fmtDate(r.date), sortVal: r => r.date },
  { key: "ticker", label: "Ticker", tdClass: "ticker", cell: histTickerCell, sortVal: r => r.ticker },
  { key: "industry", label: "Industry", tdClass: "industry-cell", cell: r => indCell(secInd(r)), sortVal: r => secInd(r) },
  { key: "side", label: "Band", cell: r => bbSideLabel(r.side), sortVal: r => r.side },
  { key: "tier", label: "Tier", cell: r => tierPill(r.tier), sortVal: r => r.tier },
  { key: "price", label: "Price", group: "vol", sepLeft: true, sortable: true, cell: r => priceCell(r.price), sortVal: r => r.price },
  { key: "pct", label: "% beyond", group: "vol", sortable: true, cell: r => bbGapCell(r.pct, r.side), sortVal: r => r.pct },
  { key: "market_cap", label: "Mkt Cap", group: "cap", sepLeft: true, sortable: true, cell: r => fmtCap(r.market_cap), sortVal: r => r.market_cap },
];

// ---------- favorites + Supabase sync ----------
const SB_URL = "https://xgntwwynbqgrfjtzarda.supabase.co";
const SB_KEY = "sb_publishable_0Q5YPRHw88ZdGUAEHblnAA_hJloliAs";
const SB_HEAD = { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY, "Content-Type": "application/json" };

let FAV = { fav: new Set(), star: new Set(), ready: new Set() };
const SHARED_CODE = "davs-shared";   // one shared list everyone on the link sees
let HOME_MAP = {};   // ticker -> latest home.json row (for Favorites page data)

function loadLocal() {
  try {
    const j = JSON.parse(localStorage.getItem("davs_fav") || "{}");
    FAV.fav = new Set(j.fav || []); FAV.star = new Set(j.star || []); FAV.ready = new Set(j.ready || []);
  } catch (e) { /* ignore */ }
}
function saveLocal() {
  localStorage.setItem("davs_fav", JSON.stringify({ fav: [...FAV.fav], star: [...FAV.star], ready: [...FAV.ready] }));
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
  FAV.ready = new Set((data && data.ready) || []);
}
let pushT = null;
function schedulePush() {
  clearTimeout(pushT);
  setStatus("syncing");
  pushT = setTimeout(async () => {
    try { await cloudPut(SHARED_CODE, { fav: [...FAV.fav], star: [...FAV.star], ready: [...FAV.ready] }); setStatus("synced"); }
    catch (e) { setStatus("error"); }
  }, 600);
}

// mutations
function toggleFav(t) {
  if (FAV.fav.has(t)) { FAV.fav.delete(t); FAV.star.delete(t); FAV.ready.delete(t); }
  else FAV.fav.add(t);
  afterFavChange();
}
function toggleStar(t) {
  if (FAV.star.has(t)) FAV.star.delete(t);
  else { FAV.star.add(t); FAV.fav.add(t); }
  afterFavChange();
}
function toggleReady(t) {
  if (FAV.ready.has(t)) FAV.ready.delete(t);
  else { FAV.ready.add(t); FAV.fav.add(t); }
  afterFavChange();
}
function removeFav(t) { FAV.fav.delete(t); FAV.star.delete(t); FAV.ready.delete(t); afterFavChange(); }
function handleFavAction(act, t) {
  if (act === "fav") toggleFav(t);
  else if (act === "star") toggleStar(t);
  else if (act === "ready") toggleReady(t);
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
  document.getElementById("view-portfolio").classList.toggle("hidden", name !== "portfolio");
  if (name === "favorites") renderFavorites();
  if (name === "portfolio") renderPortfolio();
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
  else if (v === "portfolio") renderPortfolio();
}
// Vol / BB sub-view toggles (Dashboard + History)
function applyDashMode(m) {
  dashMode = m;
  document.querySelectorAll("#dash-mode .chip").forEach(b => b.classList.toggle("active", b.dataset.mode === m));
  document.getElementById("dash-vol").classList.toggle("hidden", m !== "vol");
  document.getElementById("dash-bb").classList.toggle("hidden", m !== "bb");
  renderDash();
}
function applyHistMode(m) {
  histMode = m;
  document.querySelectorAll("#hist-mode .chip").forEach(b => b.classList.toggle("active", b.dataset.mode === m));
  document.getElementById("hist-vol").classList.toggle("hidden", m !== "vol");
  document.getElementById("hist-bb").classList.toggle("hidden", m !== "bb");
  renderHistory();
}

// ---------- favorites page ----------
function favRow(t) {
  return HOME_MAP[t] || { ticker: t, sector: "", avg20: null, volume: null, vpct: null, market_cap: null, sig180: 0 };
}
let favTier = "all";
function renderFavorites() {
  const tp = favTier === "all" ? (() => true) : (r => r.tier === favTier);
  const ready = [...FAV.ready].map(favRow).filter(tp);
  const starred = [...FAV.star].filter(t => !FAV.ready.has(t)).map(favRow).filter(tp);
  const plain = [...FAV.fav].filter(t => !FAV.star.has(t) && !FAV.ready.has(t)).map(favRow).filter(tp);
  const key = r => "d#" + r.ticker;
  document.getElementById("ready-count").textContent = ready.length ? `${ready.length}` : "";
  document.getElementById("star-count").textContent = starred.length ? `${starred.length}` : "";
  document.getElementById("fav-count").textContent = plain.length ? `${plain.length}` : "";
  makeTable(document.getElementById("ready-table"), FAV_COLS, ready, { key: "vpct", dir: -1 },
    "Nothing ready yet — tap ◇ on a starred or favorite stock to mark it ready to buy.", null, key);
  makeTable(document.getElementById("star-table"), FAV_COLS, starred, { key: "vpct", dir: -1 },
    "No starred stocks yet — tap ☆ on a favorite below to promote it here.", null, key);
  makeTable(document.getElementById("fav-table"), FAV_COLS, plain, { key: "vpct", dir: -1 },
    "No favorites yet — tap ＋ next to any stock on the Dashboard or History.", null, key);

  // your holdings at the bottom (from the Portfolio page), filtered by the same tier chip
  const held = [...new Set(PORT.lots.map(l => l.ticker))].map(favRow).filter(tp);
  document.getElementById("portfav-count").textContent = held.length ? held.length : "";
  makeTable(document.getElementById("portfav-table"), PORTFAV_COLS, held, { key: "vpct", dir: -1 },
    "No holdings yet — add them on the Portfolio page.", null, key);
}

// ---------- #Signals popup ----------
function openSignalModal(t) {
  const sigs = HIST_ROWS.filter(r => r.ticker === t && r.vpct >= 200)
    .sort((a, b) => a.date < b.date ? 1 : (a.date > b.date ? -1 : 0));
  document.getElementById("sm-title").textContent = `${t} — signals in 2026 (${sigs.length})`;
  const body = document.getElementById("sm-body");
  if (!sigs.length) {
    body.innerHTML = `<div class="empty">No 2026 signals on record for ${t}.</div>`;
  } else {
    body.innerHTML = `<table class="grid"><thead><tr>`
      + `<th class="sm-l">Day</th><th>+V%</th><th>Vol</th><th>Mkt Cap</th></tr></thead><tbody>`
      + sigs.map(r => `<tr><td class="sm-l">${fmtDate(r.date)}</td><td>${vpctCell(r.vpct)}</td>`
        + `<td>${fmtVol(r.volume)}</td><td>${fmtCap(r.market_cap)}</td></tr>`).join("")
      + `</tbody></table>`;
  }
  document.getElementById("signal-modal").classList.remove("hidden");
}
function closeSignalModal() { document.getElementById("signal-modal").classList.add("hidden"); }

// ---------- prediction notes (Favorites) — dated log ----------
function migratePredict() {   // normalize legacy string values -> [{date,text}]
  for (const k in PREDICT) {
    if (typeof PREDICT[k] === "string") PREDICT[k] = PREDICT[k].trim() ? [{ date: "", text: PREDICT[k] }] : [];
    if (!Array.isArray(PREDICT[k]) || !PREDICT[k].length) delete PREDICT[k];
  }
}
function loadPredictLocal() {
  try { PREDICT = JSON.parse(localStorage.getItem("davs_predict") || "{}"); } catch (e) { PREDICT = {}; }
  migratePredict();
}
function savePredictLocal() { localStorage.setItem("davs_predict", JSON.stringify(PREDICT)); }
let predictPushT = null;
function schedulePredictPush() {
  savePredictLocal();
  clearTimeout(predictPushT);
  predictPushT = setTimeout(() => cloudPut("davs-predictions", PREDICT).catch(() => {}), 600);
}
let pmTicker = null;
function renderPredictHistory(t) {
  const el = document.getElementById("pm-history");
  const list = PREDICT[t] || [];
  if (!list.length) { el.innerHTML = `<div class="pm-empty">No notes yet.</div>`; return; }
  el.innerHTML = `<div class="pm-h-title">Past notes</div>` + list.map((e, i) =>
    `<div class="pm-entry"><div class="pm-entry-head">`
    + `<span class="pm-date">${e.date ? fmtDate(e.date) : "—"}</span>`
    + `<button class="rm-btn" data-delnote="${i}" title="Delete note">✕</button></div>`
    + `<div class="pm-body">${escHtml(e.text)}</div></div>`).join("");
  el.querySelectorAll("[data-delnote]").forEach(b => b.onclick = () => deleteNote(+b.dataset.delnote));
}
function openPredictModal(t) {
  pmTicker = t;
  document.getElementById("pm-title").textContent = "Prediction";
  document.getElementById("pm-text").value = "";
  renderPredictHistory(t);
  document.getElementById("predict-modal").classList.remove("hidden");
  document.getElementById("pm-text").focus();
}
function closePredictModal() { document.getElementById("predict-modal").classList.add("hidden"); pmTicker = null; }
function savePrediction() {
  if (!pmTicker) return;
  const ta = document.getElementById("pm-text");
  const v = ta.value.trim();
  if (!v) return;
  (PREDICT[pmTicker] = PREDICT[pmTicker] || []).unshift({ date: todayISO(), text: v });
  schedulePredictPush();
  ta.value = "";
  renderPredictHistory(pmTicker);
  rerenderCurrent();   // refresh ✎ state on Favorites or Portfolio
  ta.focus();
}
function deleteNote(i) {
  if (!pmTicker) return;
  const list = PREDICT[pmTicker] || [];
  list.splice(i, 1);
  if (!list.length) delete PREDICT[pmTicker];
  schedulePredictPush();
  renderPredictHistory(pmTicker);
  rerenderCurrent();
}

// ================= PORTFOLIO =================
let PORT = { original: 0, lots: [], sells: [] };
let PRICES = null;           // lazy-loaded prices.json for the worth chart
let pendingSellId = null;
let portFit = false;         // false = bars proportional to Original/Now; true = fit each bar
let portSortDir = -1;        // positions Date sort: -1 newest first, 1 oldest first

function loadPortLocal() {
  try {
    const j = JSON.parse(localStorage.getItem("davs_port") || "{}");
    PORT = { original: j.original || 0, lots: j.lots || [], sells: j.sells || [] };
  } catch (e) { /* ignore */ }
}
function savePortLocal() { localStorage.setItem("davs_port", JSON.stringify(PORT)); }
let portPushT = null;
function schedulePortPush() {
  savePortLocal();
  clearTimeout(portPushT);
  portPushT = setTimeout(() => cloudPut("davs-portfolio", PORT).catch(() => {}), 600);
}

const priceOf = t => { const r = HOME_MAP[t]; return r && r.price != null ? r.price : null; };
const secOf = t => { const r = HOME_MAP[t]; return r && r.sector ? r.sector : ""; };

function portCalc() {
  let invested = 0, holdingsValue = 0, buysAll = 0, sellsAll = 0;
  for (const l of PORT.lots) {
    invested += l.cost * l.shares; buysAll += l.cost * l.shares;
    const p = priceOf(l.ticker);
    holdingsValue += (p != null ? p : l.cost) * l.shares;
  }
  for (const x of PORT.sells) { buysAll += x.cost * x.shares; sellsAll += x.sellPrice * x.shares; }
  const available = PORT.original - buysAll + sellsAll;
  return { invested, holdingsValue, available, worth: available + holdingsValue };
}

function renderPortfolio() {
  const c = portCalc();
  // stat cards
  document.getElementById("port-stats").innerHTML =
    statCard("Original", fmtMoney(PORT.original), `<button class="orig-edit" id="orig-edit">＋</button>`)
    + statCard("Invested", fmtMoney(c.invested))
    + statCard("Available", fmtMoney(c.available));
  document.getElementById("orig-edit").onclick = editOriginal;

  // positions table
  renderPositions(c);
  renderClosed();
  // charts
  document.getElementById("chart-overall").innerHTML = svgOverall(PORT.original, c.worth);
  document.getElementById("chart-perstock").innerHTML = svgPerStock(portFit ? null : Math.max(PORT.original, c.worth, 1));
  renderWorthChart();
}
function statCard(label, val, extra) {
  return `<div class="pstat"><div class="pstat-l">${label}</div><div class="pstat-v">${val}${extra || ""}</div></div>`;
}
function editOriginal() {
  const v = prompt("Set your original / starting amount ($):", PORT.original || "");
  if (v == null) return;
  const n = parseFloat(String(v).replace(/[^0-9.\-]/g, ""));
  if (!isNaN(n)) { PORT.original = n; schedulePortPush(); renderPortfolio(); }
}

function renderPositions(c) {
  const t = document.getElementById("port-table");
  document.getElementById("open-count").textContent = PORT.lots.length ? PORT.lots.length : "";
  const arrow = `<span class="arrow">${portSortDir < 0 ? "▼" : "▲"}</span>`;
  const head = `<thead><tr><th class="l sortable" id="port-date-sort">Date ${arrow}</th><th class="l">Ticker</th><th class="l">Sector</th>`
    + `<th>Cost/sh</th><th>Price</th><th>Change%</th><th>#Shares</th>`
    + `<th class="muted-col">Total Cost</th><th class="muted-col">Total Value</th><th></th></tr></thead>`;
  if (!PORT.lots.length) {
    t.innerHTML = head + `<tbody><tr><td colspan="10" class="empty">No positions yet — add one below.</td></tr></tbody>`;
    t.querySelector("#port-date-sort").onclick = () => { portSortDir = -portSortDir; renderPositions(portCalc()); };
    return;
  }
  const lots = [...PORT.lots].sort((a, b) => portSortDir * (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const rows = lots.map(l => {
    const p = priceOf(l.ticker), chg = p != null ? (p / l.cost - 1) * 100 : null;
    const tc = l.cost * l.shares, tv = p != null ? p * l.shares : null;
    return `<tr><td class="l">${fmtDate(l.date)}</td>`
      + `<td class="l ticker">${tickerLink(l.ticker)}${predictBtn(l.ticker)}</td>`
      + `<td class="l" style="color:var(--muted)">${secOf(l.ticker) || "—"}</td>`
      + `<td>$${l.cost.toFixed(2)}</td><td>${p != null ? "$" + p.toFixed(2) : "—"}</td>`
      + `<td>${chg == null ? "—" : `<span class="vpct ${chg >= 0 ? "green" : "loss"}">${fmtPct(chg)}</span>`}</td>`
      + `<td>${l.shares}</td>`
      + `<td class="muted-col">${fmtMoney(tc)}</td><td class="muted-col">${tv == null ? "—" : fmtMoney(tv)}</td>`
      + `<td class="l"><button class="sell-btn" data-sell="${l.id}">Sell</button>`
      + `<button class="rm-btn" data-dellot="${l.id}">✕</button></td></tr>`;
  }).join("");
  const totChg = c.invested > 0 ? (c.holdingsValue / c.invested - 1) * 100 : 0;
  const totals = `<tr class="port-total"><td class="l" colspan="5">Total</td>`
    + `<td><span class="vpct ${totChg >= 0 ? "green" : "loss"}">${fmtPct(totChg)}</span></td><td></td>`
    + `<td class="muted-col">${fmtMoney(c.invested)}</td><td class="muted-col">${fmtMoney(c.holdingsValue)}</td><td></td></tr>`;
  t.innerHTML = head + `<tbody>${rows}${totals}</tbody>`;
  t.querySelector("#port-date-sort").onclick = () => { portSortDir = -portSortDir; renderPositions(portCalc()); };
  t.querySelectorAll("[data-sell]").forEach(b => b.onclick = () => openSellModal(b.dataset.sell));
  t.querySelectorAll("[data-dellot]").forEach(b => b.onclick = () => deleteLot(b.dataset.dellot));
  t.querySelectorAll("[data-predict]").forEach(b => b.onclick = () => openPredictModal(b.dataset.predict));
}

function renderClosed() {
  const t = document.getElementById("closed-table");
  document.getElementById("closed-count").textContent = PORT.sells.length ? PORT.sells.length : "";
  if (!PORT.sells.length) { t.innerHTML = `<tbody><tr><td class="empty">No closed positions.</td></tr></tbody>`; return; }
  const head = `<thead><tr><th class="l">Ticker</th><th class="l">Bought</th><th class="l">Sold</th>`
    + `<th>#Sh</th><th>Cost/sh</th><th>Sell/sh</th><th>Realized $</th><th>Realized %</th><th></th></tr></thead>`;
  const rows = [...PORT.sells].sort((a, b) => a.sellDate < b.sellDate ? 1 : -1).map(x => {
    const gain = (x.sellPrice - x.cost) * x.shares, pct = (x.sellPrice / x.cost - 1) * 100;
    return `<tr><td class="l">${x.ticker}</td><td class="l">${fmtDate(x.date)}</td><td class="l">${fmtDate(x.sellDate)}</td>`
      + `<td>${x.shares}</td><td>$${x.cost.toFixed(2)}</td><td>$${x.sellPrice.toFixed(2)}</td>`
      + `<td><span class="vpct ${gain >= 0 ? "green" : "loss"}">${fmtMoney(gain)}</span></td>`
      + `<td><span class="vpct ${pct >= 0 ? "green" : "loss"}">${fmtPct(pct)}</span></td>`
      + `<td class="l"><button class="rm-btn" data-delsell="${x.id}" title="Delete record">✕</button></td></tr>`;
  }).join("");
  t.innerHTML = head + `<tbody>${rows}</tbody>`;
  t.querySelectorAll("[data-delsell]").forEach(b => b.onclick = () => {
    PORT.sells = PORT.sells.filter(s => s.id !== b.dataset.delsell); schedulePortPush(); renderPortfolio();
  });
}

// ---- add / sell / delete ----
function addLot() {
  const date = document.getElementById("pa-date").value;
  const ticker = document.getElementById("pa-ticker").value.trim().toUpperCase();
  const cost = parseFloat(document.getElementById("pa-cost").value);
  const shares = parseFloat(document.getElementById("pa-shares").value);
  if (!date || !ticker || !(cost > 0) || !(shares > 0)) { alert("Enter date, ticker, cost/share and #shares."); return; }
  PORT.lots.push({ id: (crypto.randomUUID ? crypto.randomUUID() : String(Math.random())), ticker, date, cost, shares });
  document.getElementById("pa-ticker").value = "";
  document.getElementById("pa-cost").value = "";
  document.getElementById("pa-shares").value = "";
  schedulePortPush(); renderPortfolio();
}
function deleteLot(id) {
  if (!confirm("Delete this position (no sale recorded)?")) return;
  PORT.lots = PORT.lots.filter(l => l.id !== id); schedulePortPush(); renderPortfolio();
}
function openSellModal(id) {
  const l = PORT.lots.find(x => x.id === id); if (!l) return;
  pendingSellId = id;
  document.getElementById("sell-title").textContent = `Sell ${l.ticker} (${l.shares} sh)`;
  const p = priceOf(l.ticker);
  document.getElementById("sell-price").value = p != null ? p : l.cost;
  document.getElementById("sell-date").value = todayISO();
  document.getElementById("sell-modal").classList.remove("hidden");
}
function closeSellModal() { document.getElementById("sell-modal").classList.add("hidden"); pendingSellId = null; }
function confirmSell() {
  const l = PORT.lots.find(x => x.id === pendingSellId); if (!l) return closeSellModal();
  const price = parseFloat(document.getElementById("sell-price").value);
  const sellDate = document.getElementById("sell-date").value;
  if (!(price > 0) || !sellDate) { alert("Enter a sell price and date."); return; }
  PORT.sells.push({ id: l.id, ticker: l.ticker, date: l.date, shares: l.shares, cost: l.cost, sellDate, sellPrice: price });
  PORT.lots = PORT.lots.filter(x => x.id !== l.id);
  closeSellModal(); schedulePortPush(); renderPortfolio();
}
function todayISO() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

// ---- charts (hand-rolled SVG) ----
function svgOverall(orig, now) {
  const max = Math.max(orig, now, 1);
  const W = 360, H = 210, base = 165, top = 45, x1 = 105, x2 = 255, bw = 66;
  const h = v => (v / max) * (base - top);
  const y1 = base - h(orig), y2 = base - h(now);
  const pct = orig > 0 ? (now / orig - 1) * 100 : 0;
  const col = pct >= 0 ? "#4ad991" : "#ff5c5c";
  return `<svg viewBox="0 0 ${W} ${H}" class="chart-svg" preserveAspectRatio="xMidYMid meet">`
    + `<rect x="${x1 - bw / 2}" y="${y1}" width="${bw}" height="${base - y1}" fill="#54657a" rx="3"/>`
    + `<rect x="${x2 - bw / 2}" y="${y2}" width="${bw}" height="${base - y2}" fill="${col}" rx="3"/>`
    + `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${col}" stroke-dasharray="4 3" stroke-width="1.5"/>`
    + `<text x="${x1}" y="${y1 - 8}" class="c-lbl">${fmtMoney(orig)}</text>`
    + `<text x="${x2}" y="${y2 - 8}" class="c-lbl">${fmtMoney(now)}</text>`
    + `<text x="${(x1 + x2) / 2}" y="${Math.min(y1, y2) - 22}" class="c-pct" fill="${col}">${(pct >= 0 ? "+" : "") + pct.toFixed(1)}%</text>`
    + `<text x="${x1}" y="${base + 20}" class="c-ax">Original</text>`
    + `<text x="${x2}" y="${base + 20}" class="c-ax">Now</text></svg>`;
}
function holdingsByTicker() {
  const m = {};
  for (const l of PORT.lots) {
    const p = priceOf(l.ticker);
    (m[l.ticker] = m[l.ticker] || { ticker: l.ticker, cost: 0, value: 0 });
    m[l.ticker].cost += l.cost * l.shares;
    m[l.ticker].value += (p != null ? p : l.cost) * l.shares;
  }
  return Object.values(m).sort((a, b) => b.value - a.value);
}
function svgPerStock(scale) {
  const hs = holdingsByTicker();
  if (!hs.length) return `<div class="empty">No holdings.</div>`;
  const max = scale || Math.max(...hs.map(d => Math.max(d.cost, d.value)), 1);
  const bw = 46, gap = 26, W = hs.length * (bw + gap) + gap, H = 210, base = 165, top = 45;
  const h = v => Math.min((v / max) * (base - top), base - top);   // clamp to chart height
  let bars = "";
  hs.forEach((d, i) => {
    const x = gap + i * (bw + gap);
    const lo = h(Math.min(d.cost, d.value)), hi = h(Math.max(d.cost, d.value));
    const pct = d.cost > 0 ? (d.value / d.cost - 1) * 100 : 0, gain = d.value >= d.cost;
    const col = gain ? "#4ad991" : "#ff5c5c";
    bars += `<rect x="${x}" y="${base - lo}" width="${bw}" height="${lo}" fill="#54657a" rx="2"/>`;
    bars += `<rect x="${x}" y="${base - hi}" width="${bw}" height="${hi - lo}" fill="${col}"${gain ? "" : ' opacity="0.5"'} rx="2"/>`;
    const pctStr = Math.abs(pct) < 0.05 ? "0.0%" : (pct >= 0 ? "+" : "") + pct.toFixed(1) + "%";
    bars += `<text x="${x + bw / 2}" y="${base - hi - 8}" class="c-pct" fill="${col}">${pctStr}</text>`;
    bars += `<text x="${x + bw / 2}" y="${base + 20}" class="c-ax">${d.ticker}</text>`;
  });
  return `<svg viewBox="0 0 ${W} ${H}" class="chart-svg">${bars}</svg>`;
}

function renderWorthChart() {
  const el = document.getElementById("chart-worth");
  if (!PORT.lots.length && !PORT.sells.length) { el.innerHTML = `<div class="empty">Add a position to see your worth over time.</div>`; return; }
  if (!PRICES) {
    el.innerHTML = `<div class="empty">Loading price history…</div>`;
    fetch("data/prices.json?t=" + Date.now()).then(r => r.json()).then(j => { PRICES = j; renderWorthChart(); }).catch(() => { el.innerHTML = `<div class="empty">Couldn't load price history.</div>`; });
    return;
  }
  el.innerHTML = svgWorth();
}
function svgWorth() {
  const dates = PRICES.dates, idxOf = {};
  dates.forEach((d, i) => idxOf[d] = i);
  const pxAt = (t, i) => { const a = PRICES.close[t]; return a && a[i] != null ? a[i] : null; };
  const firstDate = [...PORT.lots, ...PORT.sells].map(x => x.date).sort()[0];
  let start = dates.findIndex(d => d >= firstDate); if (start < 0) start = 0; start = Math.max(0, start - 1);
  const wk = dates.slice(start);
  const series = wk.map(d => {
    const i = idxOf[d]; let cash = PORT.original, hold = 0;
    for (const l of PORT.lots) if (l.date <= d) { cash -= l.cost * l.shares; const p = pxAt(l.ticker, i); hold += (p != null ? p : l.cost) * l.shares; }
    for (const x of PORT.sells) {
      if (x.date <= d) cash -= x.cost * x.shares;
      if (x.sellDate <= d) cash += x.sellPrice * x.shares;
      if (x.date <= d && x.sellDate > d) { const p = pxAt(x.ticker, i); hold += (p != null ? p : x.cost) * x.shares; }
    }
    return cash + hold;
  });
  if (series.length < 2) return `<div class="empty">Not enough history yet.</div>`;
  const box = document.getElementById("chart-worth");
  const W = Math.max(box ? box.clientWidth : 640, 300), H = 220, padL = 10, padR = 10, padT = 24, padB = 26;
  const lo = Math.min(...series, PORT.original), hi = Math.max(...series, PORT.original);
  const span = (hi - lo) || 1;
  const X = i => padL + i * (W - padL - padR) / (series.length - 1);
  const Y = v => padT + (1 - (v - lo) / span) * (H - padT - padB);
  const pts = series.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(" ");
  const last = series[series.length - 1], up = last >= series[0];
  const col = up ? "#4ad991" : "#ff5c5c";
  const yOrig = Y(PORT.original);
  const valY = Math.min(Math.max(16, Y(last) - 10), H - 30);
  return `<svg viewBox="0 0 ${W} ${H}" class="chart-svg">`
    + `<line x1="${padL}" y1="${yOrig}" x2="${W - padR}" y2="${yOrig}" stroke="#54657a" stroke-dasharray="3 3" stroke-width="1"/>`
    + `<polyline points="${pts}" fill="none" stroke="${col}" stroke-width="2" stroke-linejoin="round"/>`
    + `<circle cx="${X(series.length - 1)}" cy="${Y(last)}" r="3" fill="${col}"/>`
    + `<text x="${padL}" y="${H - 8}" class="c-ax" style="text-anchor:start">${fmtDate(wk[0])}</text>`
    + `<text x="${W - padR}" y="${H - 8}" class="c-ax" style="text-anchor:end">${fmtDate(wk[wk.length - 1])}</text>`
    + `<text x="${W - padR}" y="${valY}" class="c-lbl" style="text-anchor:end" fill="${col}">${fmtMoney(last)}</text></svg>`;
}

// ---------- boot ----------
let HOME_ROWS = [];
let dashFilter = "both";
let dashMode = "vol";              // "vol" | "bb"
let bbSide = "both";               // "low" | "high" | "both"  (Dashboard BB)
let bbProx = 2;                    // proximity net %: 0 | 2 | 5  (Dashboard BB)
function renderDash() {
  if (dashMode === "bb") return renderDashBB();
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
function renderDashBB() {
  const derive = r => { const d = bbSideGap(r, bbSide); return Object.assign({}, r, { _gap: d.gap, _band: d.band, _side: d.side, _count: d.count }); };
  const rows = HOME_ROWS.map(derive).filter(r => r._gap != null && r._gap <= bbProx);
  const mega = rows.filter(r => r.tier === "mega");
  const large = rows.filter(r => r.tier === "large");
  const which = bbSide === "high" ? "upper band" : bbSide === "low" ? "lower band" : "a band";
  const empty = bbProx === 0 ? `Nothing has crossed ${which} at last close.`
                             : `Nothing within ${bbProx}% of ${which} at last close.`;
  const dashKey = r => "d#" + r.ticker;
  makeTable(document.getElementById("bb-mega-table"), DASH_BB_COLS, mega, { key: "_gap", dir: 1 }, empty, null, dashKey);
  makeTable(document.getElementById("bb-large-table"), DASH_BB_COLS, large, { key: "_gap", dir: 1 }, empty, null, dashKey);
}

let HIST_ROWS = [];
let histTier = "all", histBand = "both", histRange = 90;  // range in days; 0 = all
let histSearch = "";     // ticker search filter (History)
let histPerPage = 500;   // rows per page on History (user-changeable, persists)
let histMode = "vol";    // "vol" | "bb"
// History BB filter state
let BB_HIST_ROWS = [];
let bbHistTier = "all", bbHistSide = "both", bbHistRange = 90, bbHistSearch = "", bbHistPerPage = 500;
function isoDaysAgo(days) {
  const t = new Date();
  t.setDate(t.getDate() - days);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
}
function renderHistory() {
  if (histMode === "bb") return renderBBHistory();
  const tierPass = histTier === "all" ? (() => true) : (r => r.tier === histTier);
  const bandPass = histBand === "g200" ? (r => r.vpct >= 200)
                 : histBand === "y100" ? (r => r.vpct >= 100 && r.vpct < 200)
                 : (r => r.vpct >= 100);
  const cutoff = histRange > 0 ? isoDaysAgo(histRange) : null;
  const rangePass = cutoff ? (r => r.date >= cutoff) : (() => true);
  const searchPass = histSearch ? (r => r.ticker.toLowerCase() === histSearch) : (() => true);
  const rows = HIST_ROWS.filter(r => tierPass(r) && bandPass(r) && rangePass(r) && searchPass(r));
  document.getElementById("hist-count").textContent = `${rows.length} events`;
  makeTable(document.getElementById("hist-table"), HIST_COLS, rows,
    { key: "date", dir: -1 }, "No events.", null, r => r.date + "#" + r.ticker,
    { perPage: histPerPage, perPageOptions: [250, 500, 1000, 10000],
      onPerPage: n => histPerPage = n,
      pagerEls: [document.getElementById("hist-pager-top"), document.getElementById("hist-pager-bot")] },
    { key: "date", value: r => r.date });
}
function renderBBHistory() {
  const tierPass = bbHistTier === "all" ? (() => true) : (r => r.tier === bbHistTier);
  const sidePass = bbHistSide === "both" ? (() => true) : (r => r.side === bbHistSide);
  const cutoff = bbHistRange > 0 ? isoDaysAgo(bbHistRange) : null;
  const rangePass = cutoff ? (r => r.date >= cutoff) : (() => true);
  const searchPass = bbHistSearch ? (r => r.ticker.toLowerCase() === bbHistSearch) : (() => true);
  const rows = BB_HIST_ROWS.filter(r => tierPass(r) && sidePass(r) && rangePass(r) && searchPass(r));
  document.getElementById("bb-hist-count").textContent = `${rows.length} events`;
  makeTable(document.getElementById("bb-hist-table"), BB_HIST_COLS, rows,
    { key: "date", dir: -1 }, "No band touches in range.", null, r => r.date + "#" + r.ticker + "#" + r.side,
    { perPage: bbHistPerPage, perPageOptions: [250, 500, 1000, 10000],
      onPerPage: n => bbHistPerPage = n,
      pagerEls: [document.getElementById("bb-hist-pager-top"), document.getElementById("bb-hist-pager-bot")] },
    { key: "date", value: r => r.date });
}

async function boot() {
  const bust = "?t=" + Date.now();   // always fetch the freshest data (after the daily refresh)
  const [home, hist, bbhist] = await Promise.all([
    fetch("data/home.json" + bust).then(r => r.json()),
    fetch("data/history.json" + bust).then(r => r.json()),
    fetch("data/bb_history.json" + bust).then(r => r.json()).catch(() => ({ rows: [] })),
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
  // Dashboard Vol / BB mode toggle + BB side/proximity chips
  document.querySelectorAll("#dash-mode .chip").forEach(c => c.onclick = () => applyDashMode(c.dataset.mode));
  const bbSideChips = document.querySelectorAll("#bb-side .chip");
  bbSideChips.forEach(c => c.onclick = () => {
    bbSide = c.dataset.side;
    bbSideChips.forEach(x => x.classList.toggle("active", x === c));
    renderDashBB();
  });
  const bbProxChips = document.querySelectorAll("#bb-prox .chip");
  bbProxChips.forEach(c => c.onclick = () => {
    bbProx = +c.dataset.prox;
    bbProxChips.forEach(x => x.classList.toggle("active", x === c));
    renderDashBB();
  });

  // history — two synced filter groups: tier (all/mega/large) and band (both/200/100)
  HIST_ROWS = hist.rows;
  BB_HIST_ROWS = (bbhist && bbhist.rows) || [];
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
  const histSearchEl = document.getElementById("hist-search");
  histSearchEl.addEventListener("input", () => { histSearch = histSearchEl.value.trim().toLowerCase(); renderHistory(); });

  // history Vol / BB mode toggle + BB-history filter groups
  document.querySelectorAll("#hist-mode .chip").forEach(c => c.onclick = () => applyHistMode(c.dataset.mode));
  const bbhTierChips = document.querySelectorAll("#bbh-tier .chip");
  bbhTierChips.forEach(c => c.onclick = () => {
    bbHistTier = c.dataset.filter;
    bbhTierChips.forEach(x => x.classList.toggle("active", x === c));
    renderBBHistory();
  });
  const bbhSideChips = document.querySelectorAll("#bbh-side .chip");
  bbhSideChips.forEach(c => c.onclick = () => {
    bbHistSide = c.dataset.side;
    bbhSideChips.forEach(x => x.classList.toggle("active", x === c));
    renderBBHistory();
  });
  const bbhRangeChips = document.querySelectorAll("#bbh-range .chip");
  bbhRangeChips.forEach(c => c.onclick = () => {
    bbHistRange = +c.dataset.days;
    bbhRangeChips.forEach(x => x.classList.toggle("active", x === c));
    renderBBHistory();
  });
  const bbhSearchEl = document.getElementById("bbh-search");
  bbhSearchEl.addEventListener("input", () => { bbHistSearch = bbhSearchEl.value.trim().toLowerCase(); renderBBHistory(); });

  // favorites: load local cache first (instant), then pull the one shared list
  loadLocal();
  setStatus("syncing");
  const favChips = document.querySelectorAll("#fav-filters .chip");
  favChips.forEach(c => c.onclick = () => {
    favTier = c.dataset.filter;
    favChips.forEach(x => x.classList.toggle("active", x === c));
    renderFavorites();
  });
  // build the full Yahoo chart URL only when a ticker link is actually clicked
  // (keeps hundreds of row links tiny; falls back to /chart/TICKER if this doesn't run)
  document.addEventListener("click", e => {
    const a = e.target.closest && e.target.closest("a[data-chart]");
    if (a) a.href = buildChartUrl(a.dataset.chart);
  }, true);

  // signal modal close handlers
  document.querySelectorAll("#signal-modal [data-close]").forEach(el => el.onclick = closeSignalModal);
  document.addEventListener("keydown", e => { if (e.key === "Escape") { closeSignalModal(); closeSellModal(); closePredictModal(); } });

  // prediction notes: load local, wire modal, pull synced copy
  loadPredictLocal();
  document.getElementById("pm-save").onclick = savePrediction;
  document.querySelectorAll("#predict-modal [data-pclose]").forEach(el => el.onclick = closePredictModal);
  cloudGet("davs-predictions").then(d => { if (d && typeof d === "object") { PREDICT = d; migratePredict(); savePredictLocal(); if (currentView() === "favorites") renderFavorites(); } }).catch(() => {});

  // portfolio: load local, wire form + sell modal, then pull the synced copy
  loadPortLocal();
  document.getElementById("pa-date").value = todayISO();
  document.getElementById("pa-add").onclick = addLot;
  document.getElementById("fit-toggle").onclick = () => {
    portFit = !portFit;
    document.getElementById("fit-toggle").classList.toggle("on", portFit);
    renderPortfolio();
  };
  document.getElementById("sell-confirm").onclick = confirmSell;
  document.querySelectorAll("#sell-modal [data-sclose]").forEach(el => el.onclick = closeSellModal);
  cloudGet("davs-portfolio").then(d => { if (d) { PORT = { original: d.original || 0, lots: d.lots || [], sells: d.sells || [] }; savePortLocal(); rerenderCurrent(); } }).catch(() => {});

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
