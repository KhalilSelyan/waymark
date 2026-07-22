import { error, json } from "@sveltejs/kit";
import { db } from "@waymark/db";
import { assets } from "@waymark/db/schema";
import { requireTripMember } from "$lib/server/trip-access";
import { putAsset } from "$lib/server/asset-storage";
import { randomUUID } from "node:crypto";
import type { RequestHandler } from "./$types";

const allowed = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const maxBytes = 10 * 1024 * 1024;

export const POST: RequestHandler = async ({ request, cookies, params }) => {
  const access = await requireTripMember({ request, cookies }, params.tripId);
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw error(400, "An image file is required.");
  if (!allowed.has(file.type)) throw error(415, "Unsupported image type.");
  if (file.size <= 0 || file.size > maxBytes) throw error(413, "Image must be between 1 byte and 10 MB.");
  const id = randomUUID();
  const storageKey = `trips/${params.tripId}/assets/${id}`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  await putAsset(storageKey, bytes);
  try {
    const [asset] = await db.insert(assets).values({ id, tripId: params.tripId, uploadedByMemberId: access.member.id, type: "image", storageKey, mimeType: file.type, byteSize: file.size }).returning({ id: assets.id, mimeType: assets.mimeType, byteSize: assets.byteSize });
    if (!asset) throw new Error("Asset metadata was not created.");
    return json(asset, { status: 201 });
  } catch (caught) {
    const { removeAsset } = await import("$lib/server/asset-storage");
    await removeAsset(storageKey);
    throw caught;
  }
};
