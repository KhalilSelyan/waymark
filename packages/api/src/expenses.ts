export type Share = { memberId: string; amountMinor: number };
export type Balance = { memberId: string; netMinor: number };

function assertAmount(amountMinor: number) {
  if (!Number.isSafeInteger(amountMinor) || amountMinor < 0) throw new Error("Amount must be a non-negative integer.");
}

export function equalShares(amountMinor: number, memberIds: string[]): Share[] {
  assertAmount(amountMinor);
  if (memberIds.length === 0) throw new Error("At least one participant is required.");
  const base = Math.floor(amountMinor / memberIds.length);
  const remainder = amountMinor % memberIds.length;
  return memberIds.map((memberId, index) => ({ memberId, amountMinor: base + (index < remainder ? 1 : 0) }));
}

export function customShares(amountMinor: number, shares: Share[]): Share[] {
  assertAmount(amountMinor);
  if (shares.length === 0) throw new Error("At least one participant is required.");
  if (shares.some((share) => !Number.isSafeInteger(share.amountMinor) || share.amountMinor < 0)) throw new Error("Shares must be non-negative integers.");
  if (new Set(shares.map((share) => share.memberId)).size !== shares.length) throw new Error("Each participant may appear only once.");
  if (shares.reduce((total, share) => total + share.amountMinor, 0) !== amountMinor) throw new Error("Shares must sum exactly to the expense amount.");
  return shares.map((share) => ({ ...share }));
}

export function calculateBalances(amountMinor: number, payerMemberId: string, shares: Share[]): Balance[] {
  assertAmount(amountMinor);
  if (shares.reduce((total, share) => total + share.amountMinor, 0) !== amountMinor) throw new Error("Shares must sum exactly to the expense amount.");
  const balances = new Map<string, number>([[payerMemberId, amountMinor]]);
  for (const share of shares) balances.set(share.memberId, (balances.get(share.memberId) ?? 0) - share.amountMinor);
  return [...balances.entries()].map(([memberId, netMinor]) => ({ memberId, netMinor }));
}
