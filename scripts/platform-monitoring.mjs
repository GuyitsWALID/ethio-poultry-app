import process from "node:process";

const required = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
};

const environment = required("APP_ENVIRONMENT");
const baseUrl = required("APP_BASE_URL").replace(/\/$/, "");
const ingestToken = required("MONITORING_INGEST_TOKEN");
const release = process.env.APP_RELEASE?.trim() || null;
const runIdentity = `${process.env.GITHUB_RUN_ID || Date.now()}:${process.env.GITHUB_RUN_ATTEMPT || "1"}`;

async function submit(evidence) {
  const response = await fetch(`${baseUrl}/api/internal/monitoring/evidence`, {
    method: "POST",
    headers: { Authorization: `Bearer ${ingestToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(evidence),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Evidence intake returned HTTP ${response.status}.`);
}

async function probeApplication() {
  const started = performance.now();
  let signInStatus = 0;
  let contextStatus = 0;
  let failure = null;
  try {
    const [signIn, context] = await Promise.all([
      fetch(`${baseUrl}/auth/sign-in`, { redirect: "follow", signal: AbortSignal.timeout(15_000) }),
      fetch(`${baseUrl}/api/me/context`, { redirect: "manual", signal: AbortSignal.timeout(15_000) }),
    ]);
    signInStatus = signIn.status;
    contextStatus = context.status;
    if (signIn.status !== 200 || context.status !== 401) failure = "Public application contract returned an unexpected status.";
  } catch {
    failure = "Public application probe could not reach the deployment.";
  }
  const durationMs = Math.round(performance.now() - started);
  await submit({
    evidenceKind: "application_probe",
    environment,
    status: failure ? "failed" : durationMs > 3_000 ? "degraded" : "healthy",
    provider: "github-actions",
    checkedAt: new Date().toISOString(),
    durationMs,
    release,
    summary: failure ?? `Sign-in and authorization probes passed in ${durationMs} ms.`,
    details: { signInStatus, contextStatus },
    idempotencyKey: `${environment}:application_probe:${runIdentity}`,
  });
  if (failure) throw new Error(failure);
}

async function checkBackups() {
  const projectRef = required("SUPABASE_PROJECT_REF");
  const accessToken = required("SUPABASE_ACCESS_TOKEN");
  const started = performance.now();
  let response;
  try {
    response = await fetch(`https://api.supabase.com/v1/projects/${encodeURIComponent(projectRef)}/database/backups`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    await submit({
      evidenceKind: "backup_status", environment, status: "failed", provider: "supabase",
      checkedAt: new Date().toISOString(), durationMs: Math.round(performance.now() - started), release,
      summary: "Supabase backup status could not be reached.", details: { providerStatus: "unreachable" },
      idempotencyKey: `${environment}:backup_status:${runIdentity}`,
    });
    throw new Error("Supabase backup status could not be reached.");
  }
  const durationMs = Math.round(performance.now() - started);
  if (!response.ok) {
    await submit({
      evidenceKind: "backup_status", environment, status: "failed", provider: "supabase",
      checkedAt: new Date().toISOString(), durationMs, release,
      summary: "Supabase backup status could not be verified.", details: { providerStatus: response.status },
      idempotencyKey: `${environment}:backup_status:${runIdentity}`,
    });
    throw new Error(`Supabase backup status returned HTTP ${response.status}.`);
  }
  const payload = await response.json();
  const completed = Array.isArray(payload.backups)
    ? payload.backups.filter((backup) => backup?.status === "COMPLETED" && backup?.inserted_at).sort((a, b) => String(b.inserted_at).localeCompare(String(a.inserted_at)))
    : [];
  const latest = completed[0];
  const ageHours = latest ? (Date.now() - new Date(latest.inserted_at).getTime()) / 3_600_000 : Number.POSITIVE_INFINITY;
  const status = !latest ? "failed" : ageHours > 36 ? "degraded" : "healthy";
  const summary = !latest
    ? "Supabase reported no completed database backup."
    : ageHours > 36
      ? `The latest completed database backup is ${Math.round(ageHours)} hours old.`
      : `Supabase reports a completed backup from ${new Date(latest.inserted_at).toISOString()}.`;
  await submit({
    evidenceKind: "backup_status",
    environment,
    status,
    provider: "supabase",
    checkedAt: new Date().toISOString(),
    durationMs,
    release,
    summary,
    details: { latestCompletedAt: latest?.inserted_at ?? "none", pitrEnabled: Boolean(payload.pitr_enabled), physicalBackups: Boolean(payload.walg_enabled) },
    idempotencyKey: `${environment}:backup_status:${runIdentity}`,
  });
  if (status === "failed") throw new Error(summary);
}

async function dispatchNotifications() {
  const response = await fetch(`${baseUrl}/api/internal/notifications/dispatch`, {
    method: "POST",
    headers: { Authorization: `Bearer ${ingestToken}` },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Notification dispatch returned HTTP ${response.status}.`);
  const result = await response.json();
  if (Number(result.failed ?? 0) > 0) throw new Error(`${result.failed} notification deliveries failed.`);
  console.log(result.status === "disabled" ? `Notification email disabled: ${result.reason}` : `Notification delivery complete: ${result.sent ?? 0} sent.`);
}

const command = process.argv[2];
if (command === "probe") await probeApplication();
else if (command === "backup") await checkBackups();
else if (command === "notifications") await dispatchNotifications();
else throw new Error("Usage: node scripts/platform-monitoring.mjs <probe|backup|notifications>");
