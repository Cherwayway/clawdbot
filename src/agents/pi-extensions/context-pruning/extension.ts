import type { ContextEvent, ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { pruneContextMessages } from "./pruner.js";
import { getContextPruningRuntime } from "./runtime.js";

export default function contextPruningExtension(api: ExtensionAPI): void {
  console.log("[context-pruning-ext] extension registered");
  api.on("context", (event: ContextEvent, ctx: ExtensionContext) => {
    const runtime = getContextPruningRuntime(ctx.sessionManager);
    if (!runtime) {
      console.log("[context-pruning-ext] context event fired but NO runtime found (WeakMap miss)");
      return undefined;
    }

    const msgCount = event.messages.length;
    console.log(`[context-pruning-ext] context event fired, messages=${msgCount}, mode=${runtime.settings.mode}`);

    if (runtime.settings.mode === "cache-ttl") {
      const ttlMs = runtime.settings.ttlMs;
      const lastTouch = runtime.lastCacheTouchAt ?? null;
      const elapsed = lastTouch ? Date.now() - lastTouch : null;
      console.log(`[context-pruning-ext] cache-ttl check: ttlMs=${ttlMs}, lastTouch=${lastTouch}, elapsed=${elapsed}ms`);
      if (!lastTouch || ttlMs <= 0) {
        console.log("[context-pruning-ext] SKIP: no lastTouch or ttlMs<=0");
        return undefined;
      }
      if (ttlMs > 0 && Date.now() - lastTouch < ttlMs) {
        console.log("[context-pruning-ext] SKIP: cache still hot (elapsed < ttl)");
        return undefined;
      }
      console.log("[context-pruning-ext] PASS: cache expired, proceeding to prune");
    }

    const next = pruneContextMessages({
      messages: event.messages,
      settings: runtime.settings,
      ctx,
      isToolPrunable: runtime.isToolPrunable,
      contextWindowTokensOverride: runtime.contextWindowTokens ?? undefined,
    });

    if (next === event.messages) {
      console.log("[context-pruning-ext] pruner returned same array ref (no modification)");
      return undefined;
    }

    console.log(`[context-pruning-ext] pruner modified context (before=${event.messages.length}, after=${next.length} messages)`);

    if (runtime.settings.mode === "cache-ttl") {
      runtime.lastCacheTouchAt = Date.now();
    }

    return { messages: next };
  });
}
