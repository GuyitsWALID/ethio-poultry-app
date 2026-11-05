import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {createRequire} from "node:module";
import test from "node:test";
import ts from "typescript";
import {build} from "esbuild";
import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {createTranslator, NextIntlClientProvider} from "next-intl";
import en from "../messages/en.json" with {type: "json"};
import am from "../messages/am.json" with {type: "json"};

const files = ["app/app/health/page.tsx", "app/app/sales/page.tsx", "app/app/feeding-log/page.tsx", "app/app/reconciliation/page.tsx", "components/governance-desk.tsx", "components/governance-audit-history.tsx", "components/governance-authorization-banner.tsx", "components/record-check-correction-banner.tsx", "components/mortality/mortality-control-room.tsx"];
files.push("components/reports/branch-report-workspace.tsx", "components/reconciliation-ai-panel.tsx", "components/reconciliation-assignment-panel.tsx");

test("generated guidance and compatibility catalogs retain bilingual key parity and valid ICU", () => {
  const values = {count: 2, percent: 75, metric: "metric", week: 3, age: 7, birds: 100, records: 2, expected: 3, covered: 2, actual: 2, planned: 3, number: 2, name: "name", flock: "flock", days: 7, events: 2, rate: 3, target: "target", cause: "cause", from: "date", to: "date", date: "date", scope: "scope", change: 2, gap: 2, result: "result", label: "label", type: "type", product: "product", file: "file", error: "error", language: "language"};
  const leaves = (node, prefix = "") => Object.entries(node).flatMap(([key, value]) => typeof value === "string" ? [prefix + key] : leaves(value, prefix + key + "."));
  for (const namespace of ["LegacyReports", "AnalyticsEvidence", "FeedEvidence", "FeedValidation", "OperationValidation", "MortalityEvidence", "RecordCheckGuidance", "ResolutionGuidance", "ReconciliationEvidence", "OperationFeedback", "OperationCharts", "OperationRemainder", "AiErrors"]) {
    assert.deepEqual(leaves(en[namespace]).sort(), leaves(am[namespace]).sort(), namespace);
    for (const [locale, messages] of [["en", en], ["am", am]]) {
      const errors = [];
      const t = createTranslator({locale, messages, namespace, onError: error => errors.push(error)});
      for (const key of leaves(messages[namespace])) assert.ok(t(key, values), namespace + "." + key);
      assert.deepEqual(errors, [], namespace);
    }
  }
});

test("legacy operational screens parse and do not reintroduce visible English JSX or static accessible labels", async () => {
  for (const file of files) {
    const source = await readFile(new URL(`../src/${file}`, import.meta.url), "utf8");
    const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    assert.deepEqual(ast.parseDiagnostics, [], file);
    function check(node) {
      if (ts.isJsxText(node)) assert.doesNotMatch(node.text, /[a-zA-Z]/, `${file}: ${node.text}`);
      if (ts.isJsxAttribute(node) && ["title", "placeholder", "aria-label", "label"].includes(node.name.getText(ast)) && node.initializer && ts.isStringLiteral(node.initializer)) assert.doesNotMatch(node.initializer.text, /[a-zA-Z]/, `${file}: ${node.initializer.text}`);
      if (ts.isCallExpression(node) && node.expression.getText(ast) === "ui" && ts.isStringLiteral(node.arguments[0])) assert.ok(en.OperationUI[node.arguments[0].text], `${file}: missing ${node.arguments[0].text}`);
      ts.forEachChild(node, check);
    }
    check(ast);
  }
});

test("operational catalogs have matching nonempty keys and valid ICU messages in both languages", () => {
  assert.deepEqual(Object.keys(en.OperationUI).sort(), Object.keys(am.OperationUI).sort());
  for (const [locale, messages] of [["en", en], ["am", am]]) {
    const errors = [];
    const t = createTranslator({locale, messages, namespace: "OperationUI", onError: error => errors.push(error)});
    for (const key of Object.keys(messages.OperationUI)) { assert.ok(messages.OperationUI[key].trim(), key); assert.ok(t(key), key); }
    assert.deepEqual(errors, []);
  }
  for (const key of ["diagnosis", "recordTreatment", "sendProposalToCEO", "applyApprovedCorrection", "salesLedger", "refreshHistory"]) assert.notEqual(am.OperationUI[key], en.OperationUI[key], key);
});

const bundle = await build({entryPoints: ["src/components/governance-audit-history.tsx"], bundle: true, write: false, platform: "node", format: "cjs", packages: "external", jsx: "automatic"});
const auditModule = {exports: {}};
new Function("require", "module", "exports", bundle.outputFiles[0].text)(createRequire(import.meta.url), auditModule, auditModule.exports);
test("the real audit panel renders English and Amharic controls and access explanations", () => {
  for (const [locale, messages] of [["en", en], ["am", am]]) {
    const html = renderToStaticMarkup(React.createElement(NextIntlClientProvider, {locale, messages, timeZone: "Africa/Addis_Ababa"}, React.createElement(auditModule.exports.GovernanceAuditHistory, {role: "farm_manager"})));
    for (const key of ["permanentEvidence", "permanentChangeHistory", "refreshHistory", "youCanSeeYourOwnActionsPlusActivityForFarms"]) assert.ok(html.includes(messages.OperationUI[key]), key);
    assert.doesNotMatch(html, /OperationUI\./);
  }
});
