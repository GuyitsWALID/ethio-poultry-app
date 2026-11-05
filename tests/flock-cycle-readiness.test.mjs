import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {hasTaskEvidence} from '../src/lib/today-workspace/task-evidence.ts';
import {cycleSubmissionIdentity} from '../src/lib/flock-lifecycle/submission-identity.ts';

const id=n=>`17000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const proposal={request_type:'batch_cycle_create',farm_id:id(1),reason:'New birds arrived today',proposed_values:{farm_id:id(1),cycle_code:'October arrival',production_purpose:'broiler',source:'external_purchase',placed_at:'2026-10-08T07:00:00+03:00',actual_date_confirmed:true,age_at_placement_days:0,placement_total:100,placements:[{house_id:id(2),expected_revision:'a'.repeat(64),starting_birds:100,batch_code:'House batch',flock_code:'New flock'}]}};

test('zero activity needs an explicit current confirmation; stale or missing fingerprints cannot complete work',()=>{
  assert.equal(hasTaskEvidence({hasActivity:false,sourceFingerprint:'current',attestationFingerprint:null}),false);
  assert.equal(hasTaskEvidence({hasActivity:false,sourceFingerprint:'current',attestationFingerprint:'old'}),false);
  assert.equal(hasTaskEvidence({hasActivity:false,sourceFingerprint:'',attestationFingerprint:''}),false);
  assert.equal(hasTaskEvidence({hasActivity:false,sourceFingerprint:'current',attestationFingerprint:'current'}),true);
  assert.equal(hasTaskEvidence({hasActivity:true,sourceFingerprint:'current',attestationFingerprint:null}),true);
});

test('cycle retry identity is stable for reordered object keys and excludes client routing claims',()=>{
  const reordered={...proposal,reason:` ${proposal.reason} `,proposed_values:Object.fromEntries(Object.entries(proposal.proposed_values).reverse()),source_id:id(99),correction_route:'/untrusted'};
  assert.equal(cycleSubmissionIdentity(proposal),cycleSubmissionIdentity(reordered));
});

test('cycle retry identity changes for changed counts, evidence, reasons, farms and source revisions',()=>{
  const variants=[
    {...proposal,reason:'Another reason for this arrival'},
    {...proposal,farm_id:id(3)},
    {...proposal,references:[{label:'Arrival receipt',url:'https://example.com/receipt'}]},
    {...proposal,proposed_values:{...proposal.proposed_values,placement_total:101,placements:[{...proposal.proposed_values.placements[0],starting_birds:101}]}},
    {...proposal,proposed_values:{...proposal.proposed_values,placements:[{...proposal.proposed_values.placements[0],expected_revision:'b'.repeat(64)}]}},
  ];
  for(const variant of variants) assert.notEqual(cycleSubmissionIdentity(proposal),cycleSubmissionIdentity(variant));
  assert.throws(()=>cycleSubmissionIdentity({...proposal,proposed_values:{}}),/CYCLE_INVALID_FIELDS/);
});

test('closure exposes health and supplies blockers and preserves an exact farm/cycle return target',async()=>{
  const context=await readFile(new URL('../src/lib/flock-lifecycle/cycles.ts',import.meta.url),'utf8');
  const form=await readFile(new URL('../src/components/flocks/cycle-workspace.tsx',import.meta.url),'utf8');
  assert.match(context,/today_source_fingerprint/);
  assert.match(context,/hasTaskEvidence/);
  assert.match(context,/farm_id=\$\{context.farm.id\}&cycle=\$\{p.cycle_id\}/);
  assert.match(form,/member.healthConfirmed && member.suppliesConfirmed/);
  assert.match(form,/idempotency_key: submission.current.id/);
  assert.match(form,/governance\?request=/);
});

test('submission recovery is scoped to current assignment, tenant, requester and exact payload',async()=>{
  const context=await readFile(new URL('../src/lib/flock-lifecycle/cycles.ts',import.meta.url),'utf8');
  const workflow=await readFile(new URL('../src/lib/governance-workflow.ts',import.meta.url),'utf8');
  assert.match(context,/canAccessFarm\(ctx, input.farm_id\)/);
  assert.match(context,/eq\("org_id", ctx.orgId\).eq\("requested_by", ctx.userId\).eq\("idempotency_key", input.idempotency_key\)/);
  assert.match(context,/cycle_submission_hash !== hash/);
  assert.match(workflow,/if\(existing\)return existing;input=input\.request_type==="archived_cycle_correction"\?await prepareArchivedCorrection\(.*?\):await prepareCycleProposal/);
  assert.match(workflow,/if\(error.code==="23505"\).*recoverCycleSubmission/);
});

test('legacy batch links resolve canonical cycle membership, reject contradictory targets and use current URL state',async()=>{
  const context=await readFile(new URL('../src/lib/flock-lifecycle/cycles.ts',import.meta.url),'utf8');
  const route=await readFile(new URL('../src/app/api/flocks/cycles/context/route.ts',import.meta.url),'utf8');
  const form=await readFile(new URL('../src/components/flocks/cycle-workspace.tsx',import.meta.url),'utf8');
  assert.match(context,/select\("farm_id,batch_cycle_id"\).eq\("org_id", ctx.orgId\).eq\("id", target.batchId\)/);
  assert.match(context,/cycleId && cycleId !== result.data.batch_cycle_id/);
  assert.match(context,/farmId && farmId !== result.data.farm_id/);
  assert.match(route,/resolveCycleTarget\(ctx,/);
  assert.match(form,/<Suspense/);
  assert.match(form,/useSearchParams\(\)/);
  assert.doesNotMatch(form,/window.location.search/);
  assert.match(form,/farm_id: context.farm.id/);
  assert.match(form,/cycle_id: context.cycle\?\.id/);
});
