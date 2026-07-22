import { error, json } from "@sveltejs/kit";
import { chromium } from "@playwright/test";
import { db } from "@waymark/db";
import { assets, canvasObjects } from "@waymark/db/schema";
import { requireTripMember } from "$lib/server/trip-access";
import { enforceRateLimit } from "$lib/server/rate-limit";
import { putAsset, removeAsset } from "$lib/server/asset-storage";
import { resolveSafeUrl } from "@waymark/api/url-safety";
import { randomUUID } from "node:crypto";
import type { RequestHandler } from "./$types";

const maxResponseBytes = 15 * 1024 * 1024;

export const POST: RequestHandler = async ({ request, cookies, params }) => {
  const access = await requireTripMember({ request, cookies }, params.tripId);
  if (!enforceRateLimit(`capture:${access.member.id}:${params.tripId}`, 10, 60 * 60 * 1000)) throw error(429, "Capture rate limit reached.");
  const body = await request.json().catch(() => null) as { url?: unknown } | null;
  if (typeof body?.url !== "string") throw error(400, "A webpage URL is required.");
  try { await resolveSafeUrl(body.url); } catch { throw error(400, "This webpage URL is not allowed."); }

  const browser = await chromium.launch({ headless: true });
  let storageKey = "";
  try {
    const context = await browser.newContext({ javaScriptEnabled: true, serviceWorkers: "block", viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    await page.route("**/*", async (route) => {
      try { await resolveSafeUrl(route.request().url()); await route.continue(); }
      catch { await route.abort("blockedbyclient"); }
    });
    let responseBytes = 0;
    page.on("response", (response) => { responseBytes += Number(response.headers()["content-length"] ?? 0); });
    const response = await page.goto(body.url, { waitUntil: "domcontentloaded", timeout: 15_000 });
    if (!response || !response.ok() || responseBytes > maxResponseBytes) throw new Error("Capture response rejected.");
    await page.waitForTimeout(500);
    const screenshot = await page.screenshot({ type: "png", fullPage: false });
    if (screenshot.byteLength > maxResponseBytes) throw new Error("Screenshot too large.");
    const id = randomUUID();
    storageKey = `trips/${params.tripId}/assets/${id}`;
    await putAsset(storageKey, screenshot);
    const title = await page.title().catch(() => null);
    const [asset] = await db.insert(assets).values({ id, tripId: params.tripId, uploadedByMemberId: access.member.id, type: "webpage_screenshot", storageKey, sourceUrl: body.url, title, mimeType: "image/png", width: 1280, height: 900, byteSize: screenshot.byteLength }).returning();
    if (!asset) throw new Error("Asset metadata was not created.");
    const shapeId = randomUUID();
    const shape = { id: `shape:${shapeId}`, type: "image", x: 0, y: 0, rotation: 0, index: "a1", parentId: "page:page", isLocked: false, opacity: 1, meta: { assetId: asset.id }, props: { w: 640, h: 450, assetId: `asset:${asset.id}`, playing: false, url: `/api/assets/${asset.id}`, crop: { x: 0, y: 0, w: 1, h: 1 }, flipX: false, flipY: false, altText: title ?? body.url } };
    const [object] = await db.insert(canvasObjects).values({ tripId: params.tripId, createdByMemberId: access.member.id, type: "image", x: 0, y: 0, width: 640, height: 450, rotation: 0, zIndex: 0, data: { shape } }).returning({ id: canvasObjects.id });
    return json({ asset, canvasObjectId: object?.id, shape }, { status: 201 });
  } catch (caught) {
    if (storageKey) await removeAsset(storageKey);
    throw error(502, caught instanceof Error ? "Webpage capture failed." : "Webpage capture failed.");
  } finally { await browser.close(); }
};
