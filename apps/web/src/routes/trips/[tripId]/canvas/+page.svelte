<script lang="ts">
  import { onDestroy } from "svelte";
  import { type Editor, type TLShape } from "tldraw";
  import { Button } from "$lib/components/ui/button/index.js";
  import { page } from "$app/state";
  import { client } from "$lib/orpc";
  import TldrawCanvas from "$lib/canvas/TldrawCanvas.svelte";
  import { loadCanvas, createCanvasObject, updateCanvasObject, removeCanvasObject } from "$lib/canvas/canvas-persistence";
  import { recordToShape } from "$lib/canvas/canvas-mapper";
  import type { CanvasRecord } from "$lib/canvas/canvas-types";

  let editor: Editor | null = null;
  let canvasSection: HTMLElement;
  let isFullscreen = $state(false);
  let status = $state<"loading" | "saved" | "saving" | "error">("loading");
  let error = $state<string | null>(null);
  let promotion = $state<string | null>(null);
  let realtime: EventSource | undefined;
  let onlineMembers = $state<{ memberId: string; displayName: string; color: string }[]>([]);
  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  let unsubscribe: (() => void) | undefined;
  const versions = new Map<string, number>();
  const pending = new Map<string, TLShape>();
  const removed = new Map<string, TLShape>();

  const tripId = $derived(page.params.tripId ?? "");

  function serverId(shape: TLShape) {
    const value = (shape.meta as { waymarkObjectId?: unknown }).waymarkObjectId;
    return typeof value === "string" ? value : null;
  }

  async function initialize(nextEditor: Editor) {
    editor = nextEditor;
    try {
      const records = await loadCanvas(client, tripId);
      const shapes = records.map((record) => {
        versions.set(record.id, record.version);
        return recordToShape(record);
      });
      if (shapes.length) editor.createShapes(shapes);
      unsubscribe = editor.store.listen(handleStoreChange, { source: "user", scope: "document" });
      realtime = new EventSource(`/realtime/trips/${tripId}`);
      realtime.onmessage = (message) => applyRealtime(JSON.parse(message.data) as RealtimeMessage);
      realtime.onerror = () => { if (status !== "saving") error = "Realtime connection lost. Changes will still save."; };
      status = "saved";
    } catch (caught) {
      showError(caught);
    }
  }

  function handleStoreChange(entry: unknown) {
    const change = entry as { changes: { added: Record<string, TLShape>; updated: Record<string, [TLShape, TLShape]>; removed: Record<string, TLShape> } };
    for (const shape of Object.values(change.changes.added)) pending.set(shape.id, shape);
    for (const [, [, shape]] of Object.entries(change.changes.updated)) pending.set(shape.id, shape);
    for (const shape of Object.values(change.changes.removed)) removed.set(shape.id, shape);
    scheduleSave();
  }

  function scheduleSave() {
    status = "saving";
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => void flush(), 500);
  }

  async function flush() {
    const changes = [...pending.values()];
    const deletions = [...removed.values()];
    pending.clear();
    removed.clear();

    try {
      for (const shape of changes) {
        const id = serverId(shape);
        if (id) {
          const updated = await updateCanvasObject(client, shape, versions.get(id) ?? 1);
          versions.set(id, updated.version);
        } else {
          const created = await createCanvasObject(client, tripId, shape);
          versions.set(created.id, created.version);
          editor?.updateShape({ ...shape, meta: { ...shape.meta, waymarkObjectId: created.id } });
        }
      }
      for (const shape of deletions) {
        const id = serverId(shape);
        if (id) await removeCanvasObject(client, shape, versions.get(id) ?? 1);
      }
      status = "saved";
      error = null;
    } catch (caught) {
      showError(caught);
    }
  }

  async function promoteSelected() {
    const shape = editor?.getSelectedShapes()[0];
    const id = shape ? serverId(shape) : null;
    if (!shape || !id) {
      promotion = "Select a saved text or note first.";
      return;
    }
    if (shape.type !== "text" && shape.type !== "note") {
      promotion = "Only text and note shapes can become itinerary ideas yet.";
      return;
    }
    try {
      const result = await client.itinerary.promoteCanvasObject({ tripId, canvasObjectId: id });
      promotion = result.created ? "Added to itinerary as an idea." : "This idea is already on the itinerary.";
    } catch (caught) {
      promotion = caught instanceof Error ? caught.message : "The idea could not be added to the itinerary.";
    }
  }

  function showError(caught: unknown) {
    status = "error";
    error = caught instanceof Error ? caught.message : "Canvas changes could not be saved.";
  }

  type RealtimeMessage = { type: string; objects?: CanvasRecord[]; presence?: { memberId: string; displayName: string; color: string }[]; actorMemberId?: string; payload?: { objectId?: string; objectVersion?: number; data?: Record<string, unknown>; displayName?: string; color?: string } };
  function applyRealtime(event: RealtimeMessage) {
    if (!editor) return;
    if (event.presence) onlineMembers = event.presence;
    if (event.type === "presence.joined" && event.actorMemberId && event.payload?.displayName) onlineMembers = [...onlineMembers.filter((member) => member.memberId !== event.actorMemberId), { memberId: event.actorMemberId, displayName: event.payload.displayName, color: event.payload.color ?? "" }];
    if (event.type === "presence.left" && event.actorMemberId) onlineMembers = onlineMembers.filter((member) => member.memberId !== event.actorMemberId);
    if (event.type === "snapshot" && event.objects && editor.getCurrentPageShapes().length === 0) {
      const shapes = event.objects.map((record) => { versions.set(record.id, record.version); return recordToShape(record); });
      if (shapes.length) editor.createShapes(shapes);
      return;
    }
    if (!event.payload) return;
    const existing = editor.getCurrentPageShapes().find((shape) => serverId(shape) === event.payload?.objectId);
    if (event.type === "canvas.object.deleted") {
      if (existing) editor.deleteShapes([existing.id]);
      return;
    }
    const shapeData = event.payload.data?.shape;
    if (!shapeData || typeof shapeData !== "object") return;
    const shape = shapeData as TLShape;
    if (existing) editor.updateShape({ ...shape, id: existing.id });
    else editor.createShapes([shape]);
  }

  onDestroy(() => {
    if (saveTimer) clearTimeout(saveTimer);
    unsubscribe?.();
    realtime?.close();
    document.removeEventListener("fullscreenchange", handleFullscreenChange);
  });

  function handleFullscreenChange() {
    isFullscreen = document.fullscreenElement === canvasSection;
  }

  async function toggleFullscreen() {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await canvasSection.requestFullscreen();
    }
  }

  $effect(() => {
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  });
</script>

