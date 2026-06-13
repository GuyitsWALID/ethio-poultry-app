"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  CalendarCheck,
  CheckCircle2,
  FileUp,
  Gauge,
  LineChart as LineChartIcon,
  Plus,
  Save,
  Scale,
  Upload,
} from "lucide-react";
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { useFarmScope } from "@/components/farm-scope-context";
import { createClient } from "@/utils/supabase/client";

type TemplateSource = "default" | "manual" | "upload";
type WeightStatus = "On track" | "Below target" | "Above target" | "Missing" | "Pending";

type BatchMeta = {
  id: string;
  batch_code: string;
  placement_date: string;
  age_at_placement_days: number | null;
  total_count: number;
};

type FlockRow = {
  id: string;
  flock_code: string;
  initial_count: number;
  current_count: number;
  placement_date: string;
  batch_id: string | null;
};

type FeedTemplate = {
  id: string;
  batch_id: string;
  name: string;
  source_type: TemplateSource;
  is_active: boolean;
};

type TemplateRow = {
  id?: string;
  client_id: string;
  week_number: number;
  age_day_start: number;
  age_day_end: number;
  feed_intake_std_g_per_head: number | null;
  feed_intake_recommended_g_per_head: number | null;
  target_weight_min_g: number | null;
  target_weight_max_g: number | null;
  feed_type_plan: string;
  light_on_time: string;
  light_off_time: string;
  row_order: number;
};

type MilestoneRow = {
  id: string;
  week_number: number | null;
  trigger_day: number;
  title: string;
  category: "feed" | "weight" | "vaccine" | "light" | "note";
  notes: string | null;
  is_required: boolean;
};

type DailyRecord = {
  record_date: string;
  flock_id: string;
  feed_intake_grams: number | null;
  deaths: number | null;
};

type WeightRecord = {
  id: string;
  flock_id: string;
  record_date: string;
  sample_count: number | null;
  average_weight_g: number | null;
  min_weight_g: number | null;
  max_weight_g: number | null;
  uniformity_pct: number | null;
};

type WeightTask = {
  id: string;
  flock_id: string;
  template_row_id: string | null;
  due_week_number: number;
  due_date: string;
  status: "scheduled" | "completed" | "missed";
  weight_record_id: string | null;
};

type ChartPoint = {
  week: number;
  targetMin: number | null;
  targetMax: number | null;
  actualWeight: number | null;
  weightStatus: WeightStatus;
  actualFeed: number | null;
  targetFeed: number | null;
};

const inputClass = "h-10 w-full rounded-lg border border-sand-200 bg-white px-3 text-sm text-forest-900";

const defaultPulletRows: TemplateRow[] = [
  [8, 49, 56, 51, 55, 514, 546, "Pullet", "11:00", "1:00"],
  [9, 57, 63, 55, 60, 602, 638, "Pullet", "11:00", "1:00"],
  [10, 64, 70, 59, 65, 690, 630, "Pullet", "11:00", "1:00"],
  [11, 71, 77, 62, 67, 723, 778, "Pullet", "11:00", "1:00"],
  [12, 78, 84, 65, 70, 875, 925, "Pullet", "11:00", "1:00"],
  [13, 85, 91, 68, 73, 968, 1022, "Pullet", "11:00", "1:00"],
  [14, 92, 98, 71, 75, 1051, 1110, "Pullet", "11:00", "1:00"],
  [15, 99, 105, 74, 80, 1133, 1197, "Pullet", "11:00", "1:00"],
  [16, 106, 112, 77, 83, 1216, 1284, "Pullet", "11:00", "1:00"],
  [17, 113, 119, 82, 87, 1289, 1361, "Pullet", "11:00", "1:00"],
  [18, 120, 126, 87, 90, 1363, 1438, "Pullet", "11:00", "1:00"],
  [19, 127, 133, 90, 95, 1460, 1460, "Pullet", "11:00", "1:00"],
  [20, 134, 140, 100, 105, 1510, 1510, "75% pullet + 25% layer", "11:00", "2:00"],
  [21, 141, 147, 107, 107, 1565, 1565, "50% pullet + 50% layer", "11:00", "3:00"],
  [22, 142, 148, 110, 110, 1610, 1610, "25% pullet + 75% layer", "11:00", "4:00"],
  [23, 143, 149, 115, 115, 1640, 1640, "Layer", "11:00", "4:00"],
  [24, 150, 156, 120, 120, 1660, 1660, "Layer", "11:00", "4:00"],
].map(([week, start, end, std, rec, min, max, feed, on, off], index) => {
  const minWeight = Number(min);
  const maxWeight = Number(max);
  return {
    client_id: `default-${week}`,
    week_number: Number(week),
    age_day_start: Number(start),
    age_day_end: Number(end),
    feed_intake_std_g_per_head: Number(std),
    feed_intake_recommended_g_per_head: Number(rec),
    target_weight_min_g: Math.min(minWeight, maxWeight),
    target_weight_max_g: Math.max(minWeight, maxWeight),
    feed_type_plan: String(feed),
    light_on_time: normalizeTime(String(on)),
    light_off_time: normalizeTime(String(off)),
    row_order: index,
  };
});

