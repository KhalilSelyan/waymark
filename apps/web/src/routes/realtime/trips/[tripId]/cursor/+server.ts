import { requireTripMember } from "$lib/server/trip-access";
import { getStreamVersion, publishRealtimeEvent } from "@waymark/api/realtime-hub";
import type { RequestHandler } from "./$types";

const acknowledgements = new Map<string, { clientMessageId: string; streamVersion: number }>();

export const POST: RequestHandler = async ({ request, cookies, params }) => {
  const access = await requireTripMember({ request, cookies }, params.tripId);
  const body = await request.json().catch(() => null) as { x?: unknown; y?: unknown; clientMessageId?: unknown } | null;
  const clientMessageId = typeof body?.clientMessageId === "string" ? body.clientMessageId : crypto.randomUUID();
  if (typeof body?.x !== "number" || typeof body.y !== "number" || !Number.isFinite(body.x) || !Number.isFinite(body.y)) return Response.json({ protocolVersion: 1, clientMessageId, accepted: false, streamVersion: getStreamVersion(params.tripId), reason: "invalid" }, { status: 400 });
  const key = `${params.tripId}:${access.member.id}:${clientMessageId}`;
  const previous = acknowledgements.get(key);
  if (previous) return Response.json({ protocolVersion: 1, clientMessageId, accepted: true, streamVersion: previous.streamVersion });
  const event = publishRealtimeEvent({ tripId: params.tripId, actorMemberId: access.member.id, type: "presence.cursor.updated", clientMessageId, payload: { x: body.x, y: body.y } });
  acknowledgements.set(key, { clientMessageId, streamVersion: event.streamVersion });
  if (acknowledgements.size > 10_000) acknowledgements.delete(acknowledgements.keys().next().value!);
  return Response.json({ protocolVersion: 1, clientMessageId, accepted: true, streamVersion: event.streamVersion });
};
