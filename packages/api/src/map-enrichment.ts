export type MapEnrichment = { latitude: string | null; longitude: string | null; name?: string; address?: string };

export function parseMapCoordinates(value: string): { latitude: string; longitude: string } | null {
  let url: URL;
  try { url = new URL(value); } catch { return null; }
  const candidates = [url.searchParams.get("query"), url.searchParams.get("q"), url.pathname];
  for (const candidate of candidates) {
    const match = candidate?.match(/(-?\d{1,3}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/);
    if (!match) continue;
    const latitude = Number(match[1]);
    const longitude = Number(match[2]);
    if (latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180) return { latitude: String(latitude), longitude: String(longitude) };
  }
  return null;
}
