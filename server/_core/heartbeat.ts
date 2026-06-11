import cron from "node-cron";

export type HeartbeatJob = {
  name: string;
  cron: string; // 6-field: "0 sec min hour dom mon dow" — seconds field is dropped
  path: string;
  method?: "POST" | "PUT";
  payload?: unknown;
  description?: string;
};

export type HeartbeatJobUpdate = Partial<Omit<HeartbeatJob, "name">> & {
  enable?: boolean;
};

export type HeartbeatJobInfo = {
  taskUid: string;
  name: string;
  cronExpression: string;
  isEnable: boolean;
};

type StoredJob = {
  task: cron.ScheduledTask;
  info: HeartbeatJobInfo;
  callback: () => Promise<void>;
  cronExpr: string;
};

const jobs = new Map<string, StoredJob>();

function toFiveField(sixFieldCron: string): string {
  const parts = sixFieldCron.trim().split(/\s+/);
  // If 6 fields (sec min hour dom mon dow), drop the first (seconds)
  return parts.length === 6 ? parts.slice(1).join(" ") : sixFieldCron;
}

function makeUid(name: string): string {
  return `local-${name}-${Date.now()}`;
}

export async function createHeartbeatJob(
  job: HeartbeatJob,
  callback: () => Promise<void>
): Promise<HeartbeatJobInfo> {
  const taskUid = makeUid(job.name);
  const cronExpr = toFiveField(job.cron);

  if (!cron.validate(cronExpr)) {
    throw new Error(`Invalid cron expression: "${cronExpr}" (from "${job.cron}")`);
  }

  const task = cron.schedule(cronExpr, async () => {
    try {
      await callback();
    } catch (err) {
      console.error(`[Cron] Job "${job.name}" failed:`, err);
    }
  });

  const info: HeartbeatJobInfo = {
    taskUid,
    name: job.name,
    cronExpression: cronExpr,
    isEnable: true,
  };

  jobs.set(taskUid, { task, info, callback, cronExpr });
  console.log(`[Cron] Scheduled job "${job.name}" with cron "${cronExpr}" (uid: ${taskUid})`);
  return info;
}

export async function updateHeartbeatJob(
  taskUid: string,
  update: HeartbeatJobUpdate,
  _sessionToken?: string
): Promise<HeartbeatJobInfo> {
  const stored = jobs.get(taskUid);
  if (!stored) throw new Error(`Heartbeat job not found: ${taskUid}`);

  // Stop existing task
  stored.task.stop();

  const newCronExpr = update.cron ? toFiveField(update.cron) : stored.cronExpr;
  const shouldEnable = update.enable !== undefined ? update.enable : stored.info.isEnable;

  let newTask = stored.task;
  if (shouldEnable) {
    newTask = cron.schedule(newCronExpr, async () => {
      try {
        await stored.callback();
      } catch (err) {
        console.error(`[Cron] Job "${stored.info.name}" failed:`, err);
      }
    });
  }

  const info: HeartbeatJobInfo = {
    ...stored.info,
    cronExpression: newCronExpr,
    isEnable: shouldEnable,
  };

  jobs.set(taskUid, { ...stored, task: newTask, info, cronExpr: newCronExpr });
  return info;
}

export async function deleteHeartbeatJob(
  taskUid: string,
  _sessionToken?: string
): Promise<void> {
  const stored = jobs.get(taskUid);
  if (!stored) return;
  stored.task.stop();
  jobs.delete(taskUid);
  console.log(`[Cron] Deleted job "${stored.info.name}" (uid: ${taskUid})`);
}
