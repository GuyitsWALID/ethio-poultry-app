"use client";

import Link from "next/link";

import {useFarmScope} from "@/components/farm-scope-context";
import type {TodayTaskCode} from "@/lib/today-workspace/contracts";

function addisToday() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Addis_Ababa",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function useTodayEntryMode() {
  const scope = useFarmScope();
  const enabled = scope.isFarmManager && scope.todayWorkspaceEnabled;
  const todayHref = (task: TodayTaskCode, target?: {farmId?: string; houseId?: string; flockId?: string; date?: string}) => {
    const query = new URLSearchParams({task, date: target?.date ?? addisToday()});
    const farmId = target?.farmId ?? scope.scope.farmId;
    const houseId = target?.houseId ?? scope.scope.houseId;
    const flockId = target?.flockId ?? scope.scope.flockId;
    if (farmId) query.set("farm_id", farmId);
    if (houseId) query.set("house_id", houseId);
    if (flockId) query.set("flock_id", flockId);
    return `/app/today?${query.toString()}`;
  };
  return {enabled, todayHref};
}

export function TodayEntryLink({
  task,
  target,
  className,
  children,
}: {
  task: TodayTaskCode;
  target?: {farmId?: string; houseId?: string; flockId?: string; date?: string};
  className?: string;
  children: React.ReactNode;
}) {
  const {todayHref} = useTodayEntryMode();
  return <Link href={todayHref(task, target)} className={className}>{children}</Link>;
}
