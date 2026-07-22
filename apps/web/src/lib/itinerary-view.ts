export type ItineraryView = "schedule" | "table";

export function readItineraryView(storage: Pick<Storage, "getItem">): ItineraryView {
  const value = storage.getItem("waymark-itinerary-view");
  return value === "table" || value === "schedule" ? value : "schedule";
}

export function writeItineraryView(storage: Pick<Storage, "setItem">, view: ItineraryView) {
  storage.setItem("waymark-itinerary-view", view);
}
