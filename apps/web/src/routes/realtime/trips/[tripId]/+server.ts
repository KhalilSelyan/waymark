import { requireTripMember } from "$lib/server/trip-access";
import { subscribeRealtime } from "@waymark/api/realtime-hub";
import { canvasObjects } from "@waymark/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@waymark/db";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ request, cookies, params }) => {
  await requireTripMember({ request, cookies }, params.tripId);
  const objects = await db.select().from(canvasObjects).where(and(eq(canvasObjects.tripId, params.tripId), isNull(canvasObjects.deletedAt)));
  const encoder = new TextEncoder();
  let close = () => {};
  const stream = new ReadableStream({
    start(controller) {
      const send = (event: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      send({ type: "snapshot", tripId: params.tripId, objects });
      const unsubscribe = subscribeRealtime(params.tripId, send);
      const heartbeat = setInterval(() => controller.enqueue(encoder.encode(": heartbeat\n\n")), 15_000);
      close = () => { clearInterval(heartbeat); unsubscribe(); controller.close(); };
      request.signal.addEventListener("abort", close, { once: true });
    },
    cancel() { close(); },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" } });
};
