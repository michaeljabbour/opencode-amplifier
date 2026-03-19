/**
 * Amplifier plugin entry point.
 *
 * createAmplifierPlugin() returns the OpenCode plugin function. It wires
 * together the runtime client, session scaffolding, bundle resolution,
 * mode discovery, hooks, and tools.
 *
 * Architecture (Phase 1):
 *   plugin input
 *     -> AmplifierSession (transitional scaffolding)
 *     -> StubRuntimeClient (Phase 2: replace with real client)
 *     -> resolveBundleOrDefault (Phase 3: replace with runtime API)
 *     -> discoverModes (Phase 3: replace with runtime API)
 *     -> buildHooks + all tool builders
 *     -> OpenCode Hooks return value
 */

import type { Plugin, PluginInput, Hooks } from "@opencode-ai/plugin"
import { exec } from "child_process"

import { AmplifierSession } from "../kernel/session.js"
import { StubRuntimeClient } from "../runtime/client.js"
import { resolveBundleOrDefault } from "../bundle/resolve.js"
import { loadBundleContext } from "../bundle/context.js"
import { discoverModes, loadModeContent } from "../modes/discovery.js"
import { PROVIDER_ENV, resolveProviderEnvKey } from "../providers/mapping.js"
import { buildHooks } from "./hooks.js"
import {
  buildStatusTools,
  buildBundleTools,
  buildProviderTools,
  buildModeTools,
  buildSettingsTools,
  buildDiagnosticsTools,
  buildCliTool,
} from "../tools/index.js"

// ─── CLI runner (shared by bundle/provider/settings/diagnostics tools) ─────────

function makeRunCli(): (command: string, cwd: string) => Promise<string> {
  return (command: string, cwd: string) =>
    new Promise<string>((resolve) => {
      exec(
        `amplifier ${command}`,
        { cwd, timeout: 30000, env: { ...process.env, FORCE_COLOR: "0" } },
        (err, stdout, stderr) =>
          resolve(err ? `error: ${stderr.trim() || err.message}` : stdout.trim() || "(no output)"),
      )
    })
}

// ─── Plugin factory ────────────────────────────────────────────────────────────

/**
 * Returns an OpenCode plugin function. Accepts an optional config for
 * testing — in production, use the zero-arg default.
 */
export function createAmplifierPlugin(): Plugin {
  return async (input: PluginInput): Promise<Partial<Hooks> & { tool: Record<string, unknown> }> => {
    // 1. Create transitional session scaffolding (Phase 2: replaced by runtime)
    const session = new AmplifierSession()
    const coord = session.coordinator

    coord.registerCapability("opencode.project", JSON.stringify({
      id: input.project.id,
      directory: input.directory,
      worktree: input.worktree,
    }))
    session.setInitialized()

    // 2. Create runtime client skeleton (Phase 2: connect to real runtime)
    const client = new StubRuntimeClient()
    // Attempt connection — failure is recorded but not fatal in Phase 1
    await client.connect().catch(() => {
      // StubRuntimeClient.connect() always succeeds; real client may fail here
      // Phase 2 will surface this as a runtime error state
    })

    // 3. Resolve bundle (Phase 3: replace with runtime API)
    const bundle = await resolveBundleOrDefault("foundation")
    const bundleProviders = bundle.mount_plan.providers
    const bundleContext = await loadBundleContext(bundle)

    // 4. Inject bundle provider API keys into env (Phase 3: remove)
    for (const bp of bundleProviders) {
      const envVar = PROVIDER_ENV[bp.module]
      if (!envVar) continue
      const key = resolveProviderEnvKey(bp.config ?? {})
      if (key && !process.env[envVar]) process.env[envVar] = key
    }

    // 5. Discover modes from bundle cache (Phase 3: replace with runtime API)
    const availableModes = discoverModes()

    coord.registerCapability("active.bundle", bundle.name)
    coord.registerCapability("active.provider", bundleProviders[0]?.module ?? "none")
    coord.registerCapability("active.mode", "none")

    // 6. Build mode tools (special: returns tools + getActiveModeContext)
    const { tools: modeTools, getActiveModeContext } = buildModeTools(
      coord,
      availableModes,
      loadModeContent,
    )

    // 7. Build all tools
    const runCli = makeRunCli()
    const tools = {
      ...buildStatusTools(session, client, { bundleProviders, bundleContext, availableModes }),
      ...buildBundleTools(coord, runCli),
      ...buildProviderTools(coord, runCli),
      ...modeTools,
      ...buildSettingsTools(runCli),
      ...buildDiagnosticsTools(runCli),
      ...buildCliTool(runCli),
    }

    // 8. Build hooks
    const hooks = buildHooks(session, client, {
      bundleProviders,
      bundleContext,
      getActiveModeContext,
    })

    return { tool: tools, ...hooks }
  }
}
