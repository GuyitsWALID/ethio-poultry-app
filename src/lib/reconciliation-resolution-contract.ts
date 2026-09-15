export type ResolutionMode = "direct" | "choose_source" | "governance" | "investigate";

export type ResolutionChoice = {
  id: string;
  label: string;
  explanation: string;
  href: string;
};

export type ResolutionAction = {
  actionId: string;
  status: "open" | "assigned" | "acknowledged" | "in_progress" | "awaiting_verification" | "escalated" | "resolved";
  ownerId: string | null;
  ownerName: string | null;
  dueAt: string;
  sourceCorrected: boolean;
  resolutionSummary: string | null;
};

export type ResolutionOwner = { id: string; name: string; scope: string };
export type ResolutionSourceRecord = { label: string; fields: Array<{ label: string; value: string }> };

export type ReconciliationResolution = {
  findingId: string;
  ruleCode: string;
  status: string;
  title: string;
  problem: string;
  scopeLabel: string;
  recordDate: string | null;
  mode: ResolutionMode;
  correction: {
    label: string;
    href: string;
    page: string;
    instruction: string;
    focusFields: string[];
  };
  comparison: { expected: string; recorded: string; difference: string };
  choices: ResolutionChoice[];
  sourceRecords: ResolutionSourceRecord[];
  target: {
    farmName: string | null;
    houseName: string | null;
    flockCode: string | null;
    batchCode: string | null;
    warehouseName: string | null;
    date: string | null;
    product: string | null;
    quantity: string | null;
    customer: string | null;
  };
  verification: string;
  canAssign: boolean;
  canWork: boolean;
  action: ResolutionAction | null;
  eligibleOwners: ResolutionOwner[];
};

type RuleResolution = {
  page: string;
  path: string;
  label: string;
  instruction: string;
  mode: ResolutionMode;
  focusFields: string[];
  choices?: Array<{ id: string; label: string; explanation: string; path: string }>;
};

const daily = "/app/daily-records";
const feed = "/app/feeding-log";
const sales = "/app/sales";
const inventory = "/app/inventory";
const reports = "/app/reports";
const flocks = "/app/flocks";
const mortality = "/app/mortality";
const governance = "/app/governance";

