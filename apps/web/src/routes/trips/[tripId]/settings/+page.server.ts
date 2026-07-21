import { error, fail, redirect } from "@sveltejs/kit";
import { auth } from "@waymark/auth";
import { db } from "@waymark/db";
import { trips, tripMembers } from "@waymark/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { tripFormSchema } from "$lib/trips";
import type { Actions, PageServerLoad } from "./$types";

async function getOwnerTrip(request: Request, tripId: string) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) throw redirect(303, "/login");
  const [result] = await db
    .select({ trip: trips, role: tripMembers.role })
    .from(tripMembers)
    .innerJoin(trips, eq(tripMembers.tripId, trips.id))
    .where(and(eq(tripMembers.tripId, tripId), eq(tripMembers.userId, session.user.id), isNull(trips.deletedAt)))
    .limit(1);
  if (!result) throw error(404, "Trip not found");
  if (result.role !== "owner") throw error(403, "Only the trip owner can edit settings");
  return { session, trip: result.trip };
}

export const load: PageServerLoad = async ({ request, params }) => getOwnerTrip(request, params.tripId);

export const actions: Actions = {
  update: async ({ request, params }) => {
    await getOwnerTrip(request, params.tripId);
    const values = Object.fromEntries(await request.formData());
    const parsed = tripFormSchema.safeParse(values);
    if (!parsed.success) return fail(400, { values, errors: parsed.error.flatten().fieldErrors });

    await db.update(trips).set({
      name: parsed.data.name,
      destination: parsed.data.destination || null,
      startsOn: parsed.data.startsOn || null,
      endsOn: parsed.data.endsOn || null,
      timezone: parsed.data.timezone,
      currency: parsed.data.currency,
    }).where(eq(trips.id, params.tripId));
    return { success: true };
  },
  delete: async ({ request, params }) => {
    await getOwnerTrip(request, params.tripId);
    await db.update(trips).set({ deletedAt: new Date() }).where(eq(trips.id, params.tripId));
    throw redirect(303, "/dashboard");
  },
};
