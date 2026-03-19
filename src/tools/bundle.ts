/**
 * Bundle tools.
 *
 * Phase 1: preserved from CLI passthrough in src/index.ts.
 * Phase 3: replace CLI calls with runtime API calls.
 */

import { tool } from "@opencode-ai/plugin"
import type { Coordinator } from "../kernel/session.js"
import type { RunCli } from "./index.js"
import { resolveBundle } from "../bundle/resolve.js"

export function buildBundleTools(coord: Coordinator, runCli: RunCli) {
  return {
    amplifier_bundle_resolve: tool({
      description: "Resolve an amplifier-foundation bundle and show its mount plan.",
      args: {
        name: tool.schema.string().describe("Bundle name"),
        settings: tool.schema.string().optional().describe("Optional JSON settings override"),
      },
      async execute(args) {
        try { return JSON.stringify(await resolveBundle(args.name, args.settings ? JSON.parse(args.settings) : undefined), null, 2) }
        catch (e) { return `error: ${e instanceof Error ? e.message : e}` }
      },
    }),

    amplifier_bundle_list: tool({
      description: "List all available amplifier bundles. Use when the user asks 'what bundles are available', 'what can I use', 'list bundles', or wants to know their options.",
      args: {},
      async execute(_args, ctx) {
        return runCli("bundle list", ctx.directory)
      },
    }),

    amplifier_bundle_show: tool({
      description: "Show details of an amplifier bundle including its mount plan, tools, hooks, agents, and context. Use when the user asks 'what does <name> do', 'tell me about <name> bundle', or 'what's in <name>'.",
      args: {
        name: tool.schema.string().describe("Bundle name (e.g. 'foundation', 'superpowers', 'amplifier-dev', 'skills')"),
      },
      async execute(args, ctx) {
        return runCli(`bundle show ${args.name}`, ctx.directory)
      },
    }),

    amplifier_bundle_use: tool({
      description: "Switch the active amplifier bundle. Use this when the user says 'use <name>', 'switch to <name>', or references a bundle by name (e.g. 'use superpowers', 'switch to foundation', 'use amplifier-dev'). Bundles change which tools, agents, context, and behaviors are available.",
      args: {
        name: tool.schema.string().describe("Bundle name to activate (e.g. 'superpowers', 'foundation', 'amplifier-dev', 'skills', 'recipes')"),
      },
      async execute(args, ctx) {
        const result = await runCli(`bundle use ${args.name}`, ctx.directory)
        if (!result.startsWith("error:")) coord.registerCapability("active.bundle", args.name)
        return result
      },
    }),

    amplifier_bundle_current: tool({
      description: "Show the currently active bundle and configuration mode.",
      args: {},
      async execute(_args, ctx) {
        return runCli("bundle current", ctx.directory)
      },
    }),

    amplifier_agents_list: tool({
      description: "List all available amplifier agents/experts with their names and descriptions.",
      args: {},
      async execute(_args, ctx) {
        return runCli("agents list", ctx.directory)
      },
    }),

    amplifier_agents_show: tool({
      description: "Show detailed information about a specific amplifier agent including its instructions and capabilities.",
      args: {
        name: tool.schema.string().describe("Agent name (e.g. 'coder', 'reviewer', 'planner')"),
      },
      async execute(args, ctx) {
        return runCli(`agents show ${args.name}`, ctx.directory)
      },
    }),
  }
}
