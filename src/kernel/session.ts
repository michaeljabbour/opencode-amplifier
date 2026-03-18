/**
 * TRANSITIONAL SCAFFOLDING — DO NOT EXTEND
 *
 * AmplifierSession, Coordinator, HookRegistry, and CancellationToken are
 * placeholder TypeScript structures from before the native runtime existed.
 * They exist here to keep the plugin functional during Phase 1 decomposition.
 *
 * These will be replaced in Phase 2 when the native runtime client takes
 * over session lifecycle and hook dispatch. Do not add features here.
 * Do not design around these classes. They are temporary.
 *
 * Migration rule (from design doc): if a new feature requires more execution
 * meaning in TypeScript, it belongs in the runtime, not here.
 */

import { randomUUID } from "crypto"

// Verbatim from src/index.ts kernel primitives — do not modify logic here.

export type HookAction = "Continue" | "Deny" | "Modify" | "InjectContext" | "AskUser"

export interface HookResult {
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

export class HookRegistry {
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

export class CancellationToken {
  private state: "none" | "graceful" | "immediate" = "none"
  get isCancelled() { return this.state !== "none" }
  requestGraceful() { if (this.state === "none") this.state = "graceful" }
  requestImmediate() { this.state = "immediate" }
  reset() { this.state = "none" }
}

export class Coordinator {
  readonly hooks = new HookRegistry()
  readonly cancellation = new CancellationToken()
  private capabilities = new Map<string, string>()

  registerCapability(name: string, value: string) { this.capabilities.set(name, value) }
  getCapability(name: string): string | null { return this.capabilities.get(name) ?? null }
  resetTurn() { this.cancellation.reset() }
  toDict() { return { capabilities: Object.fromEntries(this.capabilities) } }
}

export class AmplifierSession {
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
