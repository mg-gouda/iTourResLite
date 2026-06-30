import type { MaterializationGrid } from "@itour/shared";

// Heat colour by availability ratio (avail/alloc) — mirrors legacy conditional formatting.
function cellColor(alloc: number, avail: number): string {
  if (alloc <= 0) return "#1e293b";
  if (avail <= 0) return "#7f1d1d"; // over/full — red
  const ratio = avail / alloc;
  if (ratio <= 0.25) return "#92400e"; // amber — near full
  return "#14532d"; // green — available
}

export function renderGridHtml(g: MaterializationGrid): string {
  const head = g.days
    .map((d) => `<th>${d.slice(5)}</th>`)
    .join("");

  const body = g.rows
    .map((r) => {
      const alloc = `<tr><td class="lbl">Alloc</td>${r.cells.map((c) => `<td>${c.alloc || ""}</td>`).join("")}<td class="ttl">${r.totalAlloc}</td></tr>`;
      const sold = `<tr><td class="lbl">Sold</td>${r.cells.map((c) => `<td>${c.sold || ""}</td>`).join("")}<td class="ttl">${r.totalSold}</td></tr>`;
      const ss = `<tr><td class="lbl">SS</td>${r.cells.map((c) => `<td>${c.ss || ""}</td>`).join("")}<td class="ttl">${r.totalSS}</td></tr>`;
      const avail = `<tr><td class="lbl">Avail</td>${r.cells
        .map((c) => `<td style="background:${cellColor(c.alloc, c.avail)};color:#fff">${c.avail}</td>`)
        .join("")}<td class="ttl">${r.matPercent == null ? "—" : r.matPercent + "%"}</td></tr>`;
      return `<tr class="rt"><td colspan="${g.days.length + 2}">${escapeHtml(r.roomTypeName)}</td></tr>${alloc}${sold}${ss}${avail}`;
    })
    .join("");

  return `<!doctype html><html><head><meta charset="utf-8"><title>Materialization — ${escapeHtml(g.hotelName)}</title>
<style>
  body{font-family:Arial,Helvetica,sans-serif;background:#0f172a;color:#e2e8f0;margin:24px}
  h1{font-size:18px;margin:0 0 4px}
  .sub{color:#94a3b8;font-size:12px;margin-bottom:16px}
  table{border-collapse:collapse;font-size:11px;width:100%}
  th,td{border:1px solid #334155;padding:3px 5px;text-align:center;min-width:26px}
  th{background:#1e293b}
  td.lbl{text-align:left;background:#1e293b;font-weight:bold;white-space:nowrap}
  td.ttl{background:#1e293b;font-weight:bold}
  tr.rt td{background:#0b1220;color:#38bdf8;text-align:left;font-weight:bold;padding:6px}
  @media print{body{background:#fff;color:#000}}
</style></head><body>
  <h1>${escapeHtml(g.hotelName)} — Materialization</h1>
  <div class="sub">${g.from} → ${g.to}</div>
  <table><thead><tr><th>Room Type</th>${head}<th>TTL</th></tr></thead><tbody>${body}</tbody></table>
</body></html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
}
