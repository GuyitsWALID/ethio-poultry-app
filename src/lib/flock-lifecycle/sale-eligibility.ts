// Mirror the closure operation's sale-target checks for its read-only choices.
// PostgreSQL still revalidates and locks the actual sale at application time.
export function eligibleSaleFlockIds(sale: Record<string, unknown>, members: readonly Record<string, unknown>[], day: string): string[] {
  const quantity=Number(sale.quantity);
  const saleDate=sale.sale_date;
  if(typeof saleDate!=="string" || saleDate>day || !Number.isFinite(quantity) || quantity<=0) return [];
  if(String(sale.unit).trim().toLowerCase()==="bird" && !Number.isInteger(quantity)) return [];
  return members.filter(member=>
    sale.farm_id===member.farm_id && typeof member.placement_date==="string" && saleDate >= member.placement_date &&
    (sale.flock_id==null || sale.flock_id===member.id) &&
    (sale.batch_id==null || sale.batch_id===member.batch_id) &&
    (sale.house_id==null || sale.house_id===member.house_id)
  ).map(member=>String(member.id));
}

export function updateDepartureSelection<T extends {flockId:string; kind:string; saleId:string; capacity:string; reference:string}>(row:T, change:Partial<T>):T {
  const changed=(change.flockId!==undefined && change.flockId!==row.flockId) ||
    (change.kind!==undefined && change.kind!==row.kind) || (change.saleId!==undefined && change.saleId!==row.saleId);
  return {...row,...(changed?{saleId:"",capacity:"",reference:""}:{}),...change};
}
