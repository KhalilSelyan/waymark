import { requireTripMember } from "$lib/server/trip-access";
import { getPresence, joinPresence, leavePresence, publishRealtimeEvent, subscribeRealtime, touchPresence } from "@waymark/api/realtime-hub";
import { canvasObjects } from "@waymark/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@waymark/db";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ request, cookies, params }) => {
  const access = await requireTripMember({ request, cookies }, params.tripId);
  const objects = await db.select().from(canvasObjects).where(and(eq(canvasObjects.tripId, params.tripId), isNull(canvasObjects.deletedAt)));
  const encoder = new TextEncoder();
  let close = () => {};
  const stream = new ReadableStream({
    start(controller) {
      const send = (event: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      joinPresence(params.tripId, access.member.id, access.member.displayName);
      send({ type: "snapshot", tripId: params.tripId, objects, presence: getPresence(params.tripId) });
      publishRealtimeEvent({ tripId: params.tripId, actorMemberId: access.member.id, type: "presence.joined", payload: { displayName: access.member.displayName, color: getPresence(params.tripId).find((member) => member.memberId === access.member.id)?.color ?? "" } });
      const unsubscribe = subscribeRealtime(params.tripId, send);
      const heartbeat = setInterval(() => { touchPresence(params.tripId, access.member.id); controller.enqueue(encoder.encode(": heartbeat\n\n")); }, 15_000);
      close = () => { clearInterval(heartbeat); unsubscribe(); leavePresence(params.tripId, access.member.id); publishRealtimeEvent({ tripId: params.tripId, actorMemberId: access.member.id, type: "presence.left", payload: { reason: "disconnect" } }); controller.close(); };
      request.signal.addEventListener("abort", close, { once: true });
    },
    cancel() { close(); },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" } });
};
