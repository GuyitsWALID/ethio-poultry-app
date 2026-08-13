export type ReconciliationWorkflowInput = {
  rule_code: string;
  domain: string;
  severity: "critical" | "high" | "medium" | "low";
  status: string;
  title: string;
  explanation: string;
  recommended_action: string;
  finding_date?: string | null;
  flock_code?: string | null;
  farm_name?: string | null;
  warehouse_name?: string | null;
};

export type ReconciliationWorkflow = {
  plainTitle: string;
  plainExplanation: string;
  whyItMatters: string;
  likelyCauses: string[];
  owner: string;
  destination: { href: string; label: string; context: string };
  verification: string;
  stage: "needs_action" | "in_review" | "verified" | "exception";
  stageLabel: string;
  priorityLabel: string;
  priorityKind: "guidance" | "operational" | "governance";
};

type RuleGuide = {
  title: string;
  explanation?: string;
  causes: string[];
  href: string;
  destination: string;
  destinationContext: string;
  verification: string;
};

const domainWhy: Record<string, string> = {
  birds: "Population reports, mortality rates, feed-per-bird figures, and flock valuation may be unreliable until the bird custody records agree.",
  feed: "Feed stock, consumption, and feed-cost analytics may be overstated or understated until the feeding records agree.",
  mortality: "The farm cannot reliably identify why birds are being lost when the official death count and cause records disagree.",
  eggs_sales: "Egg custody, sales availability, revenue, and production-yield reporting may be unreliable until the records agree.",
  inventory: "The warehouse may contain more or less stock than the system reports, creating purchasing, custody, and loss risk.",
  financial: "Farm, flock, and batch profitability cannot be trusted until the cost is assigned and supported correctly.",
  lineage: "Bird ownership and placement history may be unreliable, affecting flock counts, costs, and lifecycle decisions.",
  governance: "A protected record may have changed outside the approved correction process and needs management review.",
};

