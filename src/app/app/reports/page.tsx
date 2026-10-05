import { ReportsWorkspace } from "@/components/reports/consolidated-report-workspace";
import { RecordCheckCorrectionBanner } from "@/components/record-check-correction-banner";
import {Suspense} from "react";

export default function ReportsPage() {
  return <div className="space-y-5"><RecordCheckCorrectionBanner/><Suspense><ReportsWorkspace /></Suspense></div>;
}
