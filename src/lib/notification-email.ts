import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";

import type { NotificationItem } from "@/lib/notification-contract";

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

export function emailDeliveryReadiness() {
  const enabled = process.env.NOTIFICATION_EMAIL_ENABLED?.trim().toLowerCase() === "true";
  const from = process.env.NOTIFICATION_EMAIL_FROM?.trim() ?? "";
  if (!enabled) return { available: false, reason: "External email delivery has not been enabled for this environment." };
  if (!from) return { available: false, reason: "A verified notification sender has not been configured." };
  return { available: true, reason: null };
}

export async function sendNotificationEmail(input: { to: string; notification: NotificationItem }) {
  const readiness = emailDeliveryReadiness();
  if (!readiness.available) throw Object.assign(new Error(readiness.reason ?? "Email delivery is unavailable."), { code: "EMAIL_NOT_CONFIGURED" });
  const { env } = await getCloudflareContext({ async: true });
  const workerEnv = env as CloudflareEnv & Env;
  if (!workerEnv.EMAIL) throw Object.assign(new Error("The Cloudflare email binding is unavailable."), { code: "EMAIL_BINDING_UNAVAILABLE" });

  const appBaseUrl = process.env.APP_BASE_URL?.replace(/\/$/, "") ?? "";
  const actionUrl = `${appBaseUrl}${input.notification.route.startsWith("/") ? input.notification.route : `/${input.notification.route}`}`;
  const title = escapeHtml(input.notification.title);
  const message = escapeHtml(input.notification.message);
  const severity = input.notification.severity === "high" ? "Urgent" : input.notification.severity === "medium" ? "Review" : "Advisory";
  const response = await workerEnv.EMAIL.send({
    to: input.to,
    from: { email: process.env.NOTIFICATION_EMAIL_FROM!, name: "EthioPoultry" },
    subject: `${severity}: ${input.notification.title}`,
    text: `${input.notification.title}\n\n${input.notification.message}\n\nOpen the action: ${actionUrl}\n\nThis is an operational notification from EthioPoultry.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#17352a"><p style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#6b7f75">EthioPoultry · ${severity}</p><h1 style="font-size:24px">${title}</h1><p style="line-height:1.6;color:#49675a">${message}</p><p><a href="${escapeHtml(actionUrl)}" style="display:inline-block;background:#17352a;color:white;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:600">Open assigned action</a></p><p style="margin-top:28px;font-size:12px;color:#71867b">The originating system remains authoritative. Correct the source and complete verification inside EthioPoultry.</p></div>`,
  });
  return { providerMessageId: response.messageId };
}
