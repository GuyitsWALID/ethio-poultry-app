import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const context=read('src/components/today/offline-context.tsx');
const screen=read('src/components/today/today-workspace-screen.tsx');
test('Today owns a tenant-scoped runtime and checks online identity before draining',()=>{
 assert.match(screen,/<TodayOfflineProvider>/);
 assert.match(context,/openOfflineStore\(identity\)/);
 assert.match(context,/identity\.userId!==active\.identity\.userId/);
 assert.match(context,/identity\.orgId!==active\.identity\.tenantId/);
 assert.match(context,/beforeSync:authorize/);
 assert.match(context,/await active\.enqueue\(command,key\);await refresh\(\)/);
 assert.match(context,/active\.finish\(command,sendTodayCommand,authorize\)/);
});
test('saving components use queued submit; bird count is read-only',()=>{
 for(const name of ['embedded-task-card','health-task-form']){
  const component=read(`src/components/today/${name}.tsx`);
  assert.match(component,/useDraftSubmit/);
  assert.doesNotMatch(component,/await sendTodayCommand\(/);
  assert.match(component,/result\.status\s*===\s*"queued"/);
 }
 assert.doesNotMatch(read('src/components/today/bird-check-card.tsx'),/useDraftSubmit|sendTodayCommand\(/);
 assert.match(read('src/components/today/embedded-task-card.tsx'),/readDetail/);
 assert.match(read('src/components/today/embedded-task-card.tsx'),/rememberDetail/);
});

test('online startup and historical work retain the durable submit path without granting offline access',()=>{
 assert.doesNotMatch(context,/return sendTodayCommand\(command\)/);
 assert.match(context,/await acceptWorkspace\(await response\.json\(\) as TodayWorkspace\)/);
 assert.match(context,/rememberOnlineWorkspace\(workspace\)/);
 assert.match(context,/if\(!grant\)\{await refresh\(\);return;\}/);
 assert.match(context,/if\(!runtime\)return;\s+const draft=await runtime\.store\.getDraft/);
});
test('draft values, choices and supply rows persist; recovery never drops ambiguous sends',()=>{
 assert.match(context,/await writes\.current/);
 assert.match(context,/saveDraft\(selection/);
 assert.match(context,/row\.state==="queued"\|\|row\.state==="sending"/);
 assert.match(context,/window\.confirm\(t\("discardConfirm"\)\)/);
 assert.match(context,/runtime\.assertEditable\(currentSelection\)/);
 const form=read('src/components/today/embedded-task-card.tsx');
 assert.match(form,/useDraftState\("supplies\.rows"/);
 assert.match(read('src/components/today/health-task-form.tsx'),/useDraftState<Choice\[\]>\("health\.selected"/);
});

test('direct saves wake retry scheduling and reconnect checks the selected farm before unlocking',()=>{
 assert.match(context,/finally\s*\{\s*await refresh\(\);\s*window\.dispatchEvent\(new CustomEvent\("ethiopoultry:retry-sync"\)\)/);
 assert.match(context,/await authorize\(currentSelection\)/);
 assert.match(context,/if\(offlineWorkerFailed\(\)\)throw Error\("WORKER_FAILED"\)/);
 assert.match(context,/else await active\.store\.removeDraft\(`grant:/);
});
test('Finish and progress include local queue and draft evidence without trusting local completion',()=>{
 assert.match(screen,/state:offline\.stateFor/);
 assert.match(screen,/canFinish=.*!offline\.queue\.length && !offline\.drafts\.length && !offline\.problem/);
 assert.match(screen,/role="status" aria-live="polite"/);
 assert.doesNotMatch(context,/return "complete"/);
});
