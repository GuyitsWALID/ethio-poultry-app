export type AssignmentWindow={starts_at:string;expires_at:string|null;revoked_at:string|null};

export function assignmentIsActive(row:AssignmentWindow,at=new Date()){
  const instant=at.getTime();return !row.revoked_at&&Date.parse(row.starts_at)<=instant&&(row.expires_at===null||Date.parse(row.expires_at)>instant);
}

function addisParts(now:Date){const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"Africa/Addis_Ababa",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(now);const value=Object.fromEntries(parts.map(part=>[part.type,part.value]));return{date:`${value.year}-${value.month}-${value.day}`,minutes:Number(value.hour)*60+Number(value.minute)}}

export function operatingDayLockBoundary(now=new Date(),lockTime="10:00:00",graceDays=7){
  const addis=addisParts(now);const [hour,minute]=lockTime.split(":").map(Number);const safeGrace=Math.max(1,Math.trunc(graceDays));const daysBack=addis.minutes>=hour*60+minute?safeGrace:safeGrace+1;const date=new Date(`${addis.date}T00:00:00Z`);date.setUTCDate(date.getUTCDate()-daysBack);return date.toISOString().slice(0,10);
}

export function sourceVersionMatches(expected:string|null,current:string|null){return expected===null||Boolean(current&&Date.parse(expected)===Date.parse(current));}