function normalizeTime(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const [hourRaw, minuteRaw = "00"] = trimmed.split(":");
  const hour = hourRaw.padStart(2, "0");
  const minute = minuteRaw.padStart(2, "0");
  return `${hour}:${minute}`;
}

function parseNumeric(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toDate(value: string) {
  return new Date(`${value}T00:00:00`);
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date: string, days: number) {
  const next = toDate(date);
  next.setDate(next.getDate() + days);
  return isoDate(next);
}

function daysBetween(start: string, end: string) {
  const ms = toDate(end).getTime() - toDate(start).getTime();
  return Math.floor(ms / 86_400_000);
}

function rowForAge(rows: TemplateRow[], ageDays: number) {
  return rows.find((row) => ageDays >= row.age_day_start && ageDays <= row.age_day_end)
    ?? rows.find((row) => row.week_number === Math.floor(ageDays / 7))
    ?? null;
}

function statusForWeight(actual: number | null, row: TemplateRow | null): WeightStatus {
  if (actual === null) return "Pending";
  if (!row || row.target_weight_min_g === null || row.target_weight_max_g === null) return "Pending";
  if (actual < row.target_weight_min_g) return "Below target";
  if (actual > row.target_weight_max_g) return "Above target";
  return "On track";
}

function statusClass(status: WeightStatus) {
  if (status === "On track") return "bg-leaf-500/10 text-leaf-700";
  if (status === "Below target") return "bg-ember-500/10 text-ember-600";
  if (status === "Above target") return "bg-amber-500/10 text-amber-700";
  if (status === "Missing") return "bg-ember-500/10 text-ember-600";
  return "bg-sand-100 text-forest-600";
}

export default function FeedPage() {
  const { scope, setScope, role, filteredBatches } = useFarmScope();
  const [orgId, setOrgId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [batch, setBatch] = useState<BatchMeta | null>(null);
  const [flocks, setFlocks] = useState<FlockRow[]>([]);
  const [template, setTemplate] = useState<FeedTemplate | null>(null);
  const [templateRows, setTemplateRows] = useState<TemplateRow[]>([]);
  const [milestones, setMilestones] = useState<MilestoneRow[]>([]);
  const [dailyRecords, setDailyRecords] = useState<DailyRecord[]>([]);
  const [weightRecords, setWeightRecords] = useState<WeightRecord[]>([]);
  const [weightTasks, setWeightTasks] = useState<WeightTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorSource, setEditorSource] = useState<TemplateSource>("manual");
  const [editorRows, setEditorRows] = useState<TemplateRow[]>([]);
  const [templateName, setTemplateName] = useState("Pullet feed template");
  const [uploading, setUploading] = useState(false);

  const canManage = role === "farm_manager" || role === "ceo" || role === "system_admin" || role === "super_admin";

  const selectedBatchId = scope.batchId;

  useEffect(() => {
    if (!scope.batchId && filteredBatches.length > 0) {
      setScope((prev) => ({ ...prev, batchId: filteredBatches[0].id }));
    }
  }, [filteredBatches, scope.batchId, setScope]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const db = supabase as any;
    const contextResponse = await fetch("/api/me/context");
    if (!contextResponse.ok) {
      setLoading(false);
      setError("Unable to load organization context.");
      return;
    }
    const context = await contextResponse.json();
    const nextOrgId = context?.orgId as string | null;
    const nextUserId = context?.userId as string | null;
    setOrgId(nextOrgId);
    setUserId(nextUserId);

    if (!nextOrgId || !selectedBatchId) {
      setBatch(null);
      setFlocks([]);
      setTemplate(null);
      setTemplateRows([]);
      setMilestones([]);
      setDailyRecords([]);
      setWeightRecords([]);
      setWeightTasks([]);
      setLoading(false);
      return;
    }

    const { data: selectedBatch, error: batchError } = await supabase
      .from("batches")
      .select("id, batch_code, placement_date, age_at_placement_days, total_count")
      .eq("id", selectedBatchId)
      .eq("org_id", nextOrgId)
      .maybeSingle();

    if (batchError || !selectedBatch) {
      setError(batchError?.message ?? "Selected batch was not found.");
      setLoading(false);
      return;
    }

    const { data: linkedFlockRows } = await supabase
      .from("flocks")
      .select("id")
      .eq("org_id", nextOrgId)
      .eq("batch_id", selectedBatchId);

    const flockIds = ((linkedFlockRows ?? []) as Array<{ id: string }>).map((row) => row.id);

    const [
      flocksRes,
      templateRes,
      dailyRes,
      weightsRes,
      tasksRes,
    ] = await Promise.all([
      flockIds.length
        ? supabase.from("flocks").select("id, flock_code, initial_count, current_count, placement_date, batch_id").eq("org_id", nextOrgId).in("id", flockIds)
        : Promise.resolve({ data: [] }),
      db.from("batch_feed_templates").select("id, batch_id, name, source_type, is_active").eq("org_id", nextOrgId).eq("batch_id", selectedBatchId).eq("is_active", true).maybeSingle(),
      flockIds.length
        ? supabase
            .from("daily_farm_records")
            .select("record_date, flock_id, feed_intake_grams, deaths")
            .eq("org_id", nextOrgId)
            .in("flock_id", flockIds)
            .order("record_date", { ascending: true })
        : Promise.resolve({ data: [] }),
      flockIds.length
        ? supabase
            .from("weight_records")
            .select("id, flock_id, record_date, sample_count, average_weight_g, min_weight_g, max_weight_g, uniformity_pct")
            .eq("org_id", nextOrgId)
            .in("flock_id", flockIds)
            .order("record_date", { ascending: true })
        : Promise.resolve({ data: [] }),
      db
        .from("batch_weight_check_tasks")
        .select("id, flock_id, template_row_id, due_week_number, due_date, status, weight_record_id")
        .eq("org_id", nextOrgId)
        .eq("batch_id", selectedBatchId)
        .order("due_date", { ascending: true }),
    ]);

    const activeTemplate = templateRes.data as FeedTemplate | null;
    let nextRows: TemplateRow[] = [];
    let nextMilestones: MilestoneRow[] = [];
    if (activeTemplate) {
      const [{ data: rowsData }, { data: milestoneData }] = await Promise.all([
        db
          .from("batch_feed_template_rows")
          .select("id, week_number, age_day_start, age_day_end, feed_intake_std_g_per_head, feed_intake_recommended_g_per_head, target_weight_min_g, target_weight_max_g, feed_type_plan, light_on_time, light_off_time, row_order")
          .eq("template_id", activeTemplate.id)
          .order("row_order", { ascending: true }),
        db
          .from("batch_feed_template_milestones")
          .select("id, week_number, trigger_day, title, category, notes, is_required")
          .eq("template_id", activeTemplate.id)
          .order("trigger_day", { ascending: true }),
      ]);

      nextRows = ((rowsData ?? []) as any[]).map((row, index) => ({
        ...row,
        client_id: row.id ?? `saved-${index}`,
        light_on_time: row.light_on_time?.slice(0, 5) ?? "",
        light_off_time: row.light_off_time?.slice(0, 5) ?? "",
      }));
      nextMilestones = (milestoneData ?? []) as MilestoneRow[];
    }

    setBatch(selectedBatch as BatchMeta);
    setFlocks((flocksRes.data ?? []) as FlockRow[]);
    setTemplate(activeTemplate);
    setTemplateRows(nextRows);
    setMilestones(nextMilestones);
    setDailyRecords((dailyRes.data ?? []) as DailyRecord[]);
    setWeightRecords((weightsRes.data ?? []) as WeightRecord[]);
    setWeightTasks((tasksRes.data ?? []) as WeightTask[]);
    setLoading(false);
  }, [selectedBatchId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, [loadData]);

  const batchAgeDays = useMemo(() => {
    if (!batch) return null;
    return daysBetween(batch.placement_date, isoDate(new Date())) + (batch.age_at_placement_days ?? 0);
  }, [batch]);

  const currentTemplateRow = useMemo(
    () => (batchAgeDays === null ? null : rowForAge(templateRows, batchAgeDays)),
    [batchAgeDays, templateRows]
  );

  const totalInitialBirds = useMemo(
    () => flocks.reduce((sum, flock) => sum + (flock.initial_count ?? 0), 0),
    [flocks]
  );

  const totalCurrentBirds = useMemo(
    () => flocks.reduce((sum, flock) => sum + (flock.current_count ?? 0), 0),
    [flocks]
  );

  const cumulativeMortality = useMemo(
    () => dailyRecords.reduce((sum, record) => sum + (record.deaths ?? 0), 0),
    [dailyRecords]
  );

  const mortalityAdjustedLiveBirds = Math.max(totalInitialBirds - cumulativeMortality, 0);

  const dailyFeedByWeek = useMemo(() => {
    if (!batch || totalInitialBirds <= 0) return new Map<number, number>();
    const byDate = new Map<string, { feed: number; deaths: number }>();
    dailyRecords.forEach((record) => {
      const current = byDate.get(record.record_date) ?? { feed: 0, deaths: 0 };
      current.feed += record.feed_intake_grams ?? 0;
      current.deaths += record.deaths ?? 0;
      byDate.set(record.record_date, current);
    });

    let deathsRunning = 0;
    const weekValues = new Map<number, { total: number; count: number }>();
    Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([date, value]) => {
        deathsRunning += value.deaths;
        const liveBirds = Math.max(totalInitialBirds - deathsRunning, 1);
        const ageDays = daysBetween(batch.placement_date, date) + (batch.age_at_placement_days ?? 0);
        const week = Math.floor(ageDays / 7);
        const perBird = value.feed / liveBirds;
        const current = weekValues.get(week) ?? { total: 0, count: 0 };
        current.total += perBird;
        current.count += 1;
        weekValues.set(week, current);
      });

    const result = new Map<number, number>();
    weekValues.forEach((value, week) => {
      result.set(week, Number((value.total / value.count).toFixed(2)));
    });
    return result;
  }, [batch, dailyRecords, totalInitialBirds]);

  const weightByWeek = useMemo(() => {
    if (!batch) return new Map<number, number>();
    const values = new Map<number, { total: number; count: number }>();
    weightRecords.forEach((record) => {
      if (record.average_weight_g === null) return;
      const ageDays = daysBetween(batch.placement_date, record.record_date) + (batch.age_at_placement_days ?? 0);
      const week = Math.floor(ageDays / 7);
      const current = values.get(week) ?? { total: 0, count: 0 };
      current.total += record.average_weight_g;
      current.count += 1;
      values.set(week, current);
    });

    const result = new Map<number, number>();
    values.forEach((value, week) => result.set(week, Number((value.total / value.count).toFixed(2))));
    return result;
  }, [batch, weightRecords]);

  const chartData = useMemo<ChartPoint[]>(() => {
    return templateRows.map((row) => {
      const actualWeight = weightByWeek.get(row.week_number) ?? null;
      return {
        week: row.week_number,
        targetMin: row.target_weight_min_g,
        targetMax: row.target_weight_max_g,
        actualWeight,
        weightStatus: statusForWeight(actualWeight, row),
        actualFeed: dailyFeedByWeek.get(row.week_number) ?? null,
        targetFeed: row.feed_intake_recommended_g_per_head,
      };
    });
  }, [dailyFeedByWeek, templateRows, weightByWeek]);

  const latestWeight = useMemo(() => {
    return [...weightRecords]
      .filter((record) => record.average_weight_g !== null)
      .sort((a, b) => b.record_date.localeCompare(a.record_date))[0] ?? null;
  }, [weightRecords]);

  const latestWeightStatus = statusForWeight(latestWeight?.average_weight_g ?? null, currentTemplateRow);

  const feedCompliance = useMemo(() => {
    if (!currentTemplateRow?.feed_intake_recommended_g_per_head || batchAgeDays === null) return null;
    const actual = dailyFeedByWeek.get(Math.floor(batchAgeDays / 7));
    if (actual === undefined) return null;
    return Number(((actual / currentTemplateRow.feed_intake_recommended_g_per_head) * 100).toFixed(1));
  }, [batchAgeDays, currentTemplateRow, dailyFeedByWeek]);

  const fcr = useMemo(() => {
    const ordered = [...weightRecords]
      .filter((record) => record.average_weight_g !== null)
      .sort((a, b) => a.record_date.localeCompare(b.record_date));
    if (ordered.length < 2 || totalCurrentBirds <= 0) return null;
    const first = ordered[0].average_weight_g ?? 0;
    const last = ordered[ordered.length - 1].average_weight_g ?? 0;
    const gainKg = ((last - first) * totalCurrentBirds) / 1000;
    const feedKg = dailyRecords.reduce((sum, record) => sum + (record.feed_intake_grams ?? 0) / 1000, 0);
    return gainKg > 0 ? Number((feedKg / gainKg).toFixed(2)) : null;
  }, [dailyRecords, totalCurrentBirds, weightRecords]);

  const nextTask = useMemo(() => {
    const today = isoDate(new Date());
    return weightTasks.find((task) => task.status !== "completed" && task.due_date >= today)
      ?? weightTasks.find((task) => task.status !== "completed")
      ?? null;
  }, [weightTasks]);

  const timeline = useMemo(() => {
    if (!batch) return [];
    const today = isoDate(new Date());
    const taskItems = weightTasks.map((task) => ({
      id: `task-${task.id}`,
      date: task.due_date,
      title: `Week ${task.due_week_number} weigh-in`,
      category: "weight",
      status: task.status === "completed" ? "completed" : task.due_date < today ? "missed" : "upcoming",
    }));
    const milestoneItems = milestones.map((milestone) => {
      const date = addDays(batch.placement_date, milestone.trigger_day - (batch.age_at_placement_days ?? 0));
      return {
        id: `milestone-${milestone.id}`,
        date,
        title: milestone.title,
        category: milestone.category,
        status: date < today ? "completed" : "upcoming",
      };
    });
    return [...taskItems, ...milestoneItems].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 18);
  }, [batch, milestones, weightTasks]);

  const openEditor = (source: TemplateSource) => {
    setEditorSource(source);
    setTemplateName(source === "default" ? "Default pullet template" : source === "upload" ? "Uploaded feed template" : "Manual feed template");
    setEditorRows(source === "default" ? defaultPulletRows.map((row) => ({ ...row, client_id: `${row.client_id}-${Date.now()}` })) : [{
      client_id: `manual-${Date.now()}`,
      week_number: 0,
      age_day_start: 0,
      age_day_end: 6,
      feed_intake_std_g_per_head: null,
      feed_intake_recommended_g_per_head: null,
      target_weight_min_g: null,
      target_weight_max_g: null,
      feed_type_plan: "",
      light_on_time: "",
      light_off_time: "",
      row_order: 0,
    }]);
    setEditorOpen(true);
  };

  const updateEditorRow = (clientId: string, key: keyof TemplateRow, value: string) => {
    setEditorRows((rows) =>
      rows.map((row) => {
        if (row.client_id !== clientId) return row;
        if (key === "feed_type_plan" || key === "light_on_time" || key === "light_off_time") return { ...row, [key]: value };
        return { ...row, [key]: parseNumeric(value) ?? 0 };
      })
    );
  };

  const addEditorRow = () => {
    setEditorRows((rows) => {
      const last = rows[rows.length - 1];
      const nextWeek = (last?.week_number ?? 0) + 1;
      const start = (last?.age_day_end ?? -1) + 1;
      return [
        ...rows,
        {
          client_id: `row-${Date.now()}`,
          week_number: nextWeek,
          age_day_start: start,
          age_day_end: start + 6,
          feed_intake_std_g_per_head: null,
          feed_intake_recommended_g_per_head: null,
          target_weight_min_g: null,
          target_weight_max_g: null,
          feed_type_plan: last?.feed_type_plan ?? "",
          light_on_time: last?.light_on_time ?? "",
          light_off_time: last?.light_off_time ?? "",
          row_order: rows.length,
        },
      ];
    });
  };

  const saveTemplate = async () => {
    if (!orgId || !userId || !batch) return;
    setError(null);
    setMessage(null);
    const supabase = createClient();
    const db = supabase as any;
    await db.from("batch_feed_templates").update({ is_active: false }).eq("org_id", orgId).eq("batch_id", batch.id).eq("is_active", true);
    const { data: insertedTemplate, error: templateError } = await db
      .from("batch_feed_templates")
      .insert({
        org_id: orgId,
        batch_id: batch.id,
        name: templateName.trim() || "Batch feed template",
        source_type: editorSource,
        is_active: true,
        created_by: userId,
      })
      .select("id")
      .single();

    if (templateError || !insertedTemplate?.id) {
      setError(templateError?.message ?? "Failed to save feed template.");
      return;
    }

    const rowsPayload = editorRows.map((row, index) => ({
      template_id: insertedTemplate.id,
      week_number: row.week_number,
      age_day_start: row.age_day_start,
      age_day_end: row.age_day_end,
      feed_intake_std_g_per_head: row.feed_intake_std_g_per_head,
      feed_intake_recommended_g_per_head: row.feed_intake_recommended_g_per_head,
      target_weight_min_g: row.target_weight_min_g,
      target_weight_max_g: row.target_weight_max_g,
      feed_type_plan: row.feed_type_plan || null,
      light_on_time: row.light_on_time || null,
      light_off_time: row.light_off_time || null,
      row_order: index,
    }));
    const { data: insertedRows, error: rowsError } = await db
      .from("batch_feed_template_rows")
      .insert(rowsPayload)
      .select("id, week_number, age_day_start, feed_type_plan, light_on_time, light_off_time");

    if (rowsError) {
      setError(rowsError.message);
      return;
    }

    const milestonePayload = (insertedRows ?? [])
      .filter((row: any, index: number, all: any[]) => {
        const prev = all[index - 1];
        return index === 0 || row.feed_type_plan !== prev?.feed_type_plan || row.light_off_time !== prev?.light_off_time;
      })
      .map((row: any) => ({
        template_id: insertedTemplate.id,
        week_number: row.week_number,
        trigger_day: row.age_day_start,
        title: row.feed_type_plan ? `Switch feed plan to ${row.feed_type_plan}` : `Week ${row.week_number} feed milestone`,
        category: "feed",
        notes: row.light_on_time && row.light_off_time ? `Lighting ${row.light_on_time}-${row.light_off_time}` : null,
        is_required: true,
      }));
    if (milestonePayload.length > 0) await db.from("batch_feed_template_milestones").insert(milestonePayload);

    const weightRows = (insertedRows ?? []).filter((row: any) => row.week_number % 2 === 0);
    const taskPayload = flocks.flatMap((flock) =>
      weightRows.map((row: any) => ({
        org_id: orgId,
        batch_id: batch.id,
        flock_id: flock.id,
        template_row_id: row.id,
        due_week_number: row.week_number,
        due_date: addDays(batch.placement_date, (row.week_number * 7) - (batch.age_at_placement_days ?? 0)),
        status: "scheduled",
        created_by: userId,
      }))
    );
    if (taskPayload.length > 0) {
      await db.from("batch_weight_check_tasks").upsert(taskPayload, { onConflict: "org_id,batch_id,flock_id,due_week_number" });
    }

    setMessage("Batch feed template saved and weight checks scheduled.");
    setEditorOpen(false);
    await loadData();
  };

  const importTemplate = async (file: File) => {
    setUploading(true);
    setError(null);
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch("/api/feed-template/import", { method: "POST", body: formData });
    const data = await response.json();
    setUploading(false);
    if (!response.ok) {
      setError(data?.error ?? "Template extraction failed. You can still enter it manually.");
      return;
    }
    const rows = (data?.rows ?? []) as Partial<TemplateRow>[];
    if (rows.length === 0) {
      setError("No rows were extracted. Try a clearer file or create the template manually.");
      return;
    }
    setEditorSource("upload");
    setTemplateName(file.name.replace(/\.[^.]+$/, "") || "Uploaded feed template");
    setEditorRows(rows.map((row, index) => ({
      client_id: `upload-${index}-${Date.now()}`,
      week_number: Number(row.week_number ?? 0),
      age_day_start: Number(row.age_day_start ?? 0),
      age_day_end: Number(row.age_day_end ?? 0),
      feed_intake_std_g_per_head: parseNumeric(row.feed_intake_std_g_per_head),
      feed_intake_recommended_g_per_head: parseNumeric(row.feed_intake_recommended_g_per_head),
      target_weight_min_g: parseNumeric(row.target_weight_min_g),
      target_weight_max_g: parseNumeric(row.target_weight_max_g),
      feed_type_plan: String(row.feed_type_plan ?? ""),
      light_on_time: row.light_on_time ? normalizeTime(String(row.light_on_time)) : "",
      light_off_time: row.light_off_time ? normalizeTime(String(row.light_off_time)) : "",
      row_order: index,
    })));
    setEditorOpen(true);
    setMessage(data?.notes ?? "Template extracted. Review the grid before saving.");
  };

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-6 px-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-forest-500">Nutrition intelligence</p>
          <h2 className="text-2xl font-semibold text-forest-900">Feed Control</h2>
          <p className="mt-1 text-sm text-forest-600">
            Batch template, feed compliance, weight progression, and production risk in one place.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="h-10 min-w-64 rounded-lg border border-sand-200 bg-white px-3 text-sm"
            value={scope.batchId}
            onChange={(event) => setScope((prev) => ({ ...prev, batchId: event.target.value }))}
          >
            <option value="">Select batch</option>
            {filteredBatches.map((item) => (
              <option key={item.id} value={item.id}>{item.batch_code}</option>
            ))}
          </select>
        </div>
      </div>

      {error ? <p className="rounded-lg border border-ember-500/30 bg-ember-500/10 px-4 py-3 text-sm text-ember-600">{error}</p> : null}
      {message ? <p className="rounded-lg border border-leaf-500/30 bg-leaf-500/10 px-4 py-3 text-sm text-leaf-700">{message}</p> : null}

      {!selectedBatchId && filteredBatches.length === 0 ? (
        <section className="rounded-lg border border-dashed border-sand-300 bg-white p-8 text-center">
          <h3 className="text-lg font-semibold text-forest-900">No live batch available</h3>
          <p className="mt-2 text-sm text-forest-600">Create or assign a batch first, then Feed Control will open it automatically.</p>
        </section>
      ) : null}

      {selectedBatchId ? (
        <>
          {!template && !loading ? (
            <section className="rounded-lg border border-sand-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-forest-900">Create the batch feed template</h3>
                  <p className="mt-1 text-sm text-forest-600">This becomes the source of truth for feed, weight, lighting, and milestone tracking.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button className="rounded-lg bg-forest-900 px-4 py-2 text-sm text-sand-50" onClick={() => openEditor("default")} disabled={!canManage}>Use default pullet template</button>
                  <button className="rounded-lg border border-sand-200 px-4 py-2 text-sm text-forest-700" onClick={() => openEditor("manual")} disabled={!canManage}>Create manually</button>
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-sand-200 px-4 py-2 text-sm text-forest-700">
                    <Upload className="h-4 w-4" />
                    {uploading ? "Extracting..." : "Upload file"}
                    <input className="hidden" type="file" accept=".csv,.txt,.pdf,image/*" disabled={!canManage || uploading} onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void importTemplate(file);
                    }} />
                  </label>
                </div>
              </div>
            </section>
          ) : null}

          {template ? (
            <section className="rounded-lg border border-sand-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-forest-900">{template.name}</h3>
                  <p className="text-sm text-forest-600">Source: {template.source_type} / Batch: {batch?.batch_code ?? "-"}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button className="rounded-lg border border-sand-200 px-4 py-2 text-sm text-forest-700" onClick={() => {
                    setEditorSource("manual");
                    setTemplateName(template.name);
                    setEditorRows(templateRows.map((row) => ({ ...row, client_id: `${row.id}-${Date.now()}` })));
                    setEditorOpen(true);
                  }} disabled={!canManage}>
                    Edit template
                  </button>
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-sand-200 px-4 py-2 text-sm text-forest-700">
                    <FileUp className="h-4 w-4" />
                    Upload replacement
                    <input className="hidden" type="file" accept=".csv,.txt,.pdf,image/*" disabled={!canManage || uploading} onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void importTemplate(file);
                    }} />
                  </label>
                </div>
              </div>
            </section>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
            <MetricCard icon={CalendarCheck} label="Batch Age" value={batchAgeDays === null ? "Pending" : `Week ${Math.floor(batchAgeDays / 7)}`} detail={batchAgeDays === null ? "-" : `${batchAgeDays} days from placement`} />
            <MetricCard icon={Scale} label="Live Birds" value={totalCurrentBirds.toLocaleString()} detail={`${mortalityAdjustedLiveBirds.toLocaleString()} mortality-adjusted feed denominator`} />
            <MetricCard icon={Gauge} label="Feed Compliance" value={feedCompliance === null ? "Pending" : `${feedCompliance}%`} detail="Actual per bird / target" />
            <MetricCard icon={LineChartIcon} label="Weight Status" value={latestWeightStatus} detail={latestWeight?.average_weight_g ? `${latestWeight.average_weight_g} g latest avg` : "No sampled weight"} status={latestWeightStatus} />
            <MetricCard icon={BarChart3} label="Estimated FCR" value={fcr === null ? "Pending" : fcr.toString()} detail="Feed kg / gain kg" />
            <MetricCard icon={AlertTriangle} label="Next Check" value={nextTask ? `Week ${nextTask.due_week_number}` : "Pending"} detail={nextTask?.due_date ?? "No scheduled check"} />
          </div>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(360px,0.6fr)]">
            <section className="rounded-lg border border-sand-200 bg-white p-5 shadow-sm">
              <h3 className="text-base font-semibold text-forest-900">Weight Progression</h3>
              <p className="mt-1 text-sm text-forest-600">Template target band vs sampled average body weight.</p>
              <div className="mt-4 h-[360px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e7dfcf" />
                    <XAxis dataKey="week" tickFormatter={(value) => `W${value}`} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Area dataKey="targetMax" name="Target max" fill="#b7d7b0" stroke="#7aa66f" fillOpacity={0.25} />
                    <Area dataKey="targetMin" name="Target min" fill="#ffffff" stroke="#7aa66f" fillOpacity={1} />
                    {chartData.map((point) =>
                      point.weightStatus === "Below target" && point.actualWeight !== null ? (
                        <ReferenceArea key={point.week} x1={point.week - 0.35} x2={point.week + 0.35} fill="#ef4444" fillOpacity={0.08} />
                      ) : null
                    )}
                    <Line type="monotone" dataKey="actualWeight" name="Actual weight" stroke="#0f3d2e" strokeWidth={3} dot={{ r: 4 }} connectNulls />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="rounded-lg border border-sand-200 bg-white p-5 shadow-sm">
              <h3 className="text-base font-semibold text-forest-900">Timeline</h3>
              <div className="mt-4 max-h-[360px] space-y-3 overflow-auto">
                {timeline.length === 0 ? <p className="text-sm text-forest-600">No milestones yet.</p> : null}
                {timeline.map((item) => (
                  <div key={item.id} className="flex gap-3 rounded-lg border border-sand-100 bg-sand-50/40 p-3">
                    <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${item.status === "completed" ? "bg-leaf-500/10 text-leaf-700" : item.status === "missed" ? "bg-ember-500/10 text-ember-600" : "bg-amber-500/10 text-amber-700"}`}>
                      <CheckCircle2 className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-forest-900">{item.title}</p>
                      <p className="text-xs capitalize text-forest-600">{item.date} / {item.category} / {item.status}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <section className="rounded-lg border border-sand-200 bg-white p-5 shadow-sm">
            <h3 className="text-base font-semibold text-forest-900">Daily Feed vs Target</h3>
            <p className="mt-1 text-sm text-forest-600">Actual feed per bird uses initial birds minus cumulative mortality.</p>
            <div className="mt-4 h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e7dfcf" />
                  <XAxis dataKey="week" tickFormatter={(value) => `W${value}`} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="actualFeed" name="Actual g/bird" fill="#0f3d2e" radius={[6, 6, 0, 0]} />
                  <Line type="monotone" dataKey="targetFeed" name="Target g/bird" stroke="#f59e0b" strokeWidth={3} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="rounded-lg border border-sand-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-forest-900">Two-Week Weight Checks</h3>
                <p className="mt-1 text-sm text-forest-600">Sample weights are scheduled and recorded in Health Log; Feed uses them for tracking and FCR.</p>
              </div>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-[900px] text-sm">
                <thead>
                  <tr className="border-b border-sand-200 text-left text-xs uppercase tracking-[0.12em] text-forest-600 [&>th]:px-3 [&>th]:py-2">
                    <th>Due</th>
                    <th>Week</th>
                    <th>Flock</th>
                    <th>Expected Weight</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {weightTasks.length === 0 ? <tr><td colSpan={6} className="px-3 py-4 text-forest-600">No scheduled checks yet.</td></tr> : null}
                  {weightTasks.map((task) => {
                    const row = templateRows.find((item) => item.id === task.template_row_id) ?? templateRows.find((item) => item.week_number === task.due_week_number) ?? null;
                    const flock = flocks.find((item) => item.id === task.flock_id);
                    const status: WeightStatus = task.status === "completed" ? "On track" : task.due_date < isoDate(new Date()) ? "Missing" : "Pending";
                    return (
                      <tr key={task.id} className="border-b border-sand-100 [&>td]:px-3 [&>td]:py-3">
                        <td>{task.due_date}</td>
                        <td>Week {task.due_week_number}</td>
                        <td>{flock?.flock_code ?? task.flock_id}</td>
                        <td>{row?.target_weight_min_g ?? "-"}-{row?.target_weight_max_g ?? "-"} g</td>
                        <td><span className={`rounded-full px-2 py-1 text-xs ${statusClass(status)}`}>{task.status === "completed" ? "Completed" : status}</span></td>
                        <td>
                          <button className="rounded-lg border border-sand-200 px-3 py-1.5 text-xs text-forest-700" onClick={() => { window.location.href = "/app/health"; }}>
                            Manage in Health Log
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}

      {editorOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-forest-900/50 px-4">
          <div className="max-h-[92vh] w-full max-w-7xl overflow-auto rounded-lg bg-white p-6 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-forest-900">Review Batch Feed Template</h3>
                <p className="text-sm text-forest-600">AI/file output is assistive. Review every row before saving it as the source of truth.</p>
              </div>
              <button className="rounded-lg border border-sand-200 px-3 py-2 text-sm" onClick={() => setEditorOpen(false)}>Close</button>
            </div>
            <label className="mt-5 grid gap-1 text-sm text-forest-700">
              Template name
              <input className={inputClass} value={templateName} onChange={(event) => setTemplateName(event.target.value)} />
            </label>
            <div className="mt-4 overflow-x-auto rounded-lg border border-sand-100">
              <table className="min-w-[1250px] text-sm">
                <thead>
                  <tr className="border-b border-sand-200 bg-sand-50 text-left text-xs uppercase tracking-[0.12em] text-forest-600 [&>th]:px-2 [&>th]:py-2">
                    <th>Week</th>
                    <th>Day start</th>
                    <th>Day end</th>
                    <th>Std g/head</th>
                    <th>Recommended g/head</th>
                    <th>Weight min g</th>
                    <th>Weight max g</th>
                    <th>Feed type plan</th>
                    <th>Light on</th>
                    <th>Light off</th>
                  </tr>
                </thead>
                <tbody>
                  {editorRows.map((row) => (
                    <tr key={row.client_id} className="border-b border-sand-100 [&>td]:px-2 [&>td]:py-2">
                      <td><input className={inputClass} type="number" value={row.week_number} onChange={(event) => updateEditorRow(row.client_id, "week_number", event.target.value)} /></td>
                      <td><input className={inputClass} type="number" value={row.age_day_start} onChange={(event) => updateEditorRow(row.client_id, "age_day_start", event.target.value)} /></td>
                      <td><input className={inputClass} type="number" value={row.age_day_end} onChange={(event) => updateEditorRow(row.client_id, "age_day_end", event.target.value)} /></td>
                      <td><input className={inputClass} type="number" value={row.feed_intake_std_g_per_head ?? ""} onChange={(event) => updateEditorRow(row.client_id, "feed_intake_std_g_per_head", event.target.value)} /></td>
                      <td><input className={inputClass} type="number" value={row.feed_intake_recommended_g_per_head ?? ""} onChange={(event) => updateEditorRow(row.client_id, "feed_intake_recommended_g_per_head", event.target.value)} /></td>
                      <td><input className={inputClass} type="number" value={row.target_weight_min_g ?? ""} onChange={(event) => updateEditorRow(row.client_id, "target_weight_min_g", event.target.value)} /></td>
                      <td><input className={inputClass} type="number" value={row.target_weight_max_g ?? ""} onChange={(event) => updateEditorRow(row.client_id, "target_weight_max_g", event.target.value)} /></td>
                      <td><input className={inputClass} value={row.feed_type_plan} onChange={(event) => updateEditorRow(row.client_id, "feed_type_plan", event.target.value)} /></td>
                      <td><input className={inputClass} type="time" value={row.light_on_time} onChange={(event) => updateEditorRow(row.client_id, "light_on_time", event.target.value)} /></td>
                      <td><input className={inputClass} type="time" value={row.light_off_time} onChange={(event) => updateEditorRow(row.client_id, "light_off_time", event.target.value)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex flex-wrap justify-between gap-3">
              <button className="inline-flex items-center gap-2 rounded-lg border border-sand-200 px-4 py-2 text-sm text-forest-700" onClick={addEditorRow}>
                <Plus className="h-4 w-4" /> Add row
              </button>
              <button className="inline-flex items-center gap-2 rounded-lg bg-forest-900 px-5 py-2 text-sm text-sand-50" onClick={() => void saveTemplate()}>
                <Save className="h-4 w-4" /> Save as Batch Template
              </button>
            </div>
          </div>
        </div>
      ) : null}

    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
  status,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  detail: string;
  status?: WeightStatus;
}) {
  return (
    <article className="rounded-lg border border-sand-200 bg-white/90 p-4 shadow-sm backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-[0.18em] text-forest-500">{label}</p>
        <span className="rounded-lg bg-sand-50 p-2 text-forest-700"><Icon className="h-4 w-4" /></span>
      </div>
      <p className={`mt-3 text-2xl font-semibold ${status ? statusClass(status) : "text-forest-900"} ${status ? "inline-block rounded-full px-2 py-1 text-base" : ""}`}>
        {value}
      </p>
      <p className="mt-2 text-xs text-forest-600">{detail}</p>
    </article>
  );
}
