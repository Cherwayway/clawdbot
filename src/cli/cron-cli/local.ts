/**
 * Local CLI Support for Cron Commands
 *
 * Provides helpers for --local mode which bypasses the Gateway
 * and works directly with the jobs.json file.
 */

import type { Command } from "commander";
import type { GatewayRpcOpts } from "../gateway-rpc.js";

export type LocalCronOpts = GatewayRpcOpts & {
  local?: boolean;
  storePath?: string;
};

/**
 * Add --local and --store-path options to a command.
 */
export function addLocalCronOptions(cmd: Command): Command {
  return cmd
    .option("--local", "Use local file store instead of Gateway", false)
    .option("--store-path <path>", "Path to jobs.json (only with --local)");
}

/**
 * Check if local mode is enabled.
 */
export function isLocalMode(opts: LocalCronOpts): boolean {
  return Boolean(opts.local);
}

/**
 * Get the store path from options.
 */
export function getStorePathFromOpts(opts: LocalCronOpts): string | undefined {
  return typeof opts.storePath === "string" ? opts.storePath : undefined;
}