<svelte:head>
  <title>Canvas · {page.data.trip.name}</title>
</svelte:head>

<section bind:this={canvasSection} class="flex h-[calc(100svh-12rem)] min-h-[32rem] flex-col overflow-hidden rounded-xl border border-border bg-card fullscreen:h-svh fullscreen:rounded-none">
  <div class="flex items-center justify-between gap-4 border-b border-border px-4 py-3">
    <div>
      <p class="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Shared planning board</p>
      <h1 class="text-lg font-semibold">Sketch the trip together</h1>
      <p class="text-xs text-muted-foreground">{onlineMembers.length} online</p>
    </div>
    <div class="flex items-center gap-3">
      <Button variant="outline" size="sm" onclick={promoteSelected}>Add selected to itinerary</Button>
      <p class="text-xs text-muted-foreground" aria-live="polite">
        {#if status === "loading"}Loading canvas...{:else if status === "saving"}Saving...{:else if status === "error"}Save failed{:else}All changes saved{/if}
      </p>
      <Button variant="outline" size="sm" onclick={toggleFullscreen} aria-label={isFullscreen ? "Exit fullscreen" : "Open canvas fullscreen"}>
        {isFullscreen ? "Exit fullscreen" : "Fullscreen"}
      </Button>
    </div>
  </div>
  {#if promotion}<p class="border-b border-border px-4 py-2 text-xs text-muted-foreground" aria-live="polite">{promotion}</p>{/if}
  {#if error}
    <div class="border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive" role="alert">{error}</div>
  {/if}
  <div class="min-h-0 flex-1">
    <TldrawCanvas onEditorMount={initialize} />
  </div>
</section>