const rules: Record<string, RuleGuide> = {
  BIRD_DAY_COUNTS_MISSING: {
    title: "An opening or closing bird count is missing",
    causes: ["The Daily Record was saved before the physical count was completed.", "A locked day needs a correction request."],
    href: "/app/daily-records", destination: "Open Daily Records", destinationContext: "Complete the bird counts for the affected flock and date.",
    verification: "The system will check that both counts are present and that the bird movement equation can be calculated.",
  },
  BIRD_DAY_IMBALANCE: {
    title: "The daily bird count does not balance",
    causes: ["A death, cull, transfer, or other removal is missing.", "The opening or closing physical count was entered incorrectly."],
    href: "/app/daily-records", destination: "Review the Daily Record", destinationContext: "Compare movements and losses with the closing physical count.",
    verification: "The check clears only when opening birds plus arrivals minus every recorded loss and departure equals closing birds.",
  },
  EGG_CLASSIFICATION_MISMATCH: {
    title: "The egg quality totals do not equal the eggs collected",
    causes: ["Normal, broken, or dirty eggs were counted incorrectly.", "The total collection was entered before classification finished."],
    href: "/app/daily-records", destination: "Review egg collection", destinationContext: "Recount the egg categories against the total collected.",
    verification: "The system will add all egg-quality categories and compare the result with total eggs collected.",
  },
  MORTALITY_ALLOCATION_MISMATCH: {
    title: "The death total and recorded causes do not match",
    causes: ["A mortality cause has not been recorded.", "A cause event contains more birds than the official Daily Record death total."],
    href: "/app/mortality", destination: "Review mortality records", destinationContext: "Match every recorded death to a cause or documented unexplained remainder.",
    verification: "The finding clears when mortality cause events equal the official Daily Record death count.",
  },
  LOCKED_RECORD_CHANGED_WITHOUT_APPROVAL: {
    title: "A locked Daily Record changed without approval",
    causes: ["A correction bypassed the governed request process.", "An approved correction exists but was not linked to this record."],
    href: "/app/governance", destination: "Review correction history", destinationContext: "Inspect the audit trail and require a governed correction explanation.",
    verification: "A CEO-approved correction must reference the changed source record.",
  },
  BIRD_DAY_CONTINUITY_BREAK: {
    title: "One day’s closing bird count does not match the next opening count",
    causes: ["A transfer or loss occurred between records but was not entered.", "One of the two physical counts is incorrect."],
    href: "/app/daily-records", destination: "Compare the two Daily Records", destinationContext: "Review the consecutive dates and record the missing movement or correction.",
    verification: "The next day must open with the same number of birds recorded at the previous close.",
  },
  FLOCK_CURRENT_COUNT_MISMATCH: {
    title: "The flock population does not match its latest Daily Record",
    causes: ["The flock master count was changed separately.", "A recent Daily Record or lifecycle movement is incomplete."],
    href: "/app/flocks", destination: "Review the flock profile", destinationContext: "Compare the flock population with the latest approved close.",
    verification: "The flock profile and latest closing bird count must agree.",
  },
  FEED_SESSION_CLOSE_MISMATCH: {
    title: "Feeding sessions do not equal the closed feed total",
    causes: ["A feeding session is missing or duplicated.", "The feeding day was closed before all sessions were completed."],
    href: "/app/feeding-log", destination: "Review Today’s Feeding", destinationContext: "Reopen the feeding day, verify its sessions, and close it again.",
    verification: "Completed feeding sessions must add up to the closed daily feed total.",
  },
  FEED_DAILY_SYNC_MISMATCH: {
    title: "Feed Control and the Daily Record do not agree",
    causes: ["The feeding day did not synchronize correctly.", "A legacy or manual feed value conflicts with Feed Control."],
    href: "/app/feeding-log", destination: "Review the feeding day", destinationContext: "Reopen and reclose the day so Feed Control synchronizes the Daily Record.",
    verification: "The Feed Control close and its synchronized Daily Record total must agree.",
  },
  FEED_STOCK_ISSUE_MISMATCH: {
    title: "Feed used does not match the inventory deduction",
    causes: ["The feeding day did not post its stock issue correctly.", "A duplicate or missing inventory movement exists."],
    href: "/app/feeding-log", destination: "Review feed and stock", destinationContext: "Check the feeding close first, then inspect the linked inventory movement.",
    verification: "Feed Control and its canonical inventory deduction must contain the same quantity.",
  },
  EGG_SALE_UNLINKED: {
    title: "An egg sale is not linked to the flock that produced it",
    causes: ["The flock was omitted when recording the sale.", "Eggs from multiple flocks need a documented allocation."],
    href: "/app/sales", destination: "Review the sale", destinationContext: "Link the sale to its producing flock or document the approved allocation.",
    verification: "The sale must have a traceable production source.",
  },
  EGG_SALE_UNIT_UNCONVERTED: {
    title: "The sales unit cannot be converted into eggs",
    causes: ["A new sales unit was entered without an approved conversion.", "The sale used an inconsistent unit name."],
    href: "/app/sales", destination: "Review the sale unit", destinationContext: "Correct the unit or configure its approved egg conversion.",
    verification: "The system must be able to convert the sale quantity into individual eggs.",
  },
  EGG_OPENING_BALANCE_UNAVAILABLE: {
    title: "The flock’s opening egg balance is unknown",
    causes: ["Production records began after the flock was placed.", "Opening egg stock was never documented."],
    href: "/app/sales", destination: "Review egg custody", destinationContext: "Document the supported opening balance before relying on cumulative comparisons.",
    verification: "Production and sales custody must begin from a supported opening balance.",
  },
  EGG_SALES_EXCEED_PRODUCTION: {
    title: "Recorded egg sales exceed traceable production",
    causes: ["A sale is duplicated or uses the wrong unit.", "Production or opening egg stock is missing.", "A sale is linked to the wrong flock."],
    href: "/app/sales", destination: "Compare production and sales", destinationContext: "Review the sales, units, flock links, and missing production records.",
    verification: "Traceable marketable eggs plus supported opening stock must cover recorded egg sales.",
  },
  PHYSICAL_STOCK_VARIANCE: {
    title: "The physical stock count differs from the system balance",
    causes: ["A receipt, issue, transfer, or loss is missing.", "The physical count or unit of measure is incorrect."],
    href: "/app/inventory", destination: "Review inventory movements", destinationContext: "Recount the item and compare receipts, issues, transfers, and adjustments.",
    verification: "A confirmed adjustment or corrected movement must bring physical and ledger stock into agreement.",
  },
  REPEATED_STOCK_ADJUSTMENTS: {
    title: "This stock item has been adjusted repeatedly",
    causes: ["Routine movements are being recorded as adjustments.", "Counting, custody, or unit-conversion problems are recurring."],
    href: "/app/inventory", destination: "Review adjustment history", destinationContext: "Compare the adjustments with source documents and recent physical counts.",
    verification: "Future movements should use their correct transaction types and unexplained adjustments should stop recurring.",
  },
  COST_ALLOCATION_MISMATCH: {
    title: "A recorded cost has not been fully assigned",
    explanation: "The expense exists, but all or part of it is not assigned to the farm, flock, or batch that should carry the cost.",
    causes: ["The cost scope was left blank.", "Allocation percentages or amounts do not total the expense.", "The expense is genuinely organization-wide and needs a CEO exception."],
    href: "/app/inventory?tab=monthly", destination: "Review the cost record", destinationContext: "Assign the full expense to the correct operating scope, or request a CEO exception.",
    verification: "The allocation total must equal the recorded expense exactly, unless the CEO accepts a documented exception.",
  },
  LOCKED_FINANCIAL_PERIOD_HAS_GAPS: {
    title: "A locked financial period still contains unsupported costs",
    causes: ["The period was locked before all costs were assigned.", "A warning was accepted without complete supporting evidence."],
    href: "/app/inventory?tab=monthly", destination: "Review the locked period", destinationContext: "Inspect the warnings and submit a governed correction where required.",
    verification: "The corrected period must contain no unexplained allocation gaps.",
  },
  PAST_FINANCIAL_PERIOD_UNLOCKED: {
    title: "A past financial period is still open to changes",
    causes: ["Month-end review was not completed.", "Unresolved costs or warnings prevented the period from being locked."],
    href: "/app/inventory?tab=monthly", destination: "Complete month-end review", destinationContext: "Finish cost review and have the CEO lock the period.",
    verification: "The period must pass its checks and be locked by the CEO.",
  },
  ACTIVE_FLOCK_LINEAGE_BROKEN: {
    title: "An active flock’s farm, house, and batch history do not agree",
    causes: ["The flock or batch was moved without completing the lifecycle workflow.", "Farm or house ownership was changed independently."],
    href: "/app/flocks", destination: "Review flock lineage", destinationContext: "Stop lifecycle changes and submit a governed lineage correction.",
    verification: "The flock, batch, house, and farm must form one consistent custody chain.",
  },
  BATCH_FLOCK_PLACEMENT_MISMATCH: {
    title: "The batch bird total does not equal its flock placements",
    causes: ["A flock placement is missing or duplicated.", "The batch count changed without updating its flock split."],
    href: "/app/flocks", destination: "Review batch placements", destinationContext: "Compare the original batch total with every linked flock placement.",
    verification: "All linked flock placements must add up to the batch bird total.",
  },
  POSSIBLE_DUPLICATE_SALE: {
    title: "Two or more sales appear to be duplicates",
    causes: ["The same sale was entered more than once.", "Separate sales share identical details but need different source references."],
    href: "/app/sales", destination: "Compare the sales", destinationContext: "Confirm separate documents or void the duplicate through governance.",
    verification: "Every retained sale must have distinct, supportable source evidence.",
  },
};

