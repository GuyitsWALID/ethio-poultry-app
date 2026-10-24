import assert from "node:assert/strict";
import {createRequire} from "node:module";
import test from "node:test";
import {build} from "esbuild";
import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {NextIntlClientProvider} from "next-intl";
import en from "../messages/en.json" with {type: "json"};
import am from "../messages/am.json" with {type: "json"};

const bundle = await build({entryPoints: ["src/components/governance-feed-template-review.tsx"], bundle: true, write: false, platform: "node", format: "cjs", packages: "external", jsx: "automatic"});
const reviewModule = {exports: {}};
new Function("require", "module", "exports", bundle.outputFiles[0].text)(createRequire(import.meta.url), reviewModule, reviewModule.exports);
const {FeedTemplateReview} = reviewModule.exports;
const row = {week_number: 1, age_day_start: 1, age_day_end: 7, feed_intake_std_g_per_head: 12.5, feed_intake_recommended_g_per_head: 13, target_weight_min_g: 100, target_weight_max_g: 150, feed_type_plan: "starter_feed", light_on_time: "06:00", light_off_time: "18:00"};
function render(locale, rows) {
  return renderToStaticMarkup(React.createElement(NextIntlClientProvider, {locale, messages: locale === "am" ? am : en, timeZone: "Africa/Addis_Ababa"}, React.createElement(FeedTemplateReview, {rows})));
}
test("approved feed review renders English/Amharic labels, numbers, types and plural counts", () => {
  const english = render("en", [row]), amharic = render("am", [row]);
  assert.match(english, /1 approved feed-plan row</);
  assert.match(render("en", [row, row]), /2 approved feed-plan rows</);
  assert.match(amharic, /ሳምንት/);
  assert.ok(amharic.includes(am.History.codes.starter_feed));
  assert.doesNotMatch(amharic, />Week<|>Target weight<|Chick starter feed/);
  assert.match(amharic, /06:00/);
  assert.match(amharic, /12.5/);
});
test("missing template values stay missing and unknown source text is preserved and escaped", () => {
  assert.ok(render("am", null).includes(am.FeedTemplateReview.empty));
  const html = render("am", [{week_number: null, feed_type_plan: "Custom <feed>"}]);
  assert.match(html, /—/);
  assert.match(html, /Custom &lt;feed&gt;/);
});
