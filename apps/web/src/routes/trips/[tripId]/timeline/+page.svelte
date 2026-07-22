<script lang="ts">
  import { page } from "$app/state";
  import { browser } from "$app/environment";
  import { onMount } from "svelte";
  import { client } from "$lib/orpc";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Card, CardContent, CardHeader, CardTitle } from "$lib/components/ui/card/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import { Badge } from "$lib/components/ui/badge/index.js";
  import { Calendar } from "$lib/components/ui/calendar/index.js";
  import { Popover, PopoverContent, PopoverTrigger } from "$lib/components/ui/popover/index.js";
  import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "$lib/components/ui/dropdown-menu/index.js";
  import * as AlertDialog from "$lib/components/ui/alert-dialog/index.js";
  import { Select, SelectContent, SelectItem, SelectTrigger } from "$lib/components/ui/select/index.js";
  import { parseDate, type DateValue } from "@internationalized/date";
  import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
  import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "$lib/components/ui/table/index.js";
  import { readItineraryView, writeItineraryView, type ItineraryView } from "$lib/itinerary-view";

  type Row = Awaited<ReturnType<typeof client.itinerary.list>>[number];
  type Place = Awaited<ReturnType<typeof client.places.list>>[number];
  let rows = $state<Row[]>([]);
  let places = $state<Place[]>([]);
  let loading = $state(true);
  let saving = $state(false);
  let error = $state<string | null>(null);
  let editingId = $state<string | null>(null);
  let editorPanel: HTMLElement;
  let view = $state<ItineraryView>("schedule");
  let form = $state({ day: "", title: "", placeId: "", startsAt: "", endsAt: "", notes: "", status: "planned" as "idea" | "planned" | "done" });
  let dayPickerOpen = $state(false);
  let archiveTarget = $state<Row | null>(null);
  let realtime: EventSource | undefined;
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

  function setView(next: ItineraryView) {
    view = next;
    if (browser) writeItineraryView(localStorage, next);
  }

  onMount(() => {
    view = readItineraryView(localStorage);
    void refresh();
    realtime = new EventSource(`/realtime/trips/${tripId}`);
    realtime.onmessage = (event) => {
      const message = JSON.parse(event.data) as { type?: string };
      if (message.type?.startsWith("itinerary.item.")) void refresh();
    };
    return () => realtime?.close();
  });

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
    form = { day: item.day ?? "", title: item.title, placeId: item.placeId ?? "", startsAt: item.startsAt ? formatInTimeZone(new Date(item.startsAt), trip.timezone, "yyyy-MM-dd'T'HH:mm") : "", endsAt: item.endsAt ? formatInTimeZone(new Date(item.endsAt), trip.timezone, "yyyy-MM-dd'T'HH:mm") : "", notes: item.notes ?? "", status: item.status };
    setTimeout(() => {
      editorPanel?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      document.getElementById("item-title")?.focus();
    }, 0);
  }
  function iso(value: string) { return value ? fromZonedTime(value, trip.timezone).toISOString() : null; }
  function calendarValue() { return form.day ? parseDate(form.day) : undefined; }
  function chooseDay(value: DateValue | undefined) { form.day = value?.toString() ?? ""; dayPickerOpen = false; }
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
  async function markStatus(row: Row) {
    const status = row.item.status === "done" ? "planned" : "done";
    saving = true;
    try { await client.itinerary.update({ id: row.item.id, ...updateInput(row, row.item.sortOrder), status }); await refresh(); }
    catch (caught) { error = caught instanceof Error ? caught.message : "Itinerary status could not be saved."; }
    finally { saving = false; }
  }
  async function save() {
    saving = true;
    try {
      const input = { day: form.day || null, title: form.title, placeId: form.placeId || null, startsAt: iso(form.startsAt), endsAt: iso(form.endsAt), notes: form.notes || null, status: form.status, sortOrder: editingId ? (rows.find((row) => row.item.id === editingId)?.item.sortOrder ?? 0) : rows.filter((row) => row.item.day === form.day).length };
      if (editingId) await client.itinerary.update({ id: editingId, ...input }); else await client.itinerary.create({ tripId, ...input });
      reset(); await refresh();
    } catch (caught) { error = caught instanceof Error ? caught.message : "Itinerary item could not be saved."; }
    finally { saving = false; }
  }
  async function archive(id: string) { try { await client.itinerary.archive({ id }); rows = rows.filter((row) => row.item.id !== id); archiveTarget = null; } catch (caught) { error = caught instanceof Error ? caught.message : "Itinerary item could not be archived."; } }
  function label(day: string) { return new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric", timeZone: trip.timezone }).format(new Date(`${day}T12:00:00Z`)); }
  function time(value: Date | string) { return new Intl.DateTimeFormat(undefined, { timeStyle: "short", timeZone: trip.timezone }).format(new Date(value)); }
  function displayUrl(value: string) {
    try {
      const parsed = new URL(value);
      const path = parsed.pathname === "/" ? "" : parsed.pathname;
      return `${parsed.hostname}${path.length > 28 ? `${path.slice(0, 27)}…` : path}`;
    } catch { return value.length > 36 ? `${value.slice(0, 35)}…` : value; }
  }
  function noteLines(value: string) {
    return value.split("\n").map((line) => line.split(/(https?:\/\/\S+)/g).filter(Boolean).flatMap((part) => {
      if (!part.startsWith("http://") && !part.startsWith("https://")) return [part];
      const match = part.match(/^(.*?)([),.;!?]*)$/);
      return match && match[1] ? [match[1], match[2]] : [part];
    }));
  }
