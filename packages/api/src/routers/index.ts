import type { RouterClient } from "@orpc/server";
import { z } from "zod";
import { and, desc, eq, isNull, lt, or } from "drizzle-orm";
import { activityEvents, assets, canvasObjects, expenseShares, expenses, itineraryItems, places, settlements, trips, tripGuests, tripMembers } from "@waymark/db/schema";
import { ORPCError } from "@orpc/server";

import { protectedProcedure, publicProcedure } from "../index";
import { customShares, equalShares } from "../expenses";
import { publishRealtimeEvent } from "../realtime-hub";

const httpUrl = z.string().url().refine((value) => {
  const url = new URL(value);
  return url.protocol === "http:" || url.protocol === "https:";
}, "URL must use http or https");

const expenseShareInput = z.object({ memberId: z.string().uuid(), amountMinor: z.number().int().nonnegative() });
const expenseInput = z.object({ tripId: z.string().uuid(), payerMemberId: z.string().uuid(), description: z.string().trim().min(1).max(240), amountMinor: z.number().int().positive(), currency: z.string().regex(/^[A-Z]{3}$/), occurredAt: z.string().datetime({ offset: true }), splitType: z.enum(["equal", "custom"]), shares: z.array(expenseShareInput).min(1) });

async function recordActivity(database: any, tripId: string, actorMemberId: string, eventType: string, payload: Record<string, unknown>) {
  await database.insert(activityEvents).values({ tripId, actorMemberId, eventType, payload, version: 1 });
}

function canvasObjectTitle(data: unknown) {
  if (!data || typeof data !== "object" || !("shape" in data)) return null;
  const shape = data.shape;
  if (!shape || typeof shape !== "object" || !("props" in shape) || !shape.props || typeof shape.props !== "object") return null;
  const props = shape.props;
  const value = "text" in props && typeof props.text === "string" ? props.text : "title" in props && typeof props.title === "string" ? props.title : null;
  return value?.trim().split("\n")[0]?.slice(0, 200) || null;
}

function memberIdentity(context: { session: { user?: { id: string } } | null; guestTokenHashes: string[] }) {
  return context.session?.user ? eq(tripMembers.userId, context.session.user.id) : or(...context.guestTokenHashes.map((hash) => eq(tripGuests.guestTokenHash, hash)));
}

async function expenseAccess(database: any, context: any, tripId: string, payerMemberId?: string, participantIds: string[] = [], expenseId?: string) {
  const [access] = await database.select({ memberId: tripMembers.id, currency: trips.currency }).from(tripMembers).innerJoin(trips, eq(tripMembers.tripId, trips.id)).leftJoin(tripGuests, eq(tripMembers.guestId, tripGuests.id)).where(and(eq(tripMembers.tripId, tripId), memberIdentity(context), isNull(tripMembers.removedAt), isNull(trips.deletedAt))).limit(1);
  if (!access) throw new ORPCError("NOT_FOUND");
  const ids = [...new Set([payerMemberId, ...participantIds].filter((id): id is string => Boolean(id)))];
  if (ids.length) {
    const members = await database.select({ id: tripMembers.id }).from(tripMembers).where(and(eq(tripMembers.tripId, tripId), isNull(tripMembers.removedAt)));
    if (ids.some((id) => !members.some((member: { id: string }) => member.id === id))) throw new ORPCError("BAD_REQUEST", { message: "All expense participants must belong to this trip." });
  }
  if (expenseId) {
    const [expense] = await database.select({ id: expenses.id }).from(expenses).where(and(eq(expenses.id, expenseId), eq(expenses.tripId, tripId), isNull(expenses.deletedAt))).limit(1);
    if (!expense) throw new ORPCError("NOT_FOUND");
  }
  return access;
}

