/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";

import { z } from "zod";

import { governanceAdmin, type AccessContext } from "@/lib/access-context";
import type { InAppThreshold, NotificationCenter, NotificationItem, NotificationPreference, NotificationSeverity } from "@/lib/notification-contract";
import { emailDeliveryReadiness, sendNotificationEmail } from "@/lib/notification-email";

type Row = Record<string, unknown>;
const db = governanceAdmin as any;
const severityRank: Record<NotificationSeverity, number> = { low: 1, medium: 2, high: 3 };
const defaultPreference: NotificationPreference = { inAppMinimumSeverity: "low", emailEnabled: false, emailMinimumSeverity: "high" };

const notificationCommand = z.discriminatedUnion("command", [
  z.object({ command: z.literal("mark_read"), notificationId: z.string().uuid() }),
  z.object({ command: z.literal("mark_all_read") }),
  z.object({
    command: z.literal("update_preferences"),
    inAppMinimumSeverity: z.enum(["low", "medium", "high", "off"]),
    emailEnabled: z.boolean(),
    emailMinimumSeverity: z.enum(["low", "medium", "high"]),
  }),
]);

function text(value: unknown) { return typeof value === "string" ? value : value == null ? "" : String(value); }

function allows(threshold: InAppThreshold | NotificationSeverity, severity: NotificationSeverity) {
  if (threshold === "off") return false;
  return severityRank[severity] >= severityRank[threshold];
}

function copy(eventType: string, action: Row) {
  const owner = text((action.owner as Row | null)?.full_name) || "the assigned Farm Manager";
  const title = text(action.title) || "Operational action updated";
  const messages: Record<string, string> = {
    discovered: "A deterministic check created a new action that needs CEO assignment.",
    assigned: `This action was assigned to ${owner}. Open it to acknowledge responsibility and inspect the source.`,
    claimed: `${owner} claimed this action and is now responsible for the next step.`,
    acknowledged: `${owner} acknowledged responsibility for this action.`,
    work_started: `${owner} started investigating this action.`,
    resolution_submitted: `${owner} submitted correction evidence. The source now needs deterministic verification.`,
    verification_failed: "The source check still reports this issue. Review the correction and try verification again.",
    system_verified: "The originating check no longer reports this issue. The action has been verified and closed.",
    escalated: "This action passed its due date without verified resolution and now requires management attention.",
    reopened: "The originating check reported this issue again after an earlier resolution.",
    due_date_changed: "The CEO changed the due date for this assigned action.",
  };
  return { title, message: messages[eventType] ?? "This operational action has new activity." };
}

async function recipientsFor(eventType: string, action: Row, actorId: string | null) {
  const recipients = new Set<string>();
  const ownerId = text(action.owner_id);
  const notifyOwner = ["assigned", "due_date_changed", "verification_failed", "system_verified", "escalated", "reopened"].includes(eventType);
  const notifyCeo = ["discovered", "claimed", "acknowledged", "work_started", "resolution_submitted", "verification_failed", "system_verified", "escalated", "reopened"].includes(eventType);
  if (notifyOwner && ownerId) recipients.add(ownerId);
  if (notifyCeo) {
    const { data } = await db.from("profiles").select("id").eq("org_id", action.org_id).eq("role", "ceo").eq("is_active", true);
    for (const row of data ?? []) recipients.add(text(row.id));
  }
  if (actorId) recipients.delete(actorId);
  return [...recipients].filter(Boolean);
}

export async function publishActionEventNotifications(input: { action: Row; event: Row }) {
  try {
    const eventType = text(input.event.event_type);
    const recipients = await recipientsFor(eventType, input.action, text(input.event.actor_id) || null);
    if (!recipients.length) return { created: 0 };
    const content = copy(eventType, input.action);
    const rows = recipients.map((recipientId) => ({
      org_id: input.action.org_id,
      recipient_id: recipientId,
      action_id: input.action.id,
      action_event_id: input.event.id,
      event_type: eventType,
      severity: input.action.severity,
      title: content.title,
      message: content.message,
      route: `/app/alerts#action-${text(input.action.id)}`,
    }));
    const { error } = await db.from("notifications").upsert(rows, { onConflict: "recipient_id,action_event_id", ignoreDuplicates: true });
    if (error) throw error;
    return { created: rows.length };
  } catch (error) {
    console.error("notification_publish_failed", { code: error instanceof Error ? error.name : "UNKNOWN" });
    return { created: 0 };
  }
}

