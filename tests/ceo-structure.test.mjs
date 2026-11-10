import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {branchStructureInput} from "../src/lib/branch-structure-input.ts";
import {branchSetupCopy} from "../src/i18n/branch-setup-copy.ts";

const input={request_id:"44000000-0000-4000-8000-000000000001",branch:{name:" Branch "},farms:[{name:"Farm",houses:[{name:"House",capacity:200,house_type:"broiler"}]}]};
test("branch structure validates capacity/type and rejects the old placement model",()=>{
 assert.equal(branchStructureInput.parse(input).branch.name,"Branch");
 for(const house_type of ["layer","broiler","rearing","parent_stock"])assert.equal(branchStructureInput.safeParse({...input,farms:[{...input.farms[0],houses:[{...input.farms[0].houses[0],house_type}]}]}).success,true);
 for(const extra of [{intakeBatch:{}},{manager:{password:null}},{org_id:input.request_id}])assert.equal(branchStructureInput.safeParse({...input,...extra}).success,false);
 for(const capacity of [0,-1,1.5,10000001])assert.equal(branchStructureInput.safeParse({...input,farms:[{name:"Farm",houses:[{name:"House",capacity,house_type:"layer"}]}]}).success,false);
 assert.equal(branchStructureInput.safeParse({...input,farms:[]}).success,false);
 assert.equal(branchStructureInput.safeParse({...input,farms:[{name:"Farm",houses:[{...input.farms[0].houses[0],flocks:[{}]}]}]}).success,false);
});
test("setup keeps placement separate and supplies bilingual accessible controls",async()=>{
 const ui=await readFile(new URL('../src/components/ceo/setup-modal.tsx',import.meta.url),'utf8');
 assert.ok(ui.includes('<dialog')&&ui.includes('.showModal()')&&ui.includes('min-h-12'));
 assert.ok(ui.includes('request_id: requestId')&&ui.includes('house_type')&&ui.includes('/app/batches'));
 assert.ok(!ui.includes('intakeBatch')&&!ui.includes('password'));
 assert.deepEqual(Object.keys(branchSetupCopy.en).sort(),Object.keys(branchSetupCopy.am).sort());
 for(const value of Object.values(branchSetupCopy.am))assert.ok(/[\u1200-\u137f]/.test(value));
});
