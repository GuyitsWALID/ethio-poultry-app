"use client";

import { useFarmScope } from "@/components/farm-scope-context";
import { useCallback } from "react";

export function ResetPageFilters() {
  const { resetFilters } = useFarmScope();
  return <button type="button" onClick={resetFilters} className="min-h-11 rounded-xl border border-sand-300 bg-white px-4 text-sm font-semibold text-forest-900 hover:bg-sand-50">Reset filters</button>;
}

export function PageSelectFilter({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }> }) {
  return <label className="grid min-w-0 gap-1 text-xs font-semibold text-forest-700">{label}<select value={value} onChange={event => onChange(event.target.value)} className="min-h-11 min-w-0 rounded-xl border border-sand-300 bg-white px-3 text-sm font-normal text-forest-900"><option value="">All {label.toLowerCase()}</option>{options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
}

export function usePageFilter<T extends string = string>(name: string, defaultValue: T) {
  const { filterValues, setFilterValue } = useFarmScope();
  const setValue = useCallback((value: T) => setFilterValue(`page_${name}`, value), [name, setFilterValue]);
  return [filterValues[`page_${name}`] as T ?? defaultValue, setValue] as const;
}
