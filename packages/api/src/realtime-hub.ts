import type { RealtimeEvent } from "./realtime";

type Listener = (event: RealtimeEvent) => void;
const listeners = new Map<string, Set<Listener>>();
const versions = new Map<string, number>();

export function publishRealtimeEvent(event: Omit<RealtimeEvent, "eventId" | "occurredAt" | "streamVersion" | "protocolVersion">) {
  const streamVersion = (versions.get(event.tripId) ?? 0) + 1;
  versions.set(event.tripId, streamVersion);
  const complete = { ...event, protocolVersion: 1 as const, eventId: crypto.randomUUID(), occurredAt: new Date().toISOString(), streamVersion } as RealtimeEvent;
  for (const listener of listeners.get(event.tripId) ?? []) listener(complete);
  return complete;
}

export function subscribeRealtime(tripId: string, listener: Listener) {
  const tripListeners = listeners.get(tripId) ?? new Set<Listener>();
  tripListeners.add(listener);
  listeners.set(tripId, tripListeners);
  return () => {
    tripListeners.delete(listener);
    if (tripListeners.size === 0) listeners.delete(tripId);
  };
}
