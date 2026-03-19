import { test, expect, mock } from "bun:test"
import {
  resolveBundleOrDefault,
  type BundleConfig,
} from "../src/bundle/resolve.js"
import { fallbackContext } from "../src/bundle/context.js"
import { runPython } from "../src/bundle/_python.js"
import {
  discoverModes,
  parseFrontmatter,
  loadModeContent,
  type ModeDefinition,
} from "../src/modes/discovery.js"
import {
  PROVIDER_MAP,
  PROVIDER_ENV,
  resolveProviderEnvKey,
} from "../src/providers/mapping.js"
import { AmplifierSession } from "../src/kernel/session.js"
import type { RuntimeContract } from "../src/runtime/contracts.js"
import { StubRuntimeClient } from "../src/runtime/client.js"

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

async function loadBuildStatusTools() {
  return (await import("../src/tools/status.js")).buildStatusTools
}

async function loadBuildBundleTools() {
  return (await import("../src/tools/bundle.js")).buildBundleTools
}

async function loadBuildProviderTools() {
  return (await import("../src/tools/provider.js")).buildProviderTools
}

async function loadBuildModeTools() {
  return (await import("../src/tools/mode.js")).buildModeTools
}

async function loadBuildSettingsTools() {
  return (await import("../src/tools/settings.js")).buildSettingsTools
}

async function loadBuildDiagnosticsTools() {
  return (await import("../src/tools/diagnostics.js")).buildDiagnosticsTools
}

async function loadBuildCliTool() {
  return (await import("../src/tools/cli.js")).buildCliTool
}

function makeRunCli(output: string) {
  return (_cmd: string, _cwd: string) => Promise.resolve(output)
}

test("tools test infrastructure is working", () => {
  expect(true).toBe(true)
})

test("bundle resolve module is importable", () => {
  // resolveBundleOrDefault is async and requires Python — just verify it's callable
  expect(typeof resolveBundleOrDefault).toBe("function")
})

test("fallbackContext returns a non-empty string", () => {
  const ctx = fallbackContext()
  expect(typeof ctx).toBe("string")
  expect(ctx.length).toBeGreaterThan(0)
  expect(ctx).toContain("amplifier")
})

test("BundleConfig type has expected shape", () => {
  const config: BundleConfig = {
    name: "foundation",
    mount_plan: {
      tools: [{ name: "t1", module: "mod", transport: "stdio" }],
      providers: [],
      hooks: [],
      context: [],
    },
  }
  expect(config.name).toBe("foundation")
  expect(config.mount_plan.tools).toHaveLength(1)
})


test("bundle private python helper is importable", () => {
  expect(typeof runPython).toBe("function")
})

test("discoverModes returns an array (may be empty if no cache)", () => {
  const modes = discoverModes()
  expect(Array.isArray(modes)).toBe(true)
})

test("parseFrontmatter extracts key-value pairs from frontmatter block", () => {
  const content = `---
name: brainstorm
description: Design exploration mode
shortcut: bs
---
# Body content here`
  const fm = parseFrontmatter(content)
  expect(fm.name).toBe("brainstorm")
  expect(fm.description).toBe("Design exploration mode")
  expect(fm.shortcut).toBe("bs")
})

test("parseFrontmatter returns empty object when no frontmatter present", () => {
  const fm = parseFrontmatter("# No frontmatter here")
  expect(Object.keys(fm)).toHaveLength(0)
})

test("ModeDefinition type has expected shape", () => {
  const mode: ModeDefinition = {
    name: "plan",
    description: "Planning mode",
    shortcut: "plan",
    source: "superpowers",
    filePath: "/tmp/modes/plan.md",
  }
  expect(mode.name).toBe("plan")
  expect(mode.source).toBe("superpowers")
})

test("loadModeContent returns null for a non-existent path", () => {
  const result = loadModeContent("/tmp/amplifier-nonexistent-mode-file.md")
  expect(result).toBeNull()
})

test("PROVIDER_MAP maps anthropic bundle module to opencode provider name", () => {
  expect(PROVIDER_MAP["provider-anthropic"]).toBe("anthropic")
  expect(PROVIDER_MAP["provider-openai"]).toBe("openai")
  expect(PROVIDER_MAP["provider-google"]).toBe("google")
})

test("PROVIDER_ENV maps anthropic bundle module to API key env var name", () => {
  expect(PROVIDER_ENV["provider-anthropic"]).toBe("ANTHROPIC_API_KEY")
  expect(PROVIDER_ENV["provider-openai"]).toBe("OPENAI_API_KEY")
})

test("PROVIDER_MAP and PROVIDER_ENV have matching keys for all 14 providers", () => {
  const mapKeys = Object.keys(PROVIDER_MAP).sort()
  const envKeys = Object.keys(PROVIDER_ENV).sort()
  expect(mapKeys).toHaveLength(14)
  expect(envKeys).toHaveLength(14)
  expect(mapKeys).toEqual(envKeys)
})

