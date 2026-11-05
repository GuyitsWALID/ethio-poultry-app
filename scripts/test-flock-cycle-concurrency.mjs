import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {spawn, spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';

// This runner never touches a remote connection or the original local DB.
const container='supabase_db_ethio-poultry-app';
const template='ethio_flock_lifecycle_dryrun_20261007';
const database=`flock_race_${randomUUID().replaceAll('-','')}`;
assert.match(database,/^flock_race_[a-f0-9]{32}$/);
function docker(args){
  const result=spawnSync('docker',['exec',container,...args],{encoding:'utf8'});
  if(result.status!==0)throw new Error(result.stderr||result.stdout||'Docker command failed');
  return result.stdout;
}
function query(sql){
  return new Promise((resolve,reject)=>{
    const process=spawn('docker',['exec','-i',container,'psql','-U','postgres','-d',database,'-v','ON_ERROR_STOP=1','-Atq']);
    let stdout='',stderr='';
    process.stdout.on('data',chunk=>stdout+=chunk);
    process.stderr.on('data',chunk=>stderr+=chunk);
    process.on('error',reject);
    process.on('close',code=>resolve({code,stdout,stderr}));
    process.stdin.end(sql);
  });
}
const id=n=>`19000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
let created=false;
try{
  docker(['createdb','-U','postgres','--template',template,database]);created=true;
  const setup=await query(`
    insert into public.organizations(id,name,today_workspace_enabled) values('${id(1)}','Concurrent placement',true);
    insert into public.profiles(id,org_id,full_name,role,is_active) values('${id(2)}','${id(1)}','Manager','farm_manager',true),('${id(3)}','${id(1)}','CEO','ceo',true);
    insert into public.branches(id,org_id,name) values('${id(4)}','${id(1)}','Race branch');
    insert into public.farms(id,org_id,branch_id,name) values('${id(5)}','${id(1)}','${id(4)}','Race farm');
    insert into public.houses(id,org_id,branch_id,farm_id,name,house_type) values('${id(6)}','${id(1)}','${id(4)}','${id(5)}','Race house','broiler');
    insert into public.user_farm_access(org_id,profile_id,farm_id,starts_at) values('${id(1)}','${id(2)}','${id(5)}',now()-interval '1 day');
    insert into public.governance_requests(id,org_id,request_type,farm_id,changed_fields,proposed_values,reason,requested_by,intent,requester_name_snapshot,requester_role_snapshot,latest_submitted_at)
    select x.id,'${id(1)}','batch_cycle_create','${id(5)}',array['placements'],jsonb_build_object(
      'farm_id','${id(5)}','cycle_code',x.code,'production_purpose','broiler','source','external_purchase',
      'placed_at',now()-interval '1 hour','actual_date_confirmed',true,'age_at_placement_days',0,'placement_total',100,
      'placements',jsonb_build_array(jsonb_build_object('house_id','${id(6)}','starting_birds',100,'batch_code',x.code,'flock_code',x.code,
      'expected_revision',public.lifecycle_house_revision('${id(1)}','${id(6)}')))),
      'Actual competing arrival','${id(2)}','batch_cycle_create','Manager','farm_manager',now()
    from (values('${id(10)}'::uuid,'RACE-A'),('${id(11)}'::uuid,'RACE-B')) x(id,code);
    select set_config('request.jwt.claim.sub','${id(3)}',false);
    select public.decide_governance_request('${id(10)}','approved','Review A');
    select public.decide_governance_request('${id(11)}','approved','Review B');
  `);
  assert.equal(setup.code,0,setup.stderr);
  // The first session deliberately holds the successful house placement open.
  // The second runs during that transaction, not after a sequential commit.
  const first=query(`begin; select set_config('request.jwt.claim.sub','${id(2)}',true); select public.apply_governance_request('${id(10)}'); select pg_sleep(3); commit;`);
  // Wait for the first transaction's house lock via pg_locks, not a timing guess.
  let locked=false;
  for(let attempt=0;attempt<50;attempt++){
    const probe=await query(`select exists(select 1 from pg_stat_activity where datname=current_database() and wait_event='PgSleep');`);
    if(probe.stdout.trim()==='t'){locked=true;break;}
  }
  assert(locked,'First application did not reach the controlled lock hold');
  const second=query(`begin; select set_config('request.jwt.claim.sub','${id(2)}',true); select public.apply_governance_request('${id(11)}'); commit;`);
  const [winner,loser]=await Promise.all([first,second]);
  assert.equal(winner.code,0,winner.stderr);
  assert.notEqual(loser.code,0,'Both concurrent placements succeeded');
  assert.match(loser.stderr,/changed|occupied|review/i);
  const counts=await query(`select
    (select count(*) from public.batch_cycles where org_id='${id(1)}'),
    (select count(*) from public.batches where org_id='${id(1)}'),
    (select count(*) from public.flocks where org_id='${id(1)}'),
    (select count(*) from public.governance_requests where org_id='${id(1)}' and status='applied'),
    (select count(*) from public.governance_requests where org_id='${id(1)}' and status='approved');`);
  assert.equal(counts.stdout.trim(),'1|1|1|1|1','Concurrent failure left partial placement');
  console.log('PASS two-session approved placement race: one placement, one safe stale rejection, no partial mutation.');

  // Reuse the accounting fixture, not the later sequential assertions. It has
  // two member houses, deaths/culls already deducted, and one shared bird sale.
  const fixture=readFileSync('tests/database/flock-cycle.integration.sql','utf8');
  const marker='-- An insufficient sale must fail';
  assert.equal(fixture.split(marker).length,2,'Closure fixture boundary changed; review this runner.');
  const closeA='17000000-0000-4000-8000-000000000030';
  const closeB='17000000-0000-4000-8000-000000000031';
  const manager='17000000-0000-4000-8000-000000000002';
  const ceo='17000000-0000-4000-8000-000000000003';
  const closureSetup=await query(fixture.split(marker)[0]+`
    insert into public.governance_requests(id,org_id,request_type,farm_id,source_table,source_id,source_version,changed_fields,proposed_values,reason,requested_by,intent,requester_name_snapshot,requester_role_snapshot,latest_submitted_at)
    select '${closeB}',org_id,request_type,farm_id,source_table,source_id,source_version,changed_fields,proposed_values,reason,requested_by,'competing_close',requester_name_snapshot,requester_role_snapshot,latest_submitted_at
    from public.governance_requests where id='${closeA}';
    select set_config('request.jwt.claim.sub','${ceo}',true);
    select public.decide_governance_request('${closeA}','approved','Concurrent closure A');
    select public.decide_governance_request('${closeB}','approved','Concurrent closure B');
    commit;
  `);
  assert.equal(closureSetup.code,0,closureSetup.stderr);
  const closeSql=(request,hold=false)=>`begin; set local role authenticated;
    select set_config('request.jwt.claim.sub','${manager}',true);
    select public.apply_governance_request('${request}'); ${hold?'select pg_sleep(3);':''} commit;`;
  const closing=query(closeSql(closeA,true));
  let closingHeld=false;
  for(let attempt=0;attempt<50;attempt++){
    const probe=await query(`select exists(select 1 from pg_stat_activity where datname=current_database() and wait_event='PgSleep');`);
    if(probe.stdout.trim()==='t'){closingHeld=true;break;}
  }
  assert(closingHeld,'First closure did not reach the controlled lock hold');
  const competing=query(closeSql(closeB));
  const [closed,rejected]=await Promise.all([closing,competing]);
  assert.equal(closed.code,0,closed.stderr);
  assert.notEqual(rejected.code,0,'Two competing closures both succeeded');
  assert.match(rejected.stderr,/This cycle is no longer operating|changed|completed|archived|review|closure/i);
  const checkClosure=async()=>{
    const result=await query(`select
      (select count(*) from public.batch_cycle_closures where org_id='17000000-0000-4000-8000-000000000001'),
      (select count(*) from public.batch_cycle_clearances where org_id='17000000-0000-4000-8000-000000000001'),
      (select sum(quantity) from public.batch_cycle_dispositions where org_id='17000000-0000-4000-8000-000000000001'),
      (select count(*) from public.daily_farm_records where org_id='17000000-0000-4000-8000-000000000001' and closing_birds=0 and deaths=2 and culls=1 and other_removals=97),
      (select count(*) from public.governance_requests where id in ('${closeA}','${closeB}') and status='applied');`);
    assert.equal(result.code,0,result.stderr);
    assert.equal(result.stdout.trim(),'1|2|194|2|1','Concurrent closure duplicated evidence or changed final accounting');
  };
  await checkClosure();
  console.log('PASS two-session shared-cycle closure race: one closure, two clearances, exact sale allocations, unchanged deaths/culls.');
  const replays=await Promise.all([query(closeSql(closeA)),query(closeSql(closeA))]);
  for(const replay of replays)assert.equal(replay.code,0,replay.stderr);
  await checkClosure();
  console.log('PASS concurrent replay of the applied closure: no duplicate dispositions or population deductions.');
}finally{
  if(created)docker(['dropdb','-U','postgres',database]);
}