export const resolutionRules: Record<string, RuleResolution> = {
  BIRD_DAY_COUNTS_MISSING: { page: "Daily Records", path: daily, label: "Complete this Daily Record", instruction: "Enter the missing opening or closing bird count for the affected flock and date.", mode: "direct", focusFields: ["opening_birds", "closing_birds"] },
  BIRD_DAY_IMBALANCE: { page: "Daily Records", path: daily, label: "Balance this Daily Record", instruction: "Compare arrivals, deaths, culls, transfers, removals, and the closing count.", mode: "direct", focusFields: ["opening_birds", "transfers_in", "deaths", "culls", "transfers_out", "other_removals", "closing_birds"] },
  EGG_CLASSIFICATION_MISMATCH: { page: "Daily Records", path: daily, label: "Correct egg classification", instruction: "Make normal, broken, and dirty eggs add up to the total collected.", mode: "direct", focusFields: ["total_eggs", "normal_eggs", "broken_eggs", "dirty_eggs"] },
  MORTALITY_ALLOCATION_MISMATCH: { page: "Mortality and Daily Records", path: mortality, label: "Compare death records", instruction: "Choose whether the official Daily Record total or the mortality cause events are incorrect.", mode: "choose_source", focusFields: ["deaths", "mortality_events"], choices: [
    { id: "daily_record", label: "The Daily Record total is wrong", explanation: "Correct the official death count for this flock and date.", path: daily },
    { id: "mortality", label: "The mortality causes are wrong", explanation: "Add or correct the detailed mortality events for this flock and date.", path: mortality },
  ] },
  LOCKED_RECORD_CHANGED_WITHOUT_APPROVAL: { page: "Daily Records", path: daily, label: "Review correction history", instruction: "Inspect the exact locked Daily Record, then submit a governed correction or explanation for the changed fields.", mode: "governance", focusFields: ["updated_at", "locked_at"] },
  BIRD_DAY_CONTINUITY_BREAK: { page: "Daily Records", path: daily, label: "Compare both Daily Records", instruction: "Choose which consecutive day is wrong or record the missing movement between them.", mode: "choose_source", focusFields: ["closing_birds", "opening_birds"], choices: [
    { id: "prior_day", label: "Previous closing count is wrong", explanation: "Open the previous Daily Record.", path: daily },
    { id: "current_day", label: "Current opening count is wrong", explanation: "Open the current Daily Record.", path: daily },
  ] },
  FLOCK_CURRENT_COUNT_MISMATCH: { page: "Flocks and Daily Records", path: flocks, label: "Compare flock population", instruction: "Choose whether the flock master count or latest Daily Record closing count is incorrect.", mode: "choose_source", focusFields: ["current_count", "closing_birds"], choices: [
    { id: "flock", label: "Flock population is wrong", explanation: "Request a governed lifecycle correction.", path: flocks },
    { id: "daily_record", label: "Latest Daily Record is wrong", explanation: "Correct the latest closing count.", path: daily },
  ] },
  FEED_SESSION_CLOSE_MISMATCH: { page: "Feed Control", path: feed, label: "Review this feeding day", instruction: "Compare completed feeding sessions with the closed daily total.", mode: "direct", focusFields: ["feeding_sessions", "actual_feed_kg"] },
  FEED_DAILY_SYNC_MISMATCH: { page: "Feed Control", path: feed, label: "Resynchronize this feeding day", instruction: "Verify the feed day and use the supported reopen and close workflow to synchronize Daily Records.", mode: "direct", focusFields: ["actual_feed_kg", "daily_feed_total"] },
  FEED_STOCK_ISSUE_MISMATCH: { page: "Feed Control and Inventory", path: feed, label: "Compare feed and stock", instruction: "Choose whether the feeding close or its warehouse deduction is incorrect.", mode: "choose_source", focusFields: ["actual_feed_kg", "inventory_issue"], choices: [
    { id: "feed", label: "Feeding close is wrong", explanation: "Review and reclose the feeding day.", path: feed },
    { id: "inventory", label: "Warehouse deduction is wrong", explanation: "Inspect the linked stock movement and request a reasoned correction.", path: inventory },
  ] },
  EGG_SALE_UNLINKED: { page: "Sales", path: sales, label: "Link this sale", instruction: "Open the exact sale and select the flock that produced the eggs.", mode: "direct", focusFields: ["flock_id"] },
  EGG_SALE_UNIT_UNCONVERTED: { page: "Sales", path: sales, label: "Resolve this sales unit", instruction: "Choose an existing supported unit or request CEO approval for a new unit-to-egg conversion.", mode: "choose_source", focusFields: ["unit"], choices: [
    { id: "sale_unit", label: "The sale used the wrong unit", explanation: "Open the exact sale and select an already supported unit.", path: sales },
    { id: "new_conversion", label: "This unit needs a conversion", explanation: "Request a governed unit-to-egg multiplier with supporting evidence.", path: governance },
  ] },
  EGG_OPENING_BALANCE_UNAVAILABLE: { page: "Daily Records", path: daily, label: "Establish the production starting point", instruction: "Create the missing placement-date Daily Record, or request an evidenced opening balance for a legacy flock.", mode: "choose_source", focusFields: ["record_date", "normal_eggs"], choices: [
    { id: "daily_record", label: "Create the missing Daily Record", explanation: "Use this for a flock placed after the system began operating.", path: daily },
    { id: "legacy_balance", label: "Request a legacy opening balance", explanation: "Use governed evidence when earlier production records genuinely do not exist.", path: governance },
  ] },
  EGG_SALES_EXCEED_PRODUCTION: { page: "Sales", path: sales, label: "Compare production and sales", instruction: "Review the affected flock's production, opening balance, conversions, and sales for this period.", mode: "investigate", focusFields: ["normal_eggs", "opening_balance", "sale_quantity", "unit"] },
  POSSIBLE_DUPLICATE_SALE: { page: "Sales", path: sales, label: "Compare matching sales", instruction: "Confirm distinct source documents or void the duplicate with an auditable reason.", mode: "investigate", focusFields: ["sale_date", "product", "quantity", "customer", "gross_amount"] },
  PHYSICAL_STOCK_VARIANCE: { page: "Inventory", path: inventory, label: "Review this shelf count", instruction: "Recount the exact item and compare its receipts, uses, transfers, and adjustments.", mode: "direct", focusFields: ["system_quantity", "counted_quantity"] },
  REPEATED_STOCK_ADJUSTMENTS: { page: "Inventory", path: inventory, label: "Review adjustment history", instruction: "Inspect the exact item movements and reverse invalid entries; document legitimate repetition as an exception.", mode: "investigate", focusFields: ["adjustments", "source_documents"] },
  COST_ALLOCATION_MISMATCH: { page: "Financial close", path: reports, label: "Review this cost allocation", instruction: "Assign the full expense to its supported operating scope or request a documented exception.", mode: "direct", focusFields: ["amount", "allocations"] },
  LOCKED_FINANCIAL_PERIOD_HAS_GAPS: { page: "Financial close", path: reports, label: "Review this locked period", instruction: "Inspect the exact warnings and use Governance before changing a locked period.", mode: "governance", focusFields: ["unallocated_cost", "reconciliation_warnings"] },
  PAST_FINANCIAL_PERIOD_UNLOCKED: { page: "Financial close", path: reports, label: "Complete this month-end close", instruction: "Resolve the period checklist and have the CEO lock the reviewed period.", mode: "direct", focusFields: ["period_status", "warnings"] },
  ACTIVE_FLOCK_LINEAGE_BROKEN: { page: "Flocks and Batches", path: flocks, label: "Review flock lineage", instruction: "Compare the flock, batch, house, and farm custody chain and submit the exact governed correction.", mode: "governance", focusFields: ["farm", "house", "batch", "flock"] },
  BATCH_FLOCK_PLACEMENT_MISMATCH: { page: "Flocks and Batches", path: flocks, label: "Review batch placements", instruction: "Compare the original batch total with every linked flock placement.", mode: "governance", focusFields: ["batch_total", "flock_placements"] },
};

export function resolutionHref(path: string, findingId: string, choice?: string) {
  const params = new URLSearchParams({ finding: findingId });
  if (choice) params.set("source", choice);
  return `${path}?${params.toString()}`;
}
