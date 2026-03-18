import { test, expect } from "bun:test"
import type {
  RuntimeContract,
  RuntimeError,
  RuntimeErrorCode,
  RuntimeSessionInfo,
  RuntimeSessionStatus,
  SessionCreateParams,
  ExecuteParams,
  SpawnParams,
  ApprovalDecision,
  RuntimeBundleInfo,
  RuntimeModeInfo,
  RuntimeProviderInfo,
  OrchestratorContract,
  OrchestratorRouting,
} from "../src/runtime/contracts.js"
import type {
  RuntimeEvent,
  RuntimeEventType,
  SessionCreatedEvent,
  ExecutionStreamingEvent,
  ApprovalRequestedEvent,
  OrchestratorRoutingEvent,
  RuntimeReadyEvent,
  RuntimeDiagnosticEvent,
} from "../src/runtime/events.js"

// This file will grow with each runtime-boundary task.
// For now, a canary test verifies the test runner works.
test("test infrastructure is working", () => {
  expect(1 + 1).toBe(2)
})

// Type-level tests: these fail at COMPILE TIME if contracts.ts is wrong.
// They do not need to run — importing the types is the test.
// The actual test just proves the module loads.

test("runtime contracts module is importable and exports required interfaces", async () => {
  const module = await import("../src/runtime/contracts.js")

  // Structural shape check — if this compiles, the types exist correctly
  const _sessionParams: SessionCreateParams = { sessionId: "test-id", cwd: "/tmp" }
  const _withParent: SessionCreateParams = { sessionId: "child", cwd: "/tmp", parentId: "parent" }
  const _decision: ApprovalDecision = { requestId: "req-1", decision: "allow" }
  const _denyDecision: ApprovalDecision = { requestId: "req-2", decision: "deny", reason: "unsafe" }
  const _execParams: ExecuteParams = { sessionId: "s1", input: "hello" }
  const _spawnParams: SpawnParams = { parentSessionId: "p1", agent: "coder" }
  const _spawnWithProfile: SpawnParams = { parentSessionId: "p1", agent: "coder", profile: "foundation", instruction: "do x" }

  expect(module).toBeObject()
  expect(_sessionParams.sessionId).toBe("test-id")
  expect(_withParent.parentId).toBe("parent")
  expect(_decision.decision).toBe("allow")
  expect(_denyDecision.reason).toBe("unsafe")
  expect(_execParams.input).toBe("hello")
  expect(_spawnWithProfile.profile).toBe("foundation")
})

test("runtime error codes cover all required failure domains", () => {
  const codes: RuntimeErrorCode[] = [
    "RUNTIME_UNAVAILABLE",
    "RUNTIME_INCOMPATIBLE",
    "BUNDLE_NOT_FOUND",
    "PROFILE_RESOLUTION_FAILED",
    "PROVIDER_AUTH_FAILED",
    "SESSION_CREATE_FAILED",
    "SESSION_RESUME_FAILED",
    "SESSION_SPAWN_FAILED",
    "EXECUTE_FAILED",
    "APPROVAL_FAILED",
    "TOOL_EXEC_FAILED",
    "HOOK_EXEC_FAILED",
    "ORCHESTRATION_FAILED",
  ]
  expect(codes.length).toBe(13)
})

test("orchestrator routing types include fast and reasoning", () => {
  const fastRouting: OrchestratorRouting = { type: "fast", reason: "simple lookup" }
  const reasoningRouting: OrchestratorRouting = {
    type: "reasoning",
    reason: "architectural decision",
    targetModel: "claude-opus-4-5",
  }
  expect(fastRouting.type).toBe("fast")
  expect(reasoningRouting.targetModel).toBe("claude-opus-4-5")
})

test("runtime events module exports required event types", async () => {
  const module = await import("../src/runtime/events.js")
  const ready: RuntimeReadyEvent = {
    type: "runtime.ready",
    timestamp: Date.now(),
    payload: { version: "0.1.0" },
  }
  const streaming: ExecutionStreamingEvent = {
    type: "execution.streaming",
    sessionId: "s1",
    timestamp: Date.now(),
    payload: { delta: "hello" },
  }
  const approval: ApprovalRequestedEvent = {
    type: "approval.requested",
    sessionId: "s1",
    timestamp: Date.now(),
    payload: { requestId: "r1", toolName: "bash", args: { command: "rm -rf /" } },
  }
  const routing: OrchestratorRoutingEvent = {
    type: "orchestration.routing",
    sessionId: "s1",
    timestamp: Date.now(),
    payload: { type: "reasoning", reason: "complex design question", targetModel: "claude-opus-4-5" },
  }

  expect(module).toBeObject()
  expect(ready.type).toBe("runtime.ready")
  expect(streaming.payload.delta).toBe("hello")
  expect(approval.payload.requestId).toBe("r1")
  expect(routing.payload.type).toBe("reasoning")
})
