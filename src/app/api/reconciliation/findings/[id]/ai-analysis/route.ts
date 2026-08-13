import { getAccessContext, isAccessResponse } from "@/lib/access-context";
import {
  analyzeReconciliationFinding,
  getReconciliationAiAnalysis,
  ReconciliationAiError,
} from "@/lib/reconciliation-ai-service";

const REQUEST_KEY = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function failure(error: unknown) {
  if (error instanceof ReconciliationAiError) {
    return Response.json({ error: error.message, code: error.code, retryable: error.retryable }, { status: error.status });
  }
  return Response.json({ error: "AI guidance is temporarily unavailable.", code: "AI_ANALYSIS_ERROR", retryable: true }, { status: 500 });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getAccessContext({ tenant: true });
  if (isAccessResponse(context)) return context;
  const { id } = await params;
  try {
    return Response.json(await getReconciliationAiAnalysis(context, id));
  } catch (error) {
    return failure(error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getAccessContext({ tenant: true });
  if (isAccessResponse(context)) return context;
  const { id } = await params;
  const body = await request.json().catch(() => null) as { regenerate?: unknown; requestKey?: unknown } | null;
  if (!body || (body.regenerate !== undefined && typeof body.regenerate !== "boolean")) {
    return Response.json({ error: "A valid AI analysis request is required.", code: "INVALID_REQUEST", retryable: false }, { status: 400 });
  }
  const requestKey = typeof body.requestKey === "string" ? body.requestKey : "";
  if (requestKey && !REQUEST_KEY.test(requestKey)) {
    return Response.json({ error: "The request identifier is invalid.", code: "INVALID_REQUEST_KEY", retryable: false }, { status: 400 });
  }
  try {
    const analysis = await analyzeReconciliationFinding(context, id, {
      regenerate: body.regenerate === true,
      requestKey: requestKey || undefined,
    });
    return Response.json({ analysis });
  } catch (error) {
    return failure(error);
  }
}
