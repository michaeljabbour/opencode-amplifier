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
