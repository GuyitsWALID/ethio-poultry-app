import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {createRequire} from "node:module";
import test from "node:test";
import ts from "typescript";
import {build} from "esbuild";
import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {NextIntlClientProvider, createTranslator} from "next-intl";
import en from "../messages/en.json" with {type: "json"};
import am from "../messages/am.json" with {type: "json"};
import {formatOperationDate} from "../src/i18n/formats.ts";

const source = await readFile(new URL("../src/app/app/feeding-log/page.tsx", import.meta.url), "utf8");
const editor = source.slice(source.indexOf("function TemplateManager("), source.indexOf("function WeightDrawer("));
const checks = source.slice(source.indexOf("function WeightTasks("), source.indexOf("function MilestoneTimeline("));
const status = source.slice(source.indexOf("function Status("), source.indexOf("function KpiCard("));
const feedTypes = ["starter_feed", "grower_pullet_feed", "layer_feed", "broiler_feed", "medicated_feed"];
const bundle = await build({stdin: {contents: `import {useState, useEffect, useRef} from "react";
import {useLocale, useTranslations} from "next-intl";
import {ChevronDown} from "lucide-react";
import {formatNumber, formatOperationDate} from "./src/i18n/formats";
const feedTypes = ${JSON.stringify(feedTypes.map(value => [value]))};
${status}
export ${checks}
export ${editor}`, resolveDir: process.cwd(), loader: "tsx"}, bundle: true, write: false, platform: "node", format: "cjs", packages: "external", jsx: "automatic"});
const editorModule = {exports: {}};
new Function("require", "module", "exports", bundle.outputFiles[0].text)(createRequire(import.meta.url), editorModule, editorModule.exports);
const {TemplateManager, WeightTasks} = editorModule.exports;
const versionDate = "2026-10-28T08:00:00Z";
const row = {week_number: 1, age_day_start: 1, age_day_end: 7, feed_intake_recommended_g_per_head: 13, target_weight_min_g: 100, target_weight_max_g: null, feed_type_plan: "starter_feed"};
const data = {template: {name: "Operator <plan>", source_type: "manual", rows: [row]}, suggestedRows: [], settings: {warningVariancePct: 10, criticalVariancePct: 20}, permissions: {canConfigure: true, canManage: true, templateChangeMode: "governance"}, templateVersions: [{id: "version", name: "Original name", source_type: "upload", created_at: versionDate, is_active: true}]};
function render(locale, value = data) {
  return renderToStaticMarkup(React.createElement(NextIntlClientProvider, {locale, messages: locale === "am" ? am : en, timeZone: "Africa/Addis_Ababa"}, React.createElement(TemplateManager, {data: value, open: true, setOpen() {}, reload: async () => {}, announce() {}, batchId: "batch"})));
}

test("template editor renders catalog labels, feed choices and accessible row names in both languages", () => {
  for (const [locale, messages] of [["en", en], ["am", am]]) {
    const html = render(locale);
    for (const key of ["title", "governanceHelp", "warning", "critical", "name", "import", "submit", "versions", "active"]) assert.ok(html.includes(messages.FeedTemplates[key]), key);
    for (const type of feedTypes) assert.ok(html.includes(messages.History.codes[type]), type);
    const t = createTranslator({locale, messages, namespace: "FeedTemplates"});
    assert.ok(html.includes(t("rowLabel", {label: t("weightMin"), row: 1})));
    assert.ok(html.includes(formatOperationDate(versionDate, locale)));
    assert.match(html, /Operator &lt;plan&gt;/);
    assert.match(html, /Original name/);
    assert.doesNotMatch(html, /min-h-10|min-h-11/);
  }
  assert.doesNotMatch(render("am"), />Template name<|>Week<|>Version history<|>Manual plan<|row 1/);
});

test("empty and read-only states are translated without rewriting source names or missing inputs", () => {
  const html = render("am", {...data, template: null, templateVersions: [], permissions: {...data.permissions, canManage: false, canConfigure: false, templateChangeMode: "read_only"}});
  for (const key of ["notConfigured", "noStandards", "readOnlyHelp", "defaultName"]) assert.ok(html.includes(am.FeedTemplates[key]), key);
  assert.match(render("am"), /name="target_weight_max_g-0"[^>]*value=""/);
});

test("editor catalog keys match; JSX text and translation references cannot silently regress", () => {
  assert.deepEqual(Object.keys(en.FeedTemplates).sort(), Object.keys(am.FeedTemplates).sort());
  const ast = ts.createSourceFile("editor.tsx", editor, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  function check(node) {
    if (ts.isJsxText(node)) assert.doesNotMatch(node.text, /\p{L}/u, `Untranslated: ${node.text}`);
    if (ts.isCallExpression(node) && node.expression.getText(ast) === "t" && ts.isStringLiteral(node.arguments[0])) assert.ok(en.FeedTemplates[node.arguments[0].text], node.arguments[0].text);
    ts.forEachChild(node, check);
  }
  check(ast);
  assert.match(editor, /JSON.stringify\(\{batchId, name, sourceType, rows\}\)/);
  assert.match(editor, /JSON.stringify\(\{warningVariancePct: Number\(thresholds.warning\), criticalVariancePct: Number\(thresholds.critical\)\}\)/);
  assert.match(editor, /body.request \? "thresholdsProposed" : "thresholdsSaved"/);
  assert.match(editor, /finally \{ setSaving\(false\); \}/);
  assert.match(editor, /finally \{ setUploading\(false\); \}/);
});

test("weight-check list localizes due dates and states without changing task identity", () => {
  assert.deepEqual(Object.keys(en.FeedChecks).sort(), Object.keys(am.FeedChecks).sort());
  const task = {id: "task", due_week_number: 3, due_date: "2026-10-28", status: "pending", displayStatus: "Overdue"};
  for (const [locale, messages] of [["en", en], ["am", am]]) {
    const html = renderToStaticMarkup(React.createElement(NextIntlClientProvider, {locale, messages, timeZone: "Africa/Addis_Ababa"}, React.createElement(WeightTasks, {data: {...data, tasks: [task], permissions: {canRecordWeight: true}}, onRecord() {}})));
    assert.ok(html.includes(messages.FeedChecks.title));
    assert.ok(html.includes(messages.FeedChecks.overdue));
    assert.ok(html.includes(messages.FeedChecks.record));
    assert.ok(html.includes(formatOperationDate("2026-10-28T12:00:00Z", locale)));
    assert.doesNotMatch(html, /min-h-11/);
  }
  assert.match(checks, /onRecord\(task\)/);
});
