/**
 * opencode-amplifier — Drop this file into .opencode/plugins/ of any OpenCode project.
 * Provides amplifier-core kernel primitives (session, hooks, capabilities, cancellation)
 * and amplifier-app-cli passthrough via OpenCode's standard plugin system.
 *
 * Zero dependencies beyond @opencode-ai/plugin (already available in OpenCode).
 * No build step. No npm install. No core modifications.
 */
import type { Plugin, PluginInput, Hooks, ToolDefinition } from "@opencode-ai/plugin"
import { tool } from "@opencode-ai/plugin"
import { randomUUID } from "crypto"
import { exec } from "child_process"
import { spawn } from "child_process"

// ─── Kernel Primitives ──────────────────────────────────────────────────────

type HookAction = "Continue" | "Deny" | "Modify" | "InjectContext" | "AskUser"

interface HookResult {
  action: HookAction
  reason?: string
  contextInjection?: string
  contextInjectionRole?: "System" | "User" | "Assistant"
  ephemeral?: boolean
  suppressOutput?: boolean
  userMessage?: string
  userMessageLevel?: "Info" | "Warning" | "Error"
  approvalPrompt?: string
  approvalTimeout?: number
  approvalDefault?: "Allow" | "Deny"
}

type HookHandler = { name: string; priority: number; fn: (event: string, data: string) => Promise<string> }

class HookRegistry {
  private handlers = new Map<string, HookHandler[]>()
  private defaults: Partial<HookResult> = {}

  register(event: string, fn: (event: string, data: string) => Promise<string>, priority: number, name: string) {
    const list = this.handlers.get(event) ?? []
    list.push({ name, priority, fn })
    list.sort((a, b) => a.priority - b.priority)
    this.handlers.set(event, list)
  }

  async emit(event: string, dataJson: string): Promise<HookResult> {
    const list = this.handlers.get(event) ?? []
    let result: HookResult = { action: "Continue", ...this.defaults }
    for (const h of list) {
      try {
        const parsed = JSON.parse(await h.fn(event, dataJson)) as Partial<HookResult>
        if (parsed.action === "Deny") return { ...result, ...parsed }
        if (parsed.action === "Modify" || parsed.action === "InjectContext") result = { ...result, ...parsed }
      } catch {
        return { action: "Deny", reason: `handler '${h.name}' failed` }
      }
    }
    return result
  }

  listHandlers(): Record<string, string[]> {
    const out: Record<string, string[]> = {}
    for (const [e, list] of this.handlers) out[e] = list.map((h) => h.name)
    return out
  }
}

class CancellationToken {
  private state: "none" | "graceful" | "immediate" = "none"
  get isCancelled() { return this.state !== "none" }
  requestGraceful() { if (this.state === "none") this.state = "graceful" }
  requestImmediate() { this.state = "immediate" }
  reset() { this.state = "none" }
}

class Coordinator {
  readonly hooks = new HookRegistry()
  readonly cancellation = new CancellationToken()
  private capabilities = new Map<string, string>()

  registerCapability(name: string, value: string) { this.capabilities.set(name, value) }
  getCapability(name: string): string | null { return this.capabilities.get(name) ?? null }
  resetTurn() { this.cancellation.reset() }
  toDict() { return { capabilities: Object.fromEntries(this.capabilities) } }
}

class AmplifierSession {
  readonly sessionId: string
  readonly parentId: string | null
  readonly coordinator = new Coordinator()
  private _initialized = false
  private _status = "Running"

  constructor(sessionId?: string, parentId?: string) {
    this.sessionId = sessionId ?? randomUUID()
    this.parentId = parentId ?? null
  }

  get isInitialized() { return this._initialized }
  get status() { return this._status }
  setInitialized() { this._initialized = true }
  async cleanup() { this._status = "Completed"; this._initialized = false }
}

// ─── Bundle Resolution (Python subprocess, optional) ────────────────────────

interface BundleConfig {
  name: string
  mount_plan: {
    tools: { name: string; module: string; transport: string }[]
    providers: { name: string; module: string; transport: string; config?: Record<string, unknown> }[]
    hooks: { event: string; module: string; transport: string; priority?: number }[]
    context: { name: string; module: string; transport: string }[]
  }
}

