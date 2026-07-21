import type { RouterClient } from "@orpc/server";
import { z } from "zod";
import { and, desc, eq, isNull } from "drizzle-orm";
import { canvasObjects, trips, tripMembers } from "@waymark/db/schema";
import { ORPCError } from "@orpc/server";

import { protectedProcedure, publicProcedure } from "../index";

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
};
export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
