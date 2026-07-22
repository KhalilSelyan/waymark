import { describe, expect, it } from "vitest";
import { realtimeAckSchema, realtimeEventSchema } from "./realtime";

const envelope = { protocolVersion: 1, eventId: "00000000-0000-4000-8000-000000000001", tripId: "00000000-0000-4000-8000-000000000002", actorMemberId: "00000000-0000-4000-8000-000000000003", occurredAt: "2026-07-22T00:00:00.000Z", streamVersion: 1 };

describe("realtime contract", () => {
  it("accepts move and reorder events", () => {
    expect(realtimeEventSchema.parse({ ...envelope, type: "canvas.object.moved", payload: { objectId: envelope.actorMemberId, objectVersion: 2, x: 10, y: 20 } })).toBeTruthy();
    expect(realtimeEventSchema.parse({ ...envelope, type: "canvas.object.reordered", payload: { objectId: envelope.actorMemberId, objectVersion: 2, zIndex: 4 } })).toBeTruthy();
  });

  it("accepts acknowledgements with explicit outcomes", () => {
    expect(realtimeAckSchema.parse({ protocolVersion: 1, clientMessageId: "client-1", accepted: false, streamVersion: 3, reason: "stale" }).reason).toBe("stale");
  });

  it("rejects malformed event envelopes and acknowledgements", () => {
    expect(() => realtimeEventSchema.parse({ ...envelope, eventId: "not-a-uuid", type: "presence.joined", payload: { displayName: "A", color: "red" } })).toThrow();
    expect(() => realtimeAckSchema.parse({ protocolVersion: 1, clientMessageId: "", accepted: true, streamVersion: 0 })).toThrow();
  });
});
