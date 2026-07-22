import type { AppRouterClient } from "@waymark/api/routers/index";
import type { TLShape } from "tldraw";
import { serverIdForShape, shapeToPayload } from "./canvas-mapper";
import type { CanvasRecord } from "./canvas-types";

type Client = AppRouterClient;

async function persistImageAsset(tripId: string, shape: TLShape) {
  if (shape.type !== "image" || typeof shape.props !== "object" || shape.props === null) return shape;
  const props = shape.props as typeof shape.props & { src?: unknown; name?: unknown };
  if (typeof props.src !== "string" || !props.src.startsWith("data:")) return shape;

  const response = await fetch(props.src);
  if (!response.ok) throw new Error("The pasted image could not be read.");
  const blob = await response.blob();
  const bitmap = await createImageBitmap(blob);
  const maxDimension = 1600;
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const optimized = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => value ? resolve(value) : reject(new Error("The pasted image could not be encoded.")), "image/webp", 0.82);
  });
  const form = new FormData();
  form.append("file", new File([optimized], typeof props.name === "string" ? props.name : "pasted-image.webp", { type: "image/webp" }));
  const upload = await fetch(`/api/trips/${tripId}/assets`, { method: "POST", body: form });
  if (!upload.ok) throw new Error("The pasted image could not be uploaded.");
  const asset = await upload.json() as { id: string; mimeType: string; byteSize: number };

  return {
    ...shape,
    props: { ...props, src: `/api/assets/${asset.id}`, w: canvas.width, h: canvas.height, mimeType: asset.mimeType, fileSize: asset.byteSize },
    meta: { ...shape.meta, waymarkAssetId: asset.id },
  } as TLShape;
}

export async function loadCanvas(client: Client, tripId: string) {
  return (await client.canvas.list({ tripId })) as CanvasRecord[];
}

export async function createCanvasObject(client: Client, tripId: string, shape: TLShape) {
  const persistedShape = await persistImageAsset(tripId, shape);
  return { object: await client.canvas.create({ tripId, ...shapeToPayload(persistedShape) }), shape: persistedShape };
}

export async function updateCanvasObject(client: Client, shape: TLShape, version: number) {
  const id = serverIdForShape(shape);
  if (!id) throw new Error("Cannot update a canvas shape before it has been saved.");
  return client.canvas.update({ id, version, ...shapeToPayload(shape) });
}

export async function removeCanvasObject(client: Client, shape: TLShape, version: number) {
  const id = serverIdForShape(shape);
  if (!id) return;
  await client.canvas.remove({ id, version });
}
