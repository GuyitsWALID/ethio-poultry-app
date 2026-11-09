import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir, writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createClient} from '@supabase/supabase-js';

createRequire(import.meta.url)('@next/env').loadEnvConfig(process.cwd());
const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const org='27e24583-0df0-415a-8815-d8d57fb49674', end='2026-11-08';
const apply=process.argv.includes('--apply');
const day=date=>new Date(date+'T00:00:00Z');
const next=date=>new Date(day(date).getTime()+86400000).toISOString().slice(0,10);
const uuid=text=>{const h=createHash('md5').update(text).digest('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;};
async function read(query){const r=await query;if(r.error)throw Error(r.error.message);return r.data;}
const flocks=await read(db.from('flocks').select('id,org_id,flock_code,placement_date,age_at_placement_days,initial_count,current_count,flock_type,status').eq('org_id',org).like('flock_code','DEMO-%').order('flock_code'));
assert.equal(flocks.length,4,'Expected exactly the four known DEMO flocks');
const inserts=[], repairs=[], summaries=[];
for(const f of flocks){
  assert(f.id.startsWith('de400000-')&&f.status==='active');
  const records=await read(db.from('daily_farm_records').select('*').eq('org_id',org).eq('flock_id',f.id).is('voided_at',null).order('record_date'));
  const byDate=new Map(records.map(r=>[r.record_date,r]));
  const actor=records.find(r=>r.recorded_by)?.recorded_by;assert(actor);
  let birds=f.initial_count, added=0;
  for(let date=f.placement_date;date<=end;date=next(date)){
    const existing=byDate.get(date);
    if(existing){
      const opening=existing.opening_birds??birds;
      assert.equal(opening,birds,`${f.flock_code} has an existing continuity conflict on ${date}`);
      const closing=opening+(existing.transfers_in??0)-(existing.deaths??0)-(existing.culls??0)-(existing.transfers_out??0)-(existing.other_removals??0);
      assert.equal(existing.closing_birds??closing,closing,`Existing record is unbalanced on ${date}`);
      if(existing.opening_birds===null||existing.closing_birds===null)repairs.push({id:existing.id,flock_id:f.id,date,before:{opening_birds:existing.opening_birds,closing_birds:existing.closing_birds},patch:{opening_birds:opening,closing_birds:closing}});
      birds=closing;continue;
    }
    const age=Math.floor((day(date)-day(f.placement_date))/86400000)+(f.age_at_placement_days??0);
    const n=Math.floor(day(date).getTime()/86400000);
    const eggs=f.flock_type==='layer'?Math.round(birds*Math.min(.94,Math.max(0,(age-126)/44*.9))*(.98+.02*Math.sin(n/8))):null;
    const broken=eggs===null?null:Math.round(eggs*.017),dirty=eggs===null?null:Math.round(eggs*.017);
    inserts.push({id:uuid(`laba-demo-gap-${f.id}-${date}`),org_id:org,flock_id:f.id,record_date:date,recorded_by:actor,
      flock_age_days:age,flock_age_weeks:Math.floor(age/7),opening_birds:birds,closing_birds:birds,deaths:0,culls:0,transfers_in:0,transfers_out:0,other_removals:0,
      normal_eggs:eggs===null?null:eggs-broken-dirty,broken_eggs:broken,dirty_eggs:dirty,total_eggs:eggs,
      average_egg_weight_g:eggs?Number((59.2+1.2*Math.sin(n/10)).toFixed(2)):null,
      water_consumed_liters:Number((birds*(f.flock_type==='layer'?.22:.18)*(1+.03*Math.sin(n/5))).toFixed(2)),
      vaccination_status:'DEMO-GAP-20261108: synthetic daily fixture; no vaccination activity generated',synced:true,
      created_at:date+'T15:00:00.000Z',updated_at:date+'T15:30:00.000Z'});
    added++;
  }
  assert.equal(birds,f.current_count,`${f.flock_code}: generated history must preserve the current count`);
  summaries.push({flock:f.flock_code,from:f.placement_date,to:end,missingDays:added,closingBirds:birds});
}
console.log(JSON.stringify({mode:apply?'apply':'preview',summaries,insertCount:inserts.length,repairs},null,2));
if(apply){
  await mkdir('artifacts',{recursive:true});
  await writeFile('artifacts/demo-daily-gap-backfill-20261108.json',JSON.stringify({synthetic:true,end,inserts,repairs},null,2));
  for(let i=0;i<inserts.length;i+=100){await read(db.from('daily_farm_records').upsert(inserts.slice(i,i+100),{onConflict:'org_id,flock_id,record_date',ignoreDuplicates:true}).select('id'));}
  for(const repair of repairs){
    let q=db.from('daily_farm_records').update(repair.patch).eq('id',repair.id).eq('org_id',org).eq('flock_id',repair.flock_id);
    for(const key of ['opening_birds','closing_birds'])q=repair.before[key]===null?q.is(key,null):q.eq(key,repair.before[key]);
    const changed=await read(q.select('id'));assert.equal(changed.length,1,'The incomplete record changed concurrently; inspect before retrying');
  }
  for(const f of flocks){
    const rows=await read(db.from('daily_farm_records').select('record_date,opening_birds,closing_birds').eq('org_id',org).eq('flock_id',f.id).is('voided_at',null).gte('record_date',f.placement_date).lte('record_date',end).order('record_date'));
    let date=f.placement_date, birds=f.initial_count;
    for(const row of rows){assert.equal(row.record_date,date);assert.equal(row.opening_birds,birds);assert(Number.isInteger(row.closing_birds));birds=row.closing_birds;date=next(date);}
    assert.equal(date,'2026-11-09');assert.equal(birds,f.current_count);
  }
  console.log('Verified: all four DEMO flock histories are continuous through 2026-11-08.');
}