async function resolveBundle(bundleName: string, settings?: Record<string, unknown>): Promise<BundleConfig> {
  const settingsJson = JSON.stringify(settings ?? {})
  const script = `
import json, sys, asyncio
async def main():
    try:
        from amplifier_foundation import BundleRegistry
        registry = BundleRegistry()
        bundle = await registry.load(${JSON.stringify(bundleName)})
        if ${JSON.stringify(settingsJson)} != "{}":
            bundle = bundle.with_settings(json.loads(${JSON.stringify(settingsJson)}))
        prepared = await bundle.prepare()
        print(json.dumps({
            "name": prepared.name,
            "mount_plan": {
                "tools": [{"name": t.name, "module": t.module, "transport": t.transport} for t in prepared.tools],
                "providers": [{"name": p.name, "module": p.module, "transport": p.transport} for p in prepared.providers],
                "hooks": [{"event": h.event, "module": h.module, "transport": h.transport} for h in prepared.hooks],
                "context": [{"name": c.name, "module": c.module, "transport": c.transport} for c in prepared.context],
            },
        }))
    except Exception as e:
        print(json.dumps({"error": str(e)})); sys.exit(1)
asyncio.run(main())
`
  return new Promise((resolve, reject) => {
    const proc = spawn("python3", ["-c", script], { stdio: ["pipe", "pipe", "pipe"], timeout: 30000 })
    let stdout = "", stderr = ""
    proc.stdout.on("data", (d: Buffer) => { stdout += d })
    proc.stderr.on("data", (d: Buffer) => { stderr += d })
    proc.on("close", (code) => {
      if (code !== 0) return reject(new Error(stderr.trim() || `exit ${code}`))
      try {
        const r = JSON.parse(stdout.trim())
        r.error ? reject(new Error(r.error)) : resolve(r)
      } catch { reject(new Error(`bad output: ${stdout.slice(0, 200)}`)) }
    })
    proc.on("error", (e) => reject(new Error(`python: ${e.message}`)))
  })
}

async function resolveBundleOrDefault(name: string, settings?: Record<string, unknown>): Promise<BundleConfig> {
  try { return await resolveBundle(name, settings) }
  catch { return { name, mount_plan: { tools: [], providers: [], hooks: [], context: [] } } }
}

// ─── Provider Mapping ───────────────────────────────────────────────────────

const PROVIDER_MAP: Record<string, string> = {
  "provider-anthropic": "anthropic", "provider-openai": "openai", "provider-google": "google",
  "provider-azure": "azure", "provider-bedrock": "amazon-bedrock", "provider-mistral": "mistral",
  "provider-groq": "groq", "provider-deepseek": "deepseek", "provider-xai": "xai",
  "provider-openrouter": "openrouter", "provider-together": "together-ai",
  "provider-fireworks": "fireworks", "provider-perplexity": "perplexity", "provider-cohere": "cohere",
}
const PROVIDER_ENV: Record<string, string> = {
  "provider-anthropic": "ANTHROPIC_API_KEY", "provider-openai": "OPENAI_API_KEY",
  "provider-google": "GOOGLE_GENERATIVE_AI_API_KEY", "provider-azure": "AZURE_API_KEY",
  "provider-bedrock": "AWS_ACCESS_KEY_ID", "provider-mistral": "MISTRAL_API_KEY",
  "provider-groq": "GROQ_API_KEY", "provider-deepseek": "DEEPSEEK_API_KEY",
  "provider-xai": "XAI_API_KEY", "provider-openrouter": "OPENROUTER_API_KEY",
  "provider-together": "TOGETHER_AI_API_KEY", "provider-fireworks": "FIREWORKS_API_KEY",
  "provider-perplexity": "PERPLEXITY_API_KEY", "provider-cohere": "COHERE_API_KEY",
}

// ─── Plugin Entry ───────────────────────────────────────────────────────────

