import { describe, expect, it } from "vitest";
import { parseMapCoordinates } from "./map-enrichment";

describe("parseMapCoordinates", () => {
  it("parses query coordinates", () => expect(parseMapCoordinates("https://maps.google.com/?q=38.7223,-9.1393")).toEqual({ latitude: "38.7223", longitude: "-9.1393" }));
  it("parses query and path variants", () => {
    expect(parseMapCoordinates("https://maps.google.com/?query=51.5074%2C%20-0.1278")).toEqual({ latitude: "51.5074", longitude: "-0.1278" });
    expect(parseMapCoordinates("https://example.com/@35.6762,139.6503,12z")).toEqual({ latitude: "35.6762", longitude: "139.6503" });
    expect(parseMapCoordinates("https://example.com/?q=90.0,-180.0")).toEqual({ latitude: "90", longitude: "-180" });
  });
  it("handles signed and whitespace-separated coordinates", () => expect(parseMapCoordinates("https://example.com/?q=-33.8688, 151.2093")).toEqual({ latitude: "-33.8688", longitude: "151.2093" }));
  it("rejects invalid and absent coordinates", () => { expect(parseMapCoordinates("https://example.com/place")).toBeNull(); expect(parseMapCoordinates("https://example.com/?q=300,1")).toBeNull(); });
  it("rejects malformed, out-of-range, and non-decimal coordinates", () => {
    expect(parseMapCoordinates("not a url")).toBeNull();
    expect(parseMapCoordinates("https://example.com/?q=91,0")).toBeNull();
    expect(parseMapCoordinates("https://example.com/?q=0,181")).toBeNull();
    expect(parseMapCoordinates("https://example.com/?q=38,-9")).toBeNull();
  });
});
