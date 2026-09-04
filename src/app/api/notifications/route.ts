import { ZodError } from "zod";

import { getAccessContext, isAccessResponse } from "@/lib/access-context";
import { loadNotificationCenter, updateNotificationCenter } from "@/lib/notification-service";

export async function GET() {
  try {
    const context = await getAccessContext({ tenant: true });
    if (isAccessResponse(context)) return context;
    return Response.json(await loadNotificationCenter(context), { headers: { "Cache-Control": "no-store" } });
  } catch (error: unknown) {
    return Response.json({ error: error instanceof Error ? error.message : "Notifications could not be loaded." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const context = await getAccessContext({ tenant: true });
    if (isAccessResponse(context)) return context;
    return Response.json(await updateNotificationCenter(context, await request.json()));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Notification settings could not be updated.";
    return Response.json({ error: message }, { status: error instanceof ZodError ? 400 : /unavailable|not configured/i.test(message) ? 503 : 409 });
  }
}
