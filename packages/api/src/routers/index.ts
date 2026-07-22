import type { RouterClient } from "@orpc/server";
import { z } from "zod";
import { and, desc, eq, isNull, lt } from "drizzle-orm";
import { activityEvents, canvasObjects, expenseShares, expenses, itineraryItems, places, settlements, trips, tripMembers } from "@waymark/db/schema";
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

async function expenseAccess(database: any, userId: string, tripId: string, payerMemberId?: string, participantIds: string[] = [], expenseId?: string) {
  const [access] = await database.select({ memberId: tripMembers.id, currency: trips.currency }).from(tripMembers).innerJoin(trips, eq(tripMembers.tripId, trips.id)).where(and(eq(tripMembers.tripId, tripId), eq(tripMembers.userId, userId), isNull(tripMembers.removedAt), isNull(trips.deletedAt))).limit(1);
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
        .where(and(eq(tripMembers.userId, context.session!.user.id), isNull(trips.deletedAt)))
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
              eq(tripMembers.userId, context.session!.user.id),
              isNull(trips.deletedAt),
            ),
          )
          .limit(1);
        return result ?? null;
      }),
  },
  members: {
    list: protectedProcedure.input(z.object({ tripId: z.string().uuid() })).handler(async ({ context, input }) => {
      const [access] = await context.db.select({ id: tripMembers.id }).from(tripMembers).innerJoin(trips, eq(tripMembers.tripId, trips.id)).where(and(eq(tripMembers.tripId, input.tripId), eq(tripMembers.userId, context.session!.user.id), isNull(tripMembers.removedAt), isNull(trips.deletedAt))).limit(1);
      if (!access) throw new ORPCError("NOT_FOUND");
      return context.db.select({ id: tripMembers.id, displayName: tripMembers.displayName, role: tripMembers.role }).from(tripMembers).where(and(eq(tripMembers.tripId, input.tripId), isNull(tripMembers.removedAt))).orderBy(tripMembers.displayName);
    }),
  },
  canvas: {
    list: protectedProcedure.input(z.object({ tripId: z.string().uuid() })).handler(async ({ context, input }) => {
      const [member] = await context.db.select({ id: tripMembers.id }).from(tripMembers).innerJoin(trips, eq(tripMembers.tripId, trips.id)).where(and(eq(tripMembers.tripId, input.tripId), eq(tripMembers.userId, context.session!.user.id), isNull(tripMembers.removedAt), isNull(trips.deletedAt))).limit(1);
      if (!member) throw new ORPCError("NOT_FOUND");
      return context.db.select().from(canvasObjects).where(and(eq(canvasObjects.tripId, input.tripId), isNull(canvasObjects.deletedAt))).orderBy(canvasObjects.zIndex, canvasObjects.createdAt);
    }),
    create: protectedProcedure.input(z.object({ tripId: z.string().uuid(), type: z.string().min(1).max(64), x: z.number(), y: z.number(), width: z.number().nullable().optional(), height: z.number().nullable().optional(), rotation: z.number().default(0), zIndex: z.number().int().default(0), data: z.record(z.string(), z.unknown()) })).handler(async ({ context, input }) => {
      const [member] = await context.db.select({ id: tripMembers.id }).from(tripMembers).innerJoin(trips, eq(tripMembers.tripId, trips.id)).where(and(eq(tripMembers.tripId, input.tripId), eq(tripMembers.userId, context.session!.user.id), isNull(tripMembers.removedAt), isNull(trips.deletedAt))).limit(1);
      if (!member) throw new ORPCError("NOT_FOUND");
       const [object] = await context.db.insert(canvasObjects).values({ ...input, createdByMemberId: member.id, width: input.width ?? null, height: input.height ?? null }).returning();
       if (object) publishRealtimeEvent({ tripId: input.tripId, actorMemberId: member.id, type: "canvas.object.created", payload: { objectId: object.id, objectVersion: object.version, shapeType: object.type, data: object.data as Record<string, unknown> } });
       if (object) await recordActivity(context.db, input.tripId, member.id, "canvas.object.created", { objectId: object.id, objectType: object.type });
      return object;
    }),
    update: protectedProcedure.input(z.object({ id: z.string().uuid(), version: z.number().int(), type: z.string().min(1).max(64), x: z.number(), y: z.number(), width: z.number().nullable().optional(), height: z.number().nullable().optional(), rotation: z.number(), zIndex: z.number().int(), data: z.record(z.string(), z.unknown()) })).handler(async ({ context, input }) => {
       const [current] = await context.db.select({ object: canvasObjects, memberId: tripMembers.id }).from(canvasObjects).innerJoin(tripMembers, eq(canvasObjects.tripId, tripMembers.tripId)).where(and(eq(canvasObjects.id, input.id), eq(tripMembers.userId, context.session!.user.id), isNull(canvasObjects.deletedAt), isNull(tripMembers.removedAt))).limit(1);
      if (!current) throw new ORPCError("NOT_FOUND");
      if (current.object.version !== input.version) throw new ORPCError("CONFLICT");
      const [updated] = await context.db.update(canvasObjects).set({ type: input.type, x: input.x, y: input.y, width: input.width ?? null, height: input.height ?? null, rotation: input.rotation, zIndex: input.zIndex, data: input.data, version: input.version + 1 }).where(and(eq(canvasObjects.id, input.id), eq(canvasObjects.version, input.version))).returning();
      if (!updated) throw new ORPCError("CONFLICT");
       if (updated) publishRealtimeEvent({ tripId: current.object.tripId, actorMemberId: current.memberId, type: "canvas.object.updated", payload: { objectId: updated.id, objectVersion: updated.version, data: updated.data as Record<string, unknown> } });
       if (updated) await recordActivity(context.db, current.object.tripId, current.memberId, "canvas.object.updated", { objectId: updated.id });
       return updated;
    }),
    remove: protectedProcedure.input(z.object({ id: z.string().uuid(), version: z.number().int() })).handler(async ({ context, input }) => {
       const [current] = await context.db.select({ object: canvasObjects, memberId: tripMembers.id }).from(canvasObjects).innerJoin(tripMembers, eq(canvasObjects.tripId, tripMembers.tripId)).where(and(eq(canvasObjects.id, input.id), eq(tripMembers.userId, context.session!.user.id), isNull(canvasObjects.deletedAt), isNull(tripMembers.removedAt))).limit(1);
      if (!current) throw new ORPCError("NOT_FOUND");
      if (current.object.version !== input.version) throw new ORPCError("CONFLICT");
      const [removed] = await context.db.update(canvasObjects).set({ deletedAt: new Date(), version: input.version + 1 }).where(and(eq(canvasObjects.id, input.id), eq(canvasObjects.version, input.version))).returning();
       if (removed) publishRealtimeEvent({ tripId: current.object.tripId, actorMemberId: current.memberId, type: "canvas.object.deleted", payload: { objectId: removed.id, objectVersion: removed.version } });
       if (removed) await recordActivity(context.db, current.object.tripId, current.memberId, "canvas.object.deleted", { objectId: removed.id });
       return removed;
    }),
    restore: protectedProcedure.input(z.object({ id: z.string().uuid() })).handler(async ({ context, input }) => {
      const [restored] = await context.db.update(canvasObjects).set({ deletedAt: null, version: 1 }).where(eq(canvasObjects.id, input.id)).returning();
      if (!restored) throw new ORPCError("NOT_FOUND");
      return restored;
    }),
  },
  places: {
    list: protectedProcedure.input(z.object({ tripId: z.string().uuid() })).handler(async ({ context, input }) => {
      const [member] = await context.db.select({ id: tripMembers.id }).from(tripMembers).innerJoin(trips, eq(tripMembers.tripId, trips.id)).where(and(eq(tripMembers.tripId, input.tripId), eq(tripMembers.userId, context.session!.user.id), isNull(tripMembers.removedAt), isNull(trips.deletedAt))).limit(1);
      if (!member) throw new ORPCError("NOT_FOUND");
      return context.db.select().from(places).where(and(eq(places.tripId, input.tripId), isNull(places.deletedAt))).orderBy(desc(places.updatedAt));
    }),
    create: protectedProcedure.input(z.object({ tripId: z.string().uuid(), name: z.string().trim().min(1).max(200), address: z.string().trim().max(500).nullable().optional(), mapUrl: httpUrl.nullable().optional(), url: httpUrl.nullable().optional(), latitude: z.string().max(32).nullable().optional(), longitude: z.string().max(32).nullable().optional(), notes: z.string().trim().max(5000).nullable().optional() })).handler(async ({ context, input }) => {
      const [member] = await context.db.select({ id: tripMembers.id }).from(tripMembers).innerJoin(trips, eq(tripMembers.tripId, trips.id)).where(and(eq(tripMembers.tripId, input.tripId), eq(tripMembers.userId, context.session!.user.id), isNull(tripMembers.removedAt), isNull(trips.deletedAt))).limit(1);
      if (!member) throw new ORPCError("NOT_FOUND");
      const [place] = await context.db.insert(places).values({ ...input, createdByMemberId: member.id, address: input.address ?? null, mapUrl: input.mapUrl ?? null, url: input.url ?? null, latitude: input.latitude ?? null, longitude: input.longitude ?? null, notes: input.notes ?? null }).returning();
      if (place) await recordActivity(context.db, input.tripId, member.id, "place.created", { placeId: place.id, name: place.name });
      return place;
    }),
    update: protectedProcedure.input(z.object({ id: z.string().uuid(), name: z.string().trim().min(1).max(200), address: z.string().trim().max(500).nullable().optional(), mapUrl: httpUrl.nullable().optional(), url: httpUrl.nullable().optional(), latitude: z.string().max(32).nullable().optional(), longitude: z.string().max(32).nullable().optional(), notes: z.string().trim().max(5000).nullable().optional() })).handler(async ({ context, input }) => {
      const [current] = await context.db.select({ place: places, memberId: tripMembers.id }).from(places).innerJoin(tripMembers, eq(places.tripId, tripMembers.tripId)).where(and(eq(places.id, input.id), eq(tripMembers.userId, context.session!.user.id), isNull(places.deletedAt), isNull(tripMembers.removedAt))).limit(1);
      if (!current) throw new ORPCError("NOT_FOUND");
      const [place] = await context.db.update(places).set({ name: input.name, address: input.address ?? null, mapUrl: input.mapUrl ?? null, url: input.url ?? null, latitude: input.latitude ?? null, longitude: input.longitude ?? null, notes: input.notes ?? null }).where(eq(places.id, input.id)).returning();
      if (place) await recordActivity(context.db, place.tripId, current.memberId, "place.updated", { placeId: place.id, name: place.name });
      return place;
    }),
    archive: protectedProcedure.input(z.object({ id: z.string().uuid() })).handler(async ({ context, input }) => {
      const [current] = await context.db.select({ place: places, memberId: tripMembers.id }).from(places).innerJoin(tripMembers, eq(places.tripId, tripMembers.tripId)).where(and(eq(places.id, input.id), eq(tripMembers.userId, context.session!.user.id), isNull(places.deletedAt), isNull(tripMembers.removedAt))).limit(1);
      if (!current) throw new ORPCError("NOT_FOUND");
      const [place] = await context.db.update(places).set({ deletedAt: new Date() }).where(eq(places.id, input.id)).returning();
      if (place) await recordActivity(context.db, place.tripId, current.memberId, "place.archived", { placeId: place.id, name: place.name });
      return place;
    }),
    addToCanvas: protectedProcedure.input(z.object({ tripId: z.string().uuid(), placeId: z.string().uuid() })).handler(async ({ context, input }) => {
      const [member] = await context.db.select({ id: tripMembers.id }).from(tripMembers).innerJoin(trips, eq(tripMembers.tripId, trips.id)).where(and(eq(tripMembers.tripId, input.tripId), eq(tripMembers.userId, context.session!.user.id), isNull(tripMembers.removedAt), isNull(trips.deletedAt))).limit(1);
      if (!member) throw new ORPCError("NOT_FOUND");
      const [place] = await context.db.select().from(places).where(and(eq(places.id, input.placeId), eq(places.tripId, input.tripId), isNull(places.deletedAt))).limit(1);
      if (!place) throw new ORPCError("NOT_FOUND");
      const shapeId = `shape:${crypto.randomUUID()}`;
      const shape = { id: shapeId, type: "note", x: 80, y: 80, rotation: 0, index: "a1", parentId: "page:page", isLocked: false, opacity: 1, meta: { waymarkType: "place", waymarkRecordId: place.id }, props: { color: "blue", size: "m", font: "draw", align: "start", verticalAlign: "start", url: "", richText: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: place.name }] }] }, scale: 1 } };
      const [object] = await context.db.insert(canvasObjects).values({ tripId: input.tripId, createdByMemberId: member.id, type: "note", x: 80, y: 80, width: 280, height: 200, rotation: 0, zIndex: 0, data: { shape } }).returning();
      return object;
    }),
  },
  itinerary: {
    list: protectedProcedure.input(z.object({ tripId: z.string().uuid() })).handler(async ({ context, input }) => {
      const [member] = await context.db.select({ id: tripMembers.id }).from(tripMembers).innerJoin(trips, eq(tripMembers.tripId, trips.id)).where(and(eq(tripMembers.tripId, input.tripId), eq(tripMembers.userId, context.session!.user.id), isNull(tripMembers.removedAt), isNull(trips.deletedAt))).limit(1);
      if (!member) throw new ORPCError("NOT_FOUND");
      return context.db.select({ item: itineraryItems, place: places }).from(itineraryItems).leftJoin(places, eq(itineraryItems.placeId, places.id)).where(and(eq(itineraryItems.tripId, input.tripId), isNull(itineraryItems.deletedAt))).orderBy(itineraryItems.day, itineraryItems.sortOrder, itineraryItems.createdAt);
    }),
    create: protectedProcedure.input(z.object({ tripId: z.string().uuid(), day: z.string().date().nullable().optional(), title: z.string().trim().min(1).max(200), placeId: z.string().uuid().nullable().optional(), startsAt: z.string().datetime({ offset: true }).nullable().optional(), endsAt: z.string().datetime({ offset: true }).nullable().optional(), notes: z.string().trim().max(5000).nullable().optional(), status: z.enum(["idea", "planned", "done"]).default("planned"), sortOrder: z.number().int().default(0) })).handler(async ({ context, input }) => {
      const [member] = await context.db.select({ id: tripMembers.id }).from(tripMembers).innerJoin(trips, eq(tripMembers.tripId, trips.id)).where(and(eq(tripMembers.tripId, input.tripId), eq(tripMembers.userId, context.session!.user.id), isNull(tripMembers.removedAt), isNull(trips.deletedAt))).limit(1);
      if (!member) throw new ORPCError("NOT_FOUND");
      const [item] = await context.db.insert(itineraryItems).values({ ...input, createdByMemberId: member.id, placeId: input.placeId ?? null, startsAt: input.startsAt ? new Date(input.startsAt) : null, endsAt: input.endsAt ? new Date(input.endsAt) : null, notes: input.notes ?? null }).returning();
      if (item) await recordActivity(context.db, input.tripId, member.id, "itinerary.created", { itineraryItemId: item.id, title: item.title });
      return item;
    }),
    update: protectedProcedure.input(z.object({ id: z.string().uuid(), day: z.string().date().nullable().optional(), title: z.string().trim().min(1).max(200), placeId: z.string().uuid().nullable().optional(), startsAt: z.string().datetime({ offset: true }).nullable().optional(), endsAt: z.string().datetime({ offset: true }).nullable().optional(), notes: z.string().trim().max(5000).nullable().optional(), status: z.enum(["idea", "planned", "done"]), sortOrder: z.number().int() })).handler(async ({ context, input }) => {
      const [current] = await context.db.select({ item: itineraryItems, memberId: tripMembers.id }).from(itineraryItems).innerJoin(tripMembers, eq(itineraryItems.tripId, tripMembers.tripId)).where(and(eq(itineraryItems.id, input.id), eq(tripMembers.userId, context.session!.user.id), isNull(itineraryItems.deletedAt), isNull(tripMembers.removedAt))).limit(1);
      if (!current) throw new ORPCError("NOT_FOUND");
      const [item] = await context.db.update(itineraryItems).set({ day: input.day, title: input.title, placeId: input.placeId ?? null, startsAt: input.startsAt ? new Date(input.startsAt) : null, endsAt: input.endsAt ? new Date(input.endsAt) : null, notes: input.notes ?? null, status: input.status, sortOrder: input.sortOrder }).where(eq(itineraryItems.id, input.id)).returning();
      if (item) await recordActivity(context.db, item.tripId, current.memberId, "itinerary.updated", { itineraryItemId: item.id, title: item.title });
      return item;
    }),
    archive: protectedProcedure.input(z.object({ id: z.string().uuid() })).handler(async ({ context, input }) => {
      const [current] = await context.db.select({ item: itineraryItems, memberId: tripMembers.id }).from(itineraryItems).innerJoin(tripMembers, eq(itineraryItems.tripId, tripMembers.tripId)).where(and(eq(itineraryItems.id, input.id), eq(tripMembers.userId, context.session!.user.id), isNull(itineraryItems.deletedAt), isNull(tripMembers.removedAt))).limit(1);
      if (!current) throw new ORPCError("NOT_FOUND");
      const [item] = await context.db.update(itineraryItems).set({ deletedAt: new Date() }).where(eq(itineraryItems.id, input.id)).returning();
      if (item) await recordActivity(context.db, item.tripId, current.memberId, "itinerary.archived", { itineraryItemId: item.id, title: item.title });
      return item;
    }),
    promoteCanvasObject: protectedProcedure.input(z.object({ tripId: z.string().uuid(), canvasObjectId: z.string().uuid(), day: z.string().date().nullable().optional() })).handler(async ({ context, input }) => {
      const [member] = await context.db.select({ id: tripMembers.id }).from(tripMembers).innerJoin(trips, eq(tripMembers.tripId, trips.id)).where(and(eq(tripMembers.tripId, input.tripId), eq(tripMembers.userId, context.session!.user.id), isNull(tripMembers.removedAt), isNull(trips.deletedAt))).limit(1);
      if (!member) throw new ORPCError("NOT_FOUND");
      const [canvas] = await context.db.select({ object: canvasObjects }).from(canvasObjects).innerJoin(tripMembers, eq(canvasObjects.tripId, tripMembers.tripId)).where(and(eq(canvasObjects.id, input.canvasObjectId), eq(canvasObjects.tripId, input.tripId), eq(tripMembers.userId, context.session!.user.id), isNull(canvasObjects.deletedAt), isNull(tripMembers.removedAt))).limit(1);
      if (!canvas) throw new ORPCError("NOT_FOUND");
      const [existing] = await context.db.select({ id: itineraryItems.id }).from(itineraryItems).where(and(eq(itineraryItems.sourceCanvasObjectId, input.canvasObjectId), isNull(itineraryItems.deletedAt))).limit(1);
      if (existing) return { id: existing.id, created: false };
      const shape = canvas.object.data && typeof canvas.object.data === "object" && "shape" in canvas.object.data ? canvas.object.data.shape : null;
      const props = shape && typeof shape === "object" && "props" in shape && shape.props && typeof shape.props === "object" ? shape.props : null;
      const rawText = props && "text" in props ? props.text : null;
      const title = typeof rawText === "string" && rawText.trim() ? rawText.trim().slice(0, 200) : "Canvas idea";
      const [item] = await context.db.insert(itineraryItems).values({ tripId: input.tripId, createdByMemberId: member.id, sourceCanvasObjectId: input.canvasObjectId, day: input.day ?? null, title, notes: typeof rawText === "string" ? rawText : null, status: "idea" }).returning({ id: itineraryItems.id });
      if (!item) throw new ORPCError("INTERNAL_SERVER_ERROR");
      return { id: item.id, created: true };
    }),
  },
  expenses: {
    list: protectedProcedure.input(z.object({ tripId: z.string().uuid() })).handler(async ({ context, input }) => {
      const [member] = await context.db.select({ id: tripMembers.id }).from(tripMembers).innerJoin(trips, eq(tripMembers.tripId, trips.id)).where(and(eq(tripMembers.tripId, input.tripId), eq(tripMembers.userId, context.session!.user.id), isNull(tripMembers.removedAt), isNull(trips.deletedAt))).limit(1);
      if (!member) throw new ORPCError("NOT_FOUND");
      return context.db.select({ expense: expenses, shares: expenseShares }).from(expenses).leftJoin(expenseShares, eq(expenses.id, expenseShares.expenseId)).where(and(eq(expenses.tripId, input.tripId), isNull(expenses.deletedAt))).orderBy(desc(expenses.occurredAt));
    }),
    create: protectedProcedure.input(expenseInput).handler(async ({ context, input }) => {
      const access = await expenseAccess(context.db, context.session!.user.id, input.tripId, input.payerMemberId, input.shares.map((share) => share.memberId));
      if (input.currency !== access.currency) throw new ORPCError("BAD_REQUEST", { message: "Expense currency must match the trip currency." });
      const shares = input.splitType === "equal" ? equalShares(input.amountMinor, input.shares.map((share) => share.memberId)) : customShares(input.amountMinor, input.shares);
      return context.db.transaction(async (tx) => {
        const [expense] = await tx.insert(expenses).values({ tripId: input.tripId, createdByMemberId: access.memberId, payerMemberId: input.payerMemberId, description: input.description, amountMinor: input.amountMinor, currency: input.currency, splitType: input.splitType, occurredAt: new Date(input.occurredAt) }).returning();
        if (!expense) throw new ORPCError("INTERNAL_SERVER_ERROR");
        await tx.insert(expenseShares).values(shares.map((share) => ({ expenseId: expense.id, ...share })));
        await recordActivity(tx, input.tripId, access.memberId, "expense.created", { expenseId: expense.id, description: expense.description });
        return expense;
      });
    }),
    update: protectedProcedure.input(expenseInput.extend({ id: z.string().uuid() })).handler(async ({ context, input }) => {
      const access = await expenseAccess(context.db, context.session!.user.id, input.tripId, input.payerMemberId, input.shares.map((share) => share.memberId), input.id);
      if (input.currency !== access.currency) throw new ORPCError("BAD_REQUEST", { message: "Expense currency must match the trip currency." });
      const shares = input.splitType === "equal" ? equalShares(input.amountMinor, input.shares.map((share) => share.memberId)) : customShares(input.amountMinor, input.shares);
      return context.db.transaction(async (tx) => {
        const [expense] = await tx.update(expenses).set({ payerMemberId: input.payerMemberId, description: input.description, amountMinor: input.amountMinor, currency: input.currency, splitType: input.splitType, occurredAt: new Date(input.occurredAt) }).where(and(eq(expenses.id, input.id), isNull(expenses.deletedAt))).returning();
        if (!expense) throw new ORPCError("NOT_FOUND");
        await tx.delete(expenseShares).where(eq(expenseShares.expenseId, input.id));
        await tx.insert(expenseShares).values(shares.map((share) => ({ expenseId: input.id, ...share })));
        await recordActivity(tx, input.tripId, access.memberId, "expense.updated", { expenseId: expense.id, description: expense.description });
        return expense;
      });
    }),
    remove: protectedProcedure.input(z.object({ tripId: z.string().uuid(), id: z.string().uuid() })).handler(async ({ context, input }) => {
      await expenseAccess(context.db, context.session!.user.id, input.tripId, undefined, [], input.id);
      const [removed] = await context.db.update(expenses).set({ deletedAt: new Date() }).where(and(eq(expenses.id, input.id), eq(expenses.tripId, input.tripId), isNull(expenses.deletedAt))).returning();
      if (!removed) throw new ORPCError("NOT_FOUND");
      const [member] = await context.db.select({ id: tripMembers.id }).from(tripMembers).where(and(eq(tripMembers.tripId, input.tripId), eq(tripMembers.userId, context.session!.user.id), isNull(tripMembers.removedAt))).limit(1);
      if (member) await recordActivity(context.db, input.tripId, member.id, "expense.deleted", { expenseId: removed.id });
      return removed;
    }),
    settlements: {
      list: protectedProcedure.input(z.object({ tripId: z.string().uuid() })).handler(async ({ context, input }) => {
        const access = await expenseAccess(context.db, context.session!.user.id, input.tripId);
        return context.db.select().from(settlements).where(and(eq(settlements.tripId, input.tripId), eq(settlements.currency, access.currency)));
      }),
      markSettled: protectedProcedure.input(z.object({ tripId: z.string().uuid(), fromMemberId: z.string().uuid(), toMemberId: z.string().uuid(), amountMinor: z.number().int().positive() })).handler(async ({ context, input }) => {
        const access = await expenseAccess(context.db, context.session!.user.id, input.tripId, input.fromMemberId, [input.toMemberId]);
        const [existing] = await context.db.select().from(settlements).where(and(eq(settlements.tripId, input.tripId), eq(settlements.fromMemberId, input.fromMemberId), eq(settlements.toMemberId, input.toMemberId), eq(settlements.amountMinor, input.amountMinor), eq(settlements.currency, access.currency))).limit(1);
        if (existing) {
          const [updated] = await context.db.update(settlements).set({ status: "settled", markedSettledAt: new Date() }).where(eq(settlements.id, existing.id)).returning();
          if (updated) await recordActivity(context.db, input.tripId, (await expenseAccess(context.db, context.session!.user.id, input.tripId)).memberId, "settlement.settled", { settlementId: updated.id });
          return updated;
        }
        const [created] = await context.db.insert(settlements).values({ tripId: input.tripId, fromMemberId: input.fromMemberId, toMemberId: input.toMemberId, amountMinor: input.amountMinor, currency: access.currency, status: "settled", markedSettledAt: new Date() }).returning();
        if (created) await recordActivity(context.db, input.tripId, access.memberId, "settlement.settled", { settlementId: created.id });
        return created;
      }),
      markSuggested: protectedProcedure.input(z.object({ tripId: z.string().uuid(), settlementId: z.string().uuid() })).handler(async ({ context, input }) => {
        await expenseAccess(context.db, context.session!.user.id, input.tripId);
        const [updated] = await context.db.update(settlements).set({ status: "suggested", markedSettledAt: null }).where(and(eq(settlements.id, input.settlementId), eq(settlements.tripId, input.tripId))).returning();
        if (!updated) throw new ORPCError("NOT_FOUND");
        await recordActivity(context.db, input.tripId, (await expenseAccess(context.db, context.session!.user.id, input.tripId)).memberId, "settlement.reopened", { settlementId: updated.id });
        return updated;
      }),
    },
  },
  activity: {
    list: protectedProcedure.input(z.object({ tripId: z.string().uuid(), limit: z.number().int().min(1).max(100).default(30), before: z.string().datetime({ offset: true }).optional() })).handler(async ({ context, input }) => {
      const [member] = await context.db.select({ id: tripMembers.id }).from(tripMembers).innerJoin(trips, eq(tripMembers.tripId, trips.id)).where(and(eq(tripMembers.tripId, input.tripId), eq(tripMembers.userId, context.session!.user.id), isNull(tripMembers.removedAt), isNull(trips.deletedAt))).limit(1);
      if (!member) throw new ORPCError("NOT_FOUND");
      return context.db.select({ event: activityEvents, actor: tripMembers.displayName }).from(activityEvents).innerJoin(tripMembers, eq(activityEvents.actorMemberId, tripMembers.id)).where(and(eq(activityEvents.tripId, input.tripId), input.before ? lt(activityEvents.createdAt, new Date(input.before)) : undefined)).orderBy(desc(activityEvents.createdAt)).limit(input.limit);
    }),
  },
};
export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
