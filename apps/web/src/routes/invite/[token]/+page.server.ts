import { fail, redirect } from "@sveltejs/kit";
import { db } from "@waymark/db";
import { tripInvites, trips, tripGuests, tripMembers } from "@waymark/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { createHash, randomBytes } from "node:crypto";
import { hashInviteToken } from "$lib/invites";
import { z } from "zod";
import type { Actions, PageServerLoad } from "./$types";
import { enforceRateLimit } from "$lib/server/rate-limit";

const usernameSchema = z.string().trim().toLowerCase().regex(/^[a-z0-9_-]+$/).min(3).max(24);

export const load: PageServerLoad = async ({ params }) => {
  const [invite] = await db.select({ trip: trips }).from(tripInvites).innerJoin(trips, eq(tripInvites.tripId, trips.id)).where(and(eq(tripInvites.tokenHash, hashInviteToken(params.token)), isNull(tripInvites.revokedAt), isNull(trips.deletedAt))).limit(1);
  if (!invite) throw redirect(303, "/");
  return { trip: invite.trip };
};

export const actions: Actions = {
  default: async ({ params, request, cookies, url }) => {
    const clientKey = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    if (!enforceRateLimit(`invite-join:${clientKey}`, 10, 15 * 60 * 1000)) return fail(429, { error: "Too many join attempts. Try again later." });
    const [invite] = await db.select({ trip: trips, invite: tripInvites }).from(tripInvites).innerJoin(trips, eq(tripInvites.tripId, trips.id)).where(and(eq(tripInvites.tokenHash, hashInviteToken(params.token)), isNull(tripInvites.revokedAt), isNull(trips.deletedAt))).limit(1);
    if (!invite) return fail(404, { error: "This invite is no longer available." });
    const data = Object.fromEntries(await request.formData());
    const parsed = usernameSchema.safeParse(data.username);
    if (!parsed.success) return fail(400, { error: parsed.error.issues[0]?.message });

    const existingGuestToken = cookies.get(`waymark_guest_${invite.trip.id}`);
    if (existingGuestToken) {
      const existingHash = createHash("sha256").update(existingGuestToken).digest("hex");
      const [existingGuest] = await db.select({ id: tripGuests.id }).from(tripGuests).where(and(eq(tripGuests.tripId, invite.trip.id), eq(tripGuests.guestTokenHash, existingHash))).limit(1);
      if (existingGuest) throw redirect(303, `/trips/${invite.trip.id}`);
    }

    const rawGuestToken = randomBytes(32).toString("base64url");
    const [guest] = await db.insert(tripGuests).values({ tripId: invite.trip.id, username: parsed.data, displayName: String(data.displayName || parsed.data), guestTokenHash: createHash("sha256").update(rawGuestToken).digest("hex") }).returning();
    await db.insert(tripMembers).values({ tripId: invite.trip.id, guestId: guest.id, displayName: guest.displayName, role: "member" });
    cookies.set(`waymark_guest_${invite.trip.id}`, rawGuestToken, { path: "/", httpOnly: true, sameSite: "lax", secure: url.protocol === "https:", maxAge: 60 * 60 * 24 * 365 });
    throw redirect(303, `/trips/${invite.trip.id}`);
  },
};
