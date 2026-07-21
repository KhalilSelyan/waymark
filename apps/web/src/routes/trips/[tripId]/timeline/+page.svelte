<script lang="ts">
  import { page } from "$app/state";
  import { onMount } from "svelte";
  import { client } from "$lib/orpc";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Card, CardContent, CardHeader, CardTitle } from "$lib/components/ui/card/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "$lib/components/ui/table/index.js";

  type Row = Awaited<ReturnType<typeof client.itinerary.list>>[number];
  type Place = Awaited<ReturnType<typeof client.places.list>>[number];
  let rows = $state<Row[]>([]);
  let places = $state<Place[]>([]);
  let loading = $state(true);
  let saving = $state(false);
  let error = $state<string | null>(null);
  let editingId = $state<string | null>(null);
  let view = $state<"schedule" | "table">("schedule");
  let form = $state({ day: "", title: "", placeId: "", startsAt: "", endsAt: "", notes: "", status: "planned" as "idea" | "planned" | "done" });
  const trip = $derived(page.data.trip);
  const tripId = $derived(page.params.tripId ?? "");

  let days = $derived.by(() => {
    if (!trip.startsOn || !trip.endsOn) return [];
    const result: string[] = [];
    const current = new Date(`${trip.startsOn}T00:00:00Z`);
    const end = new Date(`${trip.endsOn}T00:00:00Z`);
    while (current <= end && result.length < 366) { result.push(current.toISOString().slice(0, 10)); current.setUTCDate(current.getUTCDate() + 1); }
    return result;
  });
  let visibleDays = $derived.by(() => {
    const populated = [...new Set(rows.map((row) => row.item.day).filter((day): day is string => Boolean(day)))];
    return populated.length > 0 ? populated.sort() : [];
  });

  onMount(() => { void refresh(); });

  async function refresh() {
    loading = true;
    try { [rows, places] = await Promise.all([client.itinerary.list({ tripId }), client.places.list({ tripId })]); if (!form.day) form.day = days[0] ?? ""; error = null; }
    catch (caught) { error = caught instanceof Error ? caught.message : "Itinerary could not be loaded."; }
    finally { loading = false; }
  }

  function reset() { editingId = null; form = { day: days[0] ?? "", title: "", placeId: "", startsAt: "", endsAt: "", notes: "", status: "planned" }; }
  function edit(row: Row) {
    const item = row.item;
    editingId = item.id;
    form = { day: item.day ?? "", title: item.title, placeId: item.placeId ?? "", startsAt: item.startsAt ? new Date(item.startsAt).toISOString().slice(0, 16) : "", endsAt: item.endsAt ? new Date(item.endsAt).toISOString().slice(0, 16) : "", notes: item.notes ?? "", status: item.status };
  }
  function iso(value: string) { return value ? new Date(value).toISOString() : null; }
  function updateInput(row: Row, sortOrder: number) {
    const item = row.item;
    return { day: item.day, title: item.title, placeId: item.placeId ?? null, startsAt: item.startsAt ? new Date(item.startsAt).toISOString() : null, endsAt: item.endsAt ? new Date(item.endsAt).toISOString() : null, notes: item.notes ?? null, status: item.status, sortOrder };
  }
  async function move(row: Row, direction: -1 | 1) {
    const siblings = rows.filter((candidate) => candidate.item.day === row.item.day).sort((a, b) => a.item.sortOrder - b.item.sortOrder);
    const index = siblings.findIndex((candidate) => candidate.item.id === row.item.id);
    const target = siblings[index + direction];
    if (!target) return;
    saving = true;
    try {
      await Promise.all([
        client.itinerary.update({ id: row.item.id, ...updateInput(row, target.item.sortOrder) }),
        client.itinerary.update({ id: target.item.id, ...updateInput(target, row.item.sortOrder) }),
      ]);
      await refresh();
    } catch (caught) { error = caught instanceof Error ? caught.message : "Itinerary order could not be saved."; }
    finally { saving = false; }
  }
  async function save() {
    saving = true;
    try {
      const input = { day: form.day, title: form.title, placeId: form.placeId || null, startsAt: iso(form.startsAt), endsAt: iso(form.endsAt), notes: form.notes || null, status: form.status, sortOrder: editingId ? (rows.find((row) => row.item.id === editingId)?.item.sortOrder ?? 0) : rows.filter((row) => row.item.day === form.day).length };
      if (editingId) await client.itinerary.update({ id: editingId, ...input }); else await client.itinerary.create({ tripId, ...input });
      reset(); await refresh();
    } catch (caught) { error = caught instanceof Error ? caught.message : "Itinerary item could not be saved."; }
    finally { saving = false; }
  }
  async function archive(id: string) { if (!confirm("Archive this itinerary item?")) return; try { await client.itinerary.archive({ id }); rows = rows.filter((row) => row.item.id !== id); } catch (caught) { error = caught instanceof Error ? caught.message : "Itinerary item could not be archived."; } }
  function label(day: string) { return new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric", timeZone: trip.timezone }).format(new Date(`${day}T12:00:00Z`)); }
  function time(value: Date | string) { return new Intl.DateTimeFormat(undefined, { timeStyle: "short", timeZone: trip.timezone }).format(new Date(value)); }
</script>

<svelte:head><title>Timeline · {trip.name}</title></svelte:head>

<section class="space-y-6">
  <header class="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p class="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">Timeline</p><h1 class="mt-2 text-3xl font-semibold">Build the itinerary.</h1><p class="mt-2 text-muted-foreground">Organize the trip by day, with room for ideas and unscheduled plans.</p></div><div class="flex rounded-md border border-border p-1"><Button size="sm" variant={view === "schedule" ? "secondary" : "ghost"} onclick={() => view = "schedule"}>Schedule</Button><Button size="sm" variant={view === "table" ? "secondary" : "ghost"} onclick={() => view = "table"}>List</Button></div></header>
  {#if error}<div class="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">{error}</div>{/if}
  {#if view === "table" && !loading}
    {#if rows.length === 0}<Card class="border-dashed"><CardContent class="py-12 text-center text-sm text-muted-foreground">No itinerary items yet.</CardContent></Card>{:else}<Card class="overflow-hidden"><div class="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Day</TableHead><TableHead>Time</TableHead><TableHead>Plan</TableHead><TableHead>Place</TableHead><TableHead>Status</TableHead><TableHead><span class="sr-only">Actions</span></TableHead></TableRow></TableHeader><TableBody>{#each rows as row}<TableRow><TableCell>{row.item.day ? label(row.item.day) : "Unscheduled"}</TableCell><TableCell>{row.item.startsAt ? time(row.item.startsAt) : "Any time"}</TableCell><TableCell class="font-medium">{row.item.title}</TableCell><TableCell>{row.place?.name ?? "—"}</TableCell><TableCell class="capitalize">{row.item.status}</TableCell><TableCell><div class="flex justify-end gap-1"><Button variant="ghost" size="sm" onclick={() => edit(row)}>Edit</Button><Button variant="ghost" size="sm" onclick={() => archive(row.item.id)}>Archive</Button></div></TableCell></TableRow>{/each}</TableBody></Table></div></Card>{/if}
  {/if}
  <div class:invisible={view === "table"} class:hidden={view === "table"} class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
    <div class="space-y-6">
      {#if loading}<p class="text-sm text-muted-foreground">Loading itinerary...</p>
      {:else if rows.length === 0}
        <Card class="border-dashed"><CardContent class="py-12 text-center"><p class="font-medium">No itinerary items yet.</p><p class="mt-2 text-sm text-muted-foreground">Add your first plan and the relevant days will appear here.</p></CardContent></Card>
      {:else}
        {#each [...visibleDays, "unscheduled"] as day}
          {@const items = rows.filter((row) => row.item.day === day)}
          <div class="space-y-3"><div class="flex items-center justify-between"><h2 class="text-lg font-semibold">{day === "unscheduled" ? "Unscheduled" : label(day)}</h2><span class="text-xs text-muted-foreground">{items.length} {items.length === 1 ? "item" : "items"}</span></div>
            {#if items.length === 0}<div class="rounded-lg border border-dashed border-border px-4 py-5 text-sm text-muted-foreground">Nothing planned yet.</div>{/if}
            {#each items as row}
              {@const index = items.findIndex((candidate) => candidate.item.id === row.item.id)}
              <Card><CardContent class="flex items-start justify-between gap-4 py-4"><div class="min-w-0"><p class="font-medium">{row.item.title}</p>{#if row.item.sourceCanvasObjectId}<p class="text-xs uppercase tracking-wide text-primary">From canvas idea</p>{/if}{#if row.item.startsAt}<p class="text-sm text-muted-foreground">{time(row.item.startsAt)}{#if row.item.endsAt} – {time(row.item.endsAt)}{/if}</p>{/if}{#if row.place}<p class="text-sm text-muted-foreground">{row.place.name}</p>{/if}{#if row.item.notes}<p class="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{row.item.notes}</p>{/if}</div><div class="flex shrink-0 items-center gap-1"><Button variant="ghost" size="sm" disabled={saving || index === 0} onclick={() => move(row, -1)} aria-label="Move item up">↑</Button><Button variant="ghost" size="sm" disabled={saving || index === items.length - 1} onclick={() => move(row, 1)} aria-label="Move item down">↓</Button><Button variant="ghost" size="sm" onclick={() => edit(row)}>Edit</Button><Button variant="ghost" size="sm" onclick={() => archive(row.item.id)}>Archive</Button></div></CardContent></Card>
            {/each}
          </div>
        {/each}
      {/if}
    </div>
    <Card class="h-fit"><CardHeader><CardTitle>{editingId ? "Edit item" : "Add itinerary item"}</CardTitle></CardHeader><CardContent><form class="space-y-4" onsubmit={(event) => { event.preventDefault(); void save(); }}>
      <div class="space-y-2"><Label for="item-title">Title</Label><Input id="item-title" bind:value={form.title} required maxlength={200} placeholder="Sunset walk" /></div>
      <div class="space-y-2"><Label for="item-day">Day</Label><select id="item-day" bind:value={form.day} class="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">Unscheduled</option>{#each days as day}<option value={day}>{label(day)}</option>{/each}</select></div>
      <div class="space-y-2"><Label for="item-place">Place</Label><select id="item-place" bind:value={form.placeId} class="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">No place</option>{#each places as place}<option value={place.id}>{place.name}</option>{/each}</select></div>
      <div class="grid gap-3 sm:grid-cols-2"><div class="space-y-2"><Label for="item-start">Starts</Label><Input id="item-start" type="datetime-local" bind:value={form.startsAt} /></div><div class="space-y-2"><Label for="item-end">Ends</Label><Input id="item-end" type="datetime-local" bind:value={form.endsAt} /></div></div>
      <div class="space-y-2"><Label for="item-status">Status</Label><select id="item-status" bind:value={form.status} class="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="idea">Idea</option><option value="planned">Planned</option><option value="done">Done</option></select></div>
      <div class="space-y-2"><Label for="item-notes">Notes</Label><textarea id="item-notes" bind:value={form.notes} rows="3" class="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="Details for the group"></textarea></div>
      <div class="flex gap-2"><Button type="submit" disabled={saving}>{saving ? "Saving..." : editingId ? "Save changes" : "Add item"}</Button>{#if editingId}<Button type="button" variant="ghost" onclick={reset}>Cancel</Button>{/if}</div>
    </form></CardContent></Card>
  </div>
</section>
