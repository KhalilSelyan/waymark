import type { RealtimeEvent } from "./realtime";
import { Pool } from "pg";

type Listener = (event: RealtimeEvent) => void;
const listeners = new Map<string, Set<Listener>>();
const versions = new Map<string, number>();
const history = new Map<string, RealtimeEvent[]>();
const presence = new Map<string, Map<string, { memberId: string; displayName: string; color: string; lastSeen: number }>>();
const instanceId = crypto.randomUUID();
const pubsub = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL, max: 2 }) : null;
void pubsub?.connect().then((client) => {
  client.on("error", () => undefined);
  void client.query("LISTEN waymark_realtime");
  client.on("notification", (message) => {
    if (!message.payload) return;
    try {
      const { origin, event } = JSON.parse(message.payload) as { origin?: string; event?: RealtimeEvent };
      if (origin === instanceId || !event) return;
      for (const listener of listeners.get(event.tripId) ?? []) listener(event);
    } catch { /* Ignore malformed notifications from the shared channel. */ }
  });
}).catch(() => undefined);

export function publishRealtimeEvent(event: Omit<RealtimeEvent, "eventId" | "occurredAt" | "streamVersion" | "protocolVersion">) {
  const streamVersion = (versions.get(event.tripId) ?? 0) + 1;
  versions.set(event.tripId, streamVersion);
  const complete = { ...event, protocolVersion: 1 as const, eventId: crypto.randomUUID(), occurredAt: new Date().toISOString(), streamVersion } as RealtimeEvent;
  const events = history.get(event.tripId) ?? [];
  events.push(complete);
  if (events.length > 500) events.shift();
  history.set(event.tripId, events);
  for (const listener of listeners.get(event.tripId) ?? []) listener(complete);
  void pubsub?.query("SELECT pg_notify($1, $2)", ["waymark_realtime", JSON.stringify({ origin: instanceId, event: complete })]).catch(() => undefined);
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

export function getStreamVersion(tripId: string) {
  return versions.get(tripId) ?? 0;
}

export function getEventsSince(tripId: string, streamVersion: number) {
  return (history.get(tripId) ?? []).filter((event) => event.streamVersion > streamVersion);
}

export function joinPresence(tripId: string, memberId: string, displayName: string) {
  const members = presence.get(tripId) ?? new Map();
  const connectionId = crypto.randomUUID();
  members.set(connectionId, { memberId, displayName, color: `hsl(${Math.abs(hash(memberId)) % 360} 70% 55%)`, lastSeen: Date.now() });
  presence.set(tripId, members);
  return connectionId;
}

export function leavePresence(tripId: string, memberId: string) {
  const members = presence.get(tripId);
  members?.delete(memberId);
  if (members?.size === 0) presence.delete(tripId);
}

export function touchPresence(tripId: string, memberId: string) {
  const member = presence.get(tripId)?.get(memberId);
  if (member) member.lastSeen = Date.now();
}

export function getPresence(tripId: string) {
  const members = presence.get(tripId);
  if (!members) return [];
  const now = Date.now();
  for (const [memberId, value] of members) if (now - value.lastSeen > 45_000) members.delete(memberId);
  return [...members.values()].map(({ memberId, displayName, color }) => ({ memberId, displayName, color }));
}

function hash(value: string) { return [...value].reduce((total, character) => ((total << 5) - total + character.charCodeAt(0)) | 0, 0); }
