import { requireTripMember } from "$lib/server/trip-access";
import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = async ({ request, cookies, params }) => {
  const access = await requireTripMember({ request, cookies }, params.tripId);
  return { trip: access.trip, member: access.member, isOwner: access.isOwner };
};
