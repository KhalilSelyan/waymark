import { redirect } from "@sveltejs/kit";
import { auth } from "@waymark/auth";
import { db } from "@waymark/db";
import { userProfiles } from "@waymark/db/schema";
import { eq } from "drizzle-orm";
import { and, desc, isNull, eq as equals } from "drizzle-orm";
import { trips, tripMembers } from "@waymark/db/schema";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ request }) => {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) throw redirect(303, "/login");

  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.userId, session.user.id),
  });
  if (!profile) throw redirect(303, "/onboarding/username");

  const tripList = await db
    .select({ trip: trips, role: tripMembers.role })
    .from(tripMembers)
    .innerJoin(trips, equals(tripMembers.tripId, trips.id))
    .where(and(equals(tripMembers.userId, session.user.id), isNull(trips.deletedAt)))
    .orderBy(desc(trips.updatedAt));

  return { profile, trips: tripList };
};
