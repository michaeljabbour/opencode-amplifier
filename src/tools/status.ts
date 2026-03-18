/**
 * Status and kernel inspection tools:
 * - amplifier_status: session state, runtime connection, active bundle/mode/provider
 * - amplifier_capability: get/set/list coordinator capabilities
 * - amplifier_emit: emit a kernel hook event
 */

import { tool } from "@opencode-ai/plugin"
import type { AmplifierSession, HookResult } from "../kernel/session.js"
import type { RuntimeContract } from "../runtime/contracts.js"
import { PROVIDER_MAP } from "../providers/mapping.js"

export function buildStatusTools(
  session: AmplifierSession,
  client: RuntimeContract,
  extras: {
    bundleProviders?: Array<{ module: string; config?: Record<string, unknown> }>
    bundleContext?: string | null
    availableModes?: Array<{ shortcut: string }>
  } = {},
) {
  const coord = session.coordinator
  const { bundleProviders = [], bundleContext = null, availableModes = [] } = extras

  async function emit(event: string, data: Record<string, unknown>): Promise<HookResult | null> {
    try { return await coord.hooks.emit(event, JSON.stringify(data)) }
    catch (e) {
      console.error("[amplifier] emit hook failed:", (e as Error).message)
      return null
    }
  }

  return {
    amplifier_status: tool({
      description: "Show Amplifier status: session, runtime connection, active bundle/mode/provider, capabilities, hooks, and bundle providers.",
      args: {},
      async execute() {
        return JSON.stringify({
          sessionId: session.sessionId,
          parentId: session.parentId,
          status: session.status,
          isInitialized: session.isInitialized,
          runtimeConnected: client.isConnected(),
          activeBundle: coord.getCapability("active.bundle"),
          activeMode: coord.getCapability("active.mode"),
          activeProvider: coord.getCapability("active.provider"),
          availableModes: availableModes.map((m) => `/${m.shortcut}`).join(", ") || "none",
          hooks: coord.hooks.listHandlers(),
          capabilities: coord.toDict(),
          bundleProviders: bundleProviders.map((p) => ({
            module: p.module,
            opencode_provider: PROVIDER_MAP[p.module] ?? null,
          })),
          bundleContext: bundleContext
            ? `(${bundleContext.length} chars loaded from foundation)`
            : "(fallback)",
        }, null, 2)
      },
    }),

    amplifier_capability: tool({
      description: "Get, set, or list capabilities on the Amplifier coordinator.",
      args: {
        action: tool.schema.enum(["get", "set", "list"]).describe("Action"),
        name: tool.schema.string().optional().describe("Capability name"),
        value: tool.schema.string().optional().describe("JSON value for set"),
      },
      async execute(args) {
        if (args.action === "list") return JSON.stringify(coord.toDict(), null, 2)
        if (!args.name) return "name required"
        if (args.action === "get") return coord.getCapability(args.name) ?? "not found"
        if (!args.value) return "value required"
        coord.registerCapability(args.name, args.value)
        return `set '${args.name}'`
      },
    }),

    amplifier_emit: tool({
      description: "Emit a hook event to the Amplifier kernel.",
      args: {
        event: tool.schema.string().describe("Event name"),
        data: tool.schema.string().describe("JSON payload"),
      },
      async execute(args) {
        try { return JSON.stringify(await emit(args.event, JSON.parse(args.data)), null, 2) }
        catch (e) { return `error: ${e instanceof Error ? e.message : e}` }
      },
    }),
  }
}
