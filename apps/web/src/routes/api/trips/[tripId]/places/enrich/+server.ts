import { error, json } from "@sveltejs/kit";
import { requireTripMember } from "$lib/server/trip-access";
import { enforceRateLimit } from "$lib/server/rate-limit";
import { parseMapCoordinates } from "@waymark/api/map-enrichment";
import type { RequestHandler } from "./$types";

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
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(coordinates?.latitude ?? "")}&lon=${encodeURIComponent(coordinates?.longitude ?? "")}`, { headers: { "user-agent": "Waymark/1.0 contact@example.invalid" }, signal: controller.signal });
    const data = response.ok ? await response.json() as { display_name?: string; name?: string; address?: Record<string, string> } : null;
    return json({ ...coordinates, name: data?.name, address: data?.display_name });
  } catch { return json({ ...coordinates }); }
  finally { clearTimeout(timeout); }
};
