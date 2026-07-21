import { requireTripMember } from "$lib/server/trip-access";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ request, params, cookies }) => {
  const access = await requireTripMember({ request, cookies }, params.tripId);
  return { trip: access.trip, member: access.member };
};
