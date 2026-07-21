import { fail, redirect } from "@sveltejs/kit";
import { auth } from "@waymark/auth";
import { db } from "@waymark/db";
import { tripInvites, trips, tripMembers } from "@waymark/db/schema";
import { and, desc, eq, isNull } from "drizzle-orm";
import { createInviteToken, hashInviteToken } from "$lib/invites";
import type { Actions, PageServerLoad } from "./$types";
import { enforceRateLimit } from "$lib/server/rate-limit";

async function requireOwner(request: Request, tripId: string) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) throw redirect(303, "/login");
  const [membership] = await db
    .select({ trip: trips, role: tripMembers.role })
    .from(tripMembers)
    .innerJoin(trips, eq(tripMembers.tripId, trips.id))
    .where(and(eq(tripMembers.tripId, tripId), eq(tripMembers.userId, session.user.id), isNull(trips.deletedAt)))
    .limit(1);
  if (!membership || membership.role !== "owner") throw redirect(303, "/dashboard");
  return session;
}

export const load: PageServerLoad = async ({ request, params }) => {
  await requireOwner(request, params.tripId);
  return {
    invites: await db.select().from(tripInvites).where(eq(tripInvites.tripId, params.tripId)).orderBy(desc(tripInvites.createdAt)),
  };
};

export const actions: Actions = {
  create: async ({ request, params, url }) => {
    const session = await requireOwner(request, params.tripId);
    if (!enforceRateLimit(`invite-create:${session.user.id}:${params.tripId}`, 10, 60 * 60 * 1000)) return fail(429, { error: "Invite creation is temporarily rate-limited." });
    const token = createInviteToken();
    await db.insert(tripInvites).values({ tripId: params.tripId, createdByUserId: session.user.id, tokenHash: hashInviteToken(token) });
    return { inviteUrl: `${url.origin}/invite/${token}` };
  },
  revoke: async ({ request, params }) => {
    await requireOwner(request, params.tripId);
    const formData = await request.formData();
    const inviteId = String(formData.get("inviteId"));
    await db.update(tripInvites).set({ revokedAt: new Date() }).where(and(eq(tripInvites.id, inviteId), eq(tripInvites.tripId, params.tripId)));
    return { success: true };
  },
};
