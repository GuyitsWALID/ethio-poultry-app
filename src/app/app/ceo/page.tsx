import { ExecutiveControlTower } from "@/components/ceo/executive-control-tower";
import { FarmScopeFilters } from "@/components/farm-scope-filters";

export default function AdminOverview() { return <><FarmScopeFilters title="Command Center filters" showPeriod /><ExecutiveControlTower /></>; }