const AmplifierPlugin: Plugin = async (input: PluginInput) => {
  const session = new AmplifierSession()
  const coord = session.coordinator

  coord.registerCapability("opencode.project", JSON.stringify({
    id: input.project.id, directory: input.directory, worktree: input.worktree,
  }))
  session.setInitialized()

  // Resolve bundle (non-blocking, falls back to empty)
  const bundle = await resolveBundleOrDefault("foundation")
  const bundleProviders = bundle.mount_plan.providers

  // Inject bundle provider API keys into env
  for (const bp of bundleProviders) {
    const envVar = PROVIDER_ENV[bp.module]
    if (!envVar) continue
    let key = (bp.config as any)?.api_key as string | undefined
    if (key?.startsWith("${") && key.endsWith("}")) key = process.env[key.slice(2, -1)]
    if (key && !process.env[envVar]) process.env[envVar] = key
  }

  // Helper
  async function emit(event: string, data: Record<string, unknown>): Promise<HookResult | null> {
    try { return await coord.hooks.emit(event, JSON.stringify(data)) } catch { return null }
  }

  // ─── Hooks ──────────────────────────────────────────────────────────────

  const hooks: Partial<Hooks> = {
    "tool.execute.before": async (inp, out) => {
      const r = await emit("tool:pre", { tool_name: inp.tool, session_id: inp.sessionID, call_id: inp.callID, args: out.args })
      if (r?.action === "Deny") throw new Error(`amplifier denied tool ${inp.tool}: ${r.reason ?? "denied"}`)
      if (r?.action === "Modify" && r.contextInjection) try { Object.assign(out.args, JSON.parse(r.contextInjection)) } catch {}
    },

    "tool.execute.after": async (inp, out) => {
      await emit("tool:post", { tool_name: inp.tool, session_id: inp.sessionID, call_id: inp.callID, args: inp.args, output: out.output })
    },

    "chat.params": async (inp, out) => {
      const r = await emit("provider:pre", { session_id: inp.sessionID, provider: inp.model.providerID, model: inp.model.id, agent: inp.agent, temperature: out.temperature })
      if (r?.action === "Deny") throw new Error(`amplifier denied LLM call: ${r.reason ?? "denied"}`)
    },

    "experimental.chat.system.transform": async (inp, out) => {
      const r = await emit("provider:system", { session_id: inp.sessionID ?? "", model: inp.model.id, provider: inp.model.providerID })
      if (r?.action === "InjectContext" && r.contextInjection) out.system.push(r.contextInjection)
    },

    "shell.env": async (_inp, out) => {
      for (const bp of bundleProviders) {
        const envVar = PROVIDER_ENV[bp.module]
        if (!envVar) continue
        let key = (bp.config as any)?.api_key as string | undefined
        if (key?.startsWith("${") && key.endsWith("}")) key = process.env[key.slice(2, -1)]
        if (key && !out.env[envVar]) out.env[envVar] = key
      }
    },

    event: async (inp) => {
      const ev = inp.event as any
      const type = ev?.type ?? "unknown"
      if (type === "session.created") { coord.resetTurn(); await emit("session:start", { session_id: ev?.properties?.id }) }
      else if (type === "session.deleted") { await emit("session:end", { session_id: ev?.properties?.id }) }
      await emit("opencode:event", { type, data: ev })
    },
  }

  // ─── Tools ──────────────────────────────────────────────────────────────

  const tools: Record<string, ToolDefinition> = {
    amplifier_status: tool({
      description: "Show amplifier kernel status: session, capabilities, hooks, bundle providers.",
      args: {},
      async execute() {
        return JSON.stringify({
          sessionId: session.sessionId, parentId: session.parentId, status: session.status,
          isInitialized: session.isInitialized, hooks: coord.hooks.listHandlers(),
          capabilities: coord.toDict(), bundleProviders: bundleProviders.map((p) => ({
            module: p.module, opencode_provider: PROVIDER_MAP[p.module] ?? null,
          })),
        }, null, 2)
      },
    }),

    amplifier_capability: tool({
      description: "Get, set, or list capabilities on the amplifier coordinator.",
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
      description: "Emit a hook event to the amplifier kernel.",
      args: {
        event: tool.schema.string().describe("Event name"),
        data: tool.schema.string().describe("JSON payload"),
      },
      async execute(args) {
        try { return JSON.stringify(await emit(args.event, JSON.parse(args.data)), null, 2) }
        catch (e) { return `error: ${e instanceof Error ? e.message : e}` }
      },
    }),

    amplifier_bundle_resolve: tool({
      description: "Resolve an amplifier-foundation bundle and show its mount plan.",
      args: {
        name: tool.schema.string().describe("Bundle name"),
        settings: tool.schema.string().optional().describe("Optional JSON settings override"),
      },
      async execute(args) {
        try { return JSON.stringify(await resolveBundle(args.name, args.settings ? JSON.parse(args.settings) : undefined), null, 2) }
        catch (e) { return `error: ${e instanceof Error ? e.message : e}` }
      },
    }),

    amplifier_cli: tool({
      description: "Run an amplifier CLI command (init, bundle list, provider list, settings get, doctor, etc).",
      args: {
        command: tool.schema.string().describe("CLI command after 'amplifier' (e.g. 'bundle list', 'provider use anthropic')"),
      },
      async execute(args, ctx) {
        return new Promise<string>((resolve) => {
          exec(`amplifier ${args.command}`, { cwd: ctx.directory, timeout: 30000, env: { ...process.env, FORCE_COLOR: "0" } },
            (err, stdout, stderr) => resolve(err ? `error: ${stderr.trim() || err.message}` : stdout.trim() || "(no output)"))
        })
      },
    }),
  }

  return { tool: tools, ...hooks }
}

export default AmplifierPlugin
