import { fail, redirect } from "@sveltejs/kit";
import { db } from "@waymark/db";
import { tripGuests, tripMembers, trips, user, userProfiles } from "@waymark/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { requireTripMember, requireTripOwner } from "$lib/server/trip-access";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ request, params, cookies }) => {
  const access = await requireTripMember({ request, cookies }, params.tripId);
  const members = await db.select({ member: tripMembers, guest: tripGuests, user, profile: userProfiles }).from(tripMembers).leftJoin(tripGuests, eq(tripMembers.guestId, tripGuests.id)).leftJoin(user, eq(tripMembers.userId, user.id)).leftJoin(userProfiles, eq(tripMembers.userId, userProfiles.userId)).where(and(eq(tripMembers.tripId, params.tripId), isNull(tripMembers.removedAt)));
  return { trip: access.trip, member: access.member, members };
};

export const actions: Actions = {
  remove: async ({ request, params, cookies }) => {
    await requireTripOwner({ request, cookies }, params.tripId);
    const memberId = String((await request.formData()).get("memberId"));
    await db.update(tripMembers).set({ removedAt: new Date() }).where(and(eq(tripMembers.id, memberId), eq(tripMembers.tripId, params.tripId), eq(tripMembers.role, "member")));
    return { success: true };
  },
  leave: async ({ request, params, cookies }) => {
    const access = await requireTripMember({ request, cookies }, params.tripId);
    if (access.isOwner) return fail(400, { error: "The trip owner cannot leave the trip." });
    await db.update(tripMembers).set({ removedAt: new Date() }).where(eq(tripMembers.id, access.member.id));
    throw redirect(303, "/dashboard");
  },
};