async function loadPreference(ctx: AccessContext): Promise<NotificationPreference> {
  const { data } = await db.from("notification_preferences").select("in_app_minimum_severity,email_enabled,email_minimum_severity").eq("profile_id", ctx.userId).eq("org_id", ctx.orgId).maybeSingle();
  if (!data) return defaultPreference;
  return {
    inAppMinimumSeverity: text(data.in_app_minimum_severity) as InAppThreshold,
    emailEnabled: Boolean(data.email_enabled),
    emailMinimumSeverity: text(data.email_minimum_severity) as NotificationSeverity,
  };
}

function item(row: Row): NotificationItem {
  return {
    id: text(row.id), actionId: text(row.action_id), eventType: text(row.event_type),
    severity: text(row.severity) as NotificationSeverity, title: text(row.title), message: text(row.message),
    route: text(row.route), readAt: text(row.read_at) || null, createdAt: text(row.created_at),
  };
}

export async function loadNotificationCenter(ctx: AccessContext): Promise<NotificationCenter> {
  const [preferences, notificationResult] = await Promise.all([
    loadPreference(ctx),
    db.from("notifications").select("id,action_id,event_type,severity,title,message,route,read_at,created_at").eq("org_id", ctx.orgId).eq("recipient_id", ctx.userId).is("archived_at", null).order("created_at", { ascending: false }).limit(50),
  ]);
  if (notificationResult.error) throw new Error(notificationResult.error.message);
  const notifications = (notificationResult.data ?? []).map(item).filter((notification: NotificationItem) => allows(preferences.inAppMinimumSeverity, notification.severity));
  const readiness = emailDeliveryReadiness();
  return {
    notifications,
    unreadCount: notifications.filter((notification: NotificationItem) => !notification.readAt).length,
    preferences,
    email: { available: readiness.available, enabled: preferences.emailEnabled, reason: readiness.reason },
  };
}

export async function updateNotificationCenter(ctx: AccessContext, input: unknown) {
  const command = notificationCommand.parse(input);
  const now = new Date().toISOString();
  if (command.command === "mark_read") {
    const { error } = await db.from("notifications").update({ read_at: now }).eq("id", command.notificationId).eq("org_id", ctx.orgId).eq("recipient_id", ctx.userId).is("read_at", null);
    if (error) throw new Error(error.message);
  } else if (command.command === "mark_all_read") {
    const { error } = await db.from("notifications").update({ read_at: now }).eq("org_id", ctx.orgId).eq("recipient_id", ctx.userId).is("read_at", null);
    if (error) throw new Error(error.message);
  } else {
    const readiness = emailDeliveryReadiness();
    if (command.emailEnabled && !readiness.available) throw new Error(readiness.reason ?? "Email delivery is unavailable.");
    const { error } = await db.from("notification_preferences").upsert({
      profile_id: ctx.userId, org_id: ctx.orgId, in_app_minimum_severity: command.inAppMinimumSeverity,
      email_enabled: command.emailEnabled, email_minimum_severity: command.emailMinimumSeverity,
      updated_at: now, updated_by: ctx.userId,
    }, { onConflict: "profile_id" });
    if (error) throw new Error(error.message);
  }
  return loadNotificationCenter(ctx);
}

