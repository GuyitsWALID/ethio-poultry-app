import type {TodayCommand, TodayCommandResult, TodayTaskDetail, TodayWorkspace} from "./contracts.ts";
import type {OfflineDraft, OfflineIdentity, OfflineStore} from "./offline-store.ts";
import {offlineEditDecision, type StoredOfflineGrant} from "./offline-policy.ts";
import {syncOutbox, type CommandSender, type SyncSummary} from "./sync.ts";

export type LocalCommandResult = TodayCommandResult | {command_id: string; status: "queued"};
export type OfflineSelection = {farmId: string; flockId?: string | null; workDate: string};
export const workspaceKey = (farmId: string, date: string) => `${farmId}:${date}`;
export const taskDraftKey = (selection: OfflineSelection, task: string) => `task:${selection.farmId}:${selection.flockId ?? "farm"}:${selection.workDate}:${task}`;
const selectionOf = (command: TodayCommand): OfflineSelection => ({farmId: command.farm_id, flockId: command.flock_id, workDate: command.work_date});

export function commandResourceKey(command: TodayCommand) {
  const key = `${command.farm_id}:${command.flock_id ?? "farm"}:${command.work_date}`;
  if (command.type === "save_daily_record") return `daily:${key}`;
  if (command.type === "save_feed_session" || command.type === "close_feed_day") return `feed:${key}`;
  return undefined;
}

export function remainingDraft(draft: OfflineDraft, command: TodayCommand): OfflineDraft | undefined {
  if (draft.taskId !== "health_deaths") return undefined;
  const value = draft.value as {revision?: string; fields?: Record<string, unknown>};
  if (!value.fields) return undefined;
  const payload = command.payload as {record?: {_today_bird_loss?: unknown}; task_code?: string};
  const group = command.type === "record_health_event" ? "health"
    : command.type === "complete_vaccination" ? "vaccination"
      : payload.record?._today_bird_loss ? "loss" : "none";
  const completed = group === "loss" ? ["death", "cull"] : [group];
  const selected = Array.isArray(value.fields["health.selected"]) ? value.fields["health.selected"].filter(choice => !completed.includes(String(choice))) : [];
  const fields = Object.fromEntries(Object.entries(value.fields).filter(([key]) => key !== "health.selected" && !key.startsWith(`field:${group}:`)));
  if (!selected.length) return undefined;
  fields["health.selected"] = selected;
  // Other forms in this card are still unsent; keep their exact original revision.
  return {...draft, value: {...value, fields}};
}