</script>

<svelte:head><title>Timeline · {trip.name}</title></svelte:head>

<section class="space-y-6">
  <header class="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p class="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">Timeline</p><h1 class="mt-2 text-3xl font-semibold">Build the itinerary.</h1><p class="mt-2 text-muted-foreground">Organize the trip by day, with room for ideas and unscheduled plans.</p></div><div class="flex rounded-md border border-border p-1"><Button size="sm" variant={view === "schedule" ? "secondary" : "ghost"} onclick={() => setView("schedule")}>Schedule</Button><Button size="sm" variant={view === "table" ? "secondary" : "ghost"} onclick={() => setView("table")}>List</Button></div></header>
  {#if error}<div class="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">{error}</div>{/if}
  {#if view === "table" && !loading}
    {#if rows.length === 0}<Card class="border-dashed"><CardContent class="py-12 text-center text-sm text-muted-foreground">No itinerary items yet.</CardContent></Card>{:else}<div class="sm:hidden space-y-3">{#each rows as row}<Card><CardContent class="space-y-3 py-4"><div><p class="font-medium">{row.item.title}</p><p class="text-sm text-muted-foreground">{row.item.day ? label(row.item.day) : "Unscheduled"} · {row.item.startsAt ? time(row.item.startsAt) : "Any time"}</p>{#if row.place}<p class="text-sm text-muted-foreground">{row.place.name}</p>{/if}</div><div class="flex items-center justify-between gap-2"><Badge variant={row.item.status === "done" ? "secondary" : row.item.status === "planned" ? "default" : "outline"}>{row.item.status}</Badge><div class="flex gap-1"><Button variant="ghost" size="sm" onclick={() => edit(row)}>Edit</Button><Button variant="ghost" size="sm" onclick={() => archive(row.item.id)}>Archive</Button></div></div></CardContent></Card>{/each}</div><Card class="hidden overflow-hidden sm:block"><Table><TableHeader><TableRow><TableHead>Day</TableHead><TableHead>Time</TableHead><TableHead>Plan</TableHead><TableHead>Place</TableHead><TableHead>Status</TableHead><TableHead><span class="sr-only">Actions</span></TableHead></TableRow></TableHeader><TableBody>{#each rows as row}<TableRow><TableCell>{row.item.day ? label(row.item.day) : "Unscheduled"}</TableCell><TableCell>{row.item.startsAt ? time(row.item.startsAt) : "Any time"}</TableCell><TableCell class="font-medium">{row.item.title}</TableCell><TableCell>{row.place?.name ?? "—"}</TableCell><TableCell><Badge variant={row.item.status === "done" ? "secondary" : row.item.status === "planned" ? "default" : "outline"}>{row.item.status}</Badge></TableCell><TableCell><div class="flex justify-end gap-1"><Button variant="ghost" size="sm" onclick={() => edit(row)}>Edit</Button><Button variant="ghost" size="sm" onclick={() => archive(row.item.id)}>Archive</Button></div></TableCell></TableRow>{/each}</TableBody></Table></Card>{/if}
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
              <Card><CardContent class="flex items-start justify-between gap-4 py-4"><div class="min-w-0"><p class="font-medium">{row.item.title}</p>{#if row.item.sourceCanvasObjectId}<p class="text-xs uppercase tracking-wide text-primary">From canvas idea</p>{/if}{#if row.item.startsAt}<p class="text-sm text-muted-foreground">{time(row.item.startsAt)}{#if row.item.endsAt} – {time(row.item.endsAt)}{/if}</p>{/if}{#if row.place}<p class="text-sm text-muted-foreground">{row.place.name}</p>{/if}{#if row.item.notes}<div class="mt-2 space-y-1 text-sm text-muted-foreground">{#each noteLines(row.item.notes) as line}<p class="whitespace-pre-wrap">{#each line as part}{#if part.startsWith("http://") || part.startsWith("https://")}<a class="text-primary underline underline-offset-2" href={part} target="_blank" rel="noreferrer" title={part}>{displayUrl(part)}</a>{:else}{part}{/if}{/each}</p>{/each}</div>{/if}</div><div class="flex shrink-0 items-center gap-1"><Button variant="ghost" size="sm" disabled={saving || index === 0} onclick={() => move(row, -1)} aria-label="Move item up">↑</Button><Button variant="ghost" size="sm" disabled={saving || index === items.length - 1} onclick={() => move(row, 1)} aria-label="Move item down">↓</Button><DropdownMenu><DropdownMenuTrigger class="rounded-md px-2 py-1 text-sm hover:bg-accent" aria-label={`Actions for ${row.item.title}`}>•••</DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onclick={() => edit(row)}>Edit</DropdownMenuItem><DropdownMenuItem onclick={() => void markStatus(row)}>Mark as {row.item.status === "done" ? "planned" : "done"}</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem class="text-destructive" onclick={() => archiveTarget = row}>Archive</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div></CardContent></Card>
            {/each}
          </div>
        {/each}
      {/if}
    </div>
    <div bind:this={editorPanel}><Card class={editingId ? "h-fit border-primary/60 ring-1 ring-primary/20" : "h-fit"}><CardHeader><CardTitle>{editingId ? "Edit item" : "Add itinerary item"}</CardTitle></CardHeader><CardContent><form class="space-y-4" onsubmit={(event) => { event.preventDefault(); void save(); }}>
      <div class="space-y-2"><Label for="item-title">Title</Label><Input id="item-title" bind:value={form.title} required maxlength={200} placeholder="Sunset walk" /></div>
       <div class="space-y-2"><Label for="item-day">Day</Label><Popover bind:open={dayPickerOpen}><PopoverTrigger class="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-left text-sm font-normal hover:bg-accent"><span class={form.day ? "text-foreground" : "text-muted-foreground"}>{form.day ? label(form.day) : "Unscheduled"}</span><span aria-hidden="true">▾</span></PopoverTrigger><PopoverContent class="w-auto p-0" align="start"><Calendar type="single" value={calendarValue()} onValueChange={chooseDay} captionLayout="dropdown" /></PopoverContent></Popover><input id="item-day" type="hidden" value={form.day} /></div>
       <div class="space-y-2"><Label for="item-place">Place</Label><Select type="single" value={form.placeId || "none"} onValueChange={(value: string | undefined) => form.placeId = value === "none" ? "" : value ?? ""}><SelectTrigger id="item-place" class="h-10 w-full"><span>{form.placeId ? places.find((place) => place.id === form.placeId)?.name ?? "Select place" : "No place"}</span></SelectTrigger><SelectContent><SelectItem value="none">No place</SelectItem>{#each places as place}<SelectItem value={place.id}>{place.name}</SelectItem>{/each}</SelectContent></Select></div>
      <div class="grid gap-3 sm:grid-cols-2"><div class="space-y-2"><Label for="item-start">Starts</Label><Input id="item-start" type="datetime-local" bind:value={form.startsAt} /></div><div class="space-y-2"><Label for="item-end">Ends</Label><Input id="item-end" type="datetime-local" bind:value={form.endsAt} /></div></div>
       <div class="space-y-2"><Label for="item-status">Status</Label><Select type="single" value={form.status} onValueChange={(value: string | undefined) => { if (value === "idea" || value === "planned" || value === "done") form.status = value; }}><SelectTrigger id="item-status" class="h-10 w-full"><span class="capitalize">{form.status}</span></SelectTrigger><SelectContent><SelectItem value="idea">Idea</SelectItem><SelectItem value="planned">Planned</SelectItem><SelectItem value="done">Done</SelectItem></SelectContent></Select></div>
      <div class="space-y-2"><Label for="item-notes">Notes</Label><textarea id="item-notes" bind:value={form.notes} rows="3" class="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="Details for the group"></textarea></div>
      <div class="flex gap-2"><Button type="submit" disabled={saving}>{saving ? "Saving..." : editingId ? "Save changes" : "Add item"}</Button>{#if editingId}<Button type="button" variant="ghost" onclick={reset}>Cancel</Button>{/if}</div>
    </form></CardContent></Card></div>
  </div>
  <AlertDialog.Root open={Boolean(archiveTarget)} onOpenChange={(open) => { if (!open) archiveTarget = null; }}>
    <AlertDialog.Content>
      <AlertDialog.Header><AlertDialog.Title>Archive itinerary item?</AlertDialog.Title><AlertDialog.Description>{archiveTarget?.item.title} will be removed from the active schedule but can remain in history.</AlertDialog.Description></AlertDialog.Header>
      <AlertDialog.Footer><AlertDialog.Cancel>Cancel</AlertDialog.Cancel><AlertDialog.Action class="bg-destructive text-destructive-foreground hover:bg-destructive/90" onclick={() => archiveTarget && void archive(archiveTarget.item.id)}>Archive</AlertDialog.Action></AlertDialog.Footer>
    </AlertDialog.Content>
  </AlertDialog.Root>
</section>
