import { error } from "@sveltejs/kit";
import { db } from "@waymark/db";
import { assets } from "@waymark/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { getAsset } from "$lib/server/asset-storage";
import { requireTripMember } from "$lib/server/trip-access";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ request, cookies, params }) => {
  const [asset] = await db.select().from(assets).where(eq(assets.id, params.assetId)).limit(1);
  if (!asset) throw error(404, "Asset not found.");
  await requireTripMember({ request, cookies }, asset.tripId);
  try { return new Response(await getAsset(asset.storageKey), { headers: { "content-type": asset.mimeType, "cache-control": "private, max-age=300" } }); }
  catch { throw error(404, "Asset content not found."); }
};
