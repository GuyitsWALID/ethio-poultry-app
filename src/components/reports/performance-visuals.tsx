"use client";

import {useId} from "react";
import Link from "next/link";
import {Activity, Egg, Wheat, HeartPulse, Wallet, Package, ArrowUpRight, ArrowDownRight} from "lucide-react";
import {useLocale, useMessages, useTranslations} from "next-intl";
import {Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, LineChart, Pie, PieChart, Scatter, ScatterChart, Tooltip, XAxis, YAxis} from "recharts";
import {ChartContainer} from "@/components/ui/chart";
import {formatEtb, formatNumber, formatOperationDate} from "@/i18n/formats";
import type {PerformanceMetric, PerformanceResponse, PerformanceSection} from "@/lib/farm-performance";
import {chartRange, type PerformanceChart} from "@/lib/farm-performance-view";
import {composition, operationalSignals, targetRail, visualStyle} from "@/lib/performance-dashboard";

const palette = ["#358e50", "#2b6cb0", "#a16207", "#c9472d", "#735e8b", "#536c70"];
export function usePerformanceText() {
  const t = useTranslations("FarmPerformance"), locale = useLocale();
  const copy = useMessages().FarmPerformance as {labels: Record<string, string>; units: Record<string, string>; explanations: Record<string, string>};
  return {t, locale, label: (key: string) => copy.labels[key] ?? t("unavailable"), unit: (key: string) => copy.units[key] ?? key, explanation: (key: string) => copy.explanations[key] ?? t("unavailable"), number: (value: number | null | undefined, unit?: string) => value == null || !Number.isFinite(value) ? t("unavailable") : unit === "ETB" ? formatEtb(value, locale) : formatNumber(value, locale)};
}

export function MetricCards({metrics}: {metrics: PerformanceMetric[]}) {
  const {t, label, unit, number, explanation} = usePerformanceText();
  return <dl className="performance-metrics">{metrics.map(metric => <div key={metric.key} className="performance-metric">
    <dt>{(() => {const Icon = ({eggs: Egg, hdep: Activity, sessionActualKg: Wheat, feedKg: Wheat, deaths: HeartPulse, revenue: Wallet, currentLowStockItems: Package} as Record<string, typeof Egg>)[metric.key] ?? Activity; return <Icon size={17} aria-hidden="true"/>;})()}{label(metric.key)}</dt>
    <dd className="performance-value">{number(metric.value)} <span>{metric.value !== null ? unit(metric.unit) : ""}</span></dd>
    <dd className="performance-change"><span aria-hidden="true">{metric.delta === null ? "—" : metric.delta > 0 ? <ArrowUpRight size={16}/> : metric.delta < 0 ? <ArrowDownRight size={16}/> : "="}</span> {metric.delta === null ? t("noComparison") : `${metric.delta > 0 ? "+" : ""}${number(metric.delta, metric.unit)} ${metric.unit !== "ETB" ? unit(metric.unit) : ""}`}<br/><span>{t("previous")}: {number(metric.previous, metric.unit)}</span></dd>
    <dd className="performance-metric-note">{explanation(metric.explanation)}</dd>
  </div>)}</dl>;
}

export function EvidenceRibbon({data, onSelect}: {data: PerformanceResponse; onSelect: (key: string) => void}) {
  const {t, number} = usePerformanceText();
  return <section className="performance-evidence" aria-label={t("dashboard.evidence")}><div className="performance-evidence-title"><h2>{t("dashboard.evidence")}</h2><p>{t("dashboard.evidenceHint")}</p></div><div className="performance-evidence-items">{Object.entries(data.sections).map(([key, section]) => <button key={key} type="button" onClick={() => onSelect(key)} className="performance-evidence-item">
    <span>{t(`views.${key as "production"}`)} <strong>{section.state !== "failed" && section.coverage?.percent != null ? `${number(section.coverage.percent)}%` : t(`states.${section.state}`)}</strong></span>
    <span className="performance-coverage-track" aria-hidden="true">{section.state !== "failed" && section.coverage?.percent != null ? <span style={{width: `${Math.max(0, Math.min(100, section.coverage.percent))}%`}}/> : <span className={`performance-coverage-${section.state}`}/>}</span>
    <span className="performance-evidence-state">{section.coverage ? `${number(section.coverage.recorded)} / ${number(section.coverage.expected)}` : t("dashboard.sourceStatus")}</span>
  </button>)}</div></section>;
}

