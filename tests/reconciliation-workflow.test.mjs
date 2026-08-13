import assert from "node:assert/strict";
import test from "node:test";
import ts from "typescript";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/lib/reconciliation-workflow.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { reconciliationWorkflow } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

const base = {
  rule_code: "COST_ALLOCATION_MISMATCH",
  domain: "financial",
  severity: "high",
  status: "open",
  title: "Technical title",
  explanation: "Technical explanation",
  recommended_action: "Technical action",
};

test("cost allocation is translated into a plain guided correction", () => {
  const workflow = reconciliationWorkflow(base, "farm_manager");
  assert.equal(workflow.plainTitle, "A recorded cost has not been fully assigned");
  assert.equal(workflow.destination.href, "/app/inventory?tab=monthly");
  assert.equal(workflow.stage, "needs_action");
  assert.match(workflow.verification, /allocation total/i);
});

test("technical workflow states are presented as human stages", () => {
  assert.equal(reconciliationWorkflow({ ...base, status: "investigating" }, "ceo").stageLabel, "Review in progress");
  assert.equal(reconciliationWorkflow({ ...base, status: "cleared" }, "ceo").stageLabel, "Verified automatically");
  assert.equal(reconciliationWorkflow({ ...base, status: "accepted_exception" }, "ceo").stageLabel, "CEO-approved exception");
});

test("critical controls clearly require management attention", () => {
  const workflow = reconciliationWorkflow({ ...base, rule_code: "LOCKED_RECORD_CHANGED_WITHOUT_APPROVAL", domain: "governance", severity: "critical" }, "farm_manager");
  assert.equal(workflow.priorityKind, "governance");
  assert.equal(workflow.owner, "CEO review required");
  assert.equal(workflow.destination.href, "/app/governance");
});

test("unknown future rules still receive a safe usable fallback", () => {
  const workflow = reconciliationWorkflow({ ...base, rule_code: "NEW_RULE", domain: "birds", title: "New record difference" }, "farm_manager");
  assert.equal(workflow.plainTitle, "New record difference");
  assert.equal(workflow.destination.href, "/app/reconciliation");
  assert.ok(workflow.likelyCauses.length > 0);
});

