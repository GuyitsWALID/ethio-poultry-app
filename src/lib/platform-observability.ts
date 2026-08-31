import "server-only";

import { z } from "zod";

import { governanceAdmin } from "@/lib/access-context";

export const evidenceKinds = ["application_probe", "backup_status", "restore_drill"] as const;
export const evidenceStatuses = ["healthy", "degraded", "failed"] as const;

const detailValue = z.union([
  z.string().trim().max(300),
  z.number().finite(),
  z.boolean(),
  z.null(),
  z.array(z.union([z.string().trim().max(160), z.number().finite(), z.boolean()])).max(30),
]);

export const operationalEvidenceSchema = z.object({
  evidenceKind: z.enum(evidenceKinds),
  environment: z.enum(["staging", "production"]),
  status: z.enum(evidenceStatuses),
  provider: z.string().trim().min(2).max(80),
  checkedAt: z.string().datetime(),
  durationMs: z.number().int().min(0).max(3_600_000).nullable().optional(),
  release: z.string().trim().min(7).max(128).nullable().optional(),
  summary: z.string().trim().min(3).max(500),
  details: z.record(z.string().max(80), detailValue).default({}),
  idempotencyKey: z.string().trim().min(12).max(180),
}).strict();

export type OperationalEvidenceInput = z.infer<typeof operationalEvidenceSchema>;
export type HealthState = "healthy" | "degraded" | "failed" | "not_configured";

export type HealthSignal = {
  state: HealthState;
  label: string;
  detail: string;
  observedAt: string | null;
  durationMs: number | null;
};

export type SystemHealthSnapshot = {
  generatedAt: string;
  environment: string;
  release: string;
  application: HealthSignal;
  database: HealthSignal;
  backup: HealthSignal;
  recovery: HealthSignal;
  scheduler: HealthSignal;
};

const forbiddenDetailKey = /(secret|token|password|cookie|authorization|credential|api.?key|email|phone)/i;

function rejectSensitiveDetails(details: Record<string, unknown>) {
  for (const key of Object.keys(details)) {
    if (forbiddenDetailKey.test(key)) throw new Error(`Evidence detail key is not permitted: ${key}`);
  }
}

export async function tokenMatches(provided: string, expected: string) {
  const encoder = new TextEncoder();
  const [left, right] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(provided)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);
  const a = new Uint8Array(left);
  const b = new Uint8Array(right);
  let difference = a.length ^ b.length;
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    difference |= (a[index] ?? 0) ^ (b[index] ?? 0);
  }
  return difference === 0;
}

export async function recordOperationalEvidence(value: unknown) {
  const input = operationalEvidenceSchema.parse(value);
  rejectSensitiveDetails(input.details);

  const row = {
    evidence_kind: input.evidenceKind,
    environment: input.environment,
    status: input.status,
    provider: input.provider,
    checked_at: input.checkedAt,
    duration_ms: input.durationMs ?? null,
    release: input.release ?? null,
    summary: input.summary,
    details: input.details,
    idempotency_key: input.idempotencyKey,
  };
  const { data, error } = await governanceAdmin
    .from("platform_operational_evidence")
    .insert(row)
    .select("id,evidence_kind,environment,status,checked_at")
    .single();

  if (!error) return { created: true, evidence: data };
  if (error.code === "23505") {
    const { data: existing, error: readError } = await governanceAdmin
      .from("platform_operational_evidence")
      .select("id,evidence_kind,environment,status,checked_at")
      .eq("idempotency_key", input.idempotencyKey)
      .maybeSingle();
    if (readError) throw new Error(readError.message);
    return { created: false, evidence: existing };
  }
  throw new Error(error.message);
}

type EvidenceRow = {
  evidence_kind: typeof evidenceKinds[number];
  status: typeof evidenceStatuses[number];
  checked_at: string;
  duration_ms: number | null;
  summary: string;
};

