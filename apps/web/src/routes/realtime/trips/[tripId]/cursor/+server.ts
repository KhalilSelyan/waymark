import { requireTripMember } from "$lib/server/trip-access";
import { publishRealtimeEvent } from "@waymark/api/realtime-hub";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ request, cookies, params }) => {
  const access = await requireTripMember({ request, cookies }, params.tripId);
  const body = await request.json().catch(() => null) as { x?: unknown; y?: unknown } | null;
  if (typeof body?.x !== "number" || typeof body.y !== "number" || !Number.isFinite(body.x) || !Number.isFinite(body.y)) return new Response(null, { status: 400 });
  publishRealtimeEvent({ tripId: params.tripId, actorMemberId: access.member.id, type: "presence.cursor.updated", payload: { x: body.x, y: body.y } });
  return new Response(null, { status: 204 });
};
