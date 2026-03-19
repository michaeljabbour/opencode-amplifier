import { test, expect, mock } from "bun:test"
import { AmplifierSession, Coordinator, HookRegistry, CancellationToken } from "../src/kernel/session.js"
import { buildHooks } from "../src/plugin/hooks.js"
import { StubRuntimeClient } from "../src/runtime/client.js"

// ─── Mock @opencode-ai/plugin for tool builders that import `tool` as a value ──
// (Same strategy as tests/tools.test.ts — mock.module must run before any
//  dynamic import of modules that depend on this peer dependency.)
mock.module("@opencode-ai/plugin", () => ({
  tool: Object.assign(
    (definition: Record<string, unknown>) => definition,
    {
      schema: {
        enum: (_values: string[]) => ({
          describe() { return this },
        }),
        boolean: () => ({
          optional() { return this },
          describe() { return this },
        }),
        string: () => ({
          optional() { return this },
          describe() { return this },
        }),
      },
    },
  ),
}))

// ─── Dynamic loader for plugin entry point ─────────────────────────────────────
async function loadCreateAmplifierPlugin() {
  return (await import("../src/plugin/index.js")).createAmplifierPlugin
}

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

test("shell.env hook injects provider API key into env when not already set", async () => {
  const session = new AmplifierSession()
  const client = new StubRuntimeClient()
  process.env["ANTHROPIC_API_KEY"] = "test-key-abc"
  const hooks = buildHooks(session, client, {
    bundleProviders: [{ name: "anthropic", module: "provider-anthropic", transport: "local", config: {} }],
    bundleContext: null,
    getActiveModeContext: () => null,
  })
  const output = { env: {} as Record<string, string> }
  await hooks["shell.env"]!({} as any, output)
  expect(output.env["ANTHROPIC_API_KEY"]).toBe("test-key-abc")
  delete process.env["ANTHROPIC_API_KEY"]
})

// ─── Task 14: Plugin entry point tests ────────────────────────────────────────

const fakeInput = {
  project: { id: "proj-test", name: "Test Project", path: "/tmp/test" },
  directory: "/tmp/test",
  worktree: "/tmp/test",
}

test("createAmplifierPlugin returns a plugin function", async () => {
  const createAmplifierPlugin = await loadCreateAmplifierPlugin()
  const plugin = createAmplifierPlugin()
  expect(typeof plugin).toBe("function")
})

test("plugin function returns hooks and tools when invoked", async () => {
  const createAmplifierPlugin = await loadCreateAmplifierPlugin()
  const plugin = createAmplifierPlugin()
  const result = await plugin(fakeInput as any)
  // Must have tool definitions
  expect(typeof result.tool).toBe("object")
  expect(result.tool).not.toBeNull()
  // Must have hook functions
  expect(typeof result["chat.params"]).toBe("function")
  expect(typeof result["experimental.chat.system.transform"]).toBe("function")
  expect(typeof result["tool.execute.before"]).toBe("function")
  expect(typeof result["tool.execute.after"]).toBe("function")
  expect(typeof result["shell.env"]).toBe("function")
  expect(typeof result.event).toBe("function")
})

test("plugin tool map includes all expected tools", async () => {
  const createAmplifierPlugin = await loadCreateAmplifierPlugin()
  const plugin = createAmplifierPlugin()
  const result = await plugin(fakeInput as any)
  const toolNames = Object.keys(result.tool ?? {})
  const required = [
    "amplifier_status",
    "amplifier_capability",
    "amplifier_emit",
    "amplifier_bundle_resolve",
    "amplifier_bundle_list",
    "amplifier_bundle_show",
    "amplifier_bundle_use",
    "amplifier_bundle_current",
    "amplifier_agents_list",
    "amplifier_agents_show",
    "amplifier_provider_list",
    "amplifier_provider_use",
    "amplifier_modes_list",
    "amplifier_mode",
    "amplifier_settings_get",
    "amplifier_settings_set",
    "amplifier_init",
    "amplifier_doctor",
    "amplifier_cli",
  ]
  for (const name of required) {
    expect(toolNames).toContain(name)
  }
})
