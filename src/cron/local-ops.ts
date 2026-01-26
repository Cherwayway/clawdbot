/**
 * Local Cron Operations
 *
 * Provides direct file-based cron operations for --local mode.
 * These functions bypass the Gateway and work directly with jobs.json.
 */

import { randomUUID } from "node:crypto";
import { computeNextRunAtMs } from "./schedule.js";
import { loadCronStore, saveCronStore, resolveCronStorePath } from "./store.js";
import type { CronJob, CronJobCreate, CronJobPatch, CronPayload } from "./types.js";

// Helper to compute next run time for a job
function computeNextRun(job: CronJob, nowMs: number): number | undefined {
  return computeNextRunAtMs(job.schedule, nowMs);
}

export type LocalCronResult<T> = { ok: true; data: T } | { ok: false; error: string };

/**
 * Get the resolved store path.
 */
export function getStorePath(storePath?: string): string {
  return resolveCronStorePath(storePath);
}

/**
 * List all cron jobs.
 */
export async function listJobs(opts?: {
  storePath?: string;
  includeDisabled?: boolean;
}): Promise<LocalCronResult<CronJob[]>> {
  try {
    const path = resolveCronStorePath(opts?.storePath);
    const store = await loadCronStore(path);
    const jobs = opts?.includeDisabled ? store.jobs : store.jobs.filter((j) => j.enabled);
    return {
      ok: true,
      data: jobs.sort((a, b) => (a.state.nextRunAtMs ?? 0) - (b.state.nextRunAtMs ?? 0)),
    };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

/**
 * Get a single cron job by ID.
 */
export async function getJob(
  id: string,
  opts?: { storePath?: string },
): Promise<LocalCronResult<CronJob>> {
  try {
    const path = resolveCronStorePath(opts?.storePath);
    const store = await loadCronStore(path);
    const job = store.jobs.find((j) => j.id === id);
    if (!job) {
      return { ok: false, error: `Job not found: ${id}` };
    }
    return { ok: true, data: job };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

/**
 * Add a new cron job.
 */
export async function addJob(
  input: CronJobCreate,
  opts?: { storePath?: string },
): Promise<LocalCronResult<CronJob>> {
  try {
    const path = resolveCronStorePath(opts?.storePath);
    const store = await loadCronStore(path);
    const now = Date.now();

    const job: CronJob = {
      id: randomUUID(),
      ...input,
      createdAtMs: now,
      updatedAtMs: now,
      state: {
        nextRunAtMs:
          input.enabled !== false
            ? computeNextRun({ schedule: input.schedule } as CronJob, now)
            : undefined,
        ...input.state,
      },
    };

    store.jobs.push(job);
    await saveCronStore(path, store);

    return { ok: true, data: job };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

/**
 * Update an existing cron job.
 */
export async function updateJob(
  id: string,
  patch: CronJobPatch,
  opts?: { storePath?: string },
): Promise<LocalCronResult<CronJob>> {
  try {
    const path = resolveCronStorePath(opts?.storePath);
    const store = await loadCronStore(path);
    const jobIndex = store.jobs.findIndex((j) => j.id === id);

    if (jobIndex === -1) {
      return { ok: false, error: `Job not found: ${id}` };
    }

    const job = store.jobs[jobIndex]!;
    const now = Date.now();

    // Apply patch
    if (patch.name !== undefined) job.name = patch.name;
    if (patch.description !== undefined) job.description = patch.description;
    if (patch.enabled !== undefined) job.enabled = patch.enabled;
    if (patch.schedule !== undefined) job.schedule = patch.schedule;
    if (patch.sessionTarget !== undefined) job.sessionTarget = patch.sessionTarget;
    if (patch.wakeMode !== undefined) job.wakeMode = patch.wakeMode;
    if (patch.agentId !== undefined) job.agentId = patch.agentId;
    if (patch.deleteAfterRun !== undefined) job.deleteAfterRun = patch.deleteAfterRun;
    if (patch.isolation !== undefined) job.isolation = patch.isolation;

    // Apply payload patch
    if (patch.payload) {
      if (patch.payload.kind === "systemEvent") {
        job.payload = {
          kind: "systemEvent",
          text: patch.payload.text ?? (job.payload.kind === "systemEvent" ? job.payload.text : ""),
        };
      } else if (patch.payload.kind === "agentTurn") {
        type AgentTurnPayload = Extract<CronPayload, { kind: "agentTurn" }>;
        const existing: Partial<AgentTurnPayload> =
          job.payload.kind === "agentTurn" ? job.payload : {};
        job.payload = {
          kind: "agentTurn",
          message: patch.payload.message ?? existing.message ?? "",
          model: patch.payload.model ?? existing.model,
          thinking: patch.payload.thinking ?? existing.thinking,
          timeoutSeconds: patch.payload.timeoutSeconds ?? existing.timeoutSeconds,
          deliver: patch.payload.deliver ?? existing.deliver,
          channel: patch.payload.channel ?? existing.channel,
          to: patch.payload.to ?? existing.to,
          bestEffortDeliver: patch.payload.bestEffortDeliver ?? existing.bestEffortDeliver,
        };
      }
    }

    // Apply state patch
    if (patch.state) {
      if (patch.state.nextRunAtMs !== undefined) job.state.nextRunAtMs = patch.state.nextRunAtMs;
      if (patch.state.runningAtMs !== undefined) job.state.runningAtMs = patch.state.runningAtMs;
      if (patch.state.lastRunAtMs !== undefined) job.state.lastRunAtMs = patch.state.lastRunAtMs;
      if (patch.state.lastStatus !== undefined) job.state.lastStatus = patch.state.lastStatus;
      if (patch.state.lastError !== undefined) job.state.lastError = patch.state.lastError;
      if (patch.state.lastDurationMs !== undefined)
        job.state.lastDurationMs = patch.state.lastDurationMs;
    }

    job.updatedAtMs = now;

    // Recompute next run if schedule or enabled changed
    if (job.enabled && (patch.schedule !== undefined || patch.enabled !== undefined)) {
      job.state.nextRunAtMs = computeNextRun(job, now);
    } else if (!job.enabled) {
      job.state.nextRunAtMs = undefined;
    }

    store.jobs[jobIndex] = job;
    await saveCronStore(path, store);

    return { ok: true, data: job };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

/**
 * Remove a cron job.
 */
export async function removeJob(
  id: string,
  opts?: { storePath?: string },
): Promise<LocalCronResult<{ removed: boolean }>> {
  try {
    const path = resolveCronStorePath(opts?.storePath);
    const store = await loadCronStore(path);
    const before = store.jobs.length;
    store.jobs = store.jobs.filter((j) => j.id !== id);
    const removed = store.jobs.length < before;

    if (removed) {
      await saveCronStore(path, store);
    }

    return { ok: true, data: { removed } };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

/**
 * Get cron status.
 */
export async function getStatus(opts?: {
  storePath?: string;
}): Promise<
  LocalCronResult<{
    enabled: boolean;
    storePath: string;
    jobs: number;
    nextWakeAtMs: number | null;
  }>
> {
  try {
    const path = resolveCronStorePath(opts?.storePath);
    const store = await loadCronStore(path);
    const enabledJobs = store.jobs.filter((j) => j.enabled);
    const nextWakeAtMs = enabledJobs.reduce<number | null>((min, job) => {
      const next = job.state.nextRunAtMs;
      if (typeof next !== "number") return min;
      return min === null ? next : Math.min(min, next);
    }, null);

    return {
      ok: true,
      data: {
        enabled: true, // In local mode, we assume cron is always "enabled" (managed by external scheduler)
        storePath: path,
        jobs: store.jobs.length,
        nextWakeAtMs,
      },
    };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

/**
 * Get due jobs (jobs that should run now).
 */
export async function getDueJobs(opts?: {
  storePath?: string;
}): Promise<LocalCronResult<CronJob[]>> {
  try {
    const path = resolveCronStorePath(opts?.storePath);
    const store = await loadCronStore(path);
    const now = Date.now();

    const dueJobs = store.jobs.filter((j) => {
      if (!j.enabled) return false;
      if (j.state.runningAtMs) return false; // Already running
      const next = j.state.nextRunAtMs;
      return typeof next === "number" && now >= next;
    });

    return { ok: true, data: dueJobs };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

/**
 * Mark a job as running (set runningAtMs).
 */
export async function markJobRunning(
  id: string,
  opts?: { storePath?: string },
): Promise<LocalCronResult<CronJob>> {
  return updateJob(
    id,
    {
      state: { runningAtMs: Date.now() },
    },
    opts,
  );
}

/**
 * Mark a job as completed and update next run time.
 */
export async function markJobCompleted(
  id: string,
  result: { status: "ok" | "error" | "skipped"; error?: string; durationMs: number },
  opts?: { storePath?: string },
): Promise<LocalCronResult<CronJob>> {
  try {
    const path = resolveCronStorePath(opts?.storePath);
    const store = await loadCronStore(path);
    const jobIndex = store.jobs.findIndex((j) => j.id === id);

    if (jobIndex === -1) {
      return { ok: false, error: `Job not found: ${id}` };
    }

    const job = store.jobs[jobIndex]!;
    const now = Date.now();

    job.state.runningAtMs = undefined;
    job.state.lastRunAtMs = now;
    job.state.lastStatus = result.status;
    job.state.lastError = result.error;
    job.state.lastDurationMs = result.durationMs;
    job.updatedAtMs = now;

    // Handle one-shot jobs
    const isOneShot = job.schedule.kind === "at";
    if (isOneShot && result.status === "ok") {
      if (job.deleteAfterRun) {
        // Remove the job
        store.jobs = store.jobs.filter((j) => j.id !== id);
        await saveCronStore(path, store);
        return { ok: true, data: job };
      } else {
        // Disable the job
        job.enabled = false;
        job.state.nextRunAtMs = undefined;
      }
    } else if (job.enabled) {
      // Compute next run for recurring jobs
      job.state.nextRunAtMs = computeNextRun(job, now);
    }

    store.jobs[jobIndex] = job;
    await saveCronStore(path, store);

    return { ok: true, data: job };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}
