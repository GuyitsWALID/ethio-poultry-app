export const actionSeverities = ["high", "medium", "low"] as const;
export const actionStatuses = ["open", "assigned", "acknowledged", "in_progress", "awaiting_verification", "escalated", "resolved"] as const;

export type ActionSeverity = (typeof actionSeverities)[number];
export type ActionStatus = (typeof actionStatuses)[number];

export type OperationalAlert = {
  id: string;
  title: string;
  severity: ActionSeverity;
  source: string;
  context: string;
  route: string;
  createdAt: string;
  farmId?: string | null;
  warehouseId?: string | null;
};

export type ActionOwner = { id: string; name: string; scope: string };

export type ActionEvent = {
  id: string;
  eventType: string;
  actorName: string;
  actorRole: string;
  note: string | null;
  createdAt: string;
};

export type ActionCard = OperationalAlert & {
  actionId: string;
  status: ActionStatus;
  ownerId: string | null;
  ownerName: string | null;
  dueAt: string;
  acknowledgedAt: string | null;
  resolutionSummary: string | null;
  resolutionEvidence: string | null;
  escalatedAt: string | null;
  canAssign: boolean;
  canClaim: boolean;
  canWork: boolean;
  events: ActionEvent[];
};

export type ActionDesk = {
  role: "ceo" | "farm_manager" | "system_admin";
  viewerId: string;
  actions: ActionCard[];
  owners: ActionOwner[];
  summary: { unassigned: number; mine: number; dueSoon: number; escalated: number; awaitingVerification: number };
};
