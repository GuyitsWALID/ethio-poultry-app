"use client";

import {useEffect, useRef, useState, type ChangeEvent, type InputHTMLAttributes} from "react";
import {useLocale, useTranslations} from "next-intl";
import {ethiopianMonthDays, ethiopianMonthNames, isDateInRange, toEthiopianDate, toGregorianDate} from "@/i18n/ethiopian-calendar";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "defaultValue"> & {value?: string; defaultValue?: string};
type Draft = {base: string; year: string; month: string; day: string};
const months = ethiopianMonthNames();

export function OperationDateInput({value, defaultValue, onChange, className, min, max, name, id, required, disabled, readOnly, ...props}: Props) {
  const locale = useLocale();
  const t = useTranslations("Calendar");
  const [localValue, setLocalValue] = useState(defaultValue ?? "");
  const canonical = value ?? localValue;
  const [draft, setDraft] = useState<Draft | null>(null);
  const canonicalInput = useRef<HTMLInputElement>(null);
  const yearInput = useRef<HTMLSelectElement>(null);
  const converted = toEthiopianDate(canonical);
  const active = draft?.base === canonical ? draft : {
    base: canonical, year: converted ? String(converted.year) : "",
    month: converted ? String(converted.month) : "", day: converted ? String(converted.day) : "",
  };
  const iso = active.year && active.month && active.day ? toGregorianDate({year: Number(active.year), month: Number(active.month), day: Number(active.day)}) : null;
  const hasDraft = Boolean(active.year || active.month || active.day);
  const error = hasDraft && (!iso || !isDateInRange(iso, min === undefined ? undefined : String(min), max === undefined ? undefined : String(max))) ? t("invalid") : "";
  useEffect(() => {yearInput.current?.setCustomValidity(error);}, [error]);

  if (locale !== "am") return <input {...props} id={id} name={name} type="date" value={canonical} min={min} max={max} required={required} disabled={disabled} readOnly={readOnly} className={className} onChange={(event) => {setLocalValue(event.target.value); setDraft(null); onChange?.(event);}}/>;

  const now = toEthiopianDate(new Date().toISOString().slice(0, 10))!;
  const minYear = toEthiopianDate(String(min ?? ""))?.year ?? Math.min(now.year - 100, converted?.year ?? now.year);
  const maxYear = toEthiopianDate(String(max ?? ""))?.year ?? Math.max(now.year + 20, converted?.year ?? now.year);
  const days = ethiopianMonthDays(Number(active.year) || now.year, Number(active.month) || 1);
  const update = (field: "year" | "month" | "day", event: ChangeEvent<HTMLSelectElement>) => {
    const next = {...active, [field]: event.target.value};
    const nextIso = next.year && next.month && next.day ? toGregorianDate({year: Number(next.year), month: Number(next.month), day: Number(next.day)}) : null;
    setDraft({...next, base: canonical});
    if (nextIso && isDateInRange(nextIso, min === undefined ? undefined : String(min), max === undefined ? undefined : String(max))) {
      setLocalValue(nextIso);
      setDraft({...next, base: nextIso});
      if (canonicalInput.current) {
        canonicalInput.current.value = nextIso;
        onChange?.({...event, target: canonicalInput.current, currentTarget: canonicalInput.current} as unknown as ChangeEvent<HTMLInputElement>);
      }
    } else if (!next.year && !next.month && !next.day) {
      setLocalValue(""); setDraft(null);
      if (canonicalInput.current) {canonicalInput.current.value = ""; onChange?.({...event, target: canonicalInput.current, currentTarget: canonicalInput.current} as unknown as ChangeEvent<HTMLInputElement>);}
    }
  };
  const controlClass = `${className ?? "rounded-xl border border-sand-300 px-2"} min-h-11 min-w-0 w-full`;
  const locked = disabled || readOnly;
  return <span role="group" aria-label={props["aria-label"] ?? t("ethiopian")} className="grid min-w-0 gap-1">
    <input ref={canonicalInput} type="hidden" name={name} value={error ? "" : iso ?? ""} disabled={disabled}/>
    <span className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_minmax(0,1fr)] gap-1">
      <select id={id} aria-label={t("day")} aria-invalid={Boolean(error)} required={required} disabled={locked} value={active.day} onChange={(event) => update("day", event)} className={controlClass}><option value="">{t("day")}</option>{Array.from({length: Math.max(days, Number(active.day) || 0)}, (_, index) => <option key={index + 1} value={index + 1} disabled={index + 1 > days}>{index + 1}</option>)}</select>
      <select aria-label={t("month")} required={required} disabled={locked} value={active.month} onChange={(event) => update("month", event)} className={controlClass}><option value="">{t("month")}</option>{months.map((month, index) => <option key={index + 1} value={index + 1}>{month}</option>)}</select>
      <select ref={yearInput} aria-label={t("year")} aria-invalid={Boolean(error)} required={required} disabled={locked} value={active.year} onChange={(event) => update("year", event)} className={controlClass}><option value="">{t("year")}</option>{Array.from({length: Math.max(0, maxYear - minYear + 1)}, (_, index) => <option key={minYear + index} value={minYear + index}>{minYear + index}</option>)}</select>
    </span>
    <small className={error ? "text-red-700" : "text-forest-500"} aria-live="polite">{error || t("ethiopian")}</small>
  </span>;
}
