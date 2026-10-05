import { OperationsAnalyticsControlRoom } from "@/components/analytics/operations-analytics-control-room";
import {ReportAnalyticsHandoff} from "@/components/reports/report-analytics-handoff";

export default function AnalyticsPage() {
  return <ReportAnalyticsHandoff section="production"><OperationsAnalyticsControlRoom /></ReportAnalyticsHandoff>;
}
