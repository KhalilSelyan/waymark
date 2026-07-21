import type { TLShape } from "tldraw";

export type CanvasRecord = {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number | null;
  height: number | null;
  rotation: number;
  zIndex: number;
  data: Record<string, unknown>;
  version: number;
};

export type PersistedShape = TLShape & {
  meta: TLShape["meta"] & { waymarkObjectId?: string };
};
