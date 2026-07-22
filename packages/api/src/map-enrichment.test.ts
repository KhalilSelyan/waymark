import { describe, expect, it } from "vitest";
import { parseMapCoordinates } from "./map-enrichment";

describe("parseMapCoordinates", () => {
  it("parses query coordinates", () => expect(parseMapCoordinates("https://maps.google.com/?q=38.7223,-9.1393")).toEqual({ latitude: "38.7223", longitude: "-9.1393" }));
  it("rejects invalid and absent coordinates", () => { expect(parseMapCoordinates("https://example.com/place")).toBeNull(); expect(parseMapCoordinates("https://example.com/?q=300,1")).toBeNull(); });
});
