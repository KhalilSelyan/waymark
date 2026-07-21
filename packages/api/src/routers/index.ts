import type { RouterClient } from "@orpc/server";
import { z } from "zod";
import { and, desc, eq, isNull } from "drizzle-orm";
import { canvasObjects, itineraryItems, places, trips, tripMembers } from "@waymark/db/schema";
import { ORPCError } from "@orpc/server";

import { protectedProcedure, publicProcedure } from "../index";

const httpUrl = z.string().url().refine((value) => {
  const url = new URL(value);
  return url.protocol === "http:" || url.protocol === "https:";
}, "URL must use http or https");

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
      return object;
    }),
    update: protectedProcedure.input(z.object({ id: z.string().uuid(), version: z.number().int(), type: z.string().min(1).max(64), x: z.number(), y: z.number(), width: z.number().nullable().optional(), height: z.number().nullable().optional(), rotation: z.number(), zIndex: z.number().int(), data: z.record(z.string(), z.unknown()) })).handler(async ({ context, input }) => {
      const [current] = await context.db.select({ object: canvasObjects }).from(canvasObjects).innerJoin(tripMembers, eq(canvasObjects.tripId, tripMembers.tripId)).where(and(eq(canvasObjects.id, input.id), eq(tripMembers.userId, context.session!.user.id), isNull(canvasObjects.deletedAt), isNull(tripMembers.removedAt))).limit(1);
      if (!current) throw new ORPCError("NOT_FOUND");
      if (current.object.version !== input.version) throw new ORPCError("CONFLICT");
      const [updated] = await context.db.update(canvasObjects).set({ type: input.type, x: input.x, y: input.y, width: input.width ?? null, height: input.height ?? null, rotation: input.rotation, zIndex: input.zIndex, data: input.data, version: input.version + 1 }).where(and(eq(canvasObjects.id, input.id), eq(canvasObjects.version, input.version))).returning();
      if (!updated) throw new ORPCError("CONFLICT");
      return updated;
    }),
    remove: protectedProcedure.input(z.object({ id: z.string().uuid(), version: z.number().int() })).handler(async ({ context, input }) => {
      const [current] = await context.db.select({ object: canvasObjects }).from(canvasObjects).innerJoin(tripMembers, eq(canvasObjects.tripId, tripMembers.tripId)).where(and(eq(canvasObjects.id, input.id), eq(tripMembers.userId, context.session!.user.id), isNull(canvasObjects.deletedAt), isNull(tripMembers.removedAt))).limit(1);
      if (!current) throw new ORPCError("NOT_FOUND");
      if (current.object.version !== input.version) throw new ORPCError("CONFLICT");
      const [removed] = await context.db.update(canvasObjects).set({ deletedAt: new Date(), version: input.version + 1 }).where(and(eq(canvasObjects.id, input.id), eq(canvasObjects.version, input.version))).returning();
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
      return place;
    }),
    update: protectedProcedure.input(z.object({ id: z.string().uuid(), name: z.string().trim().min(1).max(200), address: z.string().trim().max(500).nullable().optional(), mapUrl: httpUrl.nullable().optional(), url: httpUrl.nullable().optional(), latitude: z.string().max(32).nullable().optional(), longitude: z.string().max(32).nullable().optional(), notes: z.string().trim().max(5000).nullable().optional() })).handler(async ({ context, input }) => {
      const [current] = await context.db.select({ place: places }).from(places).innerJoin(tripMembers, eq(places.tripId, tripMembers.tripId)).where(and(eq(places.id, input.id), eq(tripMembers.userId, context.session!.user.id), isNull(places.deletedAt), isNull(tripMembers.removedAt))).limit(1);
      if (!current) throw new ORPCError("NOT_FOUND");
      const [place] = await context.db.update(places).set({ name: input.name, address: input.address ?? null, mapUrl: input.mapUrl ?? null, url: input.url ?? null, latitude: input.latitude ?? null, longitude: input.longitude ?? null, notes: input.notes ?? null }).where(eq(places.id, input.id)).returning();
      return place;
    }),
    archive: protectedProcedure.input(z.object({ id: z.string().uuid() })).handler(async ({ context, input }) => {
      const [current] = await context.db.select({ place: places }).from(places).innerJoin(tripMembers, eq(places.tripId, tripMembers.tripId)).where(and(eq(places.id, input.id), eq(tripMembers.userId, context.session!.user.id), isNull(places.deletedAt), isNull(tripMembers.removedAt))).limit(1);
      if (!current) throw new ORPCError("NOT_FOUND");
      const [place] = await context.db.update(places).set({ deletedAt: new Date() }).where(eq(places.id, input.id)).returning();
      return place;
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
      return item;
    }),
    update: protectedProcedure.input(z.object({ id: z.string().uuid(), day: z.string().date().nullable().optional(), title: z.string().trim().min(1).max(200), placeId: z.string().uuid().nullable().optional(), startsAt: z.string().datetime({ offset: true }).nullable().optional(), endsAt: z.string().datetime({ offset: true }).nullable().optional(), notes: z.string().trim().max(5000).nullable().optional(), status: z.enum(["idea", "planned", "done"]), sortOrder: z.number().int() })).handler(async ({ context, input }) => {
      const [current] = await context.db.select({ item: itineraryItems }).from(itineraryItems).innerJoin(tripMembers, eq(itineraryItems.tripId, tripMembers.tripId)).where(and(eq(itineraryItems.id, input.id), eq(tripMembers.userId, context.session!.user.id), isNull(itineraryItems.deletedAt), isNull(tripMembers.removedAt))).limit(1);
      if (!current) throw new ORPCError("NOT_FOUND");
      const [item] = await context.db.update(itineraryItems).set({ day: input.day, title: input.title, placeId: input.placeId ?? null, startsAt: input.startsAt ? new Date(input.startsAt) : null, endsAt: input.endsAt ? new Date(input.endsAt) : null, notes: input.notes ?? null, status: input.status, sortOrder: input.sortOrder }).where(eq(itineraryItems.id, input.id)).returning();
      return item;
    }),
    archive: protectedProcedure.input(z.object({ id: z.string().uuid() })).handler(async ({ context, input }) => {
      const [current] = await context.db.select({ item: itineraryItems }).from(itineraryItems).innerJoin(tripMembers, eq(itineraryItems.tripId, tripMembers.tripId)).where(and(eq(itineraryItems.id, input.id), eq(tripMembers.userId, context.session!.user.id), isNull(itineraryItems.deletedAt), isNull(tripMembers.removedAt))).limit(1);
      if (!current) throw new ORPCError("NOT_FOUND");
      const [item] = await context.db.update(itineraryItems).set({ deletedAt: new Date() }).where(eq(itineraryItems.id, input.id)).returning();
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
};
export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
