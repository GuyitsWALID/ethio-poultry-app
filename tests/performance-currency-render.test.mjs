import assert from "node:assert/strict";
import {createRequire} from "node:module";
import test from "node:test";
import {build} from "esbuild";
import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {NextIntlClientProvider} from "next-intl";
import {formatEtb} from "../src/i18n/formats.ts";
import en from "../messages/en.json" with {type: "json"};
import am from "../messages/am.json" with {type: "json"};

const bundle = await build({entryPoints: ["src/components/reports/performance-visuals.tsx"], bundle: true, write: false, platform: "node", format: "cjs", packages: "external", jsx: "automatic"});
const compiled = {exports: {}};
new Function("require", "module", "exports", bundle.outputFiles[0].text)(createRequire(import.meta.url), compiled, compiled.exports);
const {MetricCards} = compiled.exports;
const render = (locale, value, unit = "ETB") => renderToStaticMarkup(React.createElement(NextIntlClientProvider, {locale, messages: locale === "am" ? am : en, timeZone: "Africa/Addis_Ababa"}, React.createElement(MetricCards, {metrics: [{key: "revenue", value, unit, previous: null, delta: null, explanation: "RECORDED_HEALTH_EVENTS_ONLY"}]})));
const primary = html => html.match(/<dd class="performance-value">([\s\S]*?)<\/dd>/)[1].replace(/<[^>]*>/g, "").trim();

test("metric cards format ETB once, with two currency decimals, in both locales", () => {
  for (const locale of ["en", "am"]) for (const amount of [826219.8, 0, -12.5]) {
    assert.equal(primary(render(locale, amount)), formatEtb(amount, locale));
  }
});

test("missing money remains unavailable and non-money units remain visible", () => {
  assert.equal(primary(render("en", null)), en.FarmPerformance.unavailable);
  assert.equal(primary(render("am", null)), am.FarmPerformance.unavailable);
  assert.equal(primary(render("en", 12.5, "kg")), `12.5 ${en.FarmPerformance.units.kg}`);
});