export class TodayOfflineRuntime {
  private writes: Promise<unknown> = Promise.resolve();
  readonly store: OfflineStore;
  readonly identity: OfflineIdentity;
  private online: () => boolean;
  private now: () => number;
  constructor(store: OfflineStore, identity: OfflineIdentity, online: () => boolean, now: () => number = Date.now) {
    this.store = store; this.identity = identity; this.online = online; this.now = now;
  }
  private serialize<T>(write: () => Promise<T>): Promise<T> {
    const result = this.writes.then(write);
    this.writes = result.catch(() => {});
    return result;
  }
  async rememberWorkspace(workspace: TodayWorkspace) {
    const grant = workspace.offlineAccess;
    if (!grant || grant.tenantId !== this.identity.tenantId || grant.userId !== this.identity.userId || grant.farmId !== workspace.farm.id || grant.workDate !== workspace.workDate) throw Error("OFFLINE_NOT_AUTHORIZED");
    const receivedAt = this.now();
    await this.serialize(async () => {
      await this.store.putSnapshot(workspaceKey(workspace.farm.id, workspace.workDate), workspace);
      await this.store.putDraft({key:`grant:${workspaceKey(workspace.farm.id, workspace.workDate)}`,taskId:"metadata",workDate:workspace.workDate,updatedAt:grant.issuedAt,value:{grant,receivedAt,lastSeenAt:receivedAt} satisfies StoredOfflineGrant});
    });
  }
  async assertEditable(selection: OfflineSelection) {
    const row = await this.store.getDraft(`grant:${workspaceKey(selection.farmId, selection.workDate)}`);
    const stored = row?.value as StoredOfflineGrant | undefined;
    const decision = offlineEditDecision(stored, this.identity, selection, this.now());
    if (decision !== "allowed") throw Error(decision === "expired" || decision === "clock_changed" ? "OFFLINE_EXPIRED" : "OFFLINE_NOT_AUTHORIZED");
    if (row && stored) await this.store.putDraft({...row,value:{...stored,lastSeenAt:this.now()}});
  }
  async saveDraft(selection: OfflineSelection, draft: OfflineDraft) {
    return this.serialize(async () => {
      if (!this.online()) await this.assertEditable(selection);
      await this.store.putDraft(draft);
    });
  }
  async rememberDetail(detail: TodayTaskDetail) {
    await this.store.putDraft({key:`detail:${taskDraftKey({farmId:detail.farmId,flockId:detail.flockId,workDate:detail.workDate},detail.task)}`,taskId:"metadata",workDate:detail.workDate,value:detail,updatedAt:new Date(this.now()).toISOString()});
  }
  async prepareDetails(workspace:TodayWorkspace,load:(task:string,flockId:string|null)=>Promise<TodayTaskDetail>) {
    const jobs=[...workspace.flocks.flatMap(flock=>flock.tasks.filter(task=>task.applicable&&task.code!=="birds").map(task=>({task:task.code,flockId:flock.id}))),...workspace.farmTasks.filter(task=>task.applicable).map(task=>({task:task.code,flockId:null}))];
    for(const job of jobs)await this.rememberDetail(await load(job.task,job.flockId));
  }
  async readDetail(selection: OfflineSelection, task: string) {
    return (await this.store.getDraft(`detail:${taskDraftKey(selection,task)}`))?.value as TodayTaskDetail | undefined;
  }
  async pending() { return this.store.listCommands(); }
  async drafts() { return (await this.store.listDrafts()).filter(row => row.key.startsWith("task:")); }
  async drain(send: CommandSender, authorize: () => Promise<boolean>): Promise<SyncSummary | undefined> {
    if (!this.online() || !await authorize()) return undefined;
    return syncOutbox(this.store, send, this.now, async entry => {
      if (entry.taskKey) {
        const draft = await this.store.getDraft(entry.taskKey);
        const fields=(draft?.value as {fields?:Record<string,unknown>}|undefined)?.fields;
        if(draft && draft.taskId!=="health_deaths" && draft.updatedAt!==entry.draftUpdatedAt && !(draft.taskId==="feeding"&&fields?.["feeding.editingId"]==null))return;
        const remaining = draft && remainingDraft(draft, entry.command);
        if (remaining) await this.store.putDraft(remaining);
        else await this.store.removeDraft(entry.taskKey);
      }
    });
  }
  async enqueue(command: TodayCommand, taskKey: string): Promise<LocalCommandResult> {
    if (command.type === "finish_operating_day") throw Error("ONLINE_REQUIRED");
    return this.serialize(async () => {
      if (!this.online()) await this.assertEditable(selectionOf(command));
      const queue = await this.store.listCommands();
      const existing = queue.find(row => row.command.command_id === command.command_id);
      if (existing) {
        if (JSON.stringify(existing.originalCommand??existing.command) !== JSON.stringify(command)) throw Error("COMMAND_ID_REUSED");
        return existing.result ?? {command_id:command.command_id,status:"queued"};
      }
      const sameScope=queue.filter(row=>row.command.farm_id===command.farm_id&&row.command.flock_id===command.flock_id&&row.command.work_date===command.work_date);
      // Equal append-only events can be intentional (two identical expenses or
      // feedings). Only repeated mutable/zero-confirmation saves are coalesced.
      const coalescible=["save_daily_record","close_feed_day","confirm_no_activity"].includes(command.type);
      const duplicate=coalescible&&sameScope.find(row=>row.command.type===command.type&&JSON.stringify(row.command.payload)===JSON.stringify(command.payload));
      if(duplicate)return duplicate.result??{command_id:duplicate.command.command_id,status:"queued"};
      const daily=sameScope.filter(row=>row.command.type==="save_daily_record"||row.command.type==="close_feed_day").at(-1)?.command.command_id;
      const feed=sameScope.filter(row=>row.command.type==="save_feed_session"||row.command.type==="close_feed_day").at(-1)?.command.command_id;
      const revisionFrom=command.type==="save_daily_record"?daily:command.type==="save_feed_session"||command.type==="close_feed_day"?feed:undefined;
      const dailyFrom=command.type==="close_feed_day"?daily:undefined;
      const fingerprintFrom=command.type==="confirm_no_activity"?daily:undefined;
      const dependencies=[...new Set([...(command.depends_on??[]),revisionFrom,dailyFrom,fingerprintFrom].filter((id):id is string=>Boolean(id)))];
      const queuedCommand={...command,...(revisionFrom?{revision_from:revisionFrom}:{}),...(dailyFrom?{daily_revision_from:dailyFrom}:{}),...(fingerprintFrom?{fingerprint_from:fingerprintFrom}:{}),...(dependencies.length?{depends_on:dependencies}:{})};
      const resourceKey=commandResourceKey(command);
      const savedDraft=await this.store.getDraft(taskKey);
      const queuedTime=Math.max(this.now(),...queue.map(row=>Date.parse(row.queuedAt)+1).filter(Number.isFinite));
      await this.store.putCommand({command:queuedCommand,originalCommand:command,draftUpdatedAt:savedDraft?.updatedAt,taskKey,resourceKey,state:"queued",queuedAt:new Date(queuedTime).toISOString()});
      return {command_id:command.command_id,status:"queued"};
    });
  }
  async finish(command: TodayCommand, send: CommandSender, authorize: () => Promise<boolean>) {
    if (command.type !== "finish_operating_day") throw Error("INVALID_FINISH_COMMAND");
    if (!this.online()) throw Error("ONLINE_REQUIRED");
    await this.writes;
    if ((await this.pending()).length || (await this.drafts()).length) throw Error("UNSYNCED_WORK");
    if (!await authorize()) throw Error("OFFLINE_NOT_AUTHORIZED");
    return send(command);
  }
}
