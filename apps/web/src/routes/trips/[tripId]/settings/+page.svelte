<script lang="ts">
  import { enhance } from "$app/forms";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Card, CardContent, CardHeader, CardTitle } from "$lib/components/ui/card/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import type { ActionData, PageData } from "./$types";

  let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<main class="mx-auto max-w-2xl px-6 py-12">
  <div class="mb-8 space-y-3"><p class="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">Trip settings</p><h1 class="text-4xl font-semibold tracking-tight">{data.trip.name}</h1><p class="text-muted-foreground">Update the shared trip details.</p></div>
  <Card>
    <CardHeader><CardTitle>Details</CardTitle></CardHeader>
    <CardContent>
      <form method="POST" action="?/update" use:enhance class="grid gap-5">
        <label class="grid gap-2" for="name"><Label>Trip name</Label><Input id="name" name="name" required value={form?.values?.name ?? data.trip.name} /></label>
        <label class="grid gap-2" for="destination"><Label>Destination</Label><Input id="destination" name="destination" value={form?.values?.destination ?? data.trip.destination ?? ""} /></label>
        <div class="grid gap-5 sm:grid-cols-2"><label class="grid gap-2" for="startsOn"><Label>Start date</Label><Input id="startsOn" name="startsOn" type="date" value={form?.values?.startsOn ?? data.trip.startsOn ?? ""} /></label><label class="grid gap-2" for="endsOn"><Label>End date</Label><Input id="endsOn" name="endsOn" type="date" value={form?.values?.endsOn ?? data.trip.endsOn ?? ""} /></label></div>
        <input type="hidden" name="timezone" value={data.trip.timezone} />
        <label class="grid gap-2" for="currency"><Label>Currency</Label><Input id="currency" name="currency" maxlength={3} value={form?.values?.currency ?? data.trip.currency} /></label>
        {#if form?.success}<p class="text-sm text-muted-foreground" role="status">Saved.</p>{/if}
        {#if form?.errors}<p class="text-sm text-destructive" role="alert">Check the trip details and try again.</p>{/if}
        <Button type="submit">Save changes</Button>
      </form>
    </CardContent>
  </Card>
  <form method="POST" action="?/delete" use:enhance class="mt-6"><Button type="submit" variant="destructive">Delete trip</Button></form>
</main>
