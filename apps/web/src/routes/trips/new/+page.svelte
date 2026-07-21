<script lang="ts">
  import { enhance } from "$app/forms";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Card, CardContent, CardHeader, CardTitle } from "$lib/components/ui/card/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import { Calendar } from "$lib/components/ui/calendar/index.js";
  import { parseDate, type DateValue } from "@internationalized/date";
  import type { ActionData, PageData } from "./$types";

  let { data, form }: { data: PageData; form: ActionData } = $props();
  let startsOn = $state<DateValue | undefined>();
  let endsOn = $state<DateValue | undefined>();

  $effect(() => {
    if (!startsOn && form?.values?.startsOn) startsOn = parseDate(String(form.values.startsOn));
    if (!endsOn && form?.values?.endsOn) endsOn = parseDate(String(form.values.endsOn));
  });

  function dateString(value: DateValue | undefined) {
    return value?.toString() ?? "";
  }
</script>

<main class="mx-auto max-w-2xl px-6 py-12">
  <Card>
    <CardHeader>
      <p class="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">New trip</p>
      <CardTitle class="text-3xl">Start a shared plan.</CardTitle>
    </CardHeader>
    <CardContent>
      <form method="POST" use:enhance class="grid gap-5">
        <label class="grid gap-2" for="name"><Label>Trip name</Label><Input id="name" name="name" required value={form?.values?.name ?? ""} placeholder="A week in Lisbon" /></label>
        <label class="grid gap-2" for="destination"><Label>Destination</Label><Input id="destination" name="destination" value={form?.values?.destination ?? ""} placeholder="Lisbon, Portugal" /></label>
        <div class="grid gap-5 sm:grid-cols-2">
          <div class="grid gap-2"><Label>Start date</Label><Calendar type="single" bind:value={startsOn} /></div>
          <div class="grid gap-2"><Label>End date</Label><Calendar type="single" bind:value={endsOn} /></div>
        </div>
        <input type="hidden" name="startsOn" value={dateString(startsOn)} />
        <input type="hidden" name="endsOn" value={dateString(endsOn)} />
        <input type="hidden" name="timezone" value={data.timezone} />
        <label class="grid gap-2" for="currency"><Label>Currency</Label><Input id="currency" name="currency" maxlength={3} value={form?.values?.currency ?? "USD"} /></label>
        {#if form?.errors}<p class="text-sm text-destructive" role="alert">Check the trip details and try again.</p>{/if}
        <Button type="submit">Create trip</Button>
      </form>
    </CardContent>
  </Card>
</main>
