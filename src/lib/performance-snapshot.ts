import type {PerformanceResponse} from "./farm-performance";
import type {ReportResources} from "./report-snapshot";
export type PerformanceSnapshot = PerformanceResponse & {evidence_revision: string; report_resources: ReportResources; organization_name: string; display_locale: "en" | "am"};

// A monotonic database revision detects changes between independently authorized
// readers. Publication rechecks the same revision inside its audit transaction.
export async function captureConsistentPerformance(
  revision: () => Promise<string>,
  capture: () => Promise<Omit<PerformanceSnapshot, "evidence_revision">>,
): Promise<PerformanceSnapshot> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const before = await revision();
    const evidence = await capture();
    if (Object.values(evidence.sections).some(section => section.state === "failed")) throw new Error("REPORT_EVIDENCE_INCOMPLETE");
    if (before === await revision()) return {...evidence, evidence_revision: before};
  }
  throw new Error("REPORT_EVIDENCE_CHANGED");
}
