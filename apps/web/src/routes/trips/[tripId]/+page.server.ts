import { error, redirect } from "@sveltejs/kit";
import { db } from "@waymark/db";
import { trips, tripMembers, tripGuests } from "@waymark/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { createHash } from "node:crypto";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals, params, cookies }) => {
  const guestToken = cookies.get(`waymark_guest_${params.tripId}`);
  const guestHash = guestToken ? createHash("sha256").update(guestToken).digest("hex") : null;
  const [result] = await db.select({ trip: trips }).from(tripMembers).innerJoin(trips, eq(tripMembers.tripId, trips.id)).leftJoin(tripGuests, eq(tripMembers.guestId, tripGuests.id)).where(and(eq(tripMembers.tripId, params.tripId), locals.user ? eq(tripMembers.userId, locals.user.id) : guestHash ? eq(tripGuests.guestTokenHash, guestHash) : eq(tripMembers.tripId, "00000000-0000-0000-0000-000000000000"), isNull(trips.deletedAt))).limit(1);
  if (!result) throw error(404, "Trip not found");
  return result;
};
