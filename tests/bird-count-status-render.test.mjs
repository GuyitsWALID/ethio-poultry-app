import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {NextIntlClientProvider} from 'next-intl';
import en from '../messages/en.json' with {type:'json'};
import am from '../messages/am.json' with {type:'json'};

const bundle=await build({entryPoints:['src/components/today/bird-check-card.tsx'],bundle:true,write:false,platform:'node',format:'cjs',packages:'external',jsx:'automatic',plugins:[{name:'count-boundaries',setup(b){
 b.onResolve({filter:/@\/components\/today\/(offline-context|recording-start-form|bird-opening-gap)$/},a=>({path:a.path,namespace:'stub'}));
 b.onLoad({filter:/.*/,namespace:'stub'},()=>({contents:'export const useTodayOffline=()=>({queue:globalThis.__birdCountQueue});export const TaskDraftScope=({children})=>children;export const RecordingStartForm=()=>null;export const BirdOpeningGap=()=>null;'}));
}}]});
const compiled={exports:{}};new Function('require','module','exports',bundle.outputFiles[0].text)(createRequire(import.meta.url),compiled,compiled.exports);
const flock={id:'flock',tasks:[],healthSummary:{confirmedNone:false},birdCheck:{dailyRecordId:'daily',openingBirds:100,closingBirds:99,deaths:1,culls:0,transfersIn:0,transfersOut:0,otherRemovals:0,openingSource:'daily_record'}};
test('Bird count distinguishes rejected/conflicting losses from work waiting to sync in both languages',()=>{
 for(const [locale,messages] of [['en',en],['am',am]])for(const state of ['queued','sending','conflict','rejected']){
  globalThis.__birdCountQueue=[{state,taskKey:'task:farm:flock:2026-11-10:health_deaths',command:{type:'save_daily_record',flock_id:'flock',work_date:'2026-11-10'}}];
  const html=renderToStaticMarkup(React.createElement(NextIntlClientProvider,{locale,messages,timeZone:'Africa/Addis_Ababa'},React.createElement(compiled.exports.BirdCheckCard,{flock,farmId:'farm',workDate:'2026-11-10',online:true,refreshing:false,onRefresh(){}})));
  const failed=['conflict','rejected'].includes(state);
  assert(html.includes(messages.Today.states[failed?'needsAttention':'waiting']));
  if(failed)assert(!html.includes(messages.Today.states.waiting));
 }
});
