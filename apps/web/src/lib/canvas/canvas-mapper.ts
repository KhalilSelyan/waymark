import type { TLAsset, TLShape } from "tldraw";
import type { CanvasRecord, PersistedShape } from "./canvas-types";

export function recordToShape(record: CanvasRecord): TLShape {
  const shape = record.data.shape;
  if (!shape || typeof shape !== "object") {
    throw new Error(`Canvas object ${record.id} has invalid shape data.`);
  }

  const persisted = structuredClone(shape) as PersistedShape;
  if (persisted.type === "image" && persisted.props && typeof persisted.props === "object") {
    const props = persisted.props as unknown as Record<string, unknown>;
    const crop = props.crop;
    if (!crop || typeof crop !== "object" || !("topLeft" in crop) || !("bottomRight" in crop)) {
      props.crop = { topLeft: { x: 0, y: 0 }, bottomRight: { x: 1, y: 1 } };
    }
  }
  persisted.meta = { ...persisted.meta, waymarkObjectId: record.id };
  return persisted;
}

export function recordToAsset(record: CanvasRecord): TLAsset | null {
  if (record.type !== "image") return null;
  const asset = record.data.asset;
  const shape = record.data.shape;
  const shapeMeta = shape && typeof shape === "object" && "meta" in shape && shape.meta && typeof shape.meta === "object" ? shape.meta as { assetId?: unknown } : null;
  const value = asset && typeof asset === "object" ? asset as { id?: unknown; mimeType?: unknown; width?: unknown; height?: unknown; name?: unknown } : {};
  const assetId = typeof value.id === "string" ? value.id : typeof shapeMeta?.assetId === "string" ? shapeMeta.assetId.replace(/^asset:/, "") : null;
  if (!assetId) return null;
  return {
    id: `asset:${assetId}` as TLAsset["id"],
    typeName: "asset",
    type: "image",
    props: { name: typeof value.name === "string" ? value.name : "Webpage screenshot", src: `/api/assets/${assetId}`, w: Number(value.width) || 640, h: Number(value.height) || 450, mimeType: typeof value.mimeType === "string" ? value.mimeType : "image/png", isAnimated: false },
    meta: {},
  } as TLAsset;
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
