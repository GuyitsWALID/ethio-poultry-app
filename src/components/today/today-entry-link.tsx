"use client";

import Link from "next/link";
import {useSearchParams} from "next/navigation";

import {useFarmScope} from "@/components/farm-scope-context";
import type {TodayTaskCode} from "@/lib/today-workspace/contracts";
import {buildTodayEntryHref, isLegacyCorrectionTarget, type TodayEntryTarget} from "@/lib/today-workspace/entry-routing";

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
  const query = useSearchParams();
  const enabled = scope.isFarmManager && scope.todayWorkspaceEnabled && !isLegacyCorrectionTarget(query);
  const todayHref = (task: TodayTaskCode, target?: TodayEntryTarget) => buildTodayEntryHref(task, target ?? {}, scope.scope, scope.flocks, scope.houses, addisToday());
  return {enabled, todayHref};
}

export function TodayEntryLink({
  task,
  target,
  className,
  children,
}: {
  task: TodayTaskCode;
  target?: TodayEntryTarget;
  className?: string;
  children: React.ReactNode;
}) {
  const {todayHref} = useTodayEntryMode();
  return <Link href={todayHref(task, target)} className={className}>{children}</Link>;
}