test("resolveProviderEnvKey extracts literal key from config", () => {
  const key = resolveProviderEnvKey({ api_key: "sk-abc123" })
  expect(key).toBe("sk-abc123")
})

test("resolveProviderEnvKey resolves env var reference in config", () => {
  process.env["_TEST_API_KEY_"] = "test-key-value"
  const key = resolveProviderEnvKey({ api_key: "${_TEST_API_KEY_}" })
  expect(key).toBe("test-key-value")
  delete process.env["_TEST_API_KEY_"]
})

test("resolveProviderEnvKey returns undefined for missing env var reference", () => {
  const key = resolveProviderEnvKey({ api_key: "${DEFINITELY_NOT_SET_XYZ}" })
  expect(key).toBeUndefined()
})


test("buildStatusTools returns amplifier_status, amplifier_capability, and amplifier_emit", async () => {
  const session = new AmplifierSession()
  const client: RuntimeContract = new StubRuntimeClient()
  const buildStatusTools = await loadBuildStatusTools()
  const tools = buildStatusTools(session, client)
  expect(typeof tools.amplifier_status).toBe("object")
  expect(typeof tools.amplifier_capability).toBe("object")
  expect(typeof tools.amplifier_emit).toBe("object")
})

test("amplifier_status execute() returns JSON with sessionId", async () => {
  const session = new AmplifierSession("test-session-id")
  session.setInitialized()
  const client: RuntimeContract = new StubRuntimeClient()
  const buildStatusTools = await loadBuildStatusTools()
  const tools = buildStatusTools(session, client)
  const result = await tools.amplifier_status.execute({}, { directory: "/tmp", sessionID: "oc-1" } as any)
  const parsed = JSON.parse(result as string)
  expect(parsed.sessionId).toBe("test-session-id")
  expect(parsed.isInitialized).toBe(true)
})

test("amplifier_status includes runtimeConnected field", async () => {
  const session = new AmplifierSession()
  const client: RuntimeContract = new StubRuntimeClient()
  const buildStatusTools = await loadBuildStatusTools()
  const tools = buildStatusTools(session, client)
  const result = await tools.amplifier_status.execute({}, { directory: "/tmp", sessionID: "oc-1" } as any)
  const parsed = JSON.parse(result as string)
  expect(typeof parsed.runtimeConnected).toBe("boolean")
  expect(parsed.runtimeConnected).toBe(false) // StubRuntimeClient starts disconnected
})

test("amplifier_capability list action returns JSON of capabilities", async () => {
  const session = new AmplifierSession()
  const client = new StubRuntimeClient()
  const buildStatusTools = await loadBuildStatusTools()
  const tools = buildStatusTools(session, client)
  const result = await tools.amplifier_capability.execute({ action: "list" }, {} as any)
  expect(() => JSON.parse(result as string)).not.toThrow()
})

test("amplifier_capability get action returns capability value", async () => {
  const session = new AmplifierSession()
  session.coordinator.registerCapability("test.key", "test-value")
  const client = new StubRuntimeClient()
  const buildStatusTools = await loadBuildStatusTools()
  const tools = buildStatusTools(session, client)
  const result = await tools.amplifier_capability.execute({ action: "get", name: "test.key" }, {} as any)
  expect(result).toBe("test-value")
})

test("amplifier_capability returns name required when name is missing", async () => {
  const session = new AmplifierSession()
  const client = new StubRuntimeClient()
  const buildStatusTools = await loadBuildStatusTools()
  const tools = buildStatusTools(session, client)
  const result = await tools.amplifier_capability.execute({ action: "get" }, {} as any)
  expect(result).toBe("name required")
})

test("amplifier_emit execute() returns error string on invalid JSON payload", async () => {
  const session = new AmplifierSession()
  const client = new StubRuntimeClient()
  const buildStatusTools = await loadBuildStatusTools()
  const tools = buildStatusTools(session, client)
  const result = await tools.amplifier_emit.execute({ event: "test.event", data: "not-json" }, {} as any)
  expect(result as string).toMatch(/^error:/)
})

test("amplifier_capability set action registers capability and returns confirmation", async () => {
  const session = new AmplifierSession()
  const client = new StubRuntimeClient()
  const buildStatusTools = await loadBuildStatusTools()
  const tools = buildStatusTools(session, client)
  const result = await tools.amplifier_capability.execute(
    { action: "set", name: "my.key", value: "my-value" },
    {} as any,
  )
  expect(result).toBe("set 'my.key'")
  expect(session.coordinator.getCapability("my.key")).toBe("my-value")
})

test("amplifier_capability set action returns value required when value is missing", async () => {
  const session = new AmplifierSession()
  const client = new StubRuntimeClient()
  const buildStatusTools = await loadBuildStatusTools()
  const tools = buildStatusTools(session, client)
  const result = await tools.amplifier_capability.execute(
    { action: "set", name: "my.key" },
    {} as any,
  )
  expect(result).toBe("value required")
})


