type JsonRecord=Record<string,unknown>;

const secretKey=/(password|secret|token|authorization|cookie|api[_-]?key|service[_-]?role)/i;

export function sanitizeAuditSnapshot(value:unknown,depth=0):unknown{
  if(depth>8)return "[depth limit]";
  if(value===null||value===undefined||typeof value==="string"||typeof value==="number"||typeof value==="boolean")return value??null;
  if(Array.isArray(value))return value.slice(0,250).map(item=>sanitizeAuditSnapshot(item,depth+1));
  if(typeof value!=="object")return String(value);
  return Object.fromEntries(Object.entries(value as JsonRecord).map(([key,item])=>[key,secretKey.test(key)?"[redacted]":sanitizeAuditSnapshot(item,depth+1)]));
}

export function auditReason(value:string){
  const reason=value.trim();
  if(reason.length<4)throw new Error("An audit reason of at least four characters is required.");
  return reason.slice(0,2000);
}

export type AuditDisplayEvent={event_type?:unknown;operation?:unknown;entity_table?:unknown;reason?:unknown;actor_role?:unknown};
export type AuditChange={field:string;before:string;after:string};

const technicalField=/(^id$|_id$|_ids$|^org_|^created_at$|^updated_at$|^occurred_at$|hash|token|secret|password)/i;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const displayValue=(value:unknown)=>{
  if(value===null||value===undefined||value==="")return "Not set";
  if(typeof value==="boolean")return value?"Yes":"No";
  if(typeof value==="number")return value.toLocaleString();
  if(typeof value==="string")return uuid.test(value)?"Linked record":value;
  return Array.isArray(value)?`${value.length} item${value.length===1?"":"s"}`:"Recorded details";
};

export function auditChanges(before:unknown,after:unknown):AuditChange[]{
  const left=before&&typeof before==="object"&&!Array.isArray(before)?before as JsonRecord:{};
  const right=after&&typeof after==="object"&&!Array.isArray(after)?after as JsonRecord:{};
  return [...new Set([...Object.keys(left),...Object.keys(right)])]
    .filter(key=>!technicalField.test(key)&&JSON.stringify(left[key])!==JSON.stringify(right[key]))
    .slice(0,20)
    .map(key=>({field:key.replaceAll("_"," "),before:displayValue(left[key]),after:displayValue(right[key])}));
}

export function describeAuditEvent(event:AuditDisplayEvent){
  const table=String(event.entity_table??"record").replaceAll("_"," ");
  const operation=String(event.operation??"");
  const semantic=String(event.event_type??"");
  const action=semantic.startsWith("record.")
    ? operation==="insert"?"created":operation==="update"?"updated":operation==="delete"?"removed":"changed"
    : semantic.replaceAll("."," ").replaceAll("_"," ");
  return{title:`${action.charAt(0).toUpperCase()}${action.slice(1)}`,subject:table,reason:String(event.reason??"No reason recorded"),actorRole:String(event.actor_role??"system").replaceAll("_"," ")};
}
