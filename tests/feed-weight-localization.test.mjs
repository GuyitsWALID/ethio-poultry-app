import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
import {createTranslator} from "next-intl";
import en from "../messages/en.json" with {type: "json"};
import am from "../messages/am.json" with {type: "json"};

test("weight entry uses catalog labels, Ethiopian-aware date input and unchanged mutation", async () => {
  const source = await readFile(new URL("../src/app/app/feeding-log/page.tsx", import.meta.url), "utf8");
  const sheet = source.slice(source.indexOf("function WeightDrawer("));
  assert.match(sheet, /useTranslations\("FeedWeight"\)/);
  assert.match(sheet, /<OperationDateInput/);
  assert.match(sheet, /fetch\("\/api\/feed\/weights"/);
  assert.match(sheet, /JSON.stringify\(\{ taskId: task.id, \.\.\.form \}\)/);
  const ast = ts.createSourceFile("weight.tsx", sheet, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  function check(node) {
    if (ts.isJsxText(node)) assert.equal(node.text.trim(), "", `Untranslated text: ${node.text}`);
    ts.forEachChild(node, check);
  }
  check(ast);
  const result = ts.transpileModule(source, {compilerOptions: {jsx: ts.JsxEmit.ReactJSX}, reportDiagnostics: true});
  assert.deepEqual(result.diagnostics, []);
});

test("weight catalogs match and interpolate target values in both languages", () => {
  assert.deepEqual(Object.keys(am.FeedWeight).sort(), Object.keys(en.FeedWeight).sort());
  for (const [locale, messages] of [["en", en], ["am", am]]) {
    const t = createTranslator({locale, messages, namespace: "FeedWeight"});
    assert.ok(t("target", {min: "100", max: "150"}).includes("100–150"));
    for (const key of Object.keys(messages.FeedWeight)) assert.ok(messages.FeedWeight[key]);
  }
  assert.notEqual(en.FeedWeight.title, am.FeedWeight.title);
});
