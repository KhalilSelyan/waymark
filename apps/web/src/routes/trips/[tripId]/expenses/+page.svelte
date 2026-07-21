<script lang="ts">
  import { page } from "$app/state";
  import { onMount } from "svelte";
  import { client } from "$lib/orpc";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Card, CardContent, CardHeader, CardTitle } from "$lib/components/ui/card/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import { calculateBalances } from "@waymark/api/expenses";

  type ExpenseRow = Awaited<ReturnType<typeof client.expenses.list>>[number];
  type Member = Awaited<ReturnType<typeof client.members.list>>[number];
  type Expense = { expense: ExpenseRow["expense"]; shares: NonNullable<ExpenseRow["shares"]>[] };
  let expenses = $state<Expense[]>([]);
  let members = $state<Member[]>([]);
  let loading = $state(true);
  let saving = $state(false);
  let error = $state<string | null>(null);
  let editingId = $state<string | null>(null);
  let form = $state({ description: "", amount: "", payerMemberId: "", splitType: "equal" as "equal" | "custom", participantIds: [] as string[], customAmounts: {} as Record<string, string>, occurredAt: new Date().toISOString().slice(0, 16) });
  const trip = $derived(page.data.trip);
  const tripId = $derived(page.params.tripId ?? "");
  const selectedTotal = $derived(form.participantIds.reduce((sum, id) => sum + Number(form.customAmounts[id] || 0), 0));
  const amountMinor = $derived(Math.round(Number(form.amount || 0) * 100));
  const remaining = $derived(amountMinor - Math.round(selectedTotal * 100));
  let balances = $derived.by(() => {
    const values = new Map<string, { paid: number; owed: number }>(members.map((member) => [member.id, { paid: 0, owed: 0 }]));
    for (const item of expenses) {
      const current = values.get(item.expense.payerMemberId);
      if (current) current.paid += item.expense.amountMinor;
      const shares = item.shares.map((share) => ({ memberId: share.memberId, amountMinor: share.amountMinor }));
      calculateBalances(item.expense.amountMinor, item.expense.payerMemberId, shares);
      for (const share of shares) values.get(share.memberId)!.owed += share.amountMinor;
    }
    return members.map((member) => ({ ...member, ...values.get(member.id), netMinor: (values.get(member.id)?.paid ?? 0) - (values.get(member.id)?.owed ?? 0) }));
  });

  onMount(() => { void refresh(); });
  function money(minor: number) { return new Intl.NumberFormat(undefined, { style: "currency", currency: trip.currency }).format(minor / 100); }
  function group(rows: ExpenseRow[]) { const map = new Map<string, Expense>(); for (const row of rows) { const current = map.get(row.expense.id) ?? { expense: row.expense, shares: [] }; if (row.shares) current.shares.push(row.shares); map.set(row.expense.id, current); } return [...map.values()]; }
  async function refresh() { loading = true; try { const [expenseRows, memberRows] = await Promise.all([client.expenses.list({ tripId }), client.members.list({ tripId })]); expenses = group(expenseRows); members = memberRows; if (!form.payerMemberId) form.payerMemberId = memberRows[0]?.id ?? ""; error = null; } catch (caught) { error = caught instanceof Error ? caught.message : "Expenses could not be loaded."; } finally { loading = false; } }
  function toggleParticipant(id: string) { form.participantIds = form.participantIds.includes(id) ? form.participantIds.filter((value) => value !== id) : [...form.participantIds, id]; }
  function reset() { editingId = null; form = { description: "", amount: "", payerMemberId: members[0]?.id ?? "", splitType: "equal", participantIds: [], customAmounts: {}, occurredAt: new Date().toISOString().slice(0, 16) }; }
  function edit(expense: Expense) { editingId = expense.expense.id; const participants = expense.shares.map((share) => share.memberId); form = { description: expense.expense.description, amount: (expense.expense.amountMinor / 100).toFixed(2), payerMemberId: expense.expense.payerMemberId, splitType: expense.expense.splitType, participantIds: participants, customAmounts: Object.fromEntries(expense.shares.map((share) => [share.memberId, (share.amountMinor / 100).toFixed(2)])), occurredAt: new Date(expense.expense.occurredAt).toISOString().slice(0, 16) }; }
  async function save() { saving = true; try { const shares = form.splitType === "equal" ? form.participantIds.map((memberId) => ({ memberId, amountMinor: 0 })) : form.participantIds.map((memberId) => ({ memberId, amountMinor: Math.round(Number(form.customAmounts[memberId] || 0) * 100) })); const input = { tripId, description: form.description, amountMinor, currency: trip.currency, payerMemberId: form.payerMemberId, splitType: form.splitType, shares, occurredAt: new Date(form.occurredAt).toISOString() }; if (editingId) await client.expenses.update({ id: editingId, ...input }); else await client.expenses.create(input); reset(); await refresh(); } catch (caught) { error = caught instanceof Error ? caught.message : "Expense could not be saved."; } finally { saving = false; } }
  async function remove(id: string) { if (!confirm("Delete this expense?")) return; try { await client.expenses.remove({ tripId, id }); expenses = expenses.filter((expense) => expense.expense.id !== id); } catch (caught) { error = caught instanceof Error ? caught.message : "Expense could not be deleted."; } }
</script>

