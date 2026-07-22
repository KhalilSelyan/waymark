import { error, json } from "@sveltejs/kit";
import { chromium } from "@playwright/test";
import { db } from "@waymark/db";
import { activityEvents, assets, canvasObjects } from "@waymark/db/schema";
import { publishRealtimeEvent } from "@waymark/api/realtime-hub";
import { requireTripMember } from "$lib/server/trip-access";
import { enforceRateLimit } from "$lib/server/rate-limit";
import { putAsset, removeAsset } from "$lib/server/asset-storage";
import { resolveSafeUrl } from "@waymark/api/url-safety";
import { randomUUID } from "node:crypto";
import type { RequestHandler } from "./$types";
import { acceptsCaptureResponse, maxCaptureBytes } from "$lib/server/capture-limits";

const maxResponseBytes = maxCaptureBytes;

export const POST: RequestHandler = async ({ request, cookies, params }) => {
  const access = await requireTripMember({ request, cookies }, params.tripId);
  if (!enforceRateLimit(`capture:${access.member.id}:${params.tripId}`, 10, 60 * 60 * 1000)) throw error(429, "Capture rate limit reached.");
  const body = await request.json().catch(() => null) as { url?: unknown } | null;
  if (typeof body?.url !== "string") throw error(400, "A webpage URL is required.");
  const sourceUrl = body.url;
  try { await resolveSafeUrl(sourceUrl); } catch { throw error(400, "This webpage URL is not allowed."); }

  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  let storageKey = "";
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ javaScriptEnabled: true, serviceWorkers: "block", viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
     await page.route("**/*", async (route) => {
       try {
         await resolveSafeUrl(route.request().url());
         const response = await route.fetch();
         const declaredLength = Number(response.headers()["content-length"] ?? 0);
         if (!acceptsCaptureResponse(responseBytes, declaredLength, 0)) throw new Error("Capture response rejected.");
         const body = await response.body();
         responseBytes += body.byteLength;
         if (!acceptsCaptureResponse(responseBytes - body.byteLength, 0, body.byteLength)) throw new Error("Capture response rejected.");
         await route.fulfill({ response, body });
       }
       catch { await route.abort("blockedbyclient"); }
     });
     let responseBytes = 0;
     const response = await page.goto(sourceUrl, { waitUntil: "domcontentloaded", timeout: 15_000 });
    if (!response || !response.ok() || responseBytes > maxResponseBytes) throw new Error("Capture response rejected.");
    await page.waitForLoadState("load", { timeout: 10_000 }).catch(() => undefined);
    await page.waitForLoadState("networkidle", { timeout: 3_000 }).catch(() => undefined);
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.race([
        Promise.all([...document.images].map((image) => image.complete ? image.decode().catch(() => undefined) : new Promise<void>((resolve) => { image.addEventListener("load", () => resolve(), { once: true }); image.addEventListener("error", () => resolve(), { once: true }); }))),
        new Promise<void>((resolve) => setTimeout(resolve, 3_000)),
      ]);
    }, undefined);
    await page.waitForTimeout(350);
    const screenshot = await page.screenshot({ type: "jpeg", quality: 82, fullPage: false });
    if (screenshot.byteLength > maxResponseBytes) throw new Error("Screenshot too large.");
    const id = randomUUID();
    storageKey = `trips/${params.tripId}/assets/${id}`;
    await putAsset(storageKey, screenshot);
    const title = await page.title().catch(() => null);
     const result = await db.transaction(async (tx) => {
       const [asset] = await tx.insert(assets).values({ tripId: params.tripId, uploadedByMemberId: access.member.id, type: "webpage_screenshot", storageKey, sourceUrl, title, mimeType: "image/jpeg", width: 1280, height: 900, byteSize: screenshot.byteLength }).returning();
       if (!asset) throw new Error("Asset metadata was not created.");
       const shape = { id: `shape:${randomUUID()}`, type: "webpage-card", x: 0, y: 0, rotation: 0, index: "a1", parentId: "page:page", isLocked: false, opacity: 1, meta: { assetId: asset.id, sourceUrl }, props: { w: 420, h: 430, title: title ?? "Captured webpage", url: sourceUrl, screenshotUrl: `/api/assets/${asset.id}` } };
       const [object] = await tx.insert(canvasObjects).values({ tripId: params.tripId, createdByMemberId: access.member.id, type: "webpage_screenshot", x: 0, y: 0, width: 420, height: 430, rotation: 0, zIndex: 0, data: { shape, asset: { id: asset.id, mimeType: asset.mimeType, width: asset.width, height: asset.height, name: asset.title } } }).returning({ id: canvasObjects.id });
       if (!object) throw new Error("Canvas object was not created.");
       await tx.insert(activityEvents).values({ tripId: params.tripId, actorMemberId: access.member.id, eventType: "canvas.object.created", payload: { objectId: object.id, objectType: "webpage_screenshot" }, version: 1 });
       return { asset, object, shape };
     });
     const { asset, object, shape } = result;
     publishRealtimeEvent({ tripId: params.tripId, actorMemberId: access.member.id, type: "canvas.object.created", payload: { objectId: object.id, objectVersion: 1, shapeType: "webpage_screenshot", data: { ...shape, meta: { ...shape.meta, waymarkObjectId: object.id } } } });
     return json({ asset, canvasObjectId: object?.id, shapes: [object ? { ...shape, meta: { ...shape.meta, waymarkObjectId: object.id } } : shape] }, { status: 201 });
  } catch (caught) {
    if (storageKey) await removeAsset(storageKey);
    console.error("Webpage capture failed", caught);
    throw error(502, caught instanceof Error ? "Webpage capture failed." : "Webpage capture failed.");
  } finally { await browser?.close(); }
};