function evidenceSignal(row: EvidenceRow | undefined, staleAfterMs: number, emptyDetail: string): HealthSignal {
  if (!row) return { state: "not_configured", label: "Not yet verified", detail: emptyDetail, observedAt: null, durationMs: null };
  const stale = Date.now() - new Date(row.checked_at).getTime() > staleAfterMs;
  if (stale) return { state: "degraded", label: "Evidence is stale", detail: row.summary, observedAt: row.checked_at, durationMs: row.duration_ms };
  return {
    state: row.status,
    label: row.status === "healthy" ? "Verified" : row.status === "degraded" ? "Needs attention" : "Check failed",
    detail: row.summary,
    observedAt: row.checked_at,
    durationMs: row.duration_ms,
  };
}

export async function loadSystemHealth(): Promise<SystemHealthSnapshot> {
  const environment = process.env.APP_ENVIRONMENT?.trim() || "local";
  const release = process.env.APP_RELEASE?.trim() || "unversioned";
  const started = performance.now();
  const databaseProbe = await governanceAdmin.from("profiles").select("id").limit(1);
  const databaseDuration = Math.round(performance.now() - started);

  const evidenceResult = ["staging", "production"].includes(environment)
    ? await governanceAdmin
        .from("platform_operational_evidence")
        .select("evidence_kind,status,checked_at,duration_ms,summary")
        .eq("environment", environment)
        .order("checked_at", { ascending: false })
        .limit(30)
    : { data: [], error: null };

  const schedulerResult = await governanceAdmin
    .from("governance_scheduler_health")
    .select("last_completed_at,last_started_at,last_locked_count")
    .eq("scheduler_key", "operating_day_lock")
    .maybeSingle();

  const rows = (evidenceResult.data ?? []) as EvidenceRow[];
  const latest = (kind: typeof evidenceKinds[number]) => rows.find((row) => row.evidence_kind === kind);
  const evidenceUnavailable = Boolean(evidenceResult.error);

  const application = evidenceUnavailable
    ? { state: "not_configured" as const, label: "Migration required", detail: "Deploy the platform monitoring migration before probes can be retained.", observedAt: null, durationMs: null }
    : evidenceSignal(latest("application_probe"), 45 * 60_000, "Run the scheduled application probe to establish the first health signal.");

  const database: HealthSignal = databaseProbe.error
    ? { state: "failed", label: "Connection failed", detail: "The application could not complete its database health query.", observedAt: new Date().toISOString(), durationMs: databaseDuration }
    : databaseDuration > 2_000
      ? { state: "degraded", label: "Slow response", detail: "The database responded, but the round trip exceeded two seconds.", observedAt: new Date().toISOString(), durationMs: databaseDuration }
      : { state: "healthy", label: "Connected", detail: "A live privileged database query completed successfully.", observedAt: new Date().toISOString(), durationMs: databaseDuration };

  const schedulerDate = schedulerResult.data?.last_completed_at ?? schedulerResult.data?.last_started_at ?? null;
  const schedulerAge = schedulerDate ? Date.now() - new Date(schedulerDate).getTime() : Number.POSITIVE_INFINITY;
  const scheduler: HealthSignal = schedulerResult.error || !schedulerDate
    ? { state: "not_configured", label: "No scheduler evidence", detail: "No completed operating-day scheduler run is available.", observedAt: null, durationMs: null }
    : schedulerAge > 45 * 60_000
      ? { state: "degraded", label: "Scheduler is late", detail: "The operating-day lock scheduler has not reported within 45 minutes.", observedAt: schedulerDate, durationMs: null }
      : { state: "healthy", label: "Scheduler active", detail: `Latest run completed; ${schedulerResult.data?.last_locked_count ?? 0} operating days were locked.`, observedAt: schedulerDate, durationMs: null };

  return {
    generatedAt: new Date().toISOString(),
    environment,
    release,
    application,
    database,
    backup: evidenceUnavailable
      ? application
      : evidenceSignal(latest("backup_status"), 36 * 60 * 60_000, "Configure the Supabase backup monitor and run it once."),
    recovery: evidenceUnavailable
      ? application
      : evidenceSignal(latest("restore_drill"), 35 * 24 * 60 * 60_000, "Run the isolated restore drill before claiming recoverability."),
    scheduler,
  };
}