<svelte:head><title>Expenses · {trip.name}</title></svelte:head>
<section class="space-y-6">
  <header><p class="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">Expenses</p><h1 class="mt-2 text-3xl font-semibold">Keep the money clear.</h1><p class="mt-2 text-muted-foreground">Record shared costs now; balances and settlement suggestions come next.</p></header>
  {#if error}<div class="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">{error}</div>{/if}
  <Card><CardHeader><CardTitle>Balances</CardTitle></CardHeader><CardContent><div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{#each balances as balance}<div class="rounded-lg border border-border px-3 py-3"><p class="font-medium">{balance.displayName}</p><p class="mt-1 text-sm text-muted-foreground">Paid {money(balance.paid ?? 0)} · Owes {money(balance.owed ?? 0)}</p><p class={`mt-2 text-sm font-semibold ${(balance.netMinor ?? 0) > 0 ? "text-emerald-500" : (balance.netMinor ?? 0) < 0 ? "text-amber-500" : "text-muted-foreground"}`}>{(balance.netMinor ?? 0) > 0 ? `Gets back ${money(balance.netMinor ?? 0)}` : (balance.netMinor ?? 0) < 0 ? `Owes ${money(Math.abs(balance.netMinor ?? 0))}` : "Settled up"}</p></div>{/each}</div></CardContent></Card>
  <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_23rem]">
    <div class="space-y-3">{#if loading}<p class="text-sm text-muted-foreground">Loading expenses...</p>{:else if expenses.length === 0}<Card class="border-dashed"><CardContent class="py-12 text-center text-sm text-muted-foreground">No expenses recorded yet.</CardContent></Card>{:else}{#each expenses as item}<Card><CardContent class="flex items-start justify-between gap-4 py-4"><div><p class="font-medium">{item.expense.description}</p><p class="text-sm text-muted-foreground">Paid by {members.find((member) => member.id === item.expense.payerMemberId)?.displayName ?? "a member"} · {new Date(item.expense.occurredAt).toLocaleDateString()}</p><p class="mt-1 text-lg font-semibold">{money(item.expense.amountMinor)}</p><p class="text-xs text-muted-foreground">{item.expense.splitType === "equal" ? "Split evenly" : "Custom split"} · {item.shares.length} participant{item.shares.length === 1 ? "" : "s"}</p></div><div class="flex gap-1"><Button variant="ghost" size="sm" onclick={() => edit(item)}>Edit</Button><Button variant="ghost" size="sm" onclick={() => remove(item.expense.id)}>Delete</Button></div></CardContent></Card>{/each}{/if}</div>
    <Card class="h-fit"><CardHeader><CardTitle>{editingId ? "Edit expense" : "Add expense"}</CardTitle></CardHeader><CardContent><form class="space-y-4" onsubmit={(event) => { event.preventDefault(); void save(); }}>
      <div class="space-y-2"><Label for="expense-description">Description</Label><Input id="expense-description" bind:value={form.description} required placeholder="Dinner" /></div>
      <div class="grid gap-3 sm:grid-cols-2"><div class="space-y-2"><Label for="expense-amount">Amount ({trip.currency})</Label><Input id="expense-amount" type="number" min="0.01" step="0.01" bind:value={form.amount} required /></div><div class="space-y-2"><Label for="expense-date">Date</Label><Input id="expense-date" type="datetime-local" bind:value={form.occurredAt} required /></div></div>
      <div class="space-y-2"><Label for="expense-payer">Paid by</Label><select id="expense-payer" bind:value={form.payerMemberId} class="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">{#each members as member}<option value={member.id}>{member.displayName}</option>{/each}</select></div>
      <fieldset class="space-y-2"><legend class="text-sm font-medium">Participants</legend><div class="grid gap-2">{#each members as member}<label class="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.participantIds.includes(member.id)} onchange={() => toggleParticipant(member.id)} />{member.displayName}</label>{/each}</div></fieldset>
      <div class="space-y-2"><Label for="split-type">Split method</Label><select id="split-type" bind:value={form.splitType} class="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="equal">Equal split</option><option value="custom">Custom amounts</option></select></div>
      {#if form.splitType === "equal"}<p class="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">{form.participantIds.length ? `${money(Math.floor(amountMinor / form.participantIds.length))} each, with any remainder allocated in participant order.` : "Select at least one participant."}</p>{:else}<div class="space-y-2">{#each form.participantIds as id}<div class="flex items-center gap-2"><Label class="min-w-24">{members.find((member) => member.id === id)?.displayName}</Label><Input type="number" min="0" step="0.01" bind:value={form.customAmounts[id]} /></div>{/each}<p class:text-destructive={remaining !== 0} class="text-xs text-muted-foreground">{remaining === 0 ? "Fully allocated." : `${money(Math.abs(remaining))} ${remaining > 0 ? "remaining" : "over allocated"}.`}</p></div>{/if}
      <div class="flex gap-2"><Button type="submit" disabled={saving || !form.participantIds.length || (form.splitType === "custom" && remaining !== 0)}>{saving ? "Saving..." : editingId ? "Save changes" : "Add expense"}</Button>{#if editingId}<Button type="button" variant="ghost" onclick={reset}>Cancel</Button>{/if}</div>
    </form></CardContent></Card>
  </div>
</section>
