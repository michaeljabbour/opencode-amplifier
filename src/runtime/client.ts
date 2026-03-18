/**
 * Runtime client — wraps the transport and implements RuntimeContract.
 *
 * Phase 1: StubRuntimeClient for testing. Fails closed (throws
 * RUNTIME_UNAVAILABLE) on every operation when not connected.
 *
 * Phase 2: replace StubRuntimeClient with a real client backed by the
 * socket transport and native runtime.
 */

import type {
  RuntimeContract,
  RuntimeSessionInfo,
  RuntimeBundleInfo,
  RuntimeModeInfo,
  RuntimeProviderInfo,
  SessionCreateParams,
  ExecuteParams,
  SpawnParams,
  ApprovalDecision,
  OrchestratorContract,
} from "./contracts.js"
import type { RuntimeEvent } from "./events.js"

function unavailable(): never {
  const err = new Error(
    "RUNTIME_UNAVAILABLE: The native Amplifier runtime is not connected. " +
      "Start or reconnect the runtime, then try again. " +
      "Run amplifier_doctor for diagnostics.",
  )
  err.name = "RuntimeUnavailableError"
  throw err
}

/**
 * Stub implementation of RuntimeContract used in Phase 1.
 * All operations fail with RUNTIME_UNAVAILABLE when disconnected.
 * Query operations return empty/safe defaults when connected.
 */
export class StubRuntimeClient implements RuntimeContract {
  private connected = false
  private sessions = new Map<string, RuntimeSessionInfo>()
  private spawnCount = 0

  async connect(): Promise<void> {
    this.connected = true
  }

  async disconnect(): Promise<void> {
    this.connected = false
  }

  isConnected(): boolean {
    return this.connected
  }

  async prepareProfile(_bundle: string, _overlays?: Record<string, unknown>): Promise<void> {
    if (!this.connected) unavailable()
  }

  async createSession(params: SessionCreateParams): Promise<string> {
    if (!this.connected) unavailable()

    const info: RuntimeSessionInfo = {
      sessionId: params.sessionId,
      parentId: params.parentId,
      status: "initializing",
      cwd: params.cwd,
    }

    this.sessions.set(params.sessionId, info)
    return params.sessionId
  }

  async execute(_params: ExecuteParams): Promise<void> {
    if (!this.connected) unavailable()
  }

  async *streamEvents(_sessionId: string): AsyncIterable<RuntimeEvent> {
    if (!this.connected) unavailable()
    return
  }

  async approve(_decision: ApprovalDecision): Promise<void> {
    if (!this.connected) unavailable()
  }

  async cancel(_sessionId: string): Promise<void> {
    if (!this.connected) unavailable()
  }

  async spawn(_params: SpawnParams): Promise<string> {
    if (!this.connected) unavailable()
    this.spawnCount += 1
    return `stub-child-${this.spawnCount}`
  }

  async status(sessionId: string): Promise<RuntimeSessionInfo> {
    if (!this.connected) unavailable()

    return this.sessions.get(sessionId) ?? {
      sessionId,
      status: "initializing",
    }
  }

  async listBundles(): Promise<RuntimeBundleInfo[]> {
    if (!this.connected) unavailable()
    return []
  }

  async listModes(): Promise<RuntimeModeInfo[]> {
    if (!this.connected) unavailable()
    return []
  }

  async listProviders(): Promise<RuntimeProviderInfo[]> {
    if (!this.connected) unavailable()
    return []
  }

  orchestrator(): OrchestratorContract | null {
    return null
  }
}
