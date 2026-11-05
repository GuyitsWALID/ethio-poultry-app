import {Fragment} from "react";

// Values are already label-sanitized by the authorized Governance module.
// Render nested placements/dispositions instead of coercing objects to text.
export function GovernanceStructuredValue({value}: {value: unknown}) {
  if (value === null || value === undefined || value === "") return <span>—</span>;
  if (Array.isArray(value)) return <ol className="space-y-3">{value.map((item, index) => <li key={index} className="rounded-lg border border-sand-200 p-3"><GovernanceStructuredValue value={item}/></li>)}</ol>;
  if (typeof value === "object") return <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-[minmax(8rem,1fr)_2fr]">{Object.entries(value).map(([key, item]) => <Fragment key={key}><dt className="text-forest-600">{key}</dt><dd className="min-w-0 break-words font-medium text-forest-950"><GovernanceStructuredValue value={item}/></dd></Fragment>)}</dl>;
  return <span>{typeof value === "boolean" ? (value ? "✓" : "—") : String(value)}</span>;
}
