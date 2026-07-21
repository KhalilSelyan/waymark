import type { RouterClient } from "@orpc/server";
import { z } from "zod";
import { and, desc, eq, isNull } from "drizzle-orm";
import { trips, tripMembers } from "@waymark/db/schema";

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
};
export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
