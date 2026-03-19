import { test, expect } from "bun:test"
import { AmplifierSession, Coordinator, HookRegistry, CancellationToken } from "../src/kernel/session.js"

test("plugin-hooks test infrastructure is working", () => {
  expect(true).toBe(true)
})

test("kernel session scaffolding is importable from src/kernel/session.ts", () => {
  const session = new AmplifierSession()
  expect(typeof session.sessionId).toBe("string")
  expect(session.sessionId.length).toBeGreaterThan(0)
  expect(session.isInitialized).toBe(false)
  expect(session.status).toBe("Running")
})

test("AmplifierSession accepts explicit sessionId and parentId", () => {
  const session = new AmplifierSession("explicit-id", "parent-id")
  expect(session.sessionId).toBe("explicit-id")
  expect(session.parentId).toBe("parent-id")
})

test("Coordinator tracks capabilities", () => {
  const coord = new Coordinator()
  coord.registerCapability("test.key", "value-1")
  expect(coord.getCapability("test.key")).toBe("value-1")
  expect(coord.getCapability("missing")).toBeNull()
})

test("CancellationToken starts uncancelled", () => {
  const token = new CancellationToken()
  expect(token.isCancelled).toBe(false)
  token.requestGraceful()
  expect(token.isCancelled).toBe(true)
  token.reset()
  expect(token.isCancelled).toBe(false)
})

test("HookRegistry returns Continue action when no handlers registered", async () => {
  const registry = new HookRegistry()
  const result = await registry.emit("test:event", JSON.stringify({ data: "x" }))
  expect(result.action).toBe("Continue")
})

test("CancellationToken requestImmediate() sets cancelled state unconditionally", () => {
  const token = new CancellationToken()
  token.requestGraceful()
  expect(token.isCancelled).toBe(true)
  token.requestImmediate()   // should overwrite graceful → immediate
  expect(token.isCancelled).toBe(true)
  token.reset()
  token.requestImmediate()   // should work from "none" state too
  expect(token.isCancelled).toBe(true)
})

import { buildHooks } from "../src/plugin/hooks.js"
import { StubRuntimeClient } from "../src/runtime/client.js"

const stubInput = {
  sessionID: "oc-session-1",
  model: { id: "claude-3-5-sonnet-20241022", providerID: "anthropic" },
  agent: "default",
  project: { id: "proj-1" },
  directory: "/tmp",
  worktree: "/tmp",
}

test("buildHooks returns all required OpenCode hook keys", () => {
  const session = new AmplifierSession()
  const client = new StubRuntimeClient()
  const hooks = buildHooks(session, client, {
    bundleProviders: [],
    bundleContext: null,
    getActiveModeContext: () => null,
  })
  expect(typeof hooks["tool.execute.before"]).toBe("function")
  expect(typeof hooks["tool.execute.after"]).toBe("function")
  expect(typeof hooks["chat.params"]).toBe("function")
  expect(typeof hooks["experimental.chat.system.transform"]).toBe("function")
  expect(typeof hooks["shell.env"]).toBe("function")
  expect(typeof hooks.event).toBe("function")
})

test("chat.params hook does not throw when runtime is disconnected (Phase 1 compatibility)", async () => {
  const session = new AmplifierSession()
  const client = new StubRuntimeClient()
  const hooks = buildHooks(session, client, {
    bundleProviders: [],
    bundleContext: null,
    getActiveModeContext: () => null,
  })
  const output = { temperature: 0.7 as number | undefined }
  // Should not throw in Phase 1 — fail-closed enforcement comes in Phase 2
  // Note: use async lambda form for Bun compatibility (resolves.not.toThrow fails for void)
  await expect(async () => { await hooks["chat.params"]!(stubInput as any, output) }).not.toThrow()
})

test("experimental.chat.system.transform injects bundleContext when present", async () => {
  const session = new AmplifierSession()
  const client = new StubRuntimeClient()
  const hooks = buildHooks(session, client, {
    bundleProviders: [],
    bundleContext: "You are operating with amplifier foundation context.",
    getActiveModeContext: () => null,
  })
  const output = { system: [] as string[] }
  await hooks["experimental.chat.system.transform"]!(stubInput as any, output)
  expect(output.system).toContain("You are operating with amplifier foundation context.")
})

test("experimental.chat.system.transform injects active mode context when set", async () => {
  const session = new AmplifierSession()
  session.coordinator.registerCapability("active.mode", "brainstorm")
  const client = new StubRuntimeClient()
  const hooks = buildHooks(session, client, {
    bundleProviders: [],
    bundleContext: null,
    getActiveModeContext: () => "Focus on divergent design exploration.",
  })
  const output = { system: [] as string[] }
  await hooks["experimental.chat.system.transform"]!(stubInput as any, output)
  expect(output.system.some((s) => s.includes("brainstorm"))).toBe(true)
  expect(output.system.some((s) => s.includes("divergent design exploration"))).toBe(true)
})

test("tool.execute.before hook does not throw when runtime is disconnected (Phase 1 compatibility)", async () => {
  const session = new AmplifierSession()
  const client = new StubRuntimeClient()
  const hooks = buildHooks(session, client, {
    bundleProviders: [],
    bundleContext: null,
    getActiveModeContext: () => null,
  })
  const hookInput = { tool: "bash", sessionID: "oc-1", callID: "call-1" }
  const hookOutput = { args: { command: "echo hello" } }
  // Note: use async lambda form for Bun compatibility
  await expect(async () => { await hooks["tool.execute.before"]!(hookInput as any, hookOutput) }).not.toThrow()
})
