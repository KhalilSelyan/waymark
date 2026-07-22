export type Share = { memberId: string; amountMinor: number };
export type Balance = { memberId: string; netMinor: number };
export type SettlementSuggestion = { fromMemberId: string; toMemberId: string; amountMinor: number };

function assertAmount(amountMinor: number) {
  if (!Number.isSafeInteger(amountMinor) || amountMinor < 0) throw new Error("Amount must be a non-negative integer.");
}

function sumShares(shares: Share[]) {
  return shares.reduce((total, share) => {
    const next = total + share.amountMinor;
    if (!Number.isSafeInteger(next)) throw new Error("Share total exceeds the safe integer range.");
    return next;
  }, 0);
}

export function equalShares(amountMinor: number, memberIds: string[]): Share[] {
  assertAmount(amountMinor);
  if (memberIds.length === 0) throw new Error("At least one participant is required.");
  if (memberIds.some((memberId) => !memberId) || new Set(memberIds).size !== memberIds.length) throw new Error("Each participant may appear only once.");
  // Integer division is rounded down; leftover minor units go to participants in input order.
  const base = Math.floor(amountMinor / memberIds.length);
  const remainder = amountMinor % memberIds.length;
  return memberIds.map((memberId, index) => ({ memberId, amountMinor: base + (index < remainder ? 1 : 0) }));
}

export function customShares(amountMinor: number, shares: Share[]): Share[] {
  assertAmount(amountMinor);
  if (shares.length === 0) throw new Error("At least one participant is required.");
  if (shares.some((share) => !Number.isSafeInteger(share.amountMinor) || share.amountMinor < 0)) throw new Error("Shares must be non-negative integers.");
  if (new Set(shares.map((share) => share.memberId)).size !== shares.length) throw new Error("Each participant may appear only once.");
  if (sumShares(shares) !== amountMinor) throw new Error("Shares must sum exactly to the expense amount.");
  return shares.map((share) => ({ ...share }));
}

export function calculateBalances(amountMinor: number, payerMemberId: string, shares: Share[]): Balance[] {
  assertAmount(amountMinor);
  if (shares.some((share) => !Number.isSafeInteger(share.amountMinor) || share.amountMinor < 0)) throw new Error("Shares must be non-negative integers.");
  if (sumShares(shares) !== amountMinor) throw new Error("Shares must sum exactly to the expense amount.");
  const balances = new Map<string, number>([[payerMemberId, amountMinor]]);
  for (const share of shares) {
    if (!share.memberId || !Number.isSafeInteger(share.amountMinor) || share.amountMinor < 0) throw new Error("Shares must be non-negative integers.");
    const next = (balances.get(share.memberId) ?? 0) - share.amountMinor;
    if (!Number.isSafeInteger(next)) throw new Error("Balance exceeds the safe integer range.");
    balances.set(share.memberId, next);
  }
  return [...balances.entries()].map(([memberId, netMinor]) => ({ memberId, netMinor }));
}

export function settlementSuggestions(balances: Balance[]): SettlementSuggestion[] {
  const total = balances.reduce((sum, balance) => sum + balance.netMinor, 0);
  if (!Number.isSafeInteger(total) || total !== 0) throw new Error("Balances must sum to zero.");
  const debtors = balances.filter((balance) => balance.netMinor < 0).map((balance) => ({ memberId: balance.memberId, amountMinor: -balance.netMinor })).sort((a, b) => a.memberId.localeCompare(b.memberId));
  const creditors = balances.filter((balance) => balance.netMinor > 0).map((balance) => ({ memberId: balance.memberId, amountMinor: balance.netMinor })).sort((a, b) => a.memberId.localeCompare(b.memberId));
  const suggestions: SettlementSuggestion[] = [];
  let debtorIndex = 0;
  let creditorIndex = 0;
  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex];
    const creditor = creditors[creditorIndex];
    if (!debtor || !creditor) break;
    const amountMinor = Math.min(debtor.amountMinor, creditor.amountMinor);
    suggestions.push({ fromMemberId: debtor.memberId, toMemberId: creditor.memberId, amountMinor });
    debtor.amountMinor -= amountMinor;
    creditor.amountMinor -= amountMinor;
    if (debtor.amountMinor === 0) debtorIndex += 1;
    if (creditor.amountMinor === 0) creditorIndex += 1;
  }
  return suggestions;
}
