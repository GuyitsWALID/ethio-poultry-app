import "server-only";

import { createGroq, type GroqLanguageModelChatOptions } from "@ai-sdk/groq";
import { generateText, Output } from "ai";

import { canAccessFarm, canAccessWarehouse, governanceAdmin, type AccessContext } from "@/lib/access-context";
import {recordAuditEvent} from "@/lib/audit-ledger";
import {
  canonicalAiEvidence,
  buildReconciliationAiPrompt,
  RECONCILIATION_AI_PROMPT_VERSION,
  RECONCILIATION_AI_SCHEMA_VERSION,
  reconciliationAiOutputSchema,
  sanitizeAiEvidenceText,
  validateAiEvidenceReferences,
  validateAiSafety,
  type ReconciliationAiAnalysis,
  type ReconciliationAiEvidenceItem,
  type ReconciliationAiEvidencePacket,
  type ReconciliationAiOutput,
} from "@/lib/reconciliation-ai-contract";
import { formatReconciliationNumber, userFacingReconciliationEvidence } from "@/lib/reconciliation-presentation";
import { reconciliationWorkflow } from "@/lib/reconciliation-workflow";

type Row = Record<string, unknown>;
type DbResult<T> = { data: T | null; error: { message: string } | null };

const DEFAULT_MODEL = "openai/gpt-oss-120b";
const USER_HOURLY_LIMIT = 10;
const FINDING_REGENERATION_HOURLY_LIMIT = 3;
const REGENERATION_COOLDOWN_MS = 30_000;

export class ReconciliationAiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly retryable = false,
  ) {
    super(message);
    this.name = "ReconciliationAiError";
  }
}

export type ReconciliationAiResponse = {
  enabled: boolean;
  latest: ReconciliationAiAnalysis | null;
  currentEvidenceHash: string;
  history: ReconciliationAiAnalysis[];
};

type PreparedFinding = {
  row: Row;
  packet: ReconciliationAiEvidencePacket;
  evidenceHash: string;
};

type GenerateResult = {
  output: ReconciliationAiOutput;
  usage: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
};

export type ReconciliationAiDependencies = {
  generate?: (packet: ReconciliationAiEvidencePacket, model: string, signal: AbortSignal) => Promise<GenerateResult>;
  now?: () => Date;
};

function aiEnabled() {
  return process.env.RECONCILIATION_AI_ENABLED?.trim().toLowerCase() === "true";
}

function modelName() {
  return process.env.GROQ_MODEL?.trim() || DEFAULT_MODEL;
}

function label(value: unknown, fallback: string) {
  const clean = sanitizeAiEvidenceText(value, 180);
  return clean || fallback;
}

