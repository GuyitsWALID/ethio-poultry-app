export type ReportClaim = {status: "claimed"; claim_token: string} | {status: "completed"; run_id: string} | {status: "busy"};
export class ReportBusyError extends Error {constructor() {super("This report is already being generated. Retry shortly.");}}

// Database adapters own transactions; this coordinates retries and lost responses.
export async function executeReportGeneration<T>(steps: {
  claim(): Promise<ReportClaim>;
  load(): Promise<T>;
  finish(token: string, evidence: T): Promise<string>;
  fail(token: string, error: unknown): Promise<{status: string; run_id?: string}>;
}) {
  const claim = await steps.claim();
  if (claim.status === "completed") return claim.run_id;
  if (claim.status === "busy") throw new ReportBusyError();
  try { return await steps.finish(claim.claim_token, await steps.load()); }
  catch (error) {
    const result = await steps.fail(claim.claim_token, error);
    if (result.status === "completed" && result.run_id) return result.run_id;
    throw error;
  }
}
