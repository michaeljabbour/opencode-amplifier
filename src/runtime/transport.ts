/**
 * Transport abstraction between the plugin client and the native runtime.
 *
 * Phase 1: interface + StubTransport for testing.
 * Phase 2: replace with a real Unix domain socket + JSON-RPC transport.
 *
 * The transport is intentionally low-level. The RuntimeClient above it owns
 * retry logic, error mapping, and event subscription semantics.
 */

import type { RuntimeEvent } from "./events.js"

// ─── Message shapes ───────────────────────────────────────────────────────────

export interface TransportMessage {
  id: string
  method: string
  params?: unknown
}

export interface TransportResponse {
  id: string
  result?: unknown
  error?: { code: string; message: string; detail?: unknown }
}

// ─── Interface ────────────────────────────────────────────────────────────────

export interface RuntimeTransport {
  connect(socketPath: string): Promise<void>
  disconnect(): Promise<void>
  isConnected(): boolean
  send(message: TransportMessage): Promise<TransportResponse>
  subscribe(sessionId: string, handler: (event: RuntimeEvent) => void): () => void
}

// ─── StubTransport (testing only) ────────────────────────────────────────────

/**
 * StubTransport is used in tests so we never need a live runtime.
 * Queue responses with queueResponse() before calling send().
 */
export class StubTransport implements RuntimeTransport {
  private connected = false
  private responseQueue: TransportResponse[] = []
  private subscriptions = new Map<string, (event: RuntimeEvent) => void>()

  connect(_socketPath: string): Promise<void> {
    this.connected = true
    return Promise.resolve()
  }

  disconnect(): Promise<void> {
    this.connected = false
    return Promise.resolve()
  }

  isConnected(): boolean {
    return this.connected
  }

  send(message: TransportMessage): Promise<TransportResponse> {
    if (!this.connected) {
      return Promise.reject(new Error("Transport not connected"))
    }

    const queued = this.responseQueue.shift()
    if (queued) {
      return Promise.resolve({ ...queued, id: message.id })
    }

    return Promise.resolve({ id: message.id, result: null })
  }

  /**
   * Subscribe to events for a session.
   *
   * NOTE: StubTransport supports only ONE handler per sessionId.
   * A second call to subscribe() for the same sessionId silently replaces
   * the first handler. This is intentional for the stub — it keeps the
   * implementation minimal for testing. The real SocketTransport (Phase 2)
   * will support multiple handlers per session.
   *
   * Returns an unsubscribe function. Call it to stop receiving events.
   */
  subscribe(sessionId: string, handler: (event: RuntimeEvent) => void): () => void {
    this.subscriptions.set(sessionId, handler)
    return () => {
      this.subscriptions.delete(sessionId)
    }
  }

  /** Test helper: queue a response for the next send() call */
  queueResponse(response: TransportResponse): void {
    this.responseQueue.push(response)
  }

  /** Test helper: emit a fake event to a subscribed session */
  emitEvent(sessionId: string, event: RuntimeEvent): void {
    this.subscriptions.get(sessionId)?.(event)
  }
}
