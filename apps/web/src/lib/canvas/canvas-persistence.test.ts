import { describe, expect, it, vi } from "vitest";
import { createCanvasObject, loadCanvas, removeCanvasObject, updateCanvasObject } from "./canvas-persistence";

const shape = { id: "shape:one", type: "note", x: 10, y: 20, rotation: 0, index: "a1", parentId: "page:page", isLocked: false, opacity: 1, meta: { waymarkObjectId: "object-1" }, props: { text: "Idea" } } as any;

function client(): any {
  return { canvas: { list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() } };
}

describe("canvas persistence", () => {
  it("loads objects for a trip", async () => {
    const api = client();
    api.canvas.list.mockResolvedValue([{ id: "object-1" }]);
    await expect(loadCanvas(api, "trip-1")).resolves.toEqual([{ id: "object-1" }]);
    expect(api.canvas.list).toHaveBeenCalledWith({ tripId: "trip-1" });
  });

  it("creates a browser-independent shape", async () => {
    const api = client();
    api.canvas.create.mockResolvedValue({ id: "object-1", version: 1 });
    const result = await createCanvasObject(api, "trip-1", shape);
    expect(api.canvas.create).toHaveBeenCalledWith(expect.objectContaining({ tripId: "trip-1", type: "note", x: 10, y: 20 }));
    expect(result.object.id).toBe("object-1");
  });

  it("forwards versions for update and remove", async () => {
    const api = client();
    api.canvas.update.mockResolvedValue({ version: 3 });
    await updateCanvasObject(api, shape, 2);
    await removeCanvasObject(api, shape, 3);
    expect(api.canvas.update).toHaveBeenCalledWith(expect.objectContaining({ id: "object-1", version: 2 }));
    expect(api.canvas.remove).toHaveBeenCalledWith({ id: "object-1", version: 3 });
  });

  it("rejects updates for unsaved shapes", async () => {
    const api = client();
    await expect(updateCanvasObject(api, { ...shape, meta: {} }, 1)).rejects.toThrow("before it has been saved");
  });
});
