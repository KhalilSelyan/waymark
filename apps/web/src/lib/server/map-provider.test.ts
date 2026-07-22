import { describe, expect, it, vi, afterEach } from "vitest";
import { getMapProvider } from "./map-provider";

describe("map provider", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("normalizes a successful reverse-geocode response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ name: "Tower", display_name: "Tower, London" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(getMapProvider().reverseGeocode("51.5", "-0.1", new AbortController().signal)).resolves.toEqual({ name: "Tower", address: "Tower, London" });
    expect(fetchMock.mock.calls[0]?.[1]).toEqual(expect.objectContaining({ headers: expect.objectContaining({ "user-agent": expect.stringContaining("Waymark") }) }));
  });

  it("returns null for provider failures", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 503 })));
    await expect(getMapProvider().reverseGeocode("0", "0", new AbortController().signal)).resolves.toBeNull();
  });
});
