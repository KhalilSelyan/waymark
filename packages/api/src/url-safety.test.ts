import { beforeEach, describe, expect, it, vi } from "vitest";
import { lookup } from "node:dns/promises";
import { assertSafeUrlSyntax, isBlockedIp, isBlockedHostname, resolveSafeUrl } from "./url-safety";

vi.mock("node:dns/promises", () => ({ lookup: vi.fn() }));

describe("URL safety", () => {
  beforeEach(() => vi.mocked(lookup).mockReset());
  it("allows public HTTP(S) syntax", () => { expect(assertSafeUrlSyntax("https://example.com/path").hostname).toBe("example.com"); expect(() => assertSafeUrlSyntax("ftp://example.com")).toThrow(); });
  it("blocks local and metadata hostnames", () => { expect(isBlockedHostname("localhost")).toBe(true); expect(isBlockedHostname("foo.local")).toBe(true); expect(isBlockedHostname("metadata.google.internal")).toBe(true); expect(() => assertSafeUrlSyntax("http://127.0.0.1")).toThrow(); });
  it("blocks private, loopback, link-local, reserved, and multicast IPs", () => { for (const address of ["10.0.0.1", "172.16.0.1", "192.168.1.1", "127.0.0.1", "169.254.169.254", "224.0.0.1", "::1", "fd00::1"]) expect(isBlockedIp(address)).toBe(true); expect(isBlockedIp("8.8.8.8")).toBe(false); });
  it("rejects credentials and normalized local hostnames", () => {
    expect(() => assertSafeUrlSyntax("https://user:password@example.com")).toThrow();
    expect(isBlockedHostname("LOCALHOST.")).toBe(true);
    expect(isBlockedHostname("metadata.google.com.")).toBe(true);
  });
  it("handles protocol and hostname edge cases", () => {
    expect(() => assertSafeUrlSyntax("file:///etc/passwd")).toThrow();
    expect(() => assertSafeUrlSyntax("javascript:alert(1)")).toThrow();
    expect(() => assertSafeUrlSyntax("https://[::1]/")).toThrow();
    expect(assertSafeUrlSyntax("HTTPS://EXAMPLE.COM").protocol).toBe("https:");
  });
  it("rejects DNS rebinding to private addresses", async () => {
    vi.mocked(lookup).mockResolvedValue([{ address: "127.0.0.1", family: 4 }] as never);
    await expect(resolveSafeUrl("https://example.com")).rejects.toThrow();
  });
  it("requires DNS resolution and accepts public results", async () => {
    vi.mocked(lookup).mockResolvedValue([{ address: "93.184.216.34", family: 4 }] as never);
    await expect(resolveSafeUrl("https://example.com")).resolves.toEqual({ url: new URL("https://example.com"), addresses: ["93.184.216.34"] });
    vi.mocked(lookup).mockResolvedValue([] as never);
    await expect(resolveSafeUrl("https://example.com")).rejects.toThrow();
  });
});
