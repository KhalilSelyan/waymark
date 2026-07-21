import { fail, redirect } from "@sveltejs/kit";
import { auth } from "@waymark/auth";
import { db } from "@waymark/db";
import { trips, tripMembers } from "@waymark/db/schema";
import { tripFormSchema } from "$lib/trips";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) throw redirect(303, "/login");
  return { timezone: Intl.DateTimeFormat().resolvedOptions().timeZone };
};

export const actions: Actions = {
  default: async ({ request }) => {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) throw redirect(303, "/login");

    const data = Object.fromEntries(await request.formData());
    const parsed = tripFormSchema.safeParse(data);
    if (!parsed.success) return fail(400, { values: data, errors: parsed.error.flatten().fieldErrors });

    const trip = await db.transaction(async (tx) => {
      const [created] = await tx.insert(trips).values({
        ownerUserId: session.user.id,
        name: parsed.data.name,
        destination: parsed.data.destination || null,
        startsOn: parsed.data.startsOn || null,
        endsOn: parsed.data.endsOn || null,
        timezone: parsed.data.timezone,
        currency: parsed.data.currency,
      }).returning();

      await tx.insert(tripMembers).values({
        tripId: created.id,
        userId: session.user.id,
        displayName: session.user.name,
        role: "owner",
      });

      return created;
    });

    throw redirect(303, `/trips/${trip.id}/settings`);
  },
};
