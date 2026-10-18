"use client";

import Link from "next/link";
import {useRouter, useSearchParams} from "next/navigation";
import {useEffect, useRef, useState} from "react";
import {useLocale, useTranslations} from "next-intl";
import {ChevronDown, ChevronRight, RefreshCw} from "lucide-react";
import {useFarmScope} from "@/components/farm-scope-context";
import {OperationDateInput} from "@/components/operation-date-input";
import {formatEtb, formatNumber, formatOperationDate, formatOperationDateTime} from "@/i18n/formats";
import {buildHistoryHref, historyCategories, historyCorrectionHref, historyPeriod, type HistoryCategory, type HistoryDetail, type HistoryField, type HistoryInput, type HistoryItem, type HistoryOption, type HistoryPage} from "@/lib/history/contracts";
import {historySources} from "@/lib/history/sources";

const control = "min-h-12 min-w-0 w-full rounded-lg border border-sand-300 bg-white px-3 text-base text-forest-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-700";
class ReadFailure extends Error {constructor(readonly code: string) {super(code);}}
async function read<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, {cache: "no-store", signal});
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new ReadFailure(response.status === 401 ? "SESSION_EXPIRED" : body?.code ?? "LOAD_FAILED");
  if (!body) throw new ReadFailure("LOAD_FAILED");
  return body as T;
}
const failure = (error: unknown) => error instanceof ReadFailure ? error.code : "LOAD_FAILED";
const knownErrors = new Set(["LOAD_FAILED", "SESSION_EXPIRED", "ACCESS_DENIED", "FEATURE_DISABLED", "INVALID_FILTERS", "INVALID_CURSOR", "UNAVAILABLE", "DETAIL_TOO_LARGE", "SCOPE_TOO_LARGE"]);

