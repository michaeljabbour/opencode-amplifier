/**
 * Runtime event taxonomy. These are the authoritative events the native
 * runtime emits. Plugin state is derived from these events. If the UI and
 * the runtime disagree, the runtime wins.
 */

import type { OrchestratorRouting, RuntimeErrorCode } from "./contracts.js"

// ─── Base event ───────────────────────────────────────────────────────────────

export interface RuntimeEvent {
  type: RuntimeEventType
  sessionId?: string
  timestamp: number
  payload: unknown
}

// ─── Event type union ─────────────────────────────────────────────────────────

export type RuntimeEventType =
  // Session lifecycle
  | "session.created"
  | "session.started"
  | "session.completed"
  | "session.failed"
  | "session.cancelled"
  | "session.spawned"
  // Execution
  | "execution.started"
  | "execution.streaming"
  | "execution.completed"
  | "execution.failed"
  // Tool
  | "tool.pre"
  | "tool.post"
  | "tool.failed"
  // Approval
  | "approval.requested"
  | "approval.resolved"
  // Orchestration
  | "orchestration.routing"
  | "orchestration.delegated"
  | "orchestration.failed"
  // Runtime diagnostics
  | "runtime.ready"
  | "runtime.error"
  | "diagnostic.warning"
  | "diagnostic.error"

// ─── Typed event shapes ───────────────────────────────────────────────────────

export interface SessionCreatedEvent extends RuntimeEvent {
  type: "session.created"
  payload: { sessionId: string; parentId?: string; profile?: string; cwd: string }
}

export interface SessionSpawnedEvent extends RuntimeEvent {
  type: "session.spawned"
  payload: { childSessionId: string; parentSessionId: string; agent: string; profile?: string }
}

export interface ExecutionStreamingEvent extends RuntimeEvent {
  type: "execution.streaming"
  sessionId: string
  payload: { delta: string; role?: "assistant" | "tool" }
}

export interface ExecutionFailedEvent extends RuntimeEvent {
  type: "execution.failed"
  sessionId: string
  payload: { code: RuntimeErrorCode; message: string; detail?: unknown }
}

export interface ApprovalRequestedEvent extends RuntimeEvent {
  type: "approval.requested"
  sessionId: string
  payload: { requestId: string; toolName: string; args: unknown; prompt?: string; timeoutMs?: number }
}

export interface ApprovalResolvedEvent extends RuntimeEvent {
  type: "approval.resolved"
  sessionId: string
  payload: { requestId: string; decision: "allow" | "deny"; reason?: string }
}

export interface OrchestratorRoutingEvent extends RuntimeEvent {
  type: "orchestration.routing"
  sessionId: string
  payload: OrchestratorRouting
}

export interface RuntimeReadyEvent extends RuntimeEvent {
  type: "runtime.ready"
  payload: { version: string; socketPath?: string }
}

export interface RuntimeErrorEvent extends RuntimeEvent {
  type: "runtime.error"
  payload: { code: RuntimeErrorCode; message: string; detail?: unknown }
}

export interface RuntimeDiagnosticEvent extends RuntimeEvent {
  type: "diagnostic.warning" | "diagnostic.error"
  payload: { message: string; context?: unknown }
}
