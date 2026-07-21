import { describe, expect, it } from "vitest";
import { calculateBalances, customShares, equalShares } from "./expenses";

describe("equalShares", () => {
  it("splits evenly", () => expect(equalShares(900, ["a", "b", "c"])).toEqual([{ memberId: "a", amountMinor: 300 }, { memberId: "b", amountMinor: 300 }, { memberId: "c", amountMinor: 300 }]));
  it("allocates remainder to earlier participants", () => expect(equalShares(10, ["a", "b", "c"])).toEqual([{ memberId: "a", amountMinor: 4 }, { memberId: "b", amountMinor: 3 }, { memberId: "c", amountMinor: 3 }]));
  it("supports zero and one participant", () => { expect(equalShares(0, ["a"])).toEqual([{ memberId: "a", amountMinor: 0 }]); expect(equalShares(7, ["a"])).toEqual([{ memberId: "a", amountMinor: 7 }]); });
  it("rejects invalid participants and amounts", () => { expect(() => equalShares(1, [])).toThrow(); expect(() => equalShares(-1, ["a"])).toThrow(); });
});

describe("customShares", () => {
  it("accepts exact totals", () => expect(customShares(1000, [{ memberId: "a", amountMinor: 250 }, { memberId: "b", amountMinor: 750 }])).toHaveLength(2));
  it("rejects incorrect totals, duplicates, and negatives", () => { expect(() => customShares(100, [{ memberId: "a", amountMinor: 99 }])).toThrow(); expect(() => customShares(100, [{ memberId: "a", amountMinor: 50 }, { memberId: "a", amountMinor: 50 }])).toThrow(); expect(() => customShares(100, [{ memberId: "a", amountMinor: -1 }, { memberId: "b", amountMinor: 101 }])).toThrow(); });
});

describe("calculateBalances", () => {
  it("calculates payer credit and participant debts", () => expect(calculateBalances(1000, "a", [{ memberId: "a", amountMinor: 500 }, { memberId: "b", amountMinor: 500 }])).toEqual([{ memberId: "a", netMinor: 500 }, { memberId: "b", netMinor: -500 }]));
  it("includes a payer who is not a participant", () => expect(calculateBalances(300, "payer", [{ memberId: "guest", amountMinor: 300 }])).toEqual([{ memberId: "payer", netMinor: 300 }, { memberId: "guest", netMinor: -300 }]));
});
