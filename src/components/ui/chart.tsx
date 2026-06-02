"use client";

import * as React from "react";
import { ResponsiveContainer, Tooltip as RechartsTooltip } from "recharts";

export type ChartConfig = Record<
  string,
  {
    label?: string;
    color?: string;
  }
>;

type ChartContextValue = {
  config: ChartConfig;
};

const ChartContext = React.createContext<ChartContextValue | null>(null);

function useChart() {
  const context = React.useContext(ChartContext);
  if (!context) throw new Error("Chart components must be used within ChartContainer");
  return context;
}

export function ChartContainer({
  config,
  className = "",
  children,
}: {
  config: ChartConfig;
  className?: string;
  children: React.ReactElement;
}) {
  const chartVars = Object.entries(config).reduce<React.CSSProperties & Record<string, string>>((vars, [key, item]) => {
    if (item.color) {
      vars[`--color-${key}`] = item.color;
    }
    return vars;
  }, {});

  return (
    <ChartContext.Provider value={{ config }}>
      <div className={className} style={chartVars}>
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  );
}

type TooltipPayload = {
  color?: string;
  dataKey?: string | number;
  name?: string | number;
  value?: string | number;
};

export const ChartTooltip = RechartsTooltip;

export function ChartTooltipContent({
  active,
  payload,
  label,
  indicator = "dot",
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string | number;
  indicator?: "dot" | "line";
}) {
  const { config } = useChart();

  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-xl border border-sand-200 bg-white px-3 py-2 text-xs shadow-lg">
      {label ? <p className="mb-2 font-medium text-forest-900">{label}</p> : null}
      <div className="space-y-1.5">
        {payload.map((item) => {
          const key = String(item.dataKey ?? item.name ?? "");
          const name = config[key]?.label ?? item.name ?? key;
          return (
            <div key={key} className="flex min-w-[150px] items-center justify-between gap-4 text-forest-700">
              <span className="flex items-center gap-2">
                <span
                  className={indicator === "line" ? "h-0.5 w-4 rounded-full" : "h-2.5 w-2.5 rounded-full"}
                  style={{ backgroundColor: item.color ?? config[key]?.color ?? "var(--forest-500)" }}
                />
                {name}
              </span>
              <span className="font-medium text-forest-900">{item.value}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
