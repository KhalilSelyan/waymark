import { isIP } from "node:net";
import { lookup } from "node:dns/promises";

export class UnsafeUrlError extends Error {}

export function assertSafeUrlSyntax(value: string) {
  let url: URL;
  try { url = new URL(value); } catch { throw new UnsafeUrlError("Invalid URL."); }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new UnsafeUrlError("Only HTTP and HTTPS URLs are allowed.");
  if (url.username || url.password) throw new UnsafeUrlError(" URLs with credentials are not allowed.");
  if (isBlockedHostname(url.hostname) || (isIP(url.hostname) && isBlockedIp(url.hostname))) throw new UnsafeUrlError("This destination is not allowed.");
  return url;
}

export async function resolveSafeUrl(value: string) {
  const url = assertSafeUrlSyntax(value);
  const addresses = isIP(url.hostname) ? [{ address: url.hostname }] : await lookup(url.hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(({ address }) => isBlockedIp(address))) throw new UnsafeUrlError("This destination is not allowed.");
  return { url, addresses: addresses.map(({ address }) => address) };
}

export function isBlockedHostname(hostname: string) {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  return host === "localhost" || host.endsWith(".localhost") || host === "local" || host.endsWith(".local") || host === "metadata.google.internal" || host === "metadata.google.com";
}

export function isBlockedIp(address: string) {
  const normalized = address.toLowerCase();
  if (normalized === "::1" || normalized === "0:0:0:0:0:0:0:1") return true;
  if (normalized.startsWith("fe80:") || normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  if (!isIP(address)) return true;
  if (isIP(address) !== 4) return false;
  const octets = address.split(".").map(Number);
  const [a = -1, b = -1] = octets;
  return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 0) || (a === 192 && b === 168) || (a === 198 && (b === 18 || b === 19)) || a >= 224;
}