function numberLabel(value: unknown, unit = "") {
  return formatReconciliationNumber(value, unit, "Unavailable");
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function authorizeFinding(ctx: AccessContext, id: string) {
  const { data, error } = await governanceAdmin
    .from("reconciliation_findings")
    .select("*")
    .eq("id", id)
    .eq("org_id", ctx.orgId)
    .maybeSingle();
  if (error) throw new ReconciliationAiError(error.message, 500, "DATABASE_ERROR", true);
  if (!data) throw new ReconciliationAiError("Record Check not found.", 404, "NOT_FOUND");

  const farmId = data.farm_id ? String(data.farm_id) : null;
  const warehouseId = data.warehouse_id ? String(data.warehouse_id) : null;
  if (farmId && !await canAccessFarm(ctx, farmId)) {
    throw new ReconciliationAiError("This Record Check is outside your active farm assignment.", 403, "OUT_OF_SCOPE");
  }
  if (warehouseId && ctx.role !== "ceo" && !await canAccessWarehouse(ctx, warehouseId)) {
    throw new ReconciliationAiError("This Record Check is outside your active warehouse assignment.", 403, "OUT_OF_SCOPE");
  }
  if (!farmId && !warehouseId && ctx.role !== "ceo" && !ctx.supportSessionId) {
    throw new ReconciliationAiError("Organization-wide Record Checks require CEO authority.", 403, "OUT_OF_SCOPE");
  }
  return data as Row;
}

async function oneLabel(table: string, id: unknown, column: string) {
  if (!id) return null;
  const { data } = await governanceAdmin.from(table).select(column).eq("id", id).maybeSingle() as DbResult<Row>;
  return data?.[column] ? String(data[column]) : null;
}

async function prepareFinding(ctx: AccessContext, id: string): Promise<PreparedFinding> {
  const row = await authorizeFinding(ctx, id);
  const [farmName, houseName, flockCode, batchCode, warehouseName, responseResult] = await Promise.all([
    oneLabel("farms", row.farm_id, "name"),
    oneLabel("houses", row.house_id, "name"),
    oneLabel("flocks", row.flock_id, "flock_code"),
    oneLabel("batches", row.batch_id, "batch_code"),
    oneLabel("warehouses", row.warehouse_id, "name"),
    governanceAdmin.from("reconciliation_finding_responses")
      .select("action,note,created_at")
      .eq("org_id", ctx.orgId)
      .eq("finding_id", id)
      .order("created_at", { ascending: true })
      .limit(50),
  ]);
  if (responseResult.error) throw new ReconciliationAiError(responseResult.error.message, 500, "DATABASE_ERROR", true);

  const workflow = reconciliationWorkflow({
    rule_code: String(row.rule_code),
    domain: String(row.domain),
    severity: String(row.severity) as "critical" | "high" | "medium" | "low",
    status: String(row.status),
    title: String(row.title),
    explanation: String(row.explanation),
    recommended_action: String(row.recommended_action),
    finding_date: row.record_date ? String(row.record_date) : null,
    flock_code: flockCode,
    farm_name: farmName,
    warehouse_name: warehouseName,
  }, ctx.role);

  const scope = [farmName, houseName, flockCode, batchCode, warehouseName]
    .filter(Boolean)
    .map((item) => label(item, ""))
    .join(" · ") || "Organization-wide check";
  const varianceUnit = row.unit ? String(row.unit) : "";
  const evidenceItems: ReconciliationAiEvidenceItem[] = [];
  const addEvidence = (itemLabel: string, value: unknown) => {
    const cleanLabel = label(itemLabel, "Source value");
    const cleanValue = sanitizeAiEvidenceText(value, 500);
    if (!cleanValue) return;
    evidenceItems.push({ id: `E${evidenceItems.length + 1}`, label: cleanLabel, value: cleanValue });
  };
  addEvidence("Expected value", numberLabel(row.expected_value, varianceUnit));
  addEvidence("Recorded value", numberLabel(row.recorded_value, varianceUnit));
  addEvidence("Difference", numberLabel(row.variance, varianceUnit));
  for (const entry of userFacingReconciliationEvidence(row.evidence, {
    farmName,
    houseName,
    flockCode,
    warehouseName,
    recordDate: row.record_date ? String(row.record_date) : null,
  })) {
    if (/(?:password|secret|token|credential|email|phone|contact)/i.test(entry.key)) continue;
    addEvidence(entry.label, entry.value);
  }

  const reviewNotes = (responseResult.data ?? []).map((response) => ({
    action: label(response.action, "Review note"),
    note: sanitizeAiEvidenceText(response.note, 700),
  })).filter((response) => response.note);
  for (const note of reviewNotes) addEvidence(`Review note · ${note.action}`, note.note);

  const packet: ReconciliationAiEvidencePacket = {
    finding: {
      title: label(workflow.plainTitle, "Record difference"),
      explanation: label(workflow.plainExplanation, "Related records do not agree."),
      domain: label(row.domain, "operations"),
      priority: label(workflow.priorityLabel, "Action needed"),
      status: label(workflow.stageLabel, "Needs action"),
      scope,
      date: row.record_date ? sanitizeAiEvidenceText(row.record_date, 20) : null,
    },
    comparison: {
      expected: numberLabel(row.expected_value, varianceUnit),
      recorded: numberLabel(row.recorded_value, varianceUnit),
      variance: numberLabel(row.variance, varianceUnit),
    },
    evidence: evidenceItems.slice(0, 30),
    reviewNotes,
    requiredVerification: label(workflow.verification, "Correct the source record and run Check again."),
  };
  return { row, packet, evidenceHash: await sha256(canonicalAiEvidence(packet)) };
}

function analysisFromRow(row: Row, currentHash: string, cached = false): ReconciliationAiAnalysis {
  const parsed = row.analysis_output ? reconciliationAiOutputSchema.safeParse(row.analysis_output) : null;
  const snapshot = row.evidence_snapshot && typeof row.evidence_snapshot === "object" ? row.evidence_snapshot as Partial<ReconciliationAiEvidencePacket> : null;
  const evidence = Array.isArray(snapshot?.evidence)
    ? snapshot.evidence.filter((item): item is ReconciliationAiEvidenceItem => Boolean(item && typeof item.id === "string" && typeof item.label === "string" && typeof item.value === "string"))
    : [];
  return {
    id: String(row.id),
    status: String(row.status) === "completed" ? "completed" : "failed",
    output: parsed?.success ? parsed.data : null,
    generatedAt: String(row.created_at),
    provider: "groq",
    model: String(row.model),
    evidenceHash: String(row.evidence_hash),
    promptVersion: String(row.prompt_version),
    schemaVersion: String(row.schema_version),
    stale: String(row.evidence_hash) !== currentHash
      || String(row.prompt_version) !== RECONCILIATION_AI_PROMPT_VERSION
      || String(row.schema_version) !== RECONCILIATION_AI_SCHEMA_VERSION,
    evidence,
    ...(cached ? { cached: true } : {}),
  };
}

async function historyForFinding(ctx: AccessContext, findingId: string, currentHash: string) {
  const { data, error } = await governanceAdmin
    .from("reconciliation_ai_analyses")
    .select("id,status,analysis_output,evidence_snapshot,created_at,provider,model,evidence_hash,prompt_version,schema_version")
    .eq("org_id", ctx.orgId)
    .eq("finding_id", findingId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw new ReconciliationAiError(error.message, 500, "DATABASE_ERROR", true);
  return (data ?? []).map((row) => analysisFromRow(row, currentHash));
}

export async function getReconciliationAiAnalysis(ctx: AccessContext, findingId: string): Promise<ReconciliationAiResponse> {
  const prepared = await prepareFinding(ctx, findingId);
  if (!aiEnabled()) return { enabled: false, latest: null, currentEvidenceHash: prepared.evidenceHash, history: [] };
  const history = await historyForFinding(ctx, findingId, prepared.evidenceHash);
  return {
    enabled: true,
    latest: history.find((item) => item.status === "completed" && item.output) ?? history[0] ?? null,
    currentEvidenceHash: prepared.evidenceHash,
    history,
  };
}

async function enforceRateLimit(ctx: AccessContext, findingId: string, now: Date) {
  const since = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
  const [userResult, findingResult] = await Promise.all([
    governanceAdmin.from("reconciliation_ai_analyses").select("id", { count: "exact", head: true }).eq("org_id", ctx.orgId).eq("requested_by", ctx.userId).gte("created_at", since),
    governanceAdmin.from("reconciliation_ai_analyses").select("id,created_at", { count: "exact" }).eq("org_id", ctx.orgId).eq("finding_id", findingId).eq("requested_by", ctx.userId).gte("created_at", since).order("created_at", { ascending: false }).limit(FINDING_REGENERATION_HOURLY_LIMIT),
  ]);
  if (userResult.error || findingResult.error) throw new ReconciliationAiError(userResult.error?.message ?? findingResult.error?.message ?? "Could not check AI usage.", 500, "DATABASE_ERROR", true);
  if ((userResult.count ?? 0) >= USER_HOURLY_LIMIT) throw new ReconciliationAiError("AI analysis limit reached. Try again in one hour.", 429, "USER_RATE_LIMIT", true);
  if ((findingResult.count ?? 0) >= FINDING_REGENERATION_HOURLY_LIMIT) throw new ReconciliationAiError("This check has been analyzed several times. Try again in one hour.", 429, "FINDING_RATE_LIMIT", true);
  const latestAt = findingResult.data?.[0]?.created_at ? Date.parse(String(findingResult.data[0].created_at)) : 0;
  if (latestAt && now.getTime() - latestAt < REGENERATION_COOLDOWN_MS) throw new ReconciliationAiError("Wait 30 seconds before refreshing this analysis.", 429, "COOLDOWN", true);
}

async function generateWithGroq(packet: ReconciliationAiEvidencePacket, model: string, signal: AbortSignal): Promise<GenerateResult> {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) throw new ReconciliationAiError("Groq is not configured for this deployment.", 503, "AI_NOT_CONFIGURED", true);
  const provider = createGroq({ apiKey });
  const result = await generateText({
    model: provider(model),
    output: Output.object({
      schema: reconciliationAiOutputSchema,
      name: "RecordCheckAnalysis",
      description: "Evidence-grounded, read-only guidance for one deterministic poultry record check.",
    }),
    providerOptions: {
      groq: {
        reasoningFormat: "hidden",
        reasoningEffort: "medium",
        structuredOutputs: true,
        strictJsonSchema: true,
        parallelToolCalls: false,
        serviceTier: "on_demand",
      } satisfies GroqLanguageModelChatOptions,
    },
    prompt: buildReconciliationAiPrompt(packet),
    temperature: 0.1,
    maxOutputTokens: 1800,
    maxRetries: 1,
    abortSignal: signal,
  });
  return {
    output: result.output,
    usage: {
      inputTokens: result.totalUsage.inputTokens,
      outputTokens: result.totalUsage.outputTokens,
      totalTokens: result.totalUsage.totalTokens,
    },
  };
}

function failureCode(error: unknown) {
  if (error instanceof ReconciliationAiError) return error.code;
  if (error instanceof Error && error.name === "AbortError") return "PROVIDER_TIMEOUT";
  return "PROVIDER_ERROR";
}

async function writeAudit(ctx: AccessContext, eventType: string, analysisId: string, metadata: Record<string, unknown>) {
  await recordAuditEvent(ctx,{eventType,operation:"execute",entityTable:"reconciliation_ai_analyses",entityId:analysisId,reason:eventType.endsWith(".failed")?"AI record-check analysis failed.":"Generated AI record-check guidance.",metadata});
}

export async function analyzeReconciliationFinding(
  ctx: AccessContext,
  findingId: string,
  options: { regenerate?: boolean; requestKey?: string } = {},
  dependencies: ReconciliationAiDependencies = {},
): Promise<ReconciliationAiAnalysis> {
  if (!aiEnabled()) throw new ReconciliationAiError("AI guidance is not enabled for this deployment.", 503, "AI_DISABLED", true);
  const prepared = await prepareFinding(ctx, findingId);
  const model = modelName();

  if (options.requestKey) {
    const { data } = await governanceAdmin.from("reconciliation_ai_analyses").select("*").eq("org_id", ctx.orgId).eq("requested_by", ctx.userId).eq("request_key", options.requestKey).maybeSingle();
    if (data) return analysisFromRow(data, prepared.evidenceHash, true);
  }

  if (!options.regenerate) {
    const { data } = await governanceAdmin.from("reconciliation_ai_analyses")
      .select("*")
      .eq("org_id", ctx.orgId)
      .eq("finding_id", findingId)
      .eq("status", "completed")
      .eq("evidence_hash", prepared.evidenceHash)
      .eq("prompt_version", RECONCILIATION_AI_PROMPT_VERSION)
      .eq("schema_version", RECONCILIATION_AI_SCHEMA_VERSION)
      .eq("model", model)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) return analysisFromRow(data, prepared.evidenceHash, true);
  }

  const now = dependencies.now?.() ?? new Date();
  await enforceRateLimit(ctx, findingId, now);
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const generated = await (dependencies.generate ?? generateWithGroq)(prepared.packet, model, controller.signal);
    const output = validateAiSafety(validateAiEvidenceReferences(reconciliationAiOutputSchema.parse(generated.output), prepared.packet.evidence));
    const row = {
      org_id: ctx.orgId,
      finding_id: findingId,
      finding_fingerprint: String(prepared.row.fingerprint),
      evidence_hash: prepared.evidenceHash,
      provider: "groq",
      model,
      prompt_version: RECONCILIATION_AI_PROMPT_VERSION,
      schema_version: RECONCILIATION_AI_SCHEMA_VERSION,
      status: "completed",
      evidence_snapshot: prepared.packet,
      analysis_output: output,
      requested_by: ctx.userId,
      requester_role: ctx.role,
      support_session_id: ctx.supportSessionId,
      request_key: options.requestKey ?? null,
      input_tokens: generated.usage.inputTokens ?? null,
      output_tokens: generated.usage.outputTokens ?? null,
      total_tokens: generated.usage.totalTokens ?? null,
      latency_ms: Math.max(0, Date.now() - startedAt),
    };
    const { data, error } = await governanceAdmin.from("reconciliation_ai_analyses").insert(row).select("*").single();
    if ((error || !data) && options.requestKey) {
      const { data: concurrent } = await governanceAdmin.from("reconciliation_ai_analyses").select("*").eq("org_id", ctx.orgId).eq("requested_by", ctx.userId).eq("request_key", options.requestKey).maybeSingle();
      if (concurrent) return analysisFromRow(concurrent, prepared.evidenceHash, true);
    }
    if (error || !data) throw new ReconciliationAiError(error?.message ?? "Could not preserve the AI analysis.", 500, "DATABASE_ERROR", true);
    await writeAudit(ctx, "reconciliation.ai_analysis.generated", String(data.id), {
      finding_id: findingId,
      evidence_hash: prepared.evidenceHash,
      model,
      prompt_version: RECONCILIATION_AI_PROMPT_VERSION,
      schema_version: RECONCILIATION_AI_SCHEMA_VERSION,
      input_tokens: row.input_tokens,
      output_tokens: row.output_tokens,
      total_tokens: row.total_tokens,
      latency_ms: row.latency_ms,
    });
    return analysisFromRow(data, prepared.evidenceHash);
  } catch (error) {
    const code = failureCode(error);
    const failureRow = {
      org_id: ctx.orgId,
      finding_id: findingId,
      finding_fingerprint: String(prepared.row.fingerprint),
      evidence_hash: prepared.evidenceHash,
      provider: "groq",
      model,
      prompt_version: RECONCILIATION_AI_PROMPT_VERSION,
      schema_version: RECONCILIATION_AI_SCHEMA_VERSION,
      status: "failed",
      evidence_snapshot: prepared.packet,
      error_code: code,
      requested_by: ctx.userId,
      requester_role: ctx.role,
      support_session_id: ctx.supportSessionId,
      request_key: options.requestKey ?? null,
      latency_ms: Math.max(0, Date.now() - startedAt),
    };
    const { data } = await governanceAdmin.from("reconciliation_ai_analyses").insert(failureRow).select("id").maybeSingle();
    if (data?.id) await writeAudit(ctx, "reconciliation.ai_analysis.failed", String(data.id), { finding_id: findingId, evidence_hash: prepared.evidenceHash, model, error_code: code, latency_ms: failureRow.latency_ms });
    if (error instanceof ReconciliationAiError) throw error;
    throw new ReconciliationAiError("AI guidance is temporarily unavailable. The Record Check is still valid; try again later.", 503, code, true);
  } finally {
    clearTimeout(timeout);
  }
}
