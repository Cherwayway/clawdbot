import type { EffectiveContextPruningSettings } from "./settings.js";

export type ContextPruningRuntimeValue = {
  settings: EffectiveContextPruningSettings;
  contextWindowTokens?: number | null;
  isToolPrunable: (toolName: string) => boolean;
  lastCacheTouchAt?: number | null;
};

// Session-scoped runtime registry keyed by object identity.
// Important: this relies on Pi passing the same SessionManager object instance into
// ExtensionContext (ctx.sessionManager) that we used when calling setContextPruningRuntime.
const REGISTRY = new WeakMap<object, ContextPruningRuntimeValue>();

export function setContextPruningRuntime(
  sessionManager: unknown,
  value: ContextPruningRuntimeValue | null,
): void {
  if (!sessionManager || typeof sessionManager !== "object") {
    console.log("[context-pruning-rt] setRuntime: sessionManager invalid, skipping");
    return;
  }

  const key = sessionManager;
  if (value === null) {
    REGISTRY.delete(key);
    return;
  }

  REGISTRY.set(key, value);
  console.log(`[context-pruning-rt] setRuntime: stored in WeakMap, lastCacheTouchAt=${value.lastCacheTouchAt}, contextWindowTokens=${value.contextWindowTokens}`);
}

export function getContextPruningRuntime(
  sessionManager: unknown,
): ContextPruningRuntimeValue | null {
  if (!sessionManager || typeof sessionManager !== "object") {
    console.log("[context-pruning-rt] getRuntime: sessionManager invalid");
    return null;
  }

  const val = REGISTRY.get(sessionManager) ?? null;
  console.log(`[context-pruning-rt] getRuntime: WeakMap lookup ${val ? "HIT" : "MISS"}`);
  return val;
}
