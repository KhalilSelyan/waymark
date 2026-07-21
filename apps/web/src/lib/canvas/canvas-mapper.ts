import type { TLShape } from "tldraw";
import type { CanvasRecord, PersistedShape } from "./canvas-types";

export function recordToShape(record: CanvasRecord): TLShape {
  const shape = record.data.shape;
  if (!shape || typeof shape !== "object") {
    throw new Error(`Canvas object ${record.id} has invalid shape data.`);
  }

  const persisted = structuredClone(shape) as PersistedShape;
  persisted.meta = { ...persisted.meta, waymarkObjectId: record.id };
  return persisted;
}

export function shapeToPayload(shape: TLShape) {
  const persisted = structuredClone(shape) as PersistedShape;
  const { x, y } = persisted;
  const bounds = "props" in persisted && "w" in persisted.props && "h" in persisted.props
    ? { width: Number(persisted.props.w), height: Number(persisted.props.h) }
    : { width: null, height: null };

  return {
    type: persisted.type,
    x,
    y,
    width: Number.isFinite(bounds.width) ? bounds.width : null,
    height: Number.isFinite(bounds.height) ? bounds.height : null,
    rotation: persisted.rotation,
    zIndex: 0,
    data: { shape: persisted } as Record<string, unknown>,
  };
}

export function serverIdForShape(shape: TLShape) {
  const id = (shape.meta as { waymarkObjectId?: unknown }).waymarkObjectId;
  return typeof id === "string" ? id : null;
}