export function HistoryWorkspace() {
  const t = useTranslations("History"), locale = useLocale(), router = useRouter(), search = useSearchParams();
  const {role, todayWorkspaceEnabled, loading, filterValues} = useFarmScope();
  const [defaults] = useState(() => historyPeriod());
  const value = (key: string, fallback = "") => search.get(`filter_page_history_${key}`) ?? filterValues[`page_history_${key}`] ?? fallback;
  const input: HistoryInput = {category: value("category", "daily") as HistoryCategory, subtype: value("subtype"), from: value("from", defaults.from), to: value("to", defaults.to), farm: value("farm"), house: value("house"), flock: value("flock"), batch: value("batch"), warehouse: value("warehouse")};
  const kind = search.get("history_kind") ?? "", id = search.get("history_record") ?? "";
  const [refresh, setRefresh] = useState(0), [online, setOnline] = useState(true);
  const permitted = todayWorkspaceEnabled && (role === "ceo" || role === "farm_manager");
  const query = new URLSearchParams({category: input.category, subtype: input.subtype, from: input.from, to: input.to});
  for (const name of ["farm", "house", "flock", "batch", "warehouse"] as const) if (input[name]) query.set(`${name}_id`, input[name]);
  const request = `/api/history/records?${query}`, key = `${request}:${refresh}:${online}:${role}:${todayWorkspaceEnabled}`;
  const [loaded, setLoaded] = useState<{key: string; page: HistoryPage; moreError?: string} | null>(null);
  const [error, setError] = useState<{key: string; code: string} | null>(null);
  const [moreBusy, setMoreBusy] = useState(false);
  const moreRequest = useRef<AbortController | null>(null);
  const [detail, setDetail] = useState<{key: string; data?: HistoryDetail; code?: string} | null>(null);
  const detailKey = `${key}:${kind}:${id}`;
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update(); window.addEventListener("online", update); window.addEventListener("offline", update);
    return () => {window.removeEventListener("online", update); window.removeEventListener("offline", update);};
  }, []);
  useEffect(() => {
    if (loading || !permitted || !online) return;
    const controller = new AbortController();
    void read<HistoryPage>(request, controller.signal).then(page => {
      if (!Array.isArray(page.items) || !page.options) throw new ReadFailure("LOAD_FAILED");
      if (!controller.signal.aborted) {setLoaded({key, page}); setError(null);}
    }).catch(err => {
      if (!controller.signal.aborted) {setError({key, code: failure(err)}); if (["ACCESS_DENIED", "SESSION_EXPIRED"].includes(failure(err))) {setLoaded(null); setDetail(null);}}
    });
    return () => {controller.abort(); moreRequest.current?.abort();};
  }, [key, request, loading, permitted, online]);
  useEffect(() => {
    if (!kind || !id || loading || !permitted || !online) return;
    const controller = new AbortController();
    void read<HistoryDetail>(`/api/history/records/${encodeURIComponent(kind)}/${encodeURIComponent(id)}`, controller.signal).then(data => {
      if (!Array.isArray(data.fields) || !Array.isArray(data.supporting) || data.id !== id || data.kind !== kind) throw new ReadFailure("LOAD_FAILED");
      if (!controller.signal.aborted) setDetail({key: detailKey, data});
    }).catch(err => {if (!controller.signal.aborted) setDetail({key: detailKey, code: failure(err)});});
    return () => controller.abort();
  }, [detailKey, kind, id, loading, permitted, online]);
  const change = (changes: Partial<HistoryInput>) => router.push(buildHistoryHref({...input, ...changes}), {scroll: false});
  const select = (item: HistoryItem) => router.push(buildHistoryHref(input, item.kind === kind && item.id === id ? undefined : item), {scroll: false});
  const reset = () => router.push(buildHistoryHref({category: "daily", ...historyPeriod()}), {scroll: false});
  const current = loaded?.key === key ? loaded : null, currentError = error?.key === key ? error.code : null;
  const page = current?.page, options = loaded?.page.options;
  const currentDetail = detail?.key === detailKey ? detail : null;
  const label = (group: "fields" | "codes" | "kinds" | "statuses" | "errors", name: string) => {
    const key = `${group}.${name}` as Parameters<typeof t>[0];
    return t.has(key) ? t(key) : t("unavailable");
  };
  const message = (code: string) => label("errors", knownErrors.has(code) ? code : "LOAD_FAILED");
  const display = (field: HistoryField) => {
    if (field.value === null || field.value === "") return t("unavailable");
    if (field.format === "date") return formatOperationDate(String(field.value), locale);
    if (field.format === "datetime") return formatOperationDateTime(String(field.value), locale);
    if (field.format === "money") return formatEtb(Number(field.value), locale);
    if (field.format === "number") return `${formatNumber(Number(field.value), locale)}${field.unit ? ` ${field.unit}` : ""}`;
    if (field.format === "code") return label("codes", String(field.value));
    return String(field.value);
  };
  const refreshButton = <button type="button" onClick={() => setRefresh(count => count + 1)} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-sand-300 bg-white px-4 font-semibold text-forest-900"><RefreshCw className="size-4" aria-hidden="true"/>{t("retry")}</button>;
  const fieldList = (fields: HistoryField[]) => <dl className="grid min-w-0 gap-x-6 gap-y-4 sm:grid-cols-2">{fields.map((field, index) => <div className="min-w-0" key={`${field.key}:${index}`}><dt className="text-base text-forest-600">{label("fields", field.key)}</dt><dd className="mt-1 whitespace-pre-wrap break-words font-semibold text-forest-900">{display(field)}</dd></div>)}</dl>;
  const details = () => !online ? <p role="status">{t("offline")}</p> : !currentDetail ? <p role="status">{t("loadingDetail")}</p> : currentDetail.code ? <div role="alert" className="space-y-3"><p>{message(currentDetail.code)}</p>{refreshButton}</div> : currentDetail.data ? <div className="space-y-5">
    <header><h2 className="font-display text-2xl font-semibold">{label("kinds", currentDetail.data.kind)}</h2><p className="mt-1">{formatOperationDate(currentDetail.data.date, locale)}</p><p className="mt-1 break-words text-forest-600">{currentDetail.data.context || t("organization")}</p></header>
    <p className="text-forest-700">{label("statuses", currentDetail.data.status)}</p>
    {["loss_record", "mortality_event"].includes(currentDetail.data.kind) ? <p className="border-l-2 border-forest-500 pl-3 text-forest-700">{t(currentDetail.data.kind === "loss_record" ? "officialLosses" : "supportingLosses")}</p> : null}
    {fieldList(currentDetail.data.fields)}
    {currentDetail.data.supporting.length ? <section className="space-y-4 border-t border-sand-200 pt-4"><h3 className="font-semibold">{t("supporting")}</h3>{currentDetail.data.supporting.map((item, index) => <div key={index} className="space-y-3 border-t border-sand-200 pt-3"><h4 className="font-semibold">{label("kinds", item.kind)}</h4>{fieldList(item.fields)}</div>)}</section> : null}
    {currentDetail.data.correctionHref && historyCorrectionHref(currentDetail.data.correctionHref, buildHistoryHref(input, {kind, id})) ? <Link className="inline-flex min-h-12 items-center rounded-lg border border-forest-700 px-4 font-semibold text-forest-900 underline-offset-4 hover:underline visited:text-forest-600" href={historyCorrectionHref(currentDetail.data.correctionHref, buildHistoryHref(input, {kind, id}))!}>{t("correct")}</Link> : <p className="border-t border-sand-200 pt-4 text-forest-600">{t("readOnly")}</p>}
  </div> : null;
  const filter = (name: "farm" | "house" | "flock" | "batch" | "warehouse", choices: HistoryOption[], changes: Partial<HistoryInput> = {}) => <label className="grid min-w-0 gap-2"><span className="font-semibold">{t(name)}</span><select className={control} value={input[name]} onChange={event => change({...changes, [name]: event.target.value})}><option value="">{t("all")}</option>{input[name] && !choices.some(option => option.id === input[name]) ? <option value={input[name]}>{t("selectedUnavailable")}</option> : null}{choices.map(option => <option value={option.id} key={option.id}>{option.name}</option>)}</select></label>;
  const subtypes = historySources.filter(source => source.category === input.category);
  const houses = (options?.houses ?? []).filter(row => !input.farm || row.farmId === input.farm);
  const flocks = (options?.flocks ?? []).filter(row => (!input.farm || row.farmId === input.farm) && (!input.house || row.houseId === input.house) && (!input.batch || row.batchId === input.batch));
  const batches = (options?.batches ?? []).filter(row => (!input.farm || row.farmId === input.farm) && (!input.house || row.houseId === input.house));
  const warehouses = (options?.warehouses ?? []).filter(row => !input.farm || !row.farmId || row.farmId === input.farm);
  const loadMore = async () => {
    if (!current?.page.nextCursor || moreBusy) return;
    const controller = new AbortController(); moreRequest.current = controller; setMoreBusy(true);
    try {
      const next = await read<HistoryPage>(`${request}&cursor=${encodeURIComponent(current.page.nextCursor)}`, controller.signal);
      if (!Array.isArray(next.items)) throw new ReadFailure("LOAD_FAILED");
      if (!controller.signal.aborted) setLoaded(previous => previous?.key === key ? {key, page: {...next, items: [...previous.page.items, ...next.items].filter((item, index, rows) => rows.findIndex(other => other.id === item.id && other.kind === item.kind) === index)}} : previous);
    } catch (err) {
      if (!controller.signal.aborted) {
        if (["ACCESS_DENIED", "SESSION_EXPIRED", "FEATURE_DISABLED"].includes(failure(err))) {setLoaded(null); setDetail(null); setError({key, code: failure(err)});}
        else setLoaded(previous => previous?.key === key ? {...previous, moreError: failure(err)} : previous);
      }
    } finally {setMoreBusy(false);}
  };
  if (loading) return <p role="status">{t("loading")}</p>;
  if (!permitted) return <p role="alert">{t(todayWorkspaceEnabled ? "errors.ACCESS_DENIED" : "errors.FEATURE_DISABLED")}</p>;
  return <section className="min-w-0 space-y-5 text-base text-forest-900" aria-label={t("title")}>
    <header className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="font-display text-3xl font-semibold">{t("title")}</h1><p className="mt-2 text-forest-600">{t("help")}</p></div><button className="min-h-12 rounded-lg border border-sand-300 bg-white px-4 font-semibold" type="button" onClick={reset}>{t("reset")}</button></header>
    <section aria-label={t("filters")} className="space-y-4 rounded-xl border border-sand-200 bg-white p-4 sm:p-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><label className="grid gap-2 font-semibold">{t("category")}<select className={control} value={input.category} onChange={event => change({category: event.target.value as HistoryCategory, subtype: "", warehouse: "", house: "", flock: "", batch: ""})}>{historyCategories.map(category => <option key={category} value={category}>{t(`categories.${category}`)}</option>)}</select></label>
      <div className="space-y-2 sm:col-span-1 lg:col-span-2"><p className="font-semibold">{t("period")}</p><div className="flex flex-wrap gap-2">{[7, 30, 90].map(days => {const range = historyPeriod(days); return <button key={days} type="button" aria-pressed={range.from === input.from && range.to === input.to} onClick={() => change(range)} className={`min-h-12 rounded-lg border px-4 font-semibold ${range.from === input.from && range.to === input.to ? "border-forest-900 bg-forest-900 text-white" : "border-sand-300 bg-white text-forest-900"}`}>{t("days", {days})}</button>;})}{refreshButton}</div></div>
      <label className="grid gap-2 font-semibold">{t("from")}<OperationDateInput className={control} value={input.from} max={input.to} onChange={event => change({from: event.target.value})}/></label><label className="grid gap-2 font-semibold">{t("to")}<OperationDateInput className={control} value={input.to} min={input.from} onChange={event => change({to: event.target.value})}/></label>
      {filter("farm", options?.farms ?? [], {house: "", flock: "", batch: "", warehouse: ""})}
      {input.category !== "closing" ? <>{filter("house", houses, {flock: "", batch: ""})}{filter("batch", batches, {flock: ""})}{filter("flock", flocks)}</> : null}
      {["stock", "expenses"].includes(input.category) ? filter("warehouse", warehouses) : null}
      {subtypes.length > 1 ? <label className="grid gap-2 font-semibold">{t("subtype")}<select className={control} value={input.subtype} onChange={event => change({subtype: event.target.value, ...(event.target.value === "physical_count" ? {house: "", flock: "", batch: ""} : {})})}><option value="">{t("all")}</option>{subtypes.map(source => <option key={source.kind} value={source.kind}>{label("kinds", source.kind)}</option>)}</select></label> : null}
      </div>
    </section>
    {!online ? <p role="status" className="rounded-xl border border-sand-300 bg-white p-5">{t("offline")}</p> : currentError ? <div role="alert" className="space-y-3 rounded-xl border border-ember-300 bg-white p-5"><p>{message(currentError)}</p>{currentError === "SESSION_EXPIRED" ? <Link href="/auth/sign-in" className="inline-flex min-h-12 items-center underline">{t("signIn")}</Link> : refreshButton}</div> : !page ? <p role="status">{t("loading")}</p> : <div className="min-w-0 space-y-5">
      <section className="min-w-0 overflow-hidden rounded-xl border border-sand-200 bg-white" aria-label={t("records")} aria-busy={moreBusy}>
        <header className="border-b border-sand-200 p-4"><h2 className="font-semibold">{t(`categories.${input.category}`)}</h2><p className="mt-1 text-forest-600" role="status">{t("showing", {count: page.items.length})}</p></header>
        {!page.items.length ? <div className="space-y-3 p-5"><p>{t("empty")}</p><button className="min-h-12 rounded-lg border border-sand-300 px-4 font-semibold" onClick={reset}>{t("reset")}</button></div> : page.items.map(item => <article className="border-b border-sand-200 last:border-0" key={`${item.kind}:${item.id}`}>
          <button className={`flex min-h-12 w-full items-start justify-between gap-3 p-4 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-forest-700 ${kind === item.kind && id === item.id ? "bg-sand-100" : "hover:bg-sand-50"}`} type="button" aria-expanded={kind === item.kind && id === item.id} aria-controls={kind === item.kind && id === item.id ? "history-selected-record" : undefined} onClick={() => select(item)}>
            <span className="min-w-0 space-y-2"><strong className="block">{formatOperationDate(item.date, locale)} · {label("kinds", item.kind)}</strong><span className="block break-words text-forest-600">{item.context || t("organization")}</span><span className="block text-forest-700">{item.summary.map(field => `${label("fields", field.key)}: ${display(field)}`).join(" · ")}</span><span className="block text-forest-600">{label("statuses", item.status)}</span><span className="block font-semibold underline underline-offset-4">{t("view")}</span></span>{kind === item.kind && id === item.id ? <ChevronDown aria-hidden="true" className="size-5 shrink-0"/> : <ChevronRight aria-hidden="true" className="size-5 shrink-0"/>}
          </button>{kind === item.kind && id === item.id ? <section id="history-selected-record" aria-label={t("detail")} className="border-t border-sand-200 p-4 sm:p-5">{details()}</section> : null}
        </article>)}
        {current?.moreError ? <p role="alert" className="p-4 text-ember-800">{message(current.moreError)}</p> : null}
        {page.nextCursor ? <button disabled={moreBusy} type="button" className="min-h-12 w-full p-4 font-semibold underline disabled:opacity-50" onClick={() => void loadMore()}>{t(moreBusy ? "loading" : current?.moreError ? "retryMore" : "more")}</button> : null}
      </section>
      {kind && id && !page.items.some(item => item.kind === kind && item.id === id) ? <section id="history-selected-record" className="rounded-xl border border-sand-200 bg-white p-4 sm:p-5" aria-label={t("detail")}>{details()}</section> : null}
    </div>}
  </section>;
}
