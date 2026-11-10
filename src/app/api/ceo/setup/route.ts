import {accessJson, getAccessContext, governanceAdmin, isAccessResponse} from "@/lib/access-context";
import {branchStructureInput} from "@/lib/branch-structure-input";

export async function POST(request: Request) {
  const context = await getAccessContext({tenant: true});
  if (isAccessResponse(context)) return context;
  if (context.role !== "ceo" || context.supportSessionId) return accessJson({error: "Only the CEO can create branch structure."}, 403);
  const parsed = branchStructureInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return accessJson({error: "Choose valid farms, house types and capacities. Placement and account creation must use their separate workflows.", code: "INVALID_STRUCTURE"}, 400);
  const {request_id, ...structure} = parsed.data;
  const {data, error} = await (governanceAdmin as unknown as {
    rpc(name: string, args: Record<string, unknown>): Promise<{data: unknown; error: {message: string; code?: string} | null}>;
  }).rpc("create_branch_structure", {p_actor: context.userId, p_org: context.orgId, p_request: request_id, p_structure: structure});
  if (error) return accessJson({error: error.message, code: error.code}, error.code === "42501" ? 403 : ["40001", "23505"].includes(error.code ?? "") ? 409 : ["22023", "22P02", "23514"].includes(error.code ?? "") ? 400 : 500);
  return accessJson({success: true, ids: data}, 201);
}