test("buildBundleTools returns amplifier_bundle_resolve, _list, _show, _use, _current", async () => {
  const session = new AmplifierSession()
  const buildBundleTools = await loadBuildBundleTools()
  const tools = buildBundleTools(session.coordinator, makeRunCli("ok"))
  expect(typeof tools.amplifier_bundle_resolve).toBe("object")
  expect(typeof tools.amplifier_bundle_list).toBe("object")
  expect(typeof tools.amplifier_bundle_show).toBe("object")
  expect(typeof tools.amplifier_bundle_use).toBe("object")
  expect(typeof tools.amplifier_bundle_current).toBe("object")
})

test("buildProviderTools returns amplifier_provider_list and _use", async () => {
  const session = new AmplifierSession()
  const buildProviderTools = await loadBuildProviderTools()
  const tools = buildProviderTools(session.coordinator, makeRunCli("ok"))
  expect(typeof tools.amplifier_provider_list).toBe("object")
  expect(typeof tools.amplifier_provider_use).toBe("object")
})

test("buildModeTools returns amplifier_modes_list and amplifier_mode", async () => {
  const session = new AmplifierSession()
  const availableModes: ModeDefinition[] = [{
    name: "plan",
    description: "Planning mode",
    shortcut: "plan",
    source: "superpowers",
    filePath: "/tmp/plan.md",
  }]
  const buildModeTools = await loadBuildModeTools()
  const { tools } = buildModeTools(session.coordinator, availableModes, () => "Mode content")
  expect(typeof tools.amplifier_modes_list).toBe("object")
  expect(typeof tools.amplifier_mode).toBe("object")
})

test("buildSettingsTools returns amplifier_settings_get and _set", async () => {
  const buildSettingsTools = await loadBuildSettingsTools()
  const tools = buildSettingsTools(makeRunCli("ok"))
  expect(typeof tools.amplifier_settings_get).toBe("object")
  expect(typeof tools.amplifier_settings_set).toBe("object")
})

test("buildDiagnosticsTools returns amplifier_init and amplifier_doctor", async () => {
  const buildDiagnosticsTools = await loadBuildDiagnosticsTools()
  const tools = buildDiagnosticsTools(makeRunCli("ok"))
  expect(typeof tools.amplifier_init).toBe("object")
  expect(typeof tools.amplifier_doctor).toBe("object")
})

test("buildCliTool returns amplifier_cli", async () => {
  const buildCliTool = await loadBuildCliTool()
  const tools = buildCliTool(makeRunCli("ok"))
  expect(typeof tools.amplifier_cli).toBe("object")
})

test("amplifier_agents_list and amplifier_agents_show are part of buildBundleTools", async () => {
  const session = new AmplifierSession()
  const buildBundleTools = await loadBuildBundleTools()
  const tools = buildBundleTools(session.coordinator, makeRunCli("ok"))
  expect(typeof tools.amplifier_agents_list).toBe("object")
  expect(typeof tools.amplifier_agents_show).toBe("object")
})

test("amplifier_bundle_use registers active.bundle capability on success", async () => {
  const session = new AmplifierSession()
  const buildBundleTools = await loadBuildBundleTools()
  const tools = buildBundleTools(session.coordinator, makeRunCli("switched to superpowers"))
  await tools.amplifier_bundle_use.execute({ name: "superpowers" }, { directory: "/tmp" } as any)
  expect(session.coordinator.getCapability("active.bundle")).toBe("superpowers")
})

test("amplifier_provider_use registers active.provider capability on success", async () => {
  const session = new AmplifierSession()
  const buildProviderTools = await loadBuildProviderTools()
  const tools = buildProviderTools(session.coordinator, makeRunCli("switched to anthropic"))
  await tools.amplifier_provider_use.execute({ name: "anthropic" }, { directory: "/tmp" } as any)
  expect(session.coordinator.getCapability("active.provider")).toBe("anthropic")
})

test("amplifier_mode activates, deactivates, and handles unknown mode", async () => {
  const session = new AmplifierSession()
  const modes: ModeDefinition[] = [{
    name: "plan", description: "Planning", shortcut: "plan", source: "test", filePath: "/tmp/plan.md",
  }]
  const buildModeTools = await loadBuildModeTools()
  const { tools, getActiveModeContext } = buildModeTools(
    session.coordinator,
    modes,
    () => "## Plan mode content",
  )

  const result = await tools.amplifier_mode.execute({ name: "plan" }, {} as any)
  expect(result as string).toContain("plan")
  expect(session.coordinator.getCapability("active.mode")).toBe("plan")
  expect(getActiveModeContext()).toBe("## Plan mode content")

  await tools.amplifier_mode.execute({ name: "off" }, {} as any)
  expect(session.coordinator.getCapability("active.mode")).toBe("none")
  expect(getActiveModeContext()).toBeNull()

  const bad = await tools.amplifier_mode.execute({ name: "nonexistent" }, {} as any)
  expect(bad as string).toContain("Unknown mode")
})
