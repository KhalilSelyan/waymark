import { describe, expect, it } from "vitest";
import { getPresence, getStreamVersion, joinPresence, leavePresence, publishRealtimeEvent, subscribeRealtime, touchPresence } from "./realtime-hub";

describe("realtime hub", () => {
  it("publishes ordered events to local subscribers", () => {
    const tripId = crypto.randomUUID();
    const events: unknown[] = [];
    const unsubscribe = subscribeRealtime(tripId, (event) => events.push(event));
    const first = publishRealtimeEvent({ tripId, actorMemberId: crypto.randomUUID(), type: "presence.joined", payload: { displayName: "A", color: "red" } });
    const second = publishRealtimeEvent({ tripId, actorMemberId: crypto.randomUUID(), type: "presence.left", payload: { reason: "disconnect" } });
    unsubscribe();
    expect(events).toHaveLength(2);
    expect(second.streamVersion).toBe(first.streamVersion + 1);
    expect(getStreamVersion(tripId)).toBe(second.streamVersion);
  });

  it("keeps multiple tabs for one member independent", () => {
    const tripId = crypto.randomUUID();
    const memberId = crypto.randomUUID();
    const first = joinPresence(tripId, memberId, "A");
    const second = joinPresence(tripId, memberId, "A");
    expect(getPresence(tripId)).toHaveLength(2);
    touchPresence(tripId, second);
    leavePresence(tripId, first);
    expect(getPresence(tripId)).toEqual([{ memberId, displayName: "A", color: expect.any(String) }]);
    leavePresence(tripId, second);
    expect(getPresence(tripId)).toEqual([]);
  });
});
