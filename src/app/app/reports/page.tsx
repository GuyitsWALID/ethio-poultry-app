import { BranchReportWorkspace } from "@/components/reports/branch-report-workspace";
import { RecordCheckCorrectionBanner } from "@/components/record-check-correction-banner";

export default function ReportsPage() {
  return <div className="space-y-5"><RecordCheckCorrectionBanner/><BranchReportWorkspace /></div>;
}
