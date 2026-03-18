import { test, expect } from "bun:test"

// This file will grow with each runtime-boundary task.
// For now, a canary test verifies the test runner works.
test("test infrastructure is working", () => {
  expect(1 + 1).toBe(2)
})