export function OperationalFingerprint({data}: {data: PerformanceResponse}) {
  const {t} = usePerformanceText();
  const syncGroup = useId();
  const tracks = operationalSignals(data);
  return <section className="performance-fingerprint"><header><span className="performance-kicker">{t("dashboard.alignedSignals")}</span><h2>{t("dashboard.fingerprint")}</h2><p>{t("dashboard.fingerprintHint")}</p></header><div className="performance-signal-tracks">{tracks.map(chart => <PerformancePlot key={chart.key} chart={chart} scopeLabel={data.meta.scopeLabel} syncGroup={syncGroup}/>)}{!tracks.length ? <p className="p-5">{t("noChart")}</p> : null}</div></section>;
}

export function FlockComparison({section}: {section: PerformanceSection}) {
  const {t, locale, label, number, unit} = usePerformanceText();
  const rows = section.state === "failed" ? [] : (section.rows ?? []).filter(row => row.unit === "%" || row.unit === "g");
  if (!rows.length) return null;
  return <section className="performance-flock-board"><header><span className="performance-kicker">{t("dashboard.flockComparison")}</span><h2>{t("dashboard.flockBoard")}</h2><p>{t("dashboard.flockBoardHint")}</p></header><div className="performance-flock-grid">{rows.map((row, index) => {
    const rail = targetRail(row.values.primary, row.values.target);
    return <article key={`${row.label}-${index}`}><div className="performance-flock-title"><div><h3>{row.label}</h3><p>{row.context}</p></div><span>{label("coverage")}: {number(row.values.coverage)}{row.values.coverage != null ? "%" : ""}</span></div><div className="performance-flock-result"><strong>{number(row.values.primary)} <small>{unit(row.unit!)}</small></strong><span>{label("target")}: {number(row.values.target)} {row.values.target != null ? unit(row.unit!) : ""}</span></div><p className="text-xs text-forest-600">{label(row.unit === "g" ? "latestWeightG" : "hdep")}{row.unit === "g" && row.date ? ` · ${formatOperationDate(row.date, locale)}` : ""}</p><div className="performance-target-rail" aria-hidden="true">{rail.actual != null ? <span style={{width: `${rail.actual}%`}}/> : null}{rail.target != null ? <i style={{left: `${rail.target}%`}}/> : null}</div><div className="performance-flock-foot"><span>{t(rail.target == null ? "dashboard.missingTarget" : "dashboard.targetMarker")}</span>{row.evidenceHref ? <Link href={row.evidenceHref}>{t("check")} <ArrowUpRight size={15} aria-hidden="true"/></Link> : null}</div></article>;
  })}</div>{section.rowsLimited ? <p className="p-5 text-sm">{t("preview", {shown: section.rows?.length ?? 0, total: section.rowCount ?? 0})}</p> : null}</section>;
}

