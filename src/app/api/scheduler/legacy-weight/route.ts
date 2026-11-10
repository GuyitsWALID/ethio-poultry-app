import {z} from "zod";
import {accessJson, getAccessContext, governanceAdmin, isAccessResponse} from "@/lib/access-context";
import {validHistoryDate} from "@/lib/history/contracts";
const input = z.object({request_id: z.string().uuid(), legacy_id: z.string().uuid(), revision: z.string().datetime({offset: true}), date: z.string().refine(validHistoryDate), reason: z.string().trim().min(8).max(2000)}).strict();
export async function POST(request: Request) {
 const context = await getAccessContext({tenant: true}); if (isAccessResponse(context)) return context;
 if (context.role !== "ceo" || context.supportSessionId) return accessJson({error: "CEO decision required."}, 403);
 const parsed = input.safeParse(await request.json().catch(() => null)); if (!parsed.success) return accessJson({error: "Select the exact legacy check, date and reason."}, 400);
 const value = parsed.data;
 const {data, error} = await (governanceAdmin as unknown as {rpc(name: string, args: Record<string, unknown>): Promise<{data: unknown; error: {message: string; code?: string} | null}>}).rpc("reschedule_legacy_template_weight", {p_actor: context.userId, p_task: value.legacy_id, p_revision: value.revision, p_date: value.date, p_reason: value.reason, p_request: value.request_id});
 return error ? accessJson({error: error.message}, error.code === "42501" ? 403 : ["40001", "55000"].includes(error.code ?? "") ? 409 : ["22023", "23514", "22P02"].includes(error.code ?? "") ? 400 : 500) : accessJson({rule: data}, 201);
}
