export type ReverseGeocodeResult = { name?: string; address?: string };

export interface MapProvider {
  reverseGeocode(latitude: string, longitude: string, signal: AbortSignal): Promise<ReverseGeocodeResult | null>;
}

const nominatimProvider: MapProvider = {
  async reverseGeocode(latitude, longitude, signal) {
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(latitude)}&lon=${encodeURIComponent(longitude)}`, {
      headers: { "user-agent": `Waymark/1.0 ${process.env.WAYMARK_MAP_CONTACT ?? "support@waymark.app"}` },
      signal,
    });
    if (!response.ok) return null;
    const data = await response.json() as { display_name?: string; name?: string };
    return { name: data.name, address: data.display_name };
  },
};

export function getMapProvider(): MapProvider {
  return nominatimProvider;
}
