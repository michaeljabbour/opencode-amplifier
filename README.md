# opencode-amplifier

[OpenCode](https://opencode.ai) plugin that brings [amplifier-core](https://github.com/anomalyco/amplifier-core) kernel primitives to any OpenCode project.

**Zero dependencies. Zero core modifications. One file.**

## What it does

| Feature | How |
|---------|-----|
| **Kernel session** | Manages an amplifier session with coordinator, hooks, and cancellation |
| **Tool gating** | Every tool call passes through `tool:pre` / `tool:post` hooks |
| **LLM gating** | Every LLM call passes through `provider:pre` hooks |
| **Context injection** | Hooks can inject system prompts via `InjectContext` |
| **Bundle resolution** | Resolves amplifier-foundation bundles (optional, requires Python) |
| **Provider mapping** | Maps bundle providers to OpenCode's provider system |
| **CLI passthrough** | Run any `amplifier` CLI command from within OpenCode |

## Install

### Option A: Drop-in file (simplest)

```bash
mkdir -p .opencode/plugins
```

```bash
curl -fsSL https://raw.githubusercontent.com/michaeljabbour/opencode-amplifier/main/src/index.ts -o .opencode/plugins/amplifier.ts
```

### Option B: npm

```bash
# After publishing to npm
```

Then add to your `opencode.json`:

```json
{
  "plugin": ["opencode-amplifier"]
}
```

### Option C: Local development

```json
{
  "plugin": ["file:///path/to/opencode-amplifier"]
}
```

## Usage

Start OpenCode normally:

```bash
opencode
```

The plugin loads automatically. Verify with:

```
> Use the amplifier_status tool
```

### Available tools

| Tool | Description |
|------|-------------|
| `amplifier_status` | Show kernel session state, capabilities, hooks, and bundle providers |
| `amplifier_capability` | Get, set, or list capabilities on the coordinator |
| `amplifier_emit` | Emit a hook event and return the aggregated result |
| `amplifier_bundle_resolve` | Resolve an amplifier-foundation bundle and show its mount plan |
| `amplifier_cli` | Run any amplifier CLI command (`init`, `bundle list`, `provider list`, `doctor`, etc.) |

### Hook integration

The plugin hooks into OpenCode's lifecycle automatically:

- `tool.execute.before` / `tool.execute.after` — kernel gates every tool call
- `chat.params` — kernel gates every LLM call
- `experimental.chat.system.transform` — kernel injects context into system prompts
- `shell.env` — injects bundle provider API keys
- `event` — forwards all OpenCode events to the kernel

### Bundle providers

When amplifier-foundation is installed (`pip install amplifier-foundation`), the plugin resolves bundles at startup and maps providers:

| Bundle module | OpenCode provider |
|--------------|-------------------|
| `provider-anthropic` | `anthropic` |
| `provider-openai` | `openai` |
| `provider-google` | `google` |
| `provider-mistral` | `mistral` |
| `provider-groq` | `groq` |
| `provider-deepseek` | `deepseek` |
| ... | ... |

API keys from bundle configs are injected as environment variables automatically.

## Architecture

```
OpenCode (stock, unmodified)
  |
  +-- .opencode/plugins/amplifier.ts (this plugin)
        |
        +-- AmplifierSession (pure TS)
        |     +-- Coordinator
        |     |     +-- HookRegistry (priority-based dispatch)
        |     |     +-- CancellationToken (state machine)
        |     |     +-- Capabilities (key-value store)
        |     +-- Session lifecycle
        |
        +-- Bundle Resolution (Python subprocess, optional)
        |     +-- amplifier-foundation
        |
        +-- CLI Passthrough
              +-- amplifier-app-cli
```

The kernel is a pure TypeScript reimplementation of amplifier-core's API surface. No native addon or Rust build required. When amplifier-core's NAPI bindings are available, the kernel can be swapped to use them with no changes to the plugin interface.

## Development

```bash
git clone https://github.com/michaeljabbour/opencode-amplifier
cd opencode-amplifier

# Test locally: copy to any OpenCode project
cp src/index.ts /path/to/project/.opencode/plugins/amplifier.ts

# Or link via config
# Add to opencode.json: "plugin": ["file:///path/to/opencode-amplifier"]
```

The entire plugin is one file (`src/index.ts`). Edit it directly.

## Requirements

- [OpenCode](https://opencode.ai) (any version with plugin support)
- Optional: `amplifier-foundation` Python package (for bundle resolution)
- Optional: `amplifier` CLI (for `amplifier_cli` tool passthrough)

## License

MIT
