import { redirect } from "@sveltejs/kit";
import { auth } from "@waymark/auth";
import { db } from "@waymark/db";
import { tripGuests, tripMembers, trips } from "@waymark/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { createHash } from "node:crypto";

export type TripAccess = {
  trip: typeof trips.$inferSelect;
  member: typeof tripMembers.$inferSelect;
  isOwner: boolean;
};

type Cookies = { get: (name: string) => string | undefined };

export async function getTripAccess(request: Request, cookies: Cookies, tripId: string): Promise<TripAccess | null> {
  const session = await auth.api.getSession({ headers: request.headers });
  const guestToken = cookies.get(`waymark_guest_${tripId}`);
  const guestHash = guestToken ? createHash("sha256").update(guestToken).digest("hex") : null;
  if (!session && !guestHash) return null;

  const identity = session ? eq(tripMembers.userId, session.user.id) : eq(tripGuests.guestTokenHash, guestHash!);
  const [result] = await db
    .select({ trip: trips, member: tripMembers })
    .from(tripMembers)
    .innerJoin(trips, eq(tripMembers.tripId, trips.id))
    .leftJoin(tripGuests, eq(tripMembers.guestId, tripGuests.id))
    .where(and(eq(tripMembers.tripId, tripId), identity, isNull(tripMembers.removedAt), isNull(trips.deletedAt)))
    .limit(1);

  if (!result) return null;
  return { ...result, isOwner: result.member.role === "owner" };
}

export async function requireTripMember(event: { request: Request; cookies: Cookies }, tripId: string): Promise<TripAccess> {
  const access = await getTripAccess(event.request, event.cookies, tripId);
  if (!access) throw redirect(303, "/login");
  return access;
}

export async function requireTripOwner(event: { request: Request; cookies: Cookies }, tripId: string): Promise<TripAccess> {
  const access = await requireTripMember(event, tripId);
  if (!access.isOwner) throw redirect(303, `/trips/${tripId}`);
  return access;
}
