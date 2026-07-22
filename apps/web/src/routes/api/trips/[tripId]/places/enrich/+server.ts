import { error, json } from "@sveltejs/kit";
import { requireTripMember } from "$lib/server/trip-access";
import { enforceRateLimit } from "$lib/server/rate-limit";
import { parseMapCoordinates } from "@waymark/api/map-enrichment";
import { getMapProvider } from "$lib/server/map-provider";
import type { RequestHandler } from "./$types";

const cache = new Map<string, { expiresAt: number; value: Record<string, unknown> }>();

function cacheKey(value: string) {
  try {
    const url = new URL(value);
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) if (key.toLowerCase().startsWith("utm_")) url.searchParams.delete(key);
    url.hostname = url.hostname.toLowerCase();
    return url.toString();
  } catch { return value.trim(); }
}

export const POST: RequestHandler = async ({ request, cookies, params }) => {
  const access = await requireTripMember({ request, cookies }, params.tripId);
  if (!enforceRateLimit(`enrich:${access.member.id}:${params.tripId}`, 30, 60 * 60 * 1000)) throw error(429, "Enrichment rate limit reached.");
  const body = await request.json().catch(() => null) as { url?: unknown } | null;
  if (typeof body?.url !== "string") throw error(400, "A map URL is required.");
  let url: URL;
  try { url = new URL(body.url); } catch { throw error(400, "Invalid URL."); }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw error(400, "Only HTTP and HTTPS URLs are allowed.");
  const coordinates = parseMapCoordinates(body.url);
  if (!coordinates) return json({ latitude: null, longitude: null });
  const key = cacheKey(body.url);
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return json(cached.value);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);
  try {
    const data = await getMapProvider().reverseGeocode(coordinates.latitude, coordinates.longitude, controller.signal);
    const value = { ...coordinates, name: data?.name, address: data?.address };
    cache.set(key, { expiresAt: Date.now() + 10 * 60 * 1000, value });
    return json(value);
  } catch { return json({ ...coordinates }); }
  finally { clearTimeout(timeout); }
};
