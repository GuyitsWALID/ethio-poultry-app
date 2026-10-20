import en from "../../messages/en.json";
import am from "../../messages/am.json";
import {formatOperationDate, formatOperationDateTime, formatNumber} from "../i18n/formats";
import {reportCsvCell} from "./report-safety";
import type {PerformanceSnapshot} from "./performance-snapshot";

const escape = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"})[c]!);
function text(snapshot: PerformanceSnapshot) {
  const locale: "en" | "am" = snapshot.display_locale === "am" ? "am" : "en";
  const copy = (locale === "am" ? am : en).FarmPerformance;
  const labels = copy.labels as Record<string, string>, units = copy.units as Record<string, string>, explanations = copy.explanations as Record<string, string>;
  const saved = (locale === "am" ? am : en).SavedReports;
  const headings: Record<string, string> = {metric: saved.measure, current: saved.selectedPeriod, item: copy.record, supportingFigures: copy.figures};
  return {locale: locale as "en" | "am", copy, label: (key: string) => headings[key] ?? (copy.states as Record<string, string>)[key] ?? labels[key] ?? (copy.views as Record<string, string>)[key] ?? (copy as unknown as Record<string, string>)[key] ?? copy.unavailable, unit: (key: string) => units[key] ?? key,
    explanation: (key: string) => explanations[key] ?? key,
    number: (value: number | null | undefined) => value == null || !Number.isFinite(value) ? copy.unavailable : formatNumber(value, locale),
    date: (value: string) => formatOperationDate(value, locale)};
}

// No client values, external resources or script execution in frozen previews.
export function renderPerformanceHtml(snapshot: PerformanceSnapshot, name: string) {
  const t = text(snapshot);
  const rows = (headers: string[], values: unknown[][]) => `<table><thead><tr>${headers.map(h => `<th>${escape(h)}</th>`).join("")}</tr></thead><tbody>${values.map(row => `<tr>${row.map(value => `<td>${escape(value)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  const sections = Object.entries(snapshot.sections).map(([key, section]) => {
    const charts = section.series.map(series => {
      const points = series.points.filter(p => p.value !== null && Number.isFinite(p.value));
      const min = Math.min(0, ...points.map(p => p.value!)), max = Math.max(1, ...points.map(p => p.value!));
      const bars = series.points.map((point, i) => point.value === null ? "" : `<circle cx="${5 + i * 590 / Math.max(1, series.points.length - 1)}" cy="${115 - (point.value - min) / (max - min) * 105}" r="3" fill="#277445"><title>${escape(t.date(point.date))}: ${escape(t.number(point.value))}</title></circle>`).join("");
      return `<h3>${escape(t.label(series.key))} (${escape(t.unit(series.unit))})</h3><svg role="img" aria-label="${escape(t.label(series.key))}" viewBox="0 0 600 125">${bars}</svg>${rows([t.copy.from, t.label(series.key)], series.points.map(p => [t.date(p.date), t.number(p.value)]))}`;
    }).join("");
    const figures = (section.rows ?? []).map(row => [row.label, row.date ? t.date(row.date) : "", row.context ?? "", ...Object.entries(row.values).map(([key, value]) => `${t.label(key)}: ${t.number(value)}${row.unit ? ` ${t.unit(row.unit)}` : ""}`)]);
    return `<section><h2>${escape(t.label(key))}</h2><p>${escape(t.label(section.state))}</p>${section.coverage ? `<p>${escape(t.label("coverage"))}: ${escape(t.number(section.coverage.recorded))} / ${escape(t.number(section.coverage.expected))} (${escape(t.number(section.coverage.percent))}%)</p>` : ""}
      ${rows([t.label("metric"), t.label("current"), t.label("previous"), t.label("unit")], section.metrics.map(m => [t.label(m.key), t.number(m.value), t.number(m.previous), t.unit(m.unit)]))}
      ${section.explanations.map(code => `<p>${escape(t.explanation(code))}</p>`).join("")}${charts}
      ${(section.breakdowns ?? []).map(b => `<h3>${escape(t.label(b.key))} (${escape(t.unit(b.unit))})</h3>${rows([t.label("item"), t.label("value")], b.rows.map(row => [row.label, t.number(row.value)]))}`).join("")}
      ${figures.length ? `<h3>${escape(t.label("supportingFigures"))}</h3>${rows([], figures)}` : ""}
      ${section.rowsLimited ? `<p>${escape(t.copy.preview.replace("{shown}", String(section.rows?.length ?? 0)).replace("{total}", t.number(section.rowCount)))}</p>` : ""}</section>`;
  }).join("");
  return `<!doctype html><html lang="${t.locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escape(name)}</title><style>body{font:15px Arial,sans-serif;color:#1b3020;margin:24px;line-height:1.5}h1,h2{font-family:Georgia,serif}section{margin:24px 0;break-inside:auto}table{border-collapse:collapse;width:100%;margin:16px 0}th,td{border:1px solid #ddd;padding:8px;text-align:start;overflow-wrap:anywhere}svg{width:100%;max-height:200px}footer{font-size:12px}@media print{body{margin:0}thead{display:table-header-group}tr,svg{break-inside:avoid}}@media(max-width:700px){body{margin:12px}table{font-size:12px}}</style></head><body><h1>${escape(name)}</h1><p>${escape(snapshot.organization_name)} · ${escape(snapshot.meta.scopeLabel)}</p><p>${escape(t.date(snapshot.meta.dateFrom))} – ${escape(t.date(snapshot.meta.dateTo))}</p><p>${escape(t.copy.savedNote)}</p>${sections}<footer>${escape(formatOperationDateTime(snapshot.meta.generatedAt, t.locale))} · Africa/Addis_Ababa</footer></body></html>`;
}

export function renderPerformanceCsv(snapshot: PerformanceSnapshot, name: string) {
  const t = text(snapshot);
  const rows: unknown[][] = [[name], [snapshot.organization_name, snapshot.meta.scopeLabel], [t.date(snapshot.meta.dateFrom), t.date(snapshot.meta.dateTo)]];
  for (const [key, section] of Object.entries(snapshot.sections)) {
    rows.push([], [t.label(key), t.label(section.state)]);
    if (section.coverage) rows.push([t.label("coverage"), section.coverage.recorded, section.coverage.expected, section.coverage.percent]);
    rows.push([t.label("metric"), t.label("current"), t.label("previous"), t.label("unit")], ...section.metrics.map(m => [t.label(m.key), m.value ?? t.copy.unavailable, m.previous ?? t.copy.unavailable, t.unit(m.unit)]));
    for (const code of section.explanations) rows.push([t.explanation(code)]);
    for (const series of section.series) rows.push([], [t.label(series.key), t.unit(series.unit)], ...series.points.map(p => [t.date(p.date), p.value ?? t.copy.unavailable]));
    for (const b of section.breakdowns ?? []) rows.push([], [t.label(b.key), t.unit(b.unit)], ...b.rows.map(row => [row.label, row.value ?? t.copy.unavailable]));
    for (const row of section.rows ?? []) for (const [metric, value] of Object.entries(row.values)) rows.push([row.label, row.date ? t.date(row.date) : "", row.context ?? "", t.label(metric), value ?? t.copy.unavailable, row.unit ? t.unit(row.unit) : ""]);
    if (section.rowsLimited) rows.push([t.copy.preview.replace("{shown}", String(section.rows?.length ?? 0)).replace("{total}", t.number(section.rowCount))]);
  }
  return `\uFEFF${rows.map(row => row.map(reportCsvCell).join(",")).join("\r\n")}`;
}
