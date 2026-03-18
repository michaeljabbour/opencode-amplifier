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
