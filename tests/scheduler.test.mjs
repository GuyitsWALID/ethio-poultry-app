import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {schedulePreview,scheduleRuleSchema} from '../src/lib/scheduler/contracts.ts';
import {parseTodayCommand} from '../src/lib/today-workspace/contracts.ts';
import {MemoryOfflineStore} from '../src/lib/today-workspace/offline-store.ts';
import {TodayOfflineRuntime,remainingDraft} from '../src/lib/today-workspace/offline-runtime.ts';
import {preparationInterrupted} from '../src/lib/today-workspace/offline-policy.ts';
const id=n=>`33000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
test('Interrupted offline preparation preserves cached forms without swallowing authorization or storage failures',()=>{
 assert.equal(preparationInterrupted(Error('OFFLINE_PREPARATION_NETWORK'),false),true);
 assert.equal(preparationInterrupted(Error('OFFLINE_PREPARATION_NETWORK'),true),false);
 for(const code of ['AUTH_REQUIRED','ACCESS_CHANGED','STORAGE_FAILED','OFFLINE_PREPARATION_FAILED'])assert.equal(preparationInterrupted(Error(code),false),false);
});
const day='2026-11-03',rule={request_id:id(1),farm_id:id(2),flock_ids:[id(3)],title:'Weigh birds',notes:'',kind:'weight',frequency:'weekly',start_date:day,end_date:null,active:true};
test('Scheduler previews once, daily and anchored weekly within 90 inclusive operating days',()=>{
 assert.equal(schedulePreview(rule,day).length,13);
 assert.deepEqual(schedulePreview({...rule,frequency:'once'},day),[day]);
 assert.equal(schedulePreview({...rule,frequency:'daily'},day).length,90);
 assert.deepEqual(schedulePreview({...rule,frequency:'daily',end_date:'2026-11-05'},day),[day,'2026-11-04','2026-11-05']);
 assert.deepEqual(schedulePreview({...rule,start_date:'2026-10-27'},day).slice(0,2),[day,'2026-11-10']);
 assert.deepEqual(schedulePreview({...rule,frequency:'once',start_date:'2026-11-02'},day),[]);
});
test('Scheduler rejects invented dates, duplicate targets and revisionless edits',()=>{
 assert.equal(scheduleRuleSchema.safeParse(rule).success,true);
 for(const invalid of [{...rule,start_date:'2026-02-30'},{...rule,flock_ids:[id(3),id(3)]},{...rule,id:id(5)},{...rule,end_date:'2026-11-02'}])assert.equal(scheduleRuleSchema.safeParse(invalid).success,false);
});
const command={schema_version:1,command_id:id(10),type:'complete_scheduled_work',farm_id:id(2),flock_id:id(3),work_date:day,payload:{occurrence_id:id(6),occurrence_revision:2,outcome:'skipped',reason:'Already completed externally'}};
test('Additive Today command requires occurrence version and reasoned defer/skip, preserving old commands',()=>{
 assert.equal(parseTodayCommand(command).type,'complete_scheduled_work');
 for(const payload of [{...command.payload,reason:''},{...command.payload,occurrence_revision:0},{...command.payload,outcome:'deferred'}])assert.throws(()=>parseTodayCommand({...command,payload}));
 assert.equal(parseTodayCommand({...command,type:'record_mortality_event',payload:{count:1,cause:'Unknown'}}).type,'record_mortality_event');
});
test('Offline scheduler grants bind prepared occurrence, flock and exact revision; other drafts survive',async()=>{
 const store=new MemoryOfflineStore(),identity={tenantId:'org',userId:'manager',authorizedWorkDate:day};
 const runtime=new TodayOfflineRuntime(store,identity,()=>false,()=>1000);
 const grant={tenantId:'org',userId:'manager',farmId:id(2),flockIds:[id(3)],workDate:day,issuedAt:`${day}T09:00:00Z`,expiresAt:`${day}T21:00:00Z`,scheduleRevisions:{[id(6)]:{revision:2,flockId:id(3)}}};
 await runtime.rememberWorkspace({farm:{id:id(2)},workDate:day,offlineAccess:grant});
 await runtime.enqueue(command,'task');
 await assert.rejects(runtime.enqueue({...command,command_id:id(11),payload:{...command.payload,occurrence_revision:3}},'task'),/OFFLINE_NOT_AUTHORIZED/);
 await assert.rejects(runtime.enqueue({...command,command_id:id(12),payload:{...command.payload,occurrence_id:id(7)}},'task'),/OFFLINE_NOT_AUTHORIZED/);
 const draft={taskId:'scheduled_work',value:{fields:{[`field:${id(6)}:reason`]:'done',[`field:${id(7)}:notes`]:'Keep this'}}};
 assert.deepEqual(remainingDraft(draft,command).value.fields,{[`field:${id(7)}:notes`]:'Keep this'});
});
test('Scheduler uses authoritative completion, same-farm closure locks and read-only RLS',()=>{
 const server=readFileSync('src/lib/scheduler/server.ts','utf8');assert.match(server,/\[\.\.\.rules\.data,\.\.\.pending\.data\]/);assert.match(server,/eq\('status','pending'\)\.lte\('due_date',today\)/);
 const sql=readFileSync('supabase/migrations/20261103000000_named_flock_scheduler.sql','utf8');
 for(const seam of ['record_health_event_with_inventory','complete_vaccination_with_inventory','public.weight_records','public.biosecurity_checks','for update','Scheduled work is still missing an outcome','governance_audit_events','scheduler_legacy_preflight'])assert.ok(sql.includes(seam),seam);
 assert.match(sql,/grant select on public\.scheduled_work_rules/);
 assert.match(sql,/due_date>today/);
 assert.match(sql,/on conflict\(rule_id,flock_id,due_date\) do nothing/);
 const screen=readFileSync('src/components/scheduler-workspace.tsx','utf8');assert.match(screen,/OperationDateInput/);assert.match(screen,/created_by===context\.userId/);assert.match(screen,/created_by_role==='farm_manager'/);
 assert.doesNotMatch(server,/\(archived,completed\)/);assert.match(server,/eligible:!f\.completed_at/);
 const form=readFileSync('src/components/today/scheduled-work-form.tsx','utf8');assert.match(form,/name==='sample_count'\?1:/);
});
