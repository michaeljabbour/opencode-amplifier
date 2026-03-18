/**
 * Process manager for the native Amplifier runtime.
 *
 * Supports two connection modes:
 * - auto-start (default): spawn and supervise a local runtime process
 * - connect-to-existing: attach to a runtime already running at a socket path
 *
 * Phase 1: interface + StubProcessManager for testing.
 * Phase 2: replace with real child_process spawn + socket negotiation.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProcessManagerConfig {
  /** Path to the runtime binary (e.g. "amplifier-runtime" or absolute path) */
  runtimeBinary: string
  /** Additional args to pass to the runtime binary */
  runtimeArgs?: string[]
  /** Unix socket path to create or connect to */
  socketPath?: string
  /** If true, don't auto-start — only try to connect to an existing runtime */
  connectToExisting?: boolean
  /** How long to wait for the runtime to become ready (ms). Default: 10000 */
  startTimeoutMs?: number
}

export interface ManagedProcessHandle {
  pid?: number
  socketPath: string
  stop(): Promise<void>
}

export interface ProcessManager {
  start(config: ProcessManagerConfig): Promise<ManagedProcessHandle>
  connectExisting(socketPath: string): Promise<ManagedProcessHandle>
  isRunning(): boolean
}

// ─── Error ────────────────────────────────────────────────────────────────────

export class ProcessManagerError extends Error {
  readonly code: "BINARY_NOT_FOUND" | "START_TIMEOUT" | "SOCKET_NOT_FOUND" | "CONNECT_FAILED"

  constructor(
    code: ProcessManagerError["code"],
    message: string,
    public readonly detail?: unknown,
  ) {
    super(message)
    this.name = "ProcessManagerError"
    this.code = code
  }
}

// ─── StubProcessManager (testing only) ────────────────────────────────────────

interface StubOptions {
  simulateBinaryMissing?: boolean
  simulateExistingSocket?: string
}

export class StubProcessManager implements ProcessManager {
  private running = false
  private opts: StubOptions

  constructor(opts: StubOptions = {}) {
    this.opts = opts
  }

  async start(config: ProcessManagerConfig): Promise<ManagedProcessHandle> {
    if (this.opts.simulateBinaryMissing) {
      throw new ProcessManagerError(
        "BINARY_NOT_FOUND",
        `Runtime binary '${config.runtimeBinary}' not found on PATH`,
      )
    }

    this.running = true
    const socketPath = config.socketPath ?? "/tmp/amplifier-stub.sock"
    return {
      socketPath,
      stop: async () => {
        this.running = false
      },
    }
  }

  async connectExisting(socketPath: string): Promise<ManagedProcessHandle> {
    if (this.opts.simulateExistingSocket !== socketPath) {
      throw new ProcessManagerError(
        "SOCKET_NOT_FOUND",
        `No runtime socket found at '${socketPath}'`,
      )
    }

    this.running = true
    return {
      socketPath,
      stop: async () => {
        this.running = false
      },
    }
  }

  isRunning(): boolean {
    return this.running
  }
}
