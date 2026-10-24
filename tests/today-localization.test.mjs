import assert from "node:assert/strict";
import {readFile, readdir} from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
import en from "../messages/en.json" with {type: "json"};
import am from "../messages/am.json" with {type: "json"};
import {actionStatuses} from "../src/lib/action-desk-contract.ts";

const visibleAttributes = new Set(["label", "title", "placeholder", "aria-label", "alt"]);
const message = (catalog, path) => path.split(".").reduce((value, key) => value?.[key], catalog);
function inspect(source, file) {
  const root = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const literals = [], calls = [], namespaces = new Map();
  function visibleExpression(node) {
    if (!node) return;
    if (ts.isStringLiteral(node) && /[a-z]/i.test(node.text)) literals.push(node.text);
    else if (ts.isConditionalExpression(node)) {visibleExpression(node.whenTrue); visibleExpression(node.whenFalse);}
    else if (ts.isBinaryExpression(node) && [ts.SyntaxKind.QuestionQuestionToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.AmpersandAmpersandToken].includes(node.operatorToken.kind)) visibleExpression(node.right);
  }
  function visit(node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer && ts.isCallExpression(node.initializer) && node.initializer.expression.getText(root) === "useTranslations" && ts.isStringLiteral(node.initializer.arguments[0])) {
      const name = node.name.text;
      namespaces.set(name, [...(namespaces.get(name) ?? []), node.initializer.arguments[0].text]);
    }
    if (ts.isJsxText(node) && /[a-z]/i.test(node.text)) literals.push(node.text.trim());
    if (ts.isJsxAttribute(node) && visibleAttributes.has(node.name.getText(root)) && node.initializer && ts.isStringLiteral(node.initializer) && /[a-z]/i.test(node.initializer.text)) literals.push(node.initializer.text);
    if (ts.isJsxExpression(node) && (!ts.isJsxAttribute(node.parent) || visibleAttributes.has(node.parent.name.getText(root)))) visibleExpression(node.expression);
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) calls.push({name: node.expression.text, key: node.arguments[0].text});
    ts.forEachChild(node, visit);
  }
  visit(root);
  return {literals, references: calls.filter(call => namespaces.has(call.name)).map(call => ({...call, namespaces: namespaces.get(call.name)}))};
}

test("core Today surfaces reject visible hard-coded English and missing static messages", async () => {
  const directory = new URL("../src/components/today/", import.meta.url);
  const files = [
    ...(await readdir(directory)).filter(file => file.endsWith(".tsx")).map(file => new URL(file, directory)),
    ...["app-sidebar", "app-shell", "header-alert-bell", "sign-out-button", "locale-switch", "governance-feed-template-review"].map(file => new URL(`../src/components/${file}.tsx`, import.meta.url)),
  ];
  for (const file of files) {
    const {literals, references} = inspect(await readFile(file, "utf8"), file.pathname);
    // Controlled Admin support remains English-only, outside manager localization.
    const untranslated = file.pathname.endsWith("/app-shell.tsx") ? ["Support access active for", ". Every read and change is audited. Expires", "End support session"] : file.pathname.endsWith("/locale-switch.tsx") ? ["EN"] : [];
    assert.deepEqual(literals.filter(text => !untranslated.includes(text)), [], `${file}: visible text must use catalogs`);
    for (const reference of references) {
      for (const catalog of [en, am]) assert.ok(reference.namespaces.some(namespace => typeof message(catalog, `${namespace}.${reference.key}`) === "string"), `${file}: missing ${reference.key}`);
    }
  }
});

test("localization guard detects JSX text, accessible labels and missing-key candidates", () => {
  const audit = inspect('const t = useTranslations("Today"); const x = <button aria-label="Save record">Save now {busy ? "Saving" : t("missingKey")}</button>;', "fixture.tsx");
  assert.deepEqual(audit.literals.sort(), ["Save now", "Save record", "Saving"]);
  assert.equal(message(en, `${audit.references[0].namespaces[0]}.${audit.references[0].key}`), undefined);
});

test("Today assigned-fix statuses have real translations and every save uses the shared error map", async () => {
  for (const status of actionStatuses) {
    assert.equal(typeof en.Notifications.status[status], "string");
    assert.equal(typeof am.Notifications.status[status], "string");
    assert.notEqual(en.Notifications.status[status], am.Notifications.status[status]);
  }
  for (const file of ["bird-check-card.tsx", "health-task-form.tsx", "embedded-task-card.tsx"]) {
    const source = await readFile(new URL(`../src/components/today/${file}`, import.meta.url), "utf8");
    assert.match(source, /todayErrorMessageKeys\[result\.error_code\]/, file);
    assert.doesNotMatch(source, /result\.error_code === "RESOURCE_CONFLICT" \? errors\("staleRevision"\)/, file);
  }
});
