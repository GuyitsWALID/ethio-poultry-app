import {z} from 'zod';
export const schedulerKinds=['weight','cleaning','vaccination','treatment'] as const;
export const schedulerFrequencies=['once','daily','weekly'] as const;
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value=>Number.isFinite(Date.parse(`${value}T00:00:00Z`))&&new Date(`${value}T00:00:00Z`).toISOString().slice(0,10)===value);
export const scheduleRuleSchema=z.object({
 request_id:z.string().uuid(),id:z.string().uuid().nullable().optional(),revision:z.number().int().positive().nullable().optional(),
 farm_id:z.string().uuid(),title:z.string().trim().min(2).max(160),notes:z.string().trim().max(2000).default(''),
 kind:z.enum(schedulerKinds),frequency:z.enum(schedulerFrequencies),start_date:date,end_date:date.nullable().optional(),
 flock_ids:z.array(z.string().uuid()).min(1).max(100).refine(values=>new Set(values).size===values.length),active:z.boolean().default(true),
}).refine(value=>!value.end_date||value.end_date>=value.start_date,{message:'Invalid date range',path:['end_date']})
 .refine(value=>!value.id||Boolean(value.revision),{message:'Revision required',path:['revision']});
export type ScheduleRuleInput=z.infer<typeof scheduleRuleSchema>;
export type ScheduledRule={id:string;farm_id:string;created_by:string;created_by_role:'ceo'|'farm_manager';kind:typeof schedulerKinds[number];title:string;notes:string;frequency:typeof schedulerFrequencies[number];start_date:string;end_date:string|null;flock_ids:string[];active:boolean;revision:number};
export type ScheduledOccurrence={id:string;rule_id:string;farm_id:string;flock_id:string;due_date:string;title:string;instructions:string;kind:typeof schedulerKinds[number];revision:number;status:'pending'|'completed'|'deferred'|'skipped'|'cancelled';reason:string|null;source_table:string|null;source_id:string|null;deferred_to:string|null};
export type SchedulerContext={role:'ceo'|'farm_manager';userId:string;today:string;farms:Array<{id:string;name:string}>;flocks:Array<{id:string;farm_id:string;flock_code:string;eligible:boolean}>;rules:ScheduledRule[];occurrences:ScheduledOccurrence[];nextCursor:string|null;legacy?:Array<{kind:string;title:string;due_date:string;flock_label:string|null;route:string;mapping:string}>};
export function schedulePreview(rule:Pick<ScheduleRuleInput,'start_date'|'end_date'|'frequency'>,today:string){
 const first=Date.parse(`${rule.start_date}T00:00:00Z`),from=Date.parse(`${today}T00:00:00Z`),end=Math.min(from+89*86400000,rule.end_date?Date.parse(`${rule.end_date}T00:00:00Z`):Infinity);
 if(!Number.isFinite(first)||!Number.isFinite(from))return [];
 const dates:string[]=[];
 for(let day=Math.max(first,from);day<=end;day+=86400000){if(rule.frequency==='daily'||rule.frequency==='once'&&day===first||rule.frequency==='weekly'&&(day-first)/86400000%7===0)dates.push(new Date(day).toISOString().slice(0,10));}
 return dates;
}