export function PerformancePlot({chart, scopeLabel, syncGroup}: {chart: PerformanceChart; scopeLabel: string; syncGroup?: string}) {
  const {t, locale, label, unit, number} = usePerformanceText();
  const colors = chart.key === "deaths" ? ["#c9472d", "#a16207"] : chart.key === "hdep" ? ["#358e50", "#a16207"] : chart.key === "feedPerBirdGrams" ? ["#3a513c"] : palette;
  const id = useId().replace(/:/g, ""), style = visualStyle(chart), ring = composition(chart);
  const stock = chart.key.startsWith("stock:") || chart.key.startsWith("movement:");
  const title = stock ? `${label(chart.key.split(":")[0])} · ${chart.key.slice(chart.key.indexOf(":") + 1)}` : label(chart.key);
  const range = chartRange(chart);
  const tableLines = style === "scatter" ? ["feedPerBirdGrams", ...chart.lines] : chart.lines;
  const valueUnit = (key: string) => style === "scatter" && key === "feedPerBirdGrams" ? "g/bird/day" : chart.unit;
  const translatedCategories = ["eggQuality", "lossComposition", "healthActivity", "collections", "sessionStatus"].includes(chart.key);
  const points = chart.points.map(row => ({...row, label: row.date ? formatOperationDate(row.date, locale) : translatedCategories && label(row.label) !== t("unavailable") ? label(row.label) : row.label === "unavailable" ? t("unavailable") : row.label}));
  const config = Object.fromEntries(chart.lines.map((key, index) => [key, {label: label(key), color: colors[index % colors.length]}]));
  const tooltip = <Tooltip contentStyle={{borderRadius: 8, border: "1px solid #e6dcc7", fontSize: 14}} formatter={value => number(typeof value === "number" ? value : null, chart.unit)}/>;
  const axes = <><CartesianGrid stroke="#e8ece7" strokeDasharray="3 5" vertical={false}/><XAxis dataKey="label" minTickGap={36} tickLine={false} axisLine={false} tick={{fontSize: 12, fill: "#3a513c"}} tickFormatter={value => String(value).length > 20 ? `${String(value).slice(0, 18)}…` : String(value)}/><YAxis width={66} tickLine={false} axisLine={false} tick={{fontSize: 12, fill: "#3a513c"}} tickFormatter={value => formatNumber(Number(value), locale)}/>{tooltip}</>;
  const lines = chart.lines.map((key, index) => <Line key={key} name={label(key)} dataKey={`values.${key}`} type="linear" stroke={colors[index % colors.length]} strokeWidth={2.5} strokeDasharray={key.toLowerCase().includes("target") ? "5 5" : undefined} dot={{r: 2}} connectNulls={false} isAnimationActive={false}/>);
  const description = stock ? t(chart.key.startsWith("movement:") ? "dashboard.movementHint" : "dashboard.stockHint") : t(`dashboard.chartHints.${chart.key}` as "dashboard.chartHints.eggs");
  return <figure className={`performance-plot performance-plot-${style}`} data-visual={style}>
    <figcaption><div className="performance-chart-eyebrow">{unit(chart.unit)} <span>· {scopeLabel}</span></div><h3 id={`${id}-title`}>{title}</h3><p>{description}</p></figcaption>
    {range.min === null || style === "donut" && !ring.drawable ? <div className="performance-chart-empty"><span aria-hidden="true">—</span><p>{style === "donut" && ring.total === 0 ? t("dashboard.noComposition") : t("noChart")}</p></div> : <>
      <div role="img" aria-labelledby={`${id}-title`} className={`performance-chart-stage ${style === "donut" ? "performance-donut-stage" : ""}`}>
        <ChartContainer className="h-full w-full min-w-0" config={config}>
          {style === "donut" ? <PieChart>{tooltip}<Pie data={points.map(row => ({name: row.label, value: row.values[chart.lines[0]]}))} dataKey="value" nameKey="name" innerRadius="64%" outerRadius="86%" paddingAngle={ring.rows.filter(row => row.value! > 0).length > 1 ? 3 : 0} stroke="none" isAnimationActive={false}>{points.map((_, index) => <Cell key={index} fill={colors[index % colors.length]}/>)}</Pie><text x="50%" y="47%" textAnchor="middle" fill="#1d2a1f" fontSize="24" fontWeight="600">{number(ring.total)}</text><text x="50%" y="57%" textAnchor="middle" fill="#3a513c" fontSize="12">{unit(chart.unit)}</text></PieChart>
          : style === "scatter" ? <ScatterChart margin={{top: 12, right: 20, bottom: 24, left: 4}}><CartesianGrid stroke="#e8ece7" strokeDasharray="3 5"/><XAxis type="number" dataKey="feedPerBirdGrams" name={label("feedPerBirdGrams")} unit={` ${unit("g/bird/day")}`} tick={{fontSize: 12}} tickLine={false} axisLine={false}/><YAxis type="number" dataKey="hdep" name={label("hdep")} unit="%" tick={{fontSize: 12}} width={64} tickLine={false} axisLine={false}/><Tooltip content={({active, payload}) => {const row = payload?.[0]?.payload; return active && row ? <div className="rounded-lg border border-sand-200 bg-white p-3 text-sm"><strong>{row.label}</strong><p>{label("feedPerBirdGrams")}: {number(row.feedPerBirdGrams)} {unit("g/bird/day")}</p><p>{label("hdep")}: {number(row.hdep)}%</p></div> : null;}}/><Scatter name={title} data={points.map(row => ({label: row.label, ...row.values}))} fill={colors[0]} isAnimationActive={false}/></ScatterChart>
          : style === "ranking" ? <BarChart data={points} layout="vertical" barGap={3} margin={{top: 6, right: 18, bottom: 8, left: 4}}><CartesianGrid stroke="#e8ece7" horizontal={false} strokeDasharray="3 5"/><XAxis type="number" tick={{fontSize: 12}} tickLine={false} axisLine={false} tickFormatter={value => formatNumber(Number(value), locale)}/><YAxis type="category" dataKey="label" width={110} tick={{fontSize: 12, fill: "#3a513c"}} tickLine={false} axisLine={false} tickFormatter={value => String(value).length > 16 ? `${String(value).slice(0, 14)}…` : String(value)}/>{tooltip}{chart.lines.map((key, index) => <Bar key={key} name={label(key)} dataKey={`values.${key}`} fill={colors[index % colors.length]} radius={[0, 4, 4, 0]} maxBarSize={18} isAnimationActive={false}/>)}</BarChart>
          : style === "plan" ? <ComposedChart data={points} margin={{top: 12, right: 8, bottom: 8, left: 0}}>{axes}<Bar name={label("session_actual")} dataKey="values.session_actual" fill={colors[0]} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false}/><Line name={label("session_planned")} dataKey="values.session_planned" stroke={colors[1]} strokeWidth={2.5} strokeDasharray="5 4" dot={{r: 3}} connectNulls={false} isAnimationActive={false}/></ComposedChart>
          : style === "target" ? <LineChart syncId={syncGroup} data={points} margin={{top: 12, right: 8, bottom: 8, left: 0}}>{axes}{lines}</LineChart>
          : style === "area" || style === "losses" ? <AreaChart syncId={syncGroup} data={points} margin={{top: 12, right: 8, bottom: 8, left: 0}}><defs>{chart.lines.map((key, index) => <linearGradient key={key} id={`${id}-fill-${index}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={colors[index % colors.length]} stopOpacity={0.28}/><stop offset="100%" stopColor={colors[index % colors.length]} stopOpacity={0.02}/></linearGradient>)}</defs>{axes}{chart.lines.map((key, index) => <Area key={key} name={label(key)} dataKey={`values.${key}`} type="linear" stroke={colors[index % colors.length]} fill={`url(#${id}-fill-${index})`} strokeWidth={2.5} dot={false} activeDot={{r: 4}} connectNulls={false} isAnimationActive={false}/>)}</AreaChart>
          : <BarChart data={points} margin={{top: 12, right: 8, bottom: 8, left: 0}}>{axes}{chart.lines.map((key, index) => <Bar key={key} name={label(key)} dataKey={`values.${key}`} fill={colors[index % colors.length]} radius={[4, 4, 0, 0]} maxBarSize={30} isAnimationActive={false}/>)}</BarChart>}
        </ChartContainer>
      </div>
      {style === "donut" ? <ul className="performance-composition">{points.map((row, index) => <li key={index}><span className="performance-key" style={{background: colors[index % colors.length]}} aria-hidden="true"/><span>{row.label}</span><strong>{number(row.values[chart.lines[0]], chart.unit)}</strong><span>{number(row.values[chart.lines[0]]! / ring.total! * 100)}%</span></li>)}</ul> : <ul className="performance-legend">{chart.lines.map((key, index) => <li key={key}><span aria-hidden="true" className="performance-key" style={{background: colors[index % colors.length]}}/>{label(key)}</li>)}</ul>}
      <p className="performance-range">{t("range", {min: number(range.min), max: number(range.max), unit: unit(chart.unit), missing: range.missing})}</p>
    </>}
    {chart.limited ? <p className="performance-range">{t("chartLimit")}</p> : null}
    <details className="performance-chart-table"><summary>{t("chartFigures")}</summary><div className="overflow-x-auto"><table className="w-full text-left text-sm"><caption className="sr-only">{title} · {unit(chart.unit)}</caption><thead><tr><th scope="col" className="p-2">{t(chart.kind === "line" ? "date" : "record")}</th>{tableLines.map(key => <th key={key} scope="col" className="p-2">{label(key)} · {unit(valueUnit(key))}</th>)}</tr></thead><tbody>{points.map((row, index) => <tr key={index} className="border-t border-sand-100"><th scope="row" className="p-2 font-normal">{row.label}</th>{tableLines.map(key => <td key={key} className="p-2 tabular-nums">{number(row.values[key], valueUnit(key))}</td>)}</tr>)}</tbody></table></div></details>
  </figure>;
}
