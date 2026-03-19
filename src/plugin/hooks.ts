/**
 * OpenCode plugin hooks for Amplifier mode.
 *
 * These hooks are the seam between OpenCode's session lifecycle and the
 * Amplifier plugin. All hooks delegate to the kernel coordinator for
 * event dispatch. In Phase 1, the runtime client is present but not yet
 * used to block execution (fail-closed enforcement is Phase 2).
 */

import type { Hooks } from "@opencode-ai/plugin"
import type { AmplifierSession, HookResult } from "../kernel/session.js"
import type { RuntimeContract } from "../runtime/contracts.js"
import type { BundleConfig } from "../bundle/resolve.js"
import { resolveProviderEnvKey, PROVIDER_ENV } from "../providers/mapping.js"

interface HooksConfig {
  bundleProviders: BundleConfig["mount_plan"]["providers"]
  bundleContext: string | null
  getActiveModeContext: () => string | null
}

export function buildHooks(
  session: AmplifierSession,
  _client: RuntimeContract,
  config: HooksConfig,
): Partial<Hooks> {
  const coord = session.coordinator
  const { bundleProviders, bundleContext, getActiveModeContext } = config

  async function emit(event: string, data: Record<string, unknown>): Promise<HookResult | null> {
    try { return await coord.hooks.emit(event, JSON.stringify(data)) } catch { return null }
  }

  return {
    "tool.execute.before": async (inp, out) => {
      const r = await emit("tool:pre", {
        tool_name: inp.tool,
        session_id: inp.sessionID,
        call_id: inp.callID,
        args: out.args,
      })
      if (r?.action === "Deny") throw new Error(`amplifier denied tool ${inp.tool}: ${r.reason ?? "denied"}`)
      if (r?.action === "Modify" && r.contextInjection) {
        try { Object.assign(out.args, JSON.parse(r.contextInjection)) } catch {}
      }
    },

    "tool.execute.after": async (inp, out) => {
      await emit("tool:post", {
        tool_name: inp.tool,
        session_id: inp.sessionID,
        call_id: inp.callID,
        args: inp.args,
        output: out.output,
      })
    },

    "chat.params": async (inp, out) => {
      // Phase 1: emit to kernel hooks only.
      // Phase 2: when runtime is connected, defer entirely to runtime execution.
      const r = await emit("provider:pre", {
        session_id: inp.sessionID,
        provider: inp.model.providerID,
        model: inp.model.id,
        agent: inp.agent,
        temperature: out.temperature,
      })
      if (r?.action === "Deny") throw new Error(`amplifier denied LLM call: ${r.reason ?? "denied"}`)
    },

    "experimental.chat.system.transform": async (inp, out) => {
      if (bundleContext) out.system.push(bundleContext)

      const activeModeContext = getActiveModeContext()
      if (activeModeContext) {
        const modeName = coord.getCapability("active.mode") ?? "unknown"
        out.system.push(
          `<system-reminder source="mode-${modeName}">\n${activeModeContext}\n</system-reminder>`,
        )
      }

      const r = await emit("provider:system", {
        session_id: inp.sessionID ?? "",
        model: inp.model.id,
        provider: inp.model.providerID,
      })
      if (r?.action === "InjectContext" && r.contextInjection) out.system.push(r.contextInjection)
    },

    "shell.env": async (_inp, out) => {
      for (const bp of bundleProviders) {
        const envVar = PROVIDER_ENV[bp.module]
        if (!envVar) continue
        const key = resolveProviderEnvKey(bp.config ?? {})
        if (key && !out.env[envVar]) out.env[envVar] = key
      }
    },

    event: async (inp) => {
      const ev = inp.event as any
      const type = ev?.type ?? "unknown"
      if (type === "session.created") {
        coord.resetTurn()
        await emit("session:start", { session_id: ev?.properties?.id })
      } else if (type === "session.deleted") {
        await emit("session:end", { session_id: ev?.properties?.id })
      }
      await emit("opencode:event", { type, data: ev })
    },
  }
}
