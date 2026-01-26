import type { Command } from "commander";
import * as localOps from "../../cron/local-ops.js";
import { danger } from "../../globals.js";
import { defaultRuntime } from "../../runtime.js";
import { addGatewayClientOptions, callGatewayFromCli } from "../gateway-rpc.js";
import {
  addLocalCronOptions,
  getStorePathFromOpts,
  isLocalMode,
  type LocalCronOpts,
} from "./local.js";
import { warnIfCronSchedulerDisabled } from "./shared.js";

export function registerCronSimpleCommands(cron: Command) {
  addLocalCronOptions(
    addGatewayClientOptions(
      cron
        .command("rm")
        .alias("remove")
        .alias("delete")
        .description("Remove a cron job")
        .argument("<id>", "Job id")
        .option("--json", "Output JSON", false)
        .action(async (id, opts: LocalCronOpts & { json?: boolean }) => {
          try {
            if (isLocalMode(opts)) {
              const result = await localOps.removeJob(id, {
                storePath: getStorePathFromOpts(opts),
              });
              if (!result.ok) throw new Error(result.error);
              defaultRuntime.log(JSON.stringify(result.data, null, 2));
            } else {
              const res = await callGatewayFromCli("cron.remove", opts, { id });
              defaultRuntime.log(JSON.stringify(res, null, 2));
            }
          } catch (err) {
            defaultRuntime.error(danger(String(err)));
            defaultRuntime.exit(1);
          }
        }),
    ),
  );

  addLocalCronOptions(
    addGatewayClientOptions(
      cron
        .command("enable")
        .description("Enable a cron job")
        .argument("<id>", "Job id")
        .action(async (id, opts: LocalCronOpts) => {
          try {
            if (isLocalMode(opts)) {
              const result = await localOps.updateJob(
                id,
                { enabled: true },
                {
                  storePath: getStorePathFromOpts(opts),
                },
              );
              if (!result.ok) throw new Error(result.error);
              defaultRuntime.log(JSON.stringify(result.data, null, 2));
            } else {
              const res = await callGatewayFromCli("cron.update", opts, {
                id,
                patch: { enabled: true },
              });
              defaultRuntime.log(JSON.stringify(res, null, 2));
              await warnIfCronSchedulerDisabled(opts);
            }
          } catch (err) {
            defaultRuntime.error(danger(String(err)));
            defaultRuntime.exit(1);
          }
        }),
    ),
  );

  addLocalCronOptions(
    addGatewayClientOptions(
      cron
        .command("disable")
        .description("Disable a cron job")
        .argument("<id>", "Job id")
        .action(async (id, opts: LocalCronOpts) => {
          try {
            if (isLocalMode(opts)) {
              const result = await localOps.updateJob(
                id,
                { enabled: false },
                {
                  storePath: getStorePathFromOpts(opts),
                },
              );
              if (!result.ok) throw new Error(result.error);
              defaultRuntime.log(JSON.stringify(result.data, null, 2));
            } else {
              const res = await callGatewayFromCli("cron.update", opts, {
                id,
                patch: { enabled: false },
              });
              defaultRuntime.log(JSON.stringify(res, null, 2));
              await warnIfCronSchedulerDisabled(opts);
            }
          } catch (err) {
            defaultRuntime.error(danger(String(err)));
            defaultRuntime.exit(1);
          }
        }),
    ),
  );

  addLocalCronOptions(
    addGatewayClientOptions(
      cron
        .command("runs")
        .description("Show cron run history (JSONL-backed)")
        .requiredOption("--id <id>", "Job id")
        .option("--limit <n>", "Max entries (default 50)", "50")
        .action(async (opts: LocalCronOpts & { id: string; limit: string }) => {
          try {
            if (isLocalMode(opts)) {
              // Local mode doesn't support run history yet
              throw new Error("Run history is not supported in --local mode");
            }
            const limitRaw = Number.parseInt(String(opts.limit ?? "50"), 10);
            const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : 50;
            const id = String(opts.id);
            const res = await callGatewayFromCli("cron.runs", opts, {
              id,
              limit,
            });
            defaultRuntime.log(JSON.stringify(res, null, 2));
          } catch (err) {
            defaultRuntime.error(danger(String(err)));
            defaultRuntime.exit(1);
          }
        }),
    ),
  );

  addLocalCronOptions(
    addGatewayClientOptions(
      cron
        .command("run")
        .description("Run a cron job now (debug)")
        .argument("<id>", "Job id")
        .option("--force", "Run even if not due", false)
        .action(async (id, opts: LocalCronOpts & { force?: boolean }) => {
          try {
            if (isLocalMode(opts)) {
              // Mark job as running
              const storePath = getStorePathFromOpts(opts);
              const startResult = await localOps.markJobRunning(id, { storePath });
              if (!startResult.ok) throw new Error(startResult.error);

              const job = startResult.data;
              defaultRuntime.log(`Running job: ${job.name} (${job.id})`);
              defaultRuntime.log(`Payload: ${JSON.stringify(job.payload)}`);

              // Note: Actual execution would be done by the caller (Shell Gateway)
              // This just marks the job state for local mode debugging
              defaultRuntime.log(JSON.stringify({ job, status: "marked_running" }, null, 2));
            } else {
              const res = await callGatewayFromCli("cron.run", opts, {
                id,
                mode: opts.force ? "force" : "due",
              });
              defaultRuntime.log(JSON.stringify(res, null, 2));
            }
          } catch (err) {
            defaultRuntime.error(danger(String(err)));
            defaultRuntime.exit(1);
          }
        }),
    ),
  );

  // New command: get job details
  addLocalCronOptions(
    addGatewayClientOptions(
      cron
        .command("get")
        .description("Get details of a cron job")
        .argument("<id>", "Job id")
        .option("--json", "Output JSON", false)
        .action(async (id, opts: LocalCronOpts & { json?: boolean }) => {
          try {
            if (isLocalMode(opts)) {
              const result = await localOps.getJob(id, {
                storePath: getStorePathFromOpts(opts),
              });
              if (!result.ok) throw new Error(result.error);
              defaultRuntime.log(JSON.stringify(result.data, null, 2));
            } else {
              const res = await callGatewayFromCli("cron.get", opts, { id });
              defaultRuntime.log(JSON.stringify(res, null, 2));
            }
          } catch (err) {
            defaultRuntime.error(danger(String(err)));
            defaultRuntime.exit(1);
          }
        }),
    ),
  );

  // New command: get due jobs (useful for external schedulers)
  addLocalCronOptions(
    cron
      .command("due")
      .description("List jobs that are due to run (--local only)")
      .option("--json", "Output JSON", false)
      .action(async (opts: LocalCronOpts & { json?: boolean }) => {
        try {
          if (!isLocalMode(opts)) {
            throw new Error("--due command requires --local mode");
          }
          const result = await localOps.getDueJobs({
            storePath: getStorePathFromOpts(opts),
          });
          if (!result.ok) throw new Error(result.error);
          defaultRuntime.log(JSON.stringify(result.data, null, 2));
        } catch (err) {
          defaultRuntime.error(danger(String(err)));
          defaultRuntime.exit(1);
        }
      }),
  );

  // New command: mark job completed (for external executors)
  addLocalCronOptions(
    cron
      .command("complete")
      .description("Mark a job as completed (--local only)")
      .argument("<id>", "Job id")
      .option("--status <status>", "Result status (ok|error|skipped)", "ok")
      .option("--error <msg>", "Error message (when status=error)")
      .option("--duration <ms>", "Duration in milliseconds", "0")
      .action(
        async (id, opts: LocalCronOpts & { status: string; error?: string; duration: string }) => {
          try {
            if (!isLocalMode(opts)) {
              throw new Error("--complete command requires --local mode");
            }
            const status = opts.status as "ok" | "error" | "skipped";
            if (!["ok", "error", "skipped"].includes(status)) {
              throw new Error("--status must be ok, error, or skipped");
            }
            const durationMs = Number.parseInt(opts.duration, 10) || 0;

            const result = await localOps.markJobCompleted(
              id,
              {
                status,
                error: opts.error,
                durationMs,
              },
              {
                storePath: getStorePathFromOpts(opts),
              },
            );
            if (!result.ok) throw new Error(result.error);
            defaultRuntime.log(JSON.stringify(result.data, null, 2));
          } catch (err) {
            defaultRuntime.error(danger(String(err)));
            defaultRuntime.exit(1);
          }
        },
      ),
  );
}
