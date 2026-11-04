import 'server-only';
import {canAccessFarm,governanceAdmin,type AccessContext} from '@/lib/access-context';
import {listInventoryWarehouses} from '@/lib/warehouse-management';
import {allAlertRows} from '@/lib/alert-pagination';
import {historyUuid} from '@/lib/history/contracts';
import {addisOperatingDate} from '@/lib/flock-lifecycle/server';
export type ExpenseTemplate={id:string;farm_id:string|null;warehouse_id:string|null;category:string;description:string;default_amount:number;supplier_name:string|null};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db=governanceAdmin as any;
export async function expenseTemplates(ctx:AccessContext,farm:string,warehouses:string[]):Promise<ExpenseTemplate[]>{
 if(!historyUuid.test(farm)||!await canAccessFarm(ctx,farm))throw Error('DENIED');
 return allAlertRows<ExpenseTemplate>((from,to)=>db.from('recurring_cost_templates').select('id,farm_id,warehouse_id,category,description,default_amount,supplier_name')
  .eq('org_id',ctx.orgId).eq('is_active',true).or(`and(warehouse_id.is.null,farm_id.eq.${farm})${warehouses.length?`,warehouse_id.in.(${warehouses.join(',')})`:''}`).order('id').range(from,to));
}
export async function expenseWorkspace(ctx:AccessContext,farmId?:string){
 if(!['ceo','farm_manager'].includes(ctx.role))throw Error('DENIED');
 const org=await governanceAdmin.from('organizations').select('today_workspace_enabled').eq('id',ctx.orgId).single();
 if(org.error)throw Error('FAILED');if(!org.data.today_workspace_enabled)throw Error('DENIED');
 const farmRows=await governanceAdmin.from('farms').select('id,name,branch_id').eq('org_id',ctx.orgId).order('name');if(farmRows.error)throw Error('FAILED');
 const farms=[];for(const f of farmRows.data)if(await canAccessFarm(ctx,f.id))farms.push(f);
 if(farmId&&!farms.some(f=>f.id===farmId))throw Error('DENIED');
 const farm=farms.find(f=>f.id===farmId)??(farms.length===1?farms[0]:null);
 const today=addisOperatingDate(new Date());
 const empty={farms,farmId:farm?.id??null,today,canOperate:ctx.role==='farm_manager',warehouses:[],inventory:[],templates:[]};if(!farm)return empty;
 const warehouseData=await listInventoryWarehouses(ctx);
 const warehouses=warehouseData.warehouses.filter(w=>w.status==='active'&&(w.farm_id===farm.id||!w.farm_id&&w.branch_id===farm.branch_id)).map(w=>({id:w.id,name:w.name}));
 const [templates,inventory]=await Promise.all([expenseTemplates(ctx,farm.id,warehouses.map(w=>w.id)),allAlertRows<{id:string;name:string;unit:string}>((from,to)=>governanceAdmin.from('inventory_items').select('id,name,unit').eq('org_id',ctx.orgId).order('id').range(from,to))]);
 return {...empty,warehouses,inventory,templates};
}
