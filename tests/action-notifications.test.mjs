import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const migration = await readFile(new URL("../supabase/migrations/20260902000000_configurable_action_notifications.sql", import.meta.url), "utf8");
const service = await readFile(new URL("../src/lib/notification-service.ts", import.meta.url), "utf8");
const actionService = await readFile(new URL("../src/lib/accountable-actions.ts", import.meta.url), "utf8");
const bell = await readFile(new URL("../src/components/header-alert-bell.tsx", import.meta.url), "utf8");
const settings = await readFile(new URL("../src/components/notifications/notification-settings-panel.tsx", import.meta.url), "utf8");
const monitoring = await readFile(new URL("../.github/workflows/platform-monitoring.yml", import.meta.url), "utf8");
const wrangler = await readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8");
const emailAdapter = await readFile(new URL("../src/lib/notification-email.ts", import.meta.url), "utf8");

test("notification custody is recipient-scoped and direct client mutation is denied", () => {
  assert.match(migration, /create table if not exists public\.notification_preferences/i);
  assert.match(migration, /create table if not exists public\.notifications/i);
  assert.match(migration, /create table if not exists public\.notification_delivery_attempts/i);
  assert.match(migration, /recipient_id=auth\.uid\(\)/i);
  assert.match(migration, /notification_delivery_attempts_append_only/i);
  assert.match(migration, /revoke insert,update,delete on public\.notification_preferences,public\.notifications,public\.notification_delivery_attempts from anon,authenticated/i);
});

test("action events publish durable role-aware notifications", () => {
  assert.match(actionService, /publishActionEventNotifications/);
  assert.match(service, /recipient_id,action_event_id/);
  assert.match(service, /notifyOwner/);
  assert.match(service, /notifyCeo/);
  assert.match(service, /"resolution_submitted", "verification_failed", "system_verified"/);
  assert.match(service, /recipients\.delete\(actorId\)/);
  assert.match(service, /severityRank/);
});

test("notification experience supports unread state and user-controlled thresholds", () => {
  assert.match(bell, /unreadCount/);
  assert.match(bell, /mark_read/);
  assert.match(bell, /mark_all_read/);
  assert.match(settings, /update_preferences/);
  assert.match(settings, /Changing notifications never changes ownership, deadlines, escalation, or verification/);
});

test("external delivery is opt-in, bounded, and disabled by default", () => {
  assert.match(service, /history\.length >= 3/);
  assert.match(service, /email_enabled/);
  assert.match(service, /enabledAtByRecipient/);
  assert.match(emailAdapter, /NOTIFICATION_EMAIL_ENABLED.*=== "true"/);
  assert.match(wrangler, /"send_email"/);
  assert.match(monitoring, /platform-monitoring\.mjs notifications/);
});
