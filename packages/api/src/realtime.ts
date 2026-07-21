import { z } from "zod";

export const realtimeEventNames = [
  "canvas.object.created",
  "canvas.object.updated",
  "canvas.object.deleted",
  "canvas.object.moved",
  "canvas.object.reordered",
  "presence.joined",
  "presence.left",
  "presence.cursor.updated",
] as const;

const envelope = {
  protocolVersion: z.literal(1),
  eventId: z.string().uuid(),
  tripId: z.string().uuid(),
  actorMemberId: z.string().uuid(),
  occurredAt: z.string().datetime({ offset: true }),
  clientMessageId: z.string().min(1).max(128).optional(),
  streamVersion: z.number().int().nonnegative(),
};

const objectRef = z.object({ objectId: z.string().uuid(), objectVersion: z.number().int().positive() });
const shapeData = z.record(z.string(), z.unknown());

export const realtimeEventSchema = z.discriminatedUnion("type", [
  z.object({ ...envelope, type: z.literal("canvas.object.created"), payload: objectRef.extend({ shapeType: z.string(), data: shapeData }) }),
  z.object({ ...envelope, type: z.literal("canvas.object.updated"), payload: objectRef.extend({ data: shapeData }) }),
  z.object({ ...envelope, type: z.literal("canvas.object.deleted"), payload: objectRef }),
  z.object({ ...envelope, type: z.literal("canvas.object.moved"), payload: objectRef.extend({ x: z.number(), y: z.number() }) }),
  z.object({ ...envelope, type: z.literal("canvas.object.reordered"), payload: objectRef.extend({ zIndex: z.number().int() }) }),
  z.object({ ...envelope, type: z.literal("presence.joined"), payload: z.object({ displayName: z.string(), color: z.string() }) }),
  z.object({ ...envelope, type: z.literal("presence.left"), payload: z.object({ reason: z.enum(["disconnect", "timeout", "removed"]) }) }),
  z.object({ ...envelope, type: z.literal("presence.cursor.updated"), payload: z.object({ x: z.number(), y: z.number() }) }),
]);

export type RealtimeEvent = z.infer<typeof realtimeEventSchema>;

export const realtimeSnapshotSchema = z.object({
  protocolVersion: z.literal(1),
  tripId: z.string().uuid(),
  streamVersion: z.number().int().nonnegative(),
  objects: z.array(z.object({ objectId: z.string().uuid(), objectVersion: z.number().int().positive(), shapeType: z.string(), data: shapeData })),
  presence: z.array(z.object({ memberId: z.string().uuid(), displayName: z.string(), color: z.string() })),
});

export type RealtimeSnapshot = z.infer<typeof realtimeSnapshotSchema>;

export const realtimeAckSchema = z.object({
  protocolVersion: z.literal(1),
  clientMessageId: z.string().min(1).max(128),
  accepted: z.boolean(),
  streamVersion: z.number().int().nonnegative(),
  reason: z.enum(["duplicate", "stale", "unauthorized", "invalid", "unsupported"]).optional(),
});
