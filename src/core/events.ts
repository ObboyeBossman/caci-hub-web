// src/core/events.ts
// Typed event bus — emit/on/off.
// Mirrors: core_event_bus.dart (Flutter)
//
// Event naming convention — use these strings consistently:
//   member:registered   member:updated     member:deleted
//   member:restored     member:flagged     member:changed
//   group:updated       group:created      group:deleted
//   household:updated   household:created  household:deleted
//   giving:recorded     event:created      event:cancelled
//   attendance:marked   communication:notify
//   auth:signedOut

type Listener = (data: unknown) => void

const _listeners: Record<string, Listener[]> = {}

export function emit(event: string, data?: unknown): void {
  ;(_listeners[event] ?? []).forEach(fn => {
    try {
      fn(data)
    } catch (err) {
      console.error(`[events] Error in "${event}" listener`, err)
    }
  })
}

export function on(event: string, fn: Listener): void {
  ;(_listeners[event] ??= []).push(fn)
}

export function off(event: string, fn: Listener): void {
  _listeners[event] = (_listeners[event] ?? []).filter(f => f !== fn)
}
