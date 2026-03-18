import { test, expect } from "bun:test"
import {
  resolveBundleOrDefault,
  type BundleConfig,
} from "../src/bundle/resolve.js"
import { fallbackContext } from "../src/bundle/context.js"
import {
  discoverModes,
  parseFrontmatter,
  loadModeContent,
  type ModeDefinition,
} from "../src/modes/discovery.js"

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

import { runPython } from "../src/bundle/_python.js"

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
