<script lang="ts">
  import { page } from "$app/state";
  import { onMount } from "svelte";
  import { client } from "$lib/orpc";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Card, CardContent, CardHeader, CardTitle } from "$lib/components/ui/card/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import * as AlertDialog from "$lib/components/ui/alert-dialog/index.js";

  type Place = Awaited<ReturnType<typeof client.places.list>>[number];
  let places = $state<Place[]>([]);
  let editingId = $state<string | null>(null);
  let loading = $state(true);
  let saving = $state(false);
  let error = $state<string | null>(null);
  let message = $state<string | null>(null);
  let archiveTarget = $state<Place | null>(null);
  let form = $state({ name: "", address: "", mapUrl: "", url: "", notes: "" });
  const tripId = $derived(page.params.tripId ?? "");

  onMount(() => { void refresh(); });

  async function refresh() {
    loading = true;
    try { places = await client.places.list({ tripId }); error = null; }
    catch (caught) { error = caught instanceof Error ? caught.message : "Places could not be loaded."; }
    finally { loading = false; }
  }

  function resetForm() {
    editingId = null;
    form = { name: "", address: "", mapUrl: "", url: "", notes: "" };
  }

  function edit(place: Place) {
    editingId = place.id;
    form = { name: place.name, address: place.address ?? "", mapUrl: place.mapUrl ?? "", url: place.url ?? "", notes: place.notes ?? "" };
  }

  async function save() {
    saving = true;
    try {
      const input = { name: form.name, address: form.address || null, mapUrl: form.mapUrl || null, url: form.url || null, notes: form.notes || null };
      if (editingId) await client.places.update({ id: editingId, ...input });
      else await client.places.create({ tripId, ...input });
      resetForm();
      await refresh();
    } catch (caught) { error = caught instanceof Error ? caught.message : "Place could not be saved."; }
    finally { saving = false; }
  }

  async function archive(id: string) {
    try { await client.places.archive({ id }); places = places.filter((place) => place.id !== id); if (editingId === id) resetForm(); archiveTarget = null; }
    catch (caught) { error = caught instanceof Error ? caught.message : "Place could not be archived."; }
  }

  async function addToCanvas(id: string) {
    try { await client.places.addToCanvas({ tripId, placeId: id }); message = "Place added to the canvas."; error = null; }
    catch (caught) { error = caught instanceof Error ? caught.message : "Place could not be added to the canvas."; }
  }
  async function enrich(place: Place) {
    if (!place.mapUrl) return;
    edit(place);
    try {
      const response = await fetch(`/api/trips/${tripId}/places/enrich`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url: place.mapUrl }) });
      if (!response.ok) throw new Error("Place enrichment failed.");
      const result = await response.json() as { address?: string };
      if (result.address) form.address = result.address;
      message = "Enrichment loaded for review. Save changes to apply it."; error = null;
    } catch (caught) { error = caught instanceof Error ? caught.message : "Place enrichment failed."; }
  }
</script>

<svelte:head><title>Places · {page.data.trip.name}</title></svelte:head>

<section class="space-y-6">
  <header>
    <p class="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">Places</p>
    <h1 class="mt-2 text-3xl font-semibold">Collect places worth considering.</h1>
    <p class="mt-2 text-muted-foreground">Save destinations, map links, and useful references for the group.</p>
  </header>

  {#if error}<div class="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">{error}</div>{/if}
  {#if message}<div class="rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-primary" role="status">{message}</div>{/if}

  <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
    <div class="space-y-4">
      {#if loading}<p class="text-sm text-muted-foreground">Loading places...</p>
      {:else if places.length === 0}<Card class="border-dashed"><CardContent class="py-12 text-center text-sm text-muted-foreground">No places saved yet.</CardContent></Card>
      {:else}
        {#each places as place}
          <Card>
            <CardHeader class="flex flex-row items-start justify-between gap-4"><div><CardTitle>{place.name}</CardTitle>{#if place.address}<p class="mt-1 text-sm text-muted-foreground">{place.address}</p>{/if}</div><Button variant="ghost" size="sm" onclick={() => edit(place)}>Edit</Button></CardHeader>
            <CardContent class="space-y-3 text-sm">
              {#if place.notes}<p class="whitespace-pre-wrap text-muted-foreground">{place.notes}</p>{/if}
              <div class="flex flex-wrap gap-3">
                {#if place.mapUrl}<a class="text-primary underline underline-offset-4" href={place.mapUrl} target="_blank" rel="noreferrer noopener">Open map</a>{/if}
                {#if place.mapUrl}<button class="text-primary underline underline-offset-4 hover:text-foreground" onclick={() => void enrich(place)}>Enrich</button>{/if}
                {#if place.url}<a class="text-primary underline underline-offset-4" href={place.url} target="_blank" rel="noreferrer noopener">Open website</a>{/if}
                <button class="text-primary underline underline-offset-4 hover:text-foreground" onclick={() => void addToCanvas(place.id)}>Add to canvas</button>
                 <button class="text-muted-foreground underline underline-offset-4 hover:text-destructive" onclick={() => archiveTarget = place}>Archive</button>
              </div>
            </CardContent>
          </Card>
        {/each}
      {/if}
    </div>

    <Card class="h-fit">
      <CardHeader><CardTitle>{editingId ? "Edit place" : "Add a place"}</CardTitle></CardHeader>
      <CardContent>
        <form class="space-y-4" onsubmit={(event) => { event.preventDefault(); void save(); }}>
          <div class="space-y-2"><Label for="place-name">Name</Label><Input id="place-name" bind:value={form.name} required maxlength={200} placeholder="A place to remember" /></div>
          <div class="space-y-2"><Label for="place-address">Address</Label><Input id="place-address" bind:value={form.address} maxlength={500} placeholder="Street, city" /></div>
          <div class="space-y-2"><Label for="place-map">Map link</Label><Input id="place-map" type="url" bind:value={form.mapUrl} placeholder="https://maps.google.com/..." /></div>
          <div class="space-y-2"><Label for="place-url">Website or reference link</Label><Input id="place-url" type="url" bind:value={form.url} placeholder="https://..." /></div>
          <div class="space-y-2"><Label for="place-notes">Notes</Label><textarea id="place-notes" bind:value={form.notes} maxlength="5000" rows="4" class="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring" placeholder="Why is this worth considering?"></textarea></div>
          <div class="flex gap-2"><Button type="submit" disabled={saving}>{saving ? "Saving..." : editingId ? "Save changes" : "Add place"}</Button>{#if editingId}<Button type="button" variant="ghost" onclick={resetForm}>Cancel</Button>{/if}</div>
        </form>
      </CardContent>
    </Card>
  </div>
  <AlertDialog.Root open={Boolean(archiveTarget)} onOpenChange={(open) => { if (!open) archiveTarget = null; }}>
    <AlertDialog.Content><AlertDialog.Header><AlertDialog.Title>Archive place?</AlertDialog.Title><AlertDialog.Description>{archiveTarget?.name} will be removed from the active Places list.</AlertDialog.Description></AlertDialog.Header><AlertDialog.Footer><AlertDialog.Cancel>Cancel</AlertDialog.Cancel><AlertDialog.Action class="bg-destructive text-destructive-foreground hover:bg-destructive/90" onclick={() => archiveTarget && void archive(archiveTarget.id)}>Archive</AlertDialog.Action></AlertDialog.Footer></AlertDialog.Content>
  </AlertDialog.Root>
</section>
