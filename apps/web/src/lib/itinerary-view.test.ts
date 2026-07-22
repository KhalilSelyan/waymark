import { describe, expect, it, vi } from "vitest";
import { readItineraryView, writeItineraryView } from "./itinerary-view";

describe("itinerary view preference", () => {
  it("defaults invalid values to schedule", () => expect(readItineraryView({ getItem: () => "grid" })).toBe("schedule"));
  it("reads supported values", () => { expect(readItineraryView({ getItem: () => "table" })).toBe("table"); expect(readItineraryView({ getItem: () => "schedule" })).toBe("schedule"); });
  it("writes the preference", () => { const setItem = vi.fn(); writeItineraryView({ setItem }, "table"); expect(setItem).toHaveBeenCalledWith("waymark-itinerary-view", "table"); });
});
