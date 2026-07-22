import { requireTripMember } from "$lib/server/trip-access";
import { getStreamVersion, publishRealtimeEvent } from "@waymark/api/realtime-hub";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ request, cookies, params }) => {
  const access = await requireTripMember({ request, cookies }, params.tripId);
  const body = await request.json().catch(() => null) as { x?: unknown; y?: unknown; clientMessageId?: unknown } | null;
  const clientMessageId = typeof body?.clientMessageId === "string" ? body.clientMessageId : crypto.randomUUID();
  if (typeof body?.x !== "number" || typeof body.y !== "number" || !Number.isFinite(body.x) || !Number.isFinite(body.y)) return Response.json({ protocolVersion: 1, clientMessageId, accepted: false, streamVersion: getStreamVersion(params.tripId), reason: "invalid" }, { status: 400 });
  const event = publishRealtimeEvent({ tripId: params.tripId, actorMemberId: access.member.id, type: "presence.cursor.updated", clientMessageId, payload: { x: body.x, y: body.y } });
  return Response.json({ protocolVersion: 1, clientMessageId, accepted: true, streamVersion: event.streamVersion });
};