export async function dispatchNotificationOutbox(limit = 25) {
  const readiness = emailDeliveryReadiness();
  if (!readiness.available) return { status: "disabled", attempted: 0, sent: 0, failed: 0, reason: readiness.reason };

  const { data: preferences, error: preferenceError } = await db.from("notification_preferences").select("profile_id,org_id,email_minimum_severity,updated_at").eq("email_enabled", true);
  if (preferenceError) throw new Error(preferenceError.message);
  const recipientIds = (preferences ?? []).map((row: Row) => text(row.profile_id)).filter(Boolean);
  if (!recipientIds.length) return { status: "ready", attempted: 0, sent: 0, failed: 0 };

  const { data: pending, error: notificationError } = await db.from("notifications").select("id,org_id,recipient_id,action_id,event_type,severity,title,message,route,read_at,created_at").in("recipient_id", recipientIds).order("created_at", { ascending: false }).limit(250);
  if (notificationError) throw new Error(notificationError.message);
  const notificationIds = (pending ?? []).map((row: Row) => text(row.id));
  const { data: attempts, error: attemptError } = notificationIds.length
    ? await db.from("notification_delivery_attempts").select("notification_id,attempt_number,status,retry_after").in("notification_id", notificationIds).eq("channel", "email")
    : { data: [], error: null };
  if (attemptError) throw new Error(attemptError.message);

  const thresholdByRecipient = new Map<string, NotificationSeverity>((preferences ?? []).map((row: Row) => [text(row.profile_id), text(row.email_minimum_severity) as NotificationSeverity]));
  const enabledAtByRecipient = new Map<string, number>((preferences ?? []).map((row: Row) => [text(row.profile_id), Date.parse(text(row.updated_at))]));
  const now = Date.now();
  const eligible = (pending ?? []).filter((row: Row) => {
    const recipientId = text(row.recipient_id);
    const threshold = thresholdByRecipient.get(recipientId) ?? "high";
    if (!allows(threshold, text(row.severity) as NotificationSeverity)) return false;
    if (Date.parse(text(row.created_at)) < (enabledAtByRecipient.get(recipientId) ?? now)) return false;
    const history = (attempts ?? []).filter((attempt: Row) => text(attempt.notification_id) === text(row.id));
    if (history.some((attempt: Row) => text(attempt.status) === "sent") || history.length >= 3) return false;
    const latest = history.sort((left: Row, right: Row) => Number(right.attempt_number) - Number(left.attempt_number))[0];
    return !latest?.retry_after || Date.parse(text(latest.retry_after)) <= now;
  }).slice(0, limit);

  let sent = 0, failed = 0;
  for (const row of eligible) {
    const history = (attempts ?? []).filter((attempt: Row) => text(attempt.notification_id) === text(row.id));
    const attemptNumber = history.length + 1;
    try {
      const { data: authUser } = await governanceAdmin.auth.admin.getUserById(text(row.recipient_id));
      const email = authUser.user?.email;
      if (!email) throw Object.assign(new Error("Recipient email is unavailable."), { code: "RECIPIENT_EMAIL_MISSING" });
      const result = await sendNotificationEmail({ to: email, notification: item(row) });
      const { error: sentEvidenceError } = await db.from("notification_delivery_attempts").insert({ org_id: row.org_id, notification_id: row.id, channel: "email", attempt_number: attemptNumber, status: "sent", provider: "cloudflare-email", provider_message_id: result.providerMessageId });
      if (sentEvidenceError) throw Object.assign(new Error("Email was sent but delivery evidence could not be stored."), { code: "DELIVERY_EVIDENCE_WRITE_FAILED" });
      sent += 1;
    } catch (error: unknown) {
      const code = typeof error === "object" && error && "code" in error ? text((error as { code?: unknown }).code) : "PROVIDER_ERROR";
      const retryMinutes = 5 * 2 ** (attemptNumber - 1);
      const { error: failedEvidenceError } = await db.from("notification_delivery_attempts").insert({ org_id: row.org_id, notification_id: row.id, channel: "email", attempt_number: attemptNumber, status: "failed", provider: "cloudflare-email", failure_code: code.slice(0, 80), retry_after: attemptNumber < 3 ? new Date(now + retryMinutes * 60_000).toISOString() : null });
      if (failedEvidenceError && code !== "DELIVERY_EVIDENCE_WRITE_FAILED") throw new Error("Notification delivery failed and its evidence could not be stored.");
      failed += 1;
    }
  }
  return { status: "ready", attempted: eligible.length, sent, failed };
}
