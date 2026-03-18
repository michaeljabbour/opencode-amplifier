/**
 * Runtime contract — the stable boundary between opencode-amplifier and the
 * native Amplifier runtime. All plugin→runtime communication goes through this
 * interface. Nothing else.
 *
 * Design principle: if a new feature requires more execution meaning in
 * TypeScript, it belongs in the runtime, not here.
 */

// ─── Session lifecycle ────────────────────────────────────────────────────────

export interface SessionCreateParams {
  sessionId: string
  cwd: string
  parentId?: string
}

export interface ExecuteParams {
  sessionId: string
  input: string
}

export interface SpawnParams {
  parentSessionId: string
  agent: string
  profile?: string
  instruction?: string
}

export interface ApprovalDecision {
  requestId: string
  decision: "allow" | "deny"
  reason?: string
}

export type RuntimeSessionStatus =
  | "initializing"
  | "running"
  | "waiting_approval"
  | "completed"
  | "failed"
  | "cancelled"

export interface RuntimeSessionInfo {
  sessionId: string
  parentId?: string
  status: RuntimeSessionStatus
  profile?: string
  cwd?: string
  childSessionIds?: string[]
}

// ─── Bundle / mode / provider discovery ──────────────────────────────────────

export interface RuntimeBundleInfo {
  name: string
  description?: string
  version?: string
  active?: boolean
}

export interface RuntimeModeInfo {
  name: string
  description?: string
  shortcut?: string
  source?: string
  active?: boolean
}

export interface RuntimeProviderInfo {
  name: string
  module?: string
  available: boolean
  active?: boolean
}

// ─── Error taxonomy ───────────────────────────────────────────────────────────

/**
 * All failure codes the runtime can emit. The plugin must handle each one
 * with a user-readable message and an actionable next step. No silent
 * degradation is allowed in Amplifier mode.
 */
export type RuntimeErrorCode =
  | "RUNTIME_UNAVAILABLE" // process not found or connection refused
  | "RUNTIME_INCOMPATIBLE" // version mismatch or API incompatibility
  | "BUNDLE_NOT_FOUND" // requested bundle does not exist
  | "PROFILE_RESOLUTION_FAILED" // bundle found but profile prep failed
  | "PROVIDER_AUTH_FAILED" // provider key missing or rejected
  | "SESSION_CREATE_FAILED" // could not create new session
  | "SESSION_RESUME_FAILED" // could not resume an existing session
  | "SESSION_SPAWN_FAILED" // could not spawn a child session
  | "EXECUTE_FAILED" // prompt execution failed
  | "APPROVAL_FAILED" // approval channel error
  | "TOOL_EXEC_FAILED" // tool execution error from runtime
  | "HOOK_EXEC_FAILED" // hook execution error from runtime
  | "ORCHESTRATION_FAILED" // orchestrator routing or delegation error

export interface RuntimeError {
  code: RuntimeErrorCode
  message: string
  detail?: unknown
}

// ─── Orchestrator interface shape (Phase 1: interface only) ──────────────────

/**
 * The orchestrator routes work between fast (cheap/simple) and reasoning
 * (high-value/complex) model tiers, and manages multi-session decomposition.
 *
 * Phase 1: interface defined. Behavior arrives in Phase 4.
 * The interface is defined here so Phase 2 and 3 code can reference it
 * without forward compatibility problems.
 */
export type OrchestratorTier = "fast" | "reasoning"

export interface OrchestratorRouting {
  /** Which model tier to use for this turn */
  type: OrchestratorTier
  /** Human-readable reason for the routing decision */
  reason: string
  /** Optional: runtime-selected target model identifier */
  targetModel?: string
}

export interface OrchestratorContract {
  /**
   * Given a user input, return a routing decision.
   * Fast tier: acknowledgments, lookups, low-risk substeps.
   * Reasoning tier: design, planning, architecture, difficult debugging.
   */
  route(input: string): Promise<OrchestratorRouting>
  /**
   * Spawn a coordinated child session. The parent session remains
   * authoritative for the user conversation.
   */
  spawn(params: SpawnParams): Promise<string>
  /** List all active sessions managed by this orchestrator instance */
  listActive(): Promise<RuntimeSessionInfo[]>
}

// ─── Primary runtime contract ─────────────────────────────────────────────────

/**
 * The runtime contract. opencode-amplifier calls this, the native runtime
 * implements it. This interface must remain stable across minor runtime
 * versions.
 */
export interface RuntimeContract {
  // Lifecycle
  connect(): Promise<void>
  disconnect(): Promise<void>
  isConnected(): boolean

  // Profile
  prepareProfile(bundle: string, overlays?: Record<string, unknown>): Promise<void>

  // Session
  createSession(params: SessionCreateParams): Promise<string>
  execute(params: ExecuteParams): Promise<void>
  // @ts-expect-error Forward type reference for a later Phase 1 task.
  streamEvents(sessionId: string): AsyncIterable<import("./events.js").RuntimeEvent>
  approve(decision: ApprovalDecision): Promise<void>
  cancel(sessionId: string): Promise<void>
  spawn(params: SpawnParams): Promise<string>
  status(sessionId: string): Promise<RuntimeSessionInfo>

  // Discovery
  listBundles(): Promise<RuntimeBundleInfo[]>
  listModes(): Promise<RuntimeModeInfo[]>
  listProviders(): Promise<RuntimeProviderInfo[]>

  // Orchestrator access (Phase 4 implementation, Phase 1 interface)
  orchestrator(): OrchestratorContract | null
}
