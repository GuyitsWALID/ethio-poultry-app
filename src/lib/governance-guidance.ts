export type GovernanceGuidance = {
  request_type: string;
  farm_id?: string | null;
  warehouse_id?: string | null;
  source_table?: string | null;
  source_id?: string | null;
  source_version?: string | null;
  reason: string;
  proposed_values: Record<string, unknown>;
  changed_fields: string[];
  destination: string;
  correction_route: string;
  finding?: string | null;
};

export function governanceGuidanceUrl(guidance: GovernanceGuidance) {
  const params = new URLSearchParams({
    request_type: guidance.request_type,
    reason: guidance.reason,
    proposed_values: JSON.stringify(guidance.proposed_values),
    destination: guidance.destination,
    correction_route: guidance.correction_route,
  });
  for (const [key, value] of Object.entries({
    farm_id: guidance.farm_id,
    warehouse_id: guidance.warehouse_id,
    source_table: guidance.source_table,
    source_id: guidance.source_id,
    source_version: guidance.source_version,
    finding: guidance.finding,
  })) if (value) params.set(key, value);
  return `/app/governance?${params.toString()}`;
}
