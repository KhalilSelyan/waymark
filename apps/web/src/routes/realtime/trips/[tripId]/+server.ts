import { requireTripMember } from "$lib/server/trip-access";
import { getEventsSince, getPresence, getStreamVersion, joinPresence, leavePresence, publishRealtimeEvent, subscribeRealtime, touchPresence } from "@waymark/api/realtime-hub";
import { canvasObjects } from "@waymark/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@waymark/db";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ request, cookies, params }) => {
  const access = await requireTripMember({ request, cookies }, params.tripId);
  const lastEventId = Number(request.headers.get("last-event-id") ?? 0);
  const objects = await db.select().from(canvasObjects).where(and(eq(canvasObjects.tripId, params.tripId), isNull(canvasObjects.deletedAt)));
  const encoder = new TextEncoder();
  let close = () => {};
  let closed = false;
  const stream = new ReadableStream({
    start(controller) {
       const send = (event: unknown) => {
         const id = typeof event === "object" && event !== null && "streamVersion" in event ? `id: ${String(event.streamVersion)}\n` : "";
         controller.enqueue(encoder.encode(`${id}data: ${JSON.stringify(event)}\n\n`));
       };
       const presenceId = joinPresence(params.tripId, access.member.id, access.member.displayName);
       const missed = getEventsSince(params.tripId, lastEventId);
       const canReplay = lastEventId > 0 && missed[0]?.streamVersion === lastEventId + 1;
       send({ type: "snapshot", tripId: params.tripId, streamVersion: canReplay ? lastEventId : getStreamVersion(params.tripId), ...(canReplay ? {} : { objects }), presence: getPresence(params.tripId) });
       if (canReplay) for (const event of missed) send(event);
      publishRealtimeEvent({ tripId: params.tripId, actorMemberId: access.member.id, type: "presence.joined", payload: { displayName: access.member.displayName, color: getPresence(params.tripId).find((member) => member.memberId === access.member.id)?.color ?? "" } });
      const unsubscribe = subscribeRealtime(params.tripId, send);
       const heartbeat = setInterval(() => { touchPresence(params.tripId, presenceId); controller.enqueue(encoder.encode(": heartbeat\n\n")); }, 15_000);
       close = () => { if (closed) return; closed = true; clearInterval(heartbeat); unsubscribe(); leavePresence(params.tripId, presenceId); publishRealtimeEvent({ tripId: params.tripId, actorMemberId: access.member.id, type: "presence.left", payload: { reason: "disconnect" } }); controller.close(); };
      request.signal.addEventListener("abort", close, { once: true });
    },
    cancel() { close(); },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" } });
};
