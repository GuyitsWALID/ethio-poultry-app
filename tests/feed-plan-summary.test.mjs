import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {NextIntlClientProvider} from 'next-intl';
import {readFile} from 'node:fs/promises';
import {feedPlanCopy} from '../src/i18n/feed-plan-copy.ts';
const bundle=await build({entryPoints:['src/components/today/feed-plan-summary.tsx'],bundle:true,write:false,platform:'node',format:'cjs',packages:'external',jsx:'automatic'});
const module={exports:{}};new Function('require','module','exports',bundle.outputFiles[0].text)(createRequire(import.meta.url),module,module.exports);
const {FeedPlanSummary}=module.exports;
const render=(locale,plan,sessions)=>renderToStaticMarkup(React.createElement(NextIntlClientProvider,{locale,messages:{},timeZone:'Africa/Addis_Ababa'},React.createElement(FeedPlanSummary,{plan,sessions})));
test('daily target displays once with arbitrary session allocation and bilingual explanation',()=>{
 const plan={state:'ready',ageDays:325,templateName:'Plan',openingBirds:1000,gramsPerBird:120,dailyKg:120};
 const sessions=[{planned_feed_kg:30},{planned_feed_kg:40},{planned_feed_kg:10}];
 for(const locale of ['en','am']){const html=render(locale,plan,sessions);assert.ok(html.replace(/&#x27;/g,"'").includes(feedPlanCopy[locale].help));assert.ok(html.includes('>80<'));assert.ok(html.includes('>40<'));assert.ok(!html.includes('NaN'));}
});
test('missing target and partial evidence never render invented zero or a default feed type',async()=>{
 const html=render('am',{state:'missing_population',ageDays:30},[{planned_feed_kg:null}]);
 assert.ok(html.includes(feedPlanCopy.am.missing_population));assert.ok(html.includes(feedPlanCopy.am.unavailable));assert.ok(!html.includes('>0<'));
 const source=await readFile(new URL('../src/components/today/embedded-task-card.tsx',import.meta.url),'utf8');
 assert.ok(!source.includes('scheduledFeedType ?? "layer_feed"'));
 assert.ok(source.includes('session.feed_type ?? feedPlan?.feedType ?? ""'));
 assert.ok(!source.includes('detail.data.scheduledFeedType ??'));
 assert.ok(source.includes('<FeedPlanSummary'));
});