export const appRouter = {
  healthCheck: publicProcedure.handler(() => {
    return "OK";
  }),
  privateData: protectedProcedure.handler(({ context }) => {
    return {
      message: "This is private",
      user: context.session?.user,
    };
  }),
  trips: {
    list: protectedProcedure.handler(async ({ context }) =>
      context.db
        .select({ trip: trips, role: tripMembers.role })
        .from(tripMembers)
        .innerJoin(trips, eq(tripMembers.tripId, trips.id))
        .leftJoin(tripGuests, eq(tripMembers.guestId, tripGuests.id)).where(and(memberIdentity(context), isNull(trips.deletedAt)))
        .orderBy(desc(trips.updatedAt)),
    ),
    get: protectedProcedure
      .input(z.object({ tripId: z.string().uuid() }))
      .handler(async ({ context, input }) => {
        const [result] = await context.db
          .select({ trip: trips, role: tripMembers.role })
          .from(tripMembers)
          .innerJoin(trips, eq(tripMembers.tripId, trips.id))
          .where(
            and(
              eq(tripMembers.tripId, input.tripId),
              memberIdentity(context),
              isNull(trips.deletedAt),
            ),
          )
          .limit(1);
        return result ?? null;
      }),
  },
  members: {
    list: protectedProcedure.input(z.object({ tripId: z.string().uuid() })).handler(async ({ context, input }) => {
      const [access] = await context.db.select({ id: tripMembers.id }).from(tripMembers).innerJoin(trips, eq(tripMembers.tripId, trips.id)).leftJoin(tripGuests, eq(tripMembers.guestId, tripGuests.id)).where(and(eq(tripMembers.tripId, input.tripId), memberIdentity(context), isNull(tripMembers.removedAt), isNull(trips.deletedAt))).limit(1);
      if (!access) throw new ORPCError("NOT_FOUND");
      return context.db.select({ id: tripMembers.id, displayName: tripMembers.displayName, role: tripMembers.role }).from(tripMembers).where(and(eq(tripMembers.tripId, input.tripId), isNull(tripMembers.removedAt))).orderBy(tripMembers.displayName);
    }),
  },
  canvas: {
    list: protectedProcedure.input(z.object({ tripId: z.string().uuid() })).handler(async ({ context, input }) => {
      const [member] = await context.db.select({ id: tripMembers.id }).from(tripMembers).innerJoin(trips, eq(tripMembers.tripId, trips.id)).leftJoin(tripGuests, eq(tripMembers.guestId, tripGuests.id)).where(and(eq(tripMembers.tripId, input.tripId), memberIdentity(context), isNull(tripMembers.removedAt), isNull(trips.deletedAt))).limit(1);
      if (!member) throw new ORPCError("NOT_FOUND");
      return context.db.select().from(canvasObjects).where(and(eq(canvasObjects.tripId, input.tripId), isNull(canvasObjects.deletedAt))).orderBy(canvasObjects.zIndex, canvasObjects.createdAt);
    }),
    create: protectedProcedure.input(z.object({ tripId: z.string().uuid(), type: z.string().min(1).max(64), x: z.number(), y: z.number(), width: z.number().nullable().optional(), height: z.number().nullable().optional(), rotation: z.number().default(0), zIndex: z.number().int().default(0), data: z.record(z.string(), z.unknown()) })).handler(async ({ context, input }) => {
      const [member] = await context.db.select({ id: tripMembers.id }).from(tripMembers).innerJoin(trips, eq(tripMembers.tripId, trips.id)).leftJoin(tripGuests, eq(tripMembers.guestId, tripGuests.id)).where(and(eq(tripMembers.tripId, input.tripId), memberIdentity(context), isNull(tripMembers.removedAt), isNull(trips.deletedAt))).limit(1);
      if (!member) throw new ORPCError("NOT_FOUND");
        const object = await context.db.transaction(async (tx) => {
          const [created] = await tx.insert(canvasObjects).values({ ...input, createdByMemberId: member.id, width: input.width ?? null, height: input.height ?? null }).returning();
          if (created) await recordActivity(tx, input.tripId, member.id, "canvas.object.created", { objectId: created.id, objectType: created.type });
          return created;
        });
        if (object) publishRealtimeEvent({ tripId: input.tripId, actorMemberId: member.id, type: "canvas.object.created", payload: { objectId: object.id, objectVersion: object.version, shapeType: object.type, data: object.data as Record<string, unknown> } });
      return object;
    }),
    update: protectedProcedure.input(z.object({ id: z.string().uuid(), version: z.number().int(), type: z.string().min(1).max(64), x: z.number(), y: z.number(), width: z.number().nullable().optional(), height: z.number().nullable().optional(), rotation: z.number(), zIndex: z.number().int(), data: z.record(z.string(), z.unknown()) })).handler(async ({ context, input }) => {
       const [current] = await context.db.select({ object: canvasObjects, memberId: tripMembers.id }).from(canvasObjects).innerJoin(tripMembers, eq(canvasObjects.tripId, tripMembers.tripId)).innerJoin(trips, eq(tripMembers.tripId, trips.id)).leftJoin(tripGuests, eq(tripMembers.guestId, tripGuests.id)).where(and(eq(canvasObjects.id, input.id), memberIdentity(context), isNull(canvasObjects.deletedAt), isNull(tripMembers.removedAt), isNull(trips.deletedAt))).limit(1);
      if (!current) throw new ORPCError("NOT_FOUND");
      if (current.object.version !== input.version) throw new ORPCError("CONFLICT");
       const result = await context.db.transaction(async (tx) => {
         const [updated] = await tx.update(canvasObjects).set({ type: input.type, x: input.x, y: input.y, width: input.width ?? null, height: input.height ?? null, rotation: input.rotation, zIndex: input.zIndex, data: input.data, version: input.version + 1 }).where(and(eq(canvasObjects.id, input.id), eq(canvasObjects.version, input.version))).returning();
         if (!updated) throw new ORPCError("CONFLICT");
         await recordActivity(tx, current.object.tripId, current.memberId, "canvas.object.updated", { objectId: updated.id });
         let linkedItem;
         if (updated) {
           const title = canvasObjectTitle(updated.data);
           if (title) {
             [linkedItem] = await tx.select({ id: itineraryItems.id }).from(itineraryItems).where(and(eq(itineraryItems.sourceCanvasObjectId, updated.id), isNull(itineraryItems.deletedAt))).limit(1);
             if (linkedItem) {
               await tx.update(itineraryItems).set({ title }).where(eq(itineraryItems.id, linkedItem.id));
             }
           }
         }
         return { updated, linkedItem };
       });
       const { updated } = result;
       publishRealtimeEvent({ tripId: current.object.tripId, actorMemberId: current.memberId, type: "canvas.object.updated", payload: { objectId: updated.id, objectVersion: updated.version, data: updated.data as Record<string, unknown> } });
       if (updated.x !== current.object.x || updated.y !== current.object.y) publishRealtimeEvent({ tripId: current.object.tripId, actorMemberId: current.memberId, type: "canvas.object.moved", payload: { objectId: updated.id, objectVersion: updated.version, x: updated.x, y: updated.y } });
       if (updated.zIndex !== current.object.zIndex) publishRealtimeEvent({ tripId: current.object.tripId, actorMemberId: current.memberId, type: "canvas.object.reordered", payload: { objectId: updated.id, objectVersion: updated.version, zIndex: updated.zIndex } });
       if (result.linkedItem) publishRealtimeEvent({ tripId: current.object.tripId, actorMemberId: current.memberId, type: "itinerary.item.updated", payload: { itemId: result.linkedItem.id } });
       return updated;
    }),
    remove: protectedProcedure.input(z.object({ id: z.string().uuid(), version: z.number().int() })).handler(async ({ context, input }) => {
       const [current] = await context.db.select({ object: canvasObjects, memberId: tripMembers.id }).from(canvasObjects).innerJoin(tripMembers, eq(canvasObjects.tripId, tripMembers.tripId)).innerJoin(trips, eq(tripMembers.tripId, trips.id)).leftJoin(tripGuests, eq(tripMembers.guestId, tripGuests.id)).where(and(eq(canvasObjects.id, input.id), memberIdentity(context), isNull(canvasObjects.deletedAt), isNull(tripMembers.removedAt), isNull(trips.deletedAt))).limit(1);
      if (!current) throw new ORPCError("NOT_FOUND");
      if (current.object.version !== input.version) throw new ORPCError("CONFLICT");
       const removed = await context.db.transaction(async (tx) => {
         const [deleted] = await tx.update(canvasObjects).set({ deletedAt: new Date(), version: input.version + 1 }).where(and(eq(canvasObjects.id, input.id), eq(canvasObjects.version, input.version))).returning();
         if (deleted) await recordActivity(tx, current.object.tripId, current.memberId, "canvas.object.deleted", { objectId: deleted.id });
         return deleted;
       });
        if (removed) publishRealtimeEvent({ tripId: current.object.tripId, actorMemberId: current.memberId, type: "canvas.object.deleted", payload: { objectId: removed.id, objectVersion: removed.version } });
       return removed;
    }),
     restore: protectedProcedure.input(z.object({ id: z.string().uuid() })).handler(async ({ context, input }) => {
        const [current] = await context.db.select({ object: canvasObjects, memberId: tripMembers.id }).from(canvasObjects).innerJoin(tripMembers, eq(canvasObjects.tripId, tripMembers.tripId)).innerJoin(trips, eq(tripMembers.tripId, trips.id)).leftJoin(tripGuests, eq(tripMembers.guestId, tripGuests.id)).where(and(eq(canvasObjects.id, input.id), memberIdentity(context), isNull(tripMembers.removedAt), isNull(trips.deletedAt))).limit(1);
       if (!current) throw new ORPCError("NOT_FOUND");
        const restored = await context.db.transaction(async (tx) => {
          const [updated] = await tx
            .update(canvasObjects)
            .set({ deletedAt: null, version: current.object.version + 1 })
            .where(and(eq(canvasObjects.id, input.id), eq(canvasObjects.version, current.object.version)))
            .returning();
          if (updated) await recordActivity(tx, current.object.tripId, current.memberId, "canvas.object.restored", { objectId: updated.id });
          return updated;
        });
        if (!restored) throw new ORPCError("CONFLICT");
        publishRealtimeEvent({
          tripId: current.object.tripId,
          actorMemberId: current.memberId,
          type: "canvas.object.updated",
          payload: { objectId: restored.id, objectVersion: restored.version, data: restored.data as Record<string, unknown> },
        });
        return restored;
    }),
  },
  places: {
    list: protectedProcedure.input(z.object({ tripId: z.string().uuid() })).handler(async ({ context, input }) => {
      const [member] = await context.db.select({ id: tripMembers.id }).from(tripMembers).innerJoin(trips, eq(tripMembers.tripId, trips.id)).leftJoin(tripGuests, eq(tripMembers.guestId, tripGuests.id)).where(and(eq(tripMembers.tripId, input.tripId), memberIdentity(context), isNull(tripMembers.removedAt), isNull(trips.deletedAt))).limit(1);
      if (!member) throw new ORPCError("NOT_FOUND");
      return context.db.select().from(places).where(and(eq(places.tripId, input.tripId), isNull(places.deletedAt))).orderBy(desc(places.updatedAt));
    }),
    create: protectedProcedure.input(z.object({ tripId: z.string().uuid(), name: z.string().trim().min(1).max(200), address: z.string().trim().max(500).nullable().optional(), mapUrl: httpUrl.nullable().optional(), url: httpUrl.nullable().optional(), latitude: z.string().max(32).nullable().optional(), longitude: z.string().max(32).nullable().optional(), notes: z.string().trim().max(5000).nullable().optional() })).handler(async ({ context, input }) => {
      const [member] = await context.db.select({ id: tripMembers.id }).from(tripMembers).innerJoin(trips, eq(tripMembers.tripId, trips.id)).leftJoin(tripGuests, eq(tripMembers.guestId, tripGuests.id)).where(and(eq(tripMembers.tripId, input.tripId), memberIdentity(context), isNull(tripMembers.removedAt), isNull(trips.deletedAt))).limit(1);
      if (!member) throw new ORPCError("NOT_FOUND");
       const place = await context.db.transaction(async (tx) => {
         const [created] = await tx.insert(places).values({ ...input, createdByMemberId: member.id, address: input.address ?? null, mapUrl: input.mapUrl ?? null, url: input.url ?? null, latitude: input.latitude ?? null, longitude: input.longitude ?? null, notes: input.notes ?? null }).returning();
         if (created) await recordActivity(tx, input.tripId, member.id, "place.created", { placeId: created.id, name: created.name });
         return created;
       });
      return place;
    }),
    update: protectedProcedure.input(z.object({ id: z.string().uuid(), name: z.string().trim().min(1).max(200), address: z.string().trim().max(500).nullable().optional(), mapUrl: httpUrl.nullable().optional(), url: httpUrl.nullable().optional(), latitude: z.string().max(32).nullable().optional(), longitude: z.string().max(32).nullable().optional(), notes: z.string().trim().max(5000).nullable().optional() })).handler(async ({ context, input }) => {
        const [current] = await context.db.select({ place: places, memberId: tripMembers.id }).from(places).innerJoin(tripMembers, eq(places.tripId, tripMembers.tripId)).innerJoin(trips, eq(tripMembers.tripId, trips.id)).leftJoin(tripGuests, eq(tripMembers.guestId, tripGuests.id)).where(and(eq(places.id, input.id), memberIdentity(context), isNull(places.deletedAt), isNull(tripMembers.removedAt), isNull(trips.deletedAt))).limit(1);
      if (!current) throw new ORPCError("NOT_FOUND");
       const place = await context.db.transaction(async (tx) => {
         const [updated] = await tx.update(places).set({ name: input.name, address: input.address ?? null, mapUrl: input.mapUrl ?? null, url: input.url ?? null, latitude: input.latitude ?? null, longitude: input.longitude ?? null, notes: input.notes ?? null }).where(eq(places.id, input.id)).returning();
         if (updated) await recordActivity(tx, updated.tripId, current.memberId, "place.updated", { placeId: updated.id, name: updated.name });
         return updated;
       });
      return place;
    }),
    archive: protectedProcedure.input(z.object({ id: z.string().uuid() })).handler(async ({ context, input }) => {
        const [current] = await context.db.select({ place: places, memberId: tripMembers.id }).from(places).innerJoin(tripMembers, eq(places.tripId, tripMembers.tripId)).innerJoin(trips, eq(tripMembers.tripId, trips.id)).leftJoin(tripGuests, eq(tripMembers.guestId, tripGuests.id)).where(and(eq(places.id, input.id), memberIdentity(context), isNull(places.deletedAt), isNull(tripMembers.removedAt), isNull(trips.deletedAt))).limit(1);
      if (!current) throw new ORPCError("NOT_FOUND");
       const place = await context.db.transaction(async (tx) => {
         const [archived] = await tx.update(places).set({ deletedAt: new Date() }).where(eq(places.id, input.id)).returning();
         if (archived) await recordActivity(tx, archived.tripId, current.memberId, "place.archived", { placeId: archived.id, name: archived.name });
         return archived;
       });
      return place;
    }),
     addToCanvas: protectedProcedure.input(z.object({ tripId: z.string().uuid(), placeId: z.string().uuid() })).handler(async ({ context, input }) => {
      const [member] = await context.db.select({ id: tripMembers.id }).from(tripMembers).innerJoin(trips, eq(tripMembers.tripId, trips.id)).leftJoin(tripGuests, eq(tripMembers.guestId, tripGuests.id)).where(and(eq(tripMembers.tripId, input.tripId), memberIdentity(context), isNull(tripMembers.removedAt), isNull(trips.deletedAt))).limit(1);
      if (!member) throw new ORPCError("NOT_FOUND");
       const [place] = await context.db.select().from(places).where(and(eq(places.id, input.placeId), eq(places.tripId, input.tripId), isNull(places.deletedAt))).limit(1);
       if (!place) throw new ORPCError("NOT_FOUND");
       const shapeId = `shape:${crypto.randomUUID()}`;
        const [sourceAsset] = place.url ? await context.db.select({ id: assets.id }).from(assets).where(and(eq(assets.tripId, input.tripId), eq(assets.sourceUrl, place.url))).orderBy(desc(assets.createdAt)).limit(1) : [];
        const candidates = await context.db.select().from(canvasObjects).where(eq(canvasObjects.tripId, input.tripId)).orderBy(desc(canvasObjects.updatedAt));
        const matches = (candidate: typeof candidates[number]) => {
          const data = candidate.data && typeof candidate.data === "object" ? candidate.data as Record<string, unknown> : null;
          const shape = data?.shape && typeof data.shape === "object" ? data.shape as Record<string, unknown> : null;
          const meta = shape?.meta && typeof shape.meta === "object" ? shape.meta as Record<string, unknown> : null;
          const props = shape?.props && typeof shape.props === "object" ? shape.props as Record<string, unknown> : null;
          return meta?.waymarkRecordId === place.id || (shape?.type === "webpage-card" && props?.url === place.url) || (sourceAsset && meta?.assetId === sourceAsset.id);
        };
        const original = candidates.find((candidate) => matches(candidate) && (candidate.type === "webpage-card" || (candidate.data && typeof candidate.data === "object" && "asset" in candidate.data))) ?? candidates.find(matches);
       const originalData = original?.data && typeof original.data === "object" ? original.data as Record<string, unknown> : null;
       const originalShape = originalData?.shape && typeof originalData.shape === "object" ? originalData.shape as Record<string, unknown> : null;
       const shape = originalShape ? { ...originalShape, id: shapeId, x: 80, y: 80, meta: { ...(originalShape.meta && typeof originalShape.meta === "object" ? originalShape.meta : {}), waymarkType: "place", waymarkRecordId: place.id } } : { id: shapeId, type: "note", x: 80, y: 80, rotation: 0, index: "a1", parentId: "page:page", isLocked: false, opacity: 1, meta: { waymarkType: "place", waymarkRecordId: place.id }, props: { color: "blue", size: "m", font: "draw", align: "start", verticalAlign: "start", url: "", richText: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: place.name }] }] }, scale: 1 } };
        const object = await context.db.transaction(async (tx) => {
          const [created] = await tx.insert(canvasObjects).values({ tripId: input.tripId, createdByMemberId: member.id, type: typeof shape.type === "string" ? shape.type : "note", x: 80, y: 80, width: original?.width ?? 280, height: original?.height ?? 200, rotation: typeof shape.rotation === "number" ? shape.rotation : 0, zIndex: 0, data: { ...(originalData ?? {}), shape, asset: originalData?.asset ?? undefined } }).returning();
          if (created) await recordActivity(tx, input.tripId, member.id, "canvas.object.created", { objectId: created.id, objectType: created.type });
          return created;
        });
        if (object) publishRealtimeEvent({ tripId: input.tripId, actorMemberId: member.id, type: "canvas.object.created", payload: { objectId: object.id, objectVersion: object.version, shapeType: object.type, data: object.data as Record<string, unknown> } });
       return object;
     }),
     saveCanvasObjectAsPlace: protectedProcedure.input(z.object({ tripId: z.string().uuid(), canvasObjectId: z.string().uuid(), name: z.string().trim().min(1).max(200), address: z.string().trim().max(500).nullable().optional(), url: httpUrl.nullable().optional(), notes: z.string().trim().max(5000).nullable().optional() })).handler(async ({ context, input }) => {
       const [member] = await context.db.select({ id: tripMembers.id, startsOn: trips.startsOn }).from(tripMembers).innerJoin(trips, eq(tripMembers.tripId, trips.id)).leftJoin(tripGuests, eq(tripMembers.guestId, tripGuests.id)).where(and(eq(tripMembers.tripId, input.tripId), memberIdentity(context), isNull(tripMembers.removedAt), isNull(trips.deletedAt))).limit(1);
       if (!member) throw new ORPCError("NOT_FOUND");
        const [canvas] = await context.db.select({ object: canvasObjects }).from(canvasObjects).innerJoin(tripMembers, eq(canvasObjects.tripId, tripMembers.tripId)).innerJoin(trips, eq(tripMembers.tripId, trips.id)).leftJoin(tripGuests, eq(tripMembers.guestId, tripGuests.id)).where(and(eq(canvasObjects.id, input.canvasObjectId), eq(canvasObjects.tripId, input.tripId), memberIdentity(context), isNull(canvasObjects.deletedAt), isNull(tripMembers.removedAt), isNull(trips.deletedAt))).limit(1);
       if (!canvas) throw new ORPCError("NOT_FOUND");
       const data = canvas.object.data && typeof canvas.object.data === "object" ? canvas.object.data as Record<string, unknown> : {};
       const shape = data.shape && typeof data.shape === "object" ? data.shape as Record<string, unknown> : null;
       const meta = shape?.meta && typeof shape.meta === "object" ? shape.meta as Record<string, unknown> : {};
       if (meta.waymarkType === "place" && typeof meta.waymarkRecordId === "string") return context.db.select().from(places).where(eq(places.id, meta.waymarkRecordId)).limit(1).then(([place]) => place);
        const result = await context.db.transaction(async (tx) => {
          const [place] = await tx.insert(places).values({ tripId: input.tripId, createdByMemberId: member.id, name: input.name, address: input.address ?? null, url: input.url ?? null, notes: input.notes ?? null }).returning();
          if (!place || !shape) throw new ORPCError("INTERNAL_SERVER_ERROR");
          await tx.update(canvasObjects).set({ data: { ...data, shape: { ...shape, meta: { ...meta, waymarkType: "place", waymarkRecordId: place.id } } }, version: canvas.object.version + 1 }).where(eq(canvasObjects.id, input.canvasObjectId));
          await recordActivity(tx, input.tripId, member.id, "place.created", { placeId: place.id, name: place.name });
          return place;
        });
        return result;
     }),
   },
  itinerary: {
    list: protectedProcedure.input(z.object({ tripId: z.string().uuid() })).handler(async ({ context, input }) => {
       const [member] = await context.db.select({ id: tripMembers.id, startsOn: trips.startsOn }).from(tripMembers).innerJoin(trips, eq(tripMembers.tripId, trips.id)).leftJoin(tripGuests, eq(tripMembers.guestId, tripGuests.id)).where(and(eq(tripMembers.tripId, input.tripId), memberIdentity(context), isNull(tripMembers.removedAt), isNull(trips.deletedAt))).limit(1);
      if (!member) throw new ORPCError("NOT_FOUND");
      return context.db.select({ item: itineraryItems, place: places }).from(itineraryItems).leftJoin(places, eq(itineraryItems.placeId, places.id)).where(and(eq(itineraryItems.tripId, input.tripId), isNull(itineraryItems.deletedAt))).orderBy(itineraryItems.day, itineraryItems.sortOrder, itineraryItems.createdAt);
    }),
    create: protectedProcedure.input(z.object({ tripId: z.string().uuid(), day: z.string().date().nullable().optional(), title: z.string().trim().min(1).max(200), placeId: z.string().uuid().nullable().optional(), startsAt: z.string().datetime({ offset: true }).nullable().optional(), endsAt: z.string().datetime({ offset: true }).nullable().optional(), notes: z.string().trim().max(5000).nullable().optional(), status: z.enum(["idea", "planned", "done"]).default("planned"), sortOrder: z.number().int().default(0) })).handler(async ({ context, input }) => {
      const [member] = await context.db.select({ id: tripMembers.id }).from(tripMembers).innerJoin(trips, eq(tripMembers.tripId, trips.id)).leftJoin(tripGuests, eq(tripMembers.guestId, tripGuests.id)).where(and(eq(tripMembers.tripId, input.tripId), memberIdentity(context), isNull(tripMembers.removedAt), isNull(trips.deletedAt))).limit(1);
      if (!member) throw new ORPCError("NOT_FOUND");
        const item = await context.db.transaction(async (tx) => {
          const [created] = await tx.insert(itineraryItems).values({ ...input, createdByMemberId: member.id, placeId: input.placeId ?? null, startsAt: input.startsAt ? new Date(input.startsAt) : null, endsAt: input.endsAt ? new Date(input.endsAt) : null, notes: input.notes ?? null }).returning();
          if (created) await recordActivity(tx, input.tripId, member.id, "itinerary.created", { itineraryItemId: created.id, title: created.title });
          return created;
        });
       if (item) {
         publishRealtimeEvent({ tripId: input.tripId, actorMemberId: member.id, type: "itinerary.item.created", payload: { itemId: item.id } });
       }
      return item;
    }),
    update: protectedProcedure.input(z.object({ id: z.string().uuid(), day: z.string().date().nullable().optional(), title: z.string().trim().min(1).max(200), placeId: z.string().uuid().nullable().optional(), startsAt: z.string().datetime({ offset: true }).nullable().optional(), endsAt: z.string().datetime({ offset: true }).nullable().optional(), notes: z.string().trim().max(5000).nullable().optional(), status: z.enum(["idea", "planned", "done"]), sortOrder: z.number().int() })).handler(async ({ context, input }) => {
        const [current] = await context.db.select({ item: itineraryItems, memberId: tripMembers.id }).from(itineraryItems).innerJoin(tripMembers, eq(itineraryItems.tripId, tripMembers.tripId)).innerJoin(trips, eq(tripMembers.tripId, trips.id)).leftJoin(tripGuests, eq(tripMembers.guestId, tripGuests.id)).where(and(eq(itineraryItems.id, input.id), memberIdentity(context), isNull(itineraryItems.deletedAt), isNull(tripMembers.removedAt), isNull(trips.deletedAt))).limit(1);
      if (!current) throw new ORPCError("NOT_FOUND");
       const item = await context.db.transaction(async (tx) => {
         const [updated] = await tx.update(itineraryItems).set({ day: input.day, title: input.title, placeId: input.placeId ?? null, startsAt: input.startsAt ? new Date(input.startsAt) : null, endsAt: input.endsAt ? new Date(input.endsAt) : null, notes: input.notes ?? null, status: input.status, sortOrder: input.sortOrder }).where(eq(itineraryItems.id, input.id)).returning();
         if (updated) await recordActivity(tx, updated.tripId, current.memberId, "itinerary.updated", { itineraryItemId: updated.id, title: updated.title });
         return updated;
       });
       if (item) {
         publishRealtimeEvent({ tripId: item.tripId, actorMemberId: current.memberId, type: "itinerary.item.updated", payload: { itemId: item.id } });
       }
      return item;
    }),
    archive: protectedProcedure.input(z.object({ id: z.string().uuid() })).handler(async ({ context, input }) => {
        const [current] = await context.db.select({ item: itineraryItems, memberId: tripMembers.id }).from(itineraryItems).innerJoin(tripMembers, eq(itineraryItems.tripId, tripMembers.tripId)).innerJoin(trips, eq(tripMembers.tripId, trips.id)).leftJoin(tripGuests, eq(tripMembers.guestId, tripGuests.id)).where(and(eq(itineraryItems.id, input.id), memberIdentity(context), isNull(itineraryItems.deletedAt), isNull(tripMembers.removedAt), isNull(trips.deletedAt))).limit(1);
      if (!current) throw new ORPCError("NOT_FOUND");
       const item = await context.db.transaction(async (tx) => {
         const [archived] = await tx.update(itineraryItems).set({ deletedAt: new Date() }).where(eq(itineraryItems.id, input.id)).returning();
         if (archived) await recordActivity(tx, archived.tripId, current.memberId, "itinerary.archived", { itineraryItemId: archived.id, title: archived.title });
         return archived;
       });
       if (item) {
         publishRealtimeEvent({ tripId: item.tripId, actorMemberId: current.memberId, type: "itinerary.item.deleted", payload: { itemId: item.id } });
       }
      return item;
    }),
     promoteCanvasObject: protectedProcedure.input(z.object({ tripId: z.string().uuid(), canvasObjectId: z.string().uuid(), day: z.string().date().nullable().optional(), title: z.string().trim().min(1).max(200).nullable().optional() })).handler(async ({ context, input }) => {
        const [member] = await context.db.select({ id: tripMembers.id, startsOn: trips.startsOn }).from(tripMembers).innerJoin(trips, eq(tripMembers.tripId, trips.id)).leftJoin(tripGuests, eq(tripMembers.guestId, tripGuests.id)).where(and(eq(tripMembers.tripId, input.tripId), memberIdentity(context), isNull(tripMembers.removedAt), isNull(trips.deletedAt))).limit(1);
      if (!member) throw new ORPCError("NOT_FOUND");
       const [canvas] = await context.db.select({ object: canvasObjects }).from(canvasObjects).innerJoin(tripMembers, eq(canvasObjects.tripId, tripMembers.tripId)).leftJoin(tripGuests, eq(tripMembers.guestId, tripGuests.id)).where(and(eq(canvasObjects.id, input.canvasObjectId), eq(canvasObjects.tripId, input.tripId), memberIdentity(context), isNull(canvasObjects.deletedAt), isNull(tripMembers.removedAt))).limit(1);
      if (!canvas) throw new ORPCError("NOT_FOUND");
      const [existing] = await context.db.select({ id: itineraryItems.id }).from(itineraryItems).where(and(eq(itineraryItems.sourceCanvasObjectId, input.canvasObjectId), isNull(itineraryItems.deletedAt))).limit(1);
        if (existing) {
          const effectiveDay = input.day ?? member.startsOn;
          if (effectiveDay || input.title) {
            await context.db.transaction(async (tx) => {
              await tx.update(itineraryItems).set({ day: effectiveDay ?? undefined, title: input.title ?? undefined }).where(eq(itineraryItems.id, existing.id));
              await recordActivity(tx, input.tripId, member.id, "itinerary.updated", { itineraryItemId: existing.id, title: input.title ?? "" });
            });
          }
         return { id: existing.id, created: false };
       }
      const shape = canvas.object.data && typeof canvas.object.data === "object" && "shape" in canvas.object.data ? canvas.object.data.shape : null;
      const props = shape && typeof shape === "object" && "props" in shape && shape.props && typeof shape.props === "object" ? shape.props : null;
       const richText = props && "richText" in props ? props.richText : null;
       const richTextContent = richText && typeof richText === "object" && "content" in richText && Array.isArray(richText.content) ? richText.content : [];
       const richTextValue = richTextContent.flatMap((paragraph) => paragraph && typeof paragraph === "object" && "content" in paragraph && Array.isArray(paragraph.content) ? paragraph.content : []).map((part) => part && typeof part === "object" && "text" in part && typeof part.text === "string" ? part.text : "").join(" ").trim();
       const rawText = props && "text" in props && typeof props.text === "string" ? props.text : richTextValue || (props && "title" in props && typeof props.title === "string" ? props.title : null);
       const title = input.title?.trim() || (rawText && rawText.trim() ? (rawText.trim().split("\n")[0] ?? "Canvas idea").slice(0, 200) : "Canvas idea");
       const notes = props && "url" in props && typeof props.url === "string" ? `${rawText ?? ""}\nSource: ${props.url}`.trim() : typeof rawText === "string" ? rawText : null;
       const meta = shape && typeof shape === "object" && "meta" in shape && shape.meta && typeof shape.meta === "object" ? shape.meta : null;
       const linkedPlaceId = meta && "waymarkType" in meta && meta.waymarkType === "place" && "waymarkRecordId" in meta && typeof meta.waymarkRecordId === "string" ? meta.waymarkRecordId : null;
       const [linkedPlace] = linkedPlaceId ? await context.db.select({ id: places.id }).from(places).where(and(eq(places.id, linkedPlaceId), eq(places.tripId, input.tripId), isNull(places.deletedAt))).limit(1) : [];
       const item = await context.db.transaction(async (tx) => {
         const [created] = await tx.insert(itineraryItems).values({ tripId: input.tripId, createdByMemberId: member.id, sourceCanvasObjectId: input.canvasObjectId, placeId: linkedPlace?.id ?? null, day: input.day ?? null, title: linkedPlace ? title === "Canvas idea" ? "Place idea" : title : title, notes, status: "idea" }).returning({ id: itineraryItems.id });
         if (created) await recordActivity(tx, input.tripId, member.id, "itinerary.created", { itineraryItemId: created.id, title });
         return created;
       });
      if (!item) throw new ORPCError("INTERNAL_SERVER_ERROR");
      return { id: item.id, created: true };
    }),
  },
  expenses: {
    list: protectedProcedure.input(z.object({ tripId: z.string().uuid() })).handler(async ({ context, input }) => {
       const [member] = await context.db.select({ id: tripMembers.id }).from(tripMembers).innerJoin(trips, eq(tripMembers.tripId, trips.id)).leftJoin(tripGuests, eq(tripMembers.guestId, tripGuests.id)).where(and(eq(tripMembers.tripId, input.tripId), memberIdentity(context), isNull(tripMembers.removedAt), isNull(trips.deletedAt))).limit(1);
      if (!member) throw new ORPCError("NOT_FOUND");
       const expenseRows = await context.db.select({ expense: expenses }).from(expenses).where(and(eq(expenses.tripId, input.tripId), isNull(expenses.deletedAt))).orderBy(desc(expenses.occurredAt));
       if (expenseRows.length === 0) return [];
       const shareRows = await context.db.select().from(expenseShares).where(or(...expenseRows.map(({ expense }) => eq(expenseShares.expenseId, expense.id))));
       const sharesByExpense = new Map<string, typeof shareRows>();
       for (const share of shareRows) sharesByExpense.set(share.expenseId, [...(sharesByExpense.get(share.expenseId) ?? []), share]);
       return expenseRows.map(({ expense }) => ({ expense, shares: sharesByExpense.get(expense.id) ?? [] }));
    }),
    create: protectedProcedure.input(expenseInput).handler(async ({ context, input }) => {
      const access = await expenseAccess(context.db, context, input.tripId, input.payerMemberId, input.shares.map((share) => share.memberId));
      if (input.currency !== access.currency) throw new ORPCError("BAD_REQUEST", { message: "Expense currency must match the trip currency." });
      const shares = input.splitType === "equal" ? equalShares(input.amountMinor, input.shares.map((share) => share.memberId)) : customShares(input.amountMinor, input.shares);
       const expense = await context.db.transaction(async (tx) => {
        const [expense] = await tx.insert(expenses).values({ tripId: input.tripId, createdByMemberId: access.memberId, payerMemberId: input.payerMemberId, description: input.description, amountMinor: input.amountMinor, currency: input.currency, splitType: input.splitType, occurredAt: new Date(input.occurredAt) }).returning();
        if (!expense) throw new ORPCError("INTERNAL_SERVER_ERROR");
        await tx.insert(expenseShares).values(shares.map((share) => ({ expenseId: expense.id, ...share })));
        await recordActivity(tx, input.tripId, access.memberId, "expense.created", { expenseId: expense.id, description: expense.description });
         return expense;
       });
       publishRealtimeEvent({ tripId: input.tripId, actorMemberId: access.memberId, type: "expense.changed", payload: { expenseId: expense.id } });
       return expense;
    }),
    update: protectedProcedure.input(expenseInput.extend({ id: z.string().uuid() })).handler(async ({ context, input }) => {
      const access = await expenseAccess(context.db, context, input.tripId, input.payerMemberId, input.shares.map((share) => share.memberId), input.id);
      if (input.currency !== access.currency) throw new ORPCError("BAD_REQUEST", { message: "Expense currency must match the trip currency." });
      const shares = input.splitType === "equal" ? equalShares(input.amountMinor, input.shares.map((share) => share.memberId)) : customShares(input.amountMinor, input.shares);
       const expense = await context.db.transaction(async (tx) => {
        const [expense] = await tx.update(expenses).set({ payerMemberId: input.payerMemberId, description: input.description, amountMinor: input.amountMinor, currency: input.currency, splitType: input.splitType, occurredAt: new Date(input.occurredAt) }).where(and(eq(expenses.id, input.id), isNull(expenses.deletedAt))).returning();
        if (!expense) throw new ORPCError("NOT_FOUND");
         await tx.delete(expenseShares).where(eq(expenseShares.expenseId, input.id));
         await tx.insert(expenseShares).values(shares.map((share) => ({ expenseId: input.id, ...share })));
         await tx.delete(settlements).where(eq(settlements.tripId, input.tripId));
        await recordActivity(tx, input.tripId, access.memberId, "expense.updated", { expenseId: expense.id, description: expense.description });
         return expense;
       });
       publishRealtimeEvent({ tripId: input.tripId, actorMemberId: access.memberId, type: "expense.changed", payload: { expenseId: expense.id } });
       return expense;
    }),
    remove: protectedProcedure.input(z.object({ tripId: z.string().uuid(), id: z.string().uuid() })).handler(async ({ context, input }) => {
      await expenseAccess(context.db, context, input.tripId, undefined, [], input.id);
       const member = await expenseAccess(context.db, context, input.tripId);
       const removed = await context.db.transaction(async (tx) => {
         const [deleted] = await tx.update(expenses).set({ deletedAt: new Date() }).where(and(eq(expenses.id, input.id), eq(expenses.tripId, input.tripId), isNull(expenses.deletedAt))).returning();
         if (!deleted) throw new ORPCError("NOT_FOUND");
         await tx.delete(settlements).where(eq(settlements.tripId, input.tripId));
         await recordActivity(tx, input.tripId, member.memberId, "expense.deleted", { expenseId: deleted.id });
         return deleted;
       });
       if (!removed) throw new ORPCError("NOT_FOUND");
       publishRealtimeEvent({ tripId: input.tripId, actorMemberId: member.memberId, type: "expense.changed", payload: { expenseId: removed.id } });
       return removed;
    }),
    settlements: {
      list: protectedProcedure.input(z.object({ tripId: z.string().uuid() })).handler(async ({ context, input }) => {
        const access = await expenseAccess(context.db, context, input.tripId);
        return context.db.select().from(settlements).where(and(eq(settlements.tripId, input.tripId), eq(settlements.currency, access.currency)));
      }),
      markSettled: protectedProcedure.input(z.object({ tripId: z.string().uuid(), fromMemberId: z.string().uuid(), toMemberId: z.string().uuid(), amountMinor: z.number().int().positive() })).handler(async ({ context, input }) => {
        const access = await expenseAccess(context.db, context, input.tripId, input.fromMemberId, [input.toMemberId]);
          const settlement = await context.db.transaction(async (tx) => {
         const [existing] = await tx.select().from(settlements).where(and(eq(settlements.tripId, input.tripId), eq(settlements.fromMemberId, input.fromMemberId), eq(settlements.toMemberId, input.toMemberId), eq(settlements.amountMinor, input.amountMinor), eq(settlements.currency, access.currency))).limit(1);
        if (existing) {
           const [updated] = await tx.update(settlements).set({ status: "settled", markedSettledAt: new Date() }).where(eq(settlements.id, existing.id)).returning();
           if (updated) await recordActivity(tx, input.tripId, access.memberId, "settlement.settled", { settlementId: updated.id });
          return updated;
        }
         const [created] = await tx.insert(settlements).values({ tripId: input.tripId, fromMemberId: input.fromMemberId, toMemberId: input.toMemberId, amountMinor: input.amountMinor, currency: access.currency, status: "settled", markedSettledAt: new Date() }).returning();
         if (created) await recordActivity(tx, input.tripId, access.memberId, "settlement.settled", { settlementId: created.id });
         return created;
          });
          if (settlement) publishRealtimeEvent({ tripId: input.tripId, actorMemberId: access.memberId, type: "settlement.changed", payload: { settlementId: settlement.id } });
          return settlement;
      }),
      markSuggested: protectedProcedure.input(z.object({ tripId: z.string().uuid(), settlementId: z.string().uuid() })).handler(async ({ context, input }) => {
        await expenseAccess(context.db, context, input.tripId);
         const access = await expenseAccess(context.db, context, input.tripId);
         const updated = await context.db.transaction(async (tx) => {
         const [settlement] = await tx.update(settlements).set({ status: "suggested", markedSettledAt: null }).where(and(eq(settlements.id, input.settlementId), eq(settlements.tripId, input.tripId))).returning();
         if (settlement) await recordActivity(tx, input.tripId, access.memberId, "settlement.reopened", { settlementId: settlement.id });
         return settlement;
         });
         if (!updated) throw new ORPCError("NOT_FOUND");
         publishRealtimeEvent({ tripId: input.tripId, actorMemberId: access.memberId, type: "settlement.changed", payload: { settlementId: updated.id } });
         return updated;
      }),
    },
  },
  activity: {
    list: protectedProcedure.input(z.object({ tripId: z.string().uuid(), limit: z.number().int().min(1).max(100).default(30), before: z.string().datetime({ offset: true }).optional() })).handler(async ({ context, input }) => {
       const [member] = await context.db.select({ id: tripMembers.id }).from(tripMembers).innerJoin(trips, eq(tripMembers.tripId, trips.id)).leftJoin(tripGuests, eq(tripMembers.guestId, tripGuests.id)).where(and(eq(tripMembers.tripId, input.tripId), memberIdentity(context), isNull(tripMembers.removedAt), isNull(trips.deletedAt))).limit(1);
      if (!member) throw new ORPCError("NOT_FOUND");
      return context.db.select({ event: activityEvents, actor: tripMembers.displayName }).from(activityEvents).innerJoin(tripMembers, eq(activityEvents.actorMemberId, tripMembers.id)).where(and(eq(activityEvents.tripId, input.tripId), input.before ? lt(activityEvents.createdAt, new Date(input.before)) : undefined)).orderBy(desc(activityEvents.createdAt)).limit(input.limit);
    }),
  },
};
export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
