import { test, expect } from "bun:test"
import {
  resolveBundleOrDefault,
  type BundleConfig,
} from "../src/bundle/resolve.js"
import { fallbackContext } from "../src/bundle/context.js"

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
