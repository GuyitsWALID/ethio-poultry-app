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

function copy(eventType: string, action: Row, event: Row) {
  const owner = text((action.owner as Row | null)?.full_name) || "the assigned Farm Manager";
  const actorName = text(event.actor_name_snapshot) || "System";
  const actionTitle = text(action.title) || "Operational action updated";
  const context = text(action.context) || actionTitle;
  const messages: Record<string, string> = {
    discovered: "A deterministic check created a new action that needs CEO assignment.",
    assigned: `${context} Open it in Action Desk for details and the next step.`,
    claimed: `${owner} claimed this action and is now responsible for the next step.`,
    acknowledged: `${owner} acknowledged responsibility for this action.`,
    work_started: `${owner} started investigating this action.`,
    resolution_submitted: `${actorName} marked this task complete. Review the corrected source, then verify and close it in Action Desk.`,
    verification_failed: "The source check still reports this issue. Review the correction and try verification again.",
    system_verified: "The originating check no longer reports this issue. The action has been verified and closed.",
    escalated: "This action passed its due date without verified resolution and now requires management attention.",
    reopened: "The originating check reported this issue again after an earlier resolution.",
    due_date_changed: "The CEO changed the due date for this assigned action.",
  };
  return {
    title: eventType === "assigned" ? `New task assigned by ${actorName}` : eventType === "resolution_submitted" ? `Task completed by ${actorName}` : actionTitle,
    message: messages[eventType] ?? "This operational action has new activity.",
  };
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
    const content = copy(eventType, input.action, input.event);
    const exactRecordCheckRoute = text(input.action.source_name) === "Record Checks"
      && ["assigned", "resolution_submitted", "verification_failed", "system_verified"].includes(eventType)
      ? text(input.action.source_route)
      : "";
    const rows = recipients.map((recipientId) => ({
      org_id: input.action.org_id,
      recipient_id: recipientId,
      action_id: input.action.id,
      action_event_id: input.event.id,
      event_type: eventType,
      severity: input.action.severity,
      title: content.title,
      message: content.message,
      route: exactRecordCheckRoute || `/app/alerts#action-${text(input.action.id)}`,
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
  const { data, error } = await db.from("notification_preferences").select("in_app_minimum_severity,email_enabled,email_minimum_severity").eq("profile_id", ctx.userId).eq("org_id", ctx.orgId).maybeSingle();
  if (error) throw new Error("Notification settings could not be checked.");
  if (!data) return defaultPreference;
  return {
    inAppMinimumSeverity: text(data.in_app_minimum_severity) as InAppThreshold,
    emailEnabled: Boolean(data.email_enabled),
    emailMinimumSeverity: text(data.email_minimum_severity) as NotificationSeverity,
  };
}

function item(row: Row): NotificationItem {
  const action = row.action as Row | null;
  const actionEvent = row.action_event as Row | null;
  const eventType = text(row.event_type);
  const actorName = text(actionEvent?.actor_name_snapshot) || (eventType === "assigned" ? "System" : "");
  const actionContext = text(action?.context) || null;
  const sourceCleared = Boolean(action?.source_resolved_at) && text(action?.status) !== "resolved";
  const sourceClearedMessage = text(action?.status) === "awaiting_verification"
    ? "The correction was submitted and the source check is clear. CEO review is pending."
    : "The source check is now clear. Confirm completion and send the task to the CEO for review.";
  return {
    id: text(row.id), actionId: text(row.action_id), eventType,
    severity: text(row.severity) as NotificationSeverity,
    title: sourceCleared ? `Source corrected: ${text(action?.title) || text(row.title)}` : eventType === "assigned" ? `New task assigned by ${actorName}` : text(row.title),
    message: sourceCleared ? sourceClearedMessage : eventType === "assigned" && actionContext ? `${actionContext} Open it in Action Desk for details and the next step.` : text(row.message),
    actorName: actorName || null, actorRole: text(actionEvent?.actor_role_snapshot) || null,
    actionContext, dueAt: text(action?.due_at) || null,
    route: text(row.route), readAt: text(row.read_at) || null, createdAt: text(row.created_at),
  };
}

export async function loadNotificationCenter(ctx: AccessContext): Promise<NotificationCenter> {
  const preferences = await loadPreference(ctx);
  const optional = preferences.inAppMinimumSeverity === "off" ? [] : Object.keys(severityRank).filter(severity => allows(preferences.inAppMinimumSeverity, severity as NotificationSeverity));
  const allowed = `event_type.in.(assigned,resolution_submitted)${optional.length ? `,severity.in.(${optional.join(",")})` : ""}`;
  const [notificationResult, unread] = await Promise.all([
    db.from("authorized_notifications").select("id,action_id,event_type,severity,title,message,route,read_at,created_at,action:operational_actions!notifications_action_id_fkey(title,context,status,source_resolved_at,due_at),action_event:operational_action_events!notifications_action_event_id_fkey(actor_name_snapshot,actor_role_snapshot)").eq("org_id", ctx.orgId).eq("recipient_id", ctx.userId).is("archived_at", null).or(allowed).order("created_at", { ascending: false }).order("id", {ascending: false}).limit(50),
    db.from("authorized_notifications").select("id", {count: "exact", head: true}).eq("org_id", ctx.orgId).eq("recipient_id", ctx.userId).is("archived_at", null).is("read_at", null).or(allowed),
  ]);
  if (notificationResult.error) throw new Error(notificationResult.error.message);
  if (unread.error) throw new Error("Unread notifications could not be counted.");
  const notifications = (notificationResult.data ?? []).map(item).filter((notification: NotificationItem) => ["assigned", "resolution_submitted"].includes(notification.eventType) || allows(preferences.inAppMinimumSeverity, notification.severity));
  const readiness = emailDeliveryReadiness();
  return {
    notifications,
    unreadCount: unread.count ?? 0,
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

  const {data:eligible,error}=await db.rpc("claim_notification_emails",{p_limit:limit});
  if(error)throw new Error("Email deliveries could not be claimed.");
  let sent = 0, failed = 0, uncertain=0, skipped=0;
  for (const row of eligible as Row[]) {
    if(row.dispatch_status==="uncertain"){uncertain++;continue;}
    const phase=async(status:string,code:string|null=null,messageId:string|null=null,retry=false)=>{
      const result=await db.rpc("record_notification_email_phase",{p_notification:row.id,p_token:row.claim_token,p_status:status,p_code:code,p_message_id:messageId,p_retry:retry});
      if(result.error)throw new Error("Email delivery evidence could not be stored.");
      return result.data as string;
    };
    let sending=false;
    try {
      // Access may have been revoked after the outbox read.
      const {data: authorized, error: accessError} = await db.rpc("notification_recipient_has_access", {p_notification: row.id});
      if (accessError) throw Object.assign(new Error("Recipient access could not be checked."), {code: "RECIPIENT_ACCESS_CHECK_FAILED"});
      if (authorized !== true) {await phase("sending");skipped++;continue;}
      const { data: authUser } = await governanceAdmin.auth.admin.getUserById(text(row.recipient_id));
      const email = authUser.user?.email;
      if (!email) throw Object.assign(new Error("Recipient email is unavailable."), { code: "RECIPIENT_EMAIL_MISSING" });
      if(await phase("sending")!=="sending"){skipped++;continue;}
      sending=true;
      const result = await sendNotificationEmail({ to: email, notification: item(row) });
      if(await phase("sent",null,result.providerMessageId)==="sent")sent++;
    } catch (error: unknown) {
      const code = typeof error === "object" && error && "code" in error ? text((error as { code?: unknown }).code) : "PROVIDER_ERROR";
      const definitelyUnsent=!sending || (typeof error==="object"&&error!==null&&"definitelyUnsent" in error&&error.definitelyUnsent===true);
      // An unknown provider result must not turn into an automatic duplicate send.
      const outcome=await phase(definitelyUnsent?"failed":"uncertain",code,null,definitelyUnsent);
      if(outcome==="sent")sent++;else if(outcome==="uncertain")uncertain++;else failed++;
    }
  }
  return { status: "ready", attempted: eligible.length, sent, failed, uncertain, skipped };
}
