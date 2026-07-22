import { describe, expect, it } from "vitest";
import { assertSafeUrlSyntax, isBlockedIp, isBlockedHostname } from "./url-safety";

describe("URL safety", () => {
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
});
