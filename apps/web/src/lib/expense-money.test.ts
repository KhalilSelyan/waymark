import { describe, expect, it } from "vitest";
import { toMinor } from "./expense-money";

describe("toMinor", () => {
  it("converts decimal currency without floating-point drift", () => {
    expect(toMinor("10.10")).toBe(1010);
    expect(toMinor("0.1")).toBe(10);
    expect(toMinor("5")).toBe(500);
  });
  it("rejects malformed precision and signs", () => {
    expect(Number.isNaN(toMinor("1.001"))).toBe(true);
    expect(Number.isNaN(toMinor("-1.00"))).toBe(true);
    expect(Number.isNaN(toMinor(""))).toBe(true);
    expect(Number.isNaN(toMinor("1e2"))).toBe(true);
  });
  it("rejects unsafe totals", () => expect(Number.isSafeInteger(toMinor("900719925474099.91"))).toBe(false));
});
