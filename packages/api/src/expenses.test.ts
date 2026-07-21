import { describe, expect, it } from "vitest";
import { calculateBalances, customShares, equalShares, settlementSuggestions } from "./expenses";

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

describe("settlementSuggestions", () => {
  it("matches debtors to creditors deterministically", () => expect(settlementSuggestions([{ memberId: "a", netMinor: 700 }, { memberId: "b", netMinor: -300 }, { memberId: "c", netMinor: -400 }])).toEqual([{ fromMemberId: "b", toMemberId: "a", amountMinor: 300 }, { fromMemberId: "c", toMemberId: "a", amountMinor: 400 }]));
  it("reduces transfers when one debtor covers multiple creditors", () => expect(settlementSuggestions([{ memberId: "a", netMinor: 300 }, { memberId: "b", netMinor: 200 }, { memberId: "c", netMinor: -500 }])).toEqual([{ fromMemberId: "c", toMemberId: "a", amountMinor: 300 }, { fromMemberId: "c", toMemberId: "b", amountMinor: 200 }]));
  it("ignores zero balances and supports an already settled group", () => { expect(settlementSuggestions([{ memberId: "a", netMinor: 0 }])).toEqual([]); expect(settlementSuggestions([])).toEqual([]); });
  it("rejects unbalanced input", () => expect(() => settlementSuggestions([{ memberId: "a", netMinor: 1 }])).toThrow());
});
