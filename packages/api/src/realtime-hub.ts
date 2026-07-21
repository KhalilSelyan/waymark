import type { RealtimeEvent } from "./realtime";

type Listener = (event: RealtimeEvent) => void;
const listeners = new Map<string, Set<Listener>>();
const versions = new Map<string, number>();
const presence = new Map<string, Map<string, { displayName: string; color: string; lastSeen: number }>>();

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

export function joinPresence(tripId: string, memberId: string, displayName: string) {
  const members = presence.get(tripId) ?? new Map();
  members.set(memberId, { displayName, color: `hsl(${Math.abs(hash(memberId)) % 360} 70% 55%)`, lastSeen: Date.now() });
  presence.set(tripId, members);
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
  return [...members.entries()].map(([memberId, value]) => ({ memberId, displayName: value.displayName, color: value.color }));
}

function hash(value: string) { return [...value].reduce((total, character) => ((total << 5) - total + character.charCodeAt(0)) | 0, 0); }
