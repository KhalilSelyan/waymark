import { error } from "@sveltejs/kit";
import { db } from "@waymark/db";
import { activityEvents, assets, canvasObjects } from "@waymark/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { getAsset } from "$lib/server/asset-storage";
import { removeAsset } from "$lib/server/asset-storage";
import { requireTripMember } from "$lib/server/trip-access";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ request, cookies, params }) => {
  const [asset] = await db.select().from(assets).where(eq(assets.id, params.assetId)).limit(1);
  if (!asset) throw error(404, "Asset not found.");
  await requireTripMember({ request, cookies }, asset.tripId);
  try { return new Response(await getAsset(asset.storageKey), { headers: { "content-type": asset.mimeType, "cache-control": "private, max-age=300" } }); }
  catch { throw error(404, "Asset content not found."); }
};

export const DELETE: RequestHandler = async ({ request, cookies, params }) => {
  const [asset] = await db.select().from(assets).where(eq(assets.id, params.assetId)).limit(1);
  if (!asset) throw error(404, "Asset not found.");
  const access = await requireTripMember({ request, cookies }, asset.tripId);
  await removeAsset(asset.storageKey);
  await db.transaction(async (tx) => {
    const objects = await tx.select({ id: canvasObjects.id }).from(canvasObjects).where(and(eq(canvasObjects.tripId, asset.tripId), isNull(canvasObjects.deletedAt)));
    const referenced = objects.filter(({ id }) => id).map(({ id }) => id);
    for (const objectId of referenced) {
      const [object] = await tx.select({ data: canvasObjects.data }).from(canvasObjects).where(eq(canvasObjects.id, objectId)).limit(1);
      if (!object || !JSON.stringify(object.data).includes(asset.id)) continue;
      await tx.delete(canvasObjects).where(eq(canvasObjects.id, objectId));
      await tx.insert(activityEvents).values({ tripId: asset.tripId, actorMemberId: access.member.id, eventType: "canvas.object.deleted", payload: { objectId, reason: "asset.deleted" }, version: 1 });
    }
    await tx.delete(assets).where(eq(assets.id, asset.id));
  });
  return new Response(null, { status: 204 });
};