function stage(status: string): Pick<ReconciliationWorkflow, "stage" | "stageLabel"> {
  if (status === "accepted_exception") return { stage: "exception", stageLabel: "CEO-approved exception" };
  if (status === "cleared") return { stage: "verified", stageLabel: "Verified automatically" };
  if (status === "resolved") return { stage: "verified", stageLabel: "Closed after review" };
  if (status === "acknowledged" || status === "investigating") return { stage: "in_review", stageLabel: "Review in progress" };
  return { stage: "needs_action", stageLabel: "Needs action" };
}

export function reconciliationWorkflow(
  finding: ReconciliationWorkflowInput,
  role: string,
): ReconciliationWorkflow {
  const guide = rules[finding.rule_code];
  const governance = finding.severity === "critical" || finding.domain === "governance" || finding.domain === "lineage";
  const priorityKind = finding.severity === "low" ? "guidance" : governance ? "governance" : "operational";
  const priorityLabel = priorityKind === "guidance" ? "Guidance" : priorityKind === "governance" ? "Management attention" : finding.severity === "high" ? "Action soon" : "Action needed";
  const owner = role === "ceo"
    ? governance || finding.domain === "financial" ? "CEO review · Farm Manager correction" : "Farm Manager correction"
    : governance ? "CEO review required" : "Your operating scope";

  return {
    plainTitle: guide?.title ?? finding.title,
    plainExplanation: guide?.explanation ?? finding.explanation,
    whyItMatters: domainWhy[finding.domain] ?? "Related operational reports may be unreliable until the source records agree.",
    likelyCauses: guide?.causes ?? ["A source record may be missing, duplicated, or entered incorrectly."],
    owner,
    destination: {
      href: guide?.href ?? "/app/reconciliation",
      label: guide?.destination ?? "Review the source records",
      context: guide?.destinationContext ?? finding.recommended_action,
    },
    verification: guide?.verification ?? "After the source record is corrected, run the check again to confirm that the records agree.",
    ...stage(finding.status),
    priorityLabel,
    priorityKind,
  };
}

