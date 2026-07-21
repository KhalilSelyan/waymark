import type { AppRouterClient } from "@waymark/api/routers/index";
import type { TLShape } from "tldraw";
import { serverIdForShape, shapeToPayload } from "./canvas-mapper";
import type { CanvasRecord } from "./canvas-types";

type Client = AppRouterClient;

export async function loadCanvas(client: Client, tripId: string) {
  return (await client.canvas.list({ tripId })) as CanvasRecord[];
}

export async function createCanvasObject(client: Client, tripId: string, shape: TLShape) {
  return client.canvas.create({ tripId, ...shapeToPayload(shape) });
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
