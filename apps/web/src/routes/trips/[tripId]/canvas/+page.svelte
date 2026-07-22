<script lang="ts">
  import { onDestroy } from "svelte";
  import { type Editor, type TLShape } from "tldraw";
  import { Button } from "$lib/components/ui/button/index.js";
  import { page } from "$app/state";
  import { browser } from "$app/environment";
  import { client } from "$lib/orpc";
  import TldrawCanvas from "$lib/canvas/TldrawCanvas.svelte";
  import { loadCanvas, createCanvasObject, updateCanvasObject, removeCanvasObject } from "$lib/canvas/canvas-persistence";
  import { recordToAsset, recordToShape } from "$lib/canvas/canvas-mapper";
  import type { CanvasRecord } from "$lib/canvas/canvas-types";
  import * as ContextMenu from "$lib/components/ui/context-menu/index.js";

  let editor: Editor | null = null;
  let canvasSection: HTMLElement;
  let isFullscreen = $state(false);
  let status = $state<"loading" | "saved" | "saving" | "error">("loading");
  let error = $state<string | null>(null);
  let promotion = $state<string | null>(null);
  let captureUrl = $state("");
  let captureStatus = $state<"idle" | "capturing" | "error">("idle");
  let contextMenu = $state(false);
  let contextTitle = $state("");
  let realtime: EventSource | undefined;
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  let reconnectAttempt = 0;
  let realtimeStatus = $state<"connected" | "reconnecting">("reconnecting");
  let onlineMembers = $state<{ memberId: string; displayName: string; color: string }[]>([]);
  let remoteCursors = $state(new Map<string, { x: number; y: number; displayName: string; color: string }>());
  let lastCursorSent = 0;
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
      const assets = records.map(recordToAsset).filter((asset): asset is NonNullable<typeof asset> => asset !== null);
      if (assets.length) editor.createAssets(assets);
      if (shapes.length) editor.createShapes(shapes);
      unsubscribe = editor.store.listen(handleStoreChange, { source: "user", scope: "document" });
      connectRealtime();
      status = "saved";
    } catch (caught) {
      showError(caught);
    }
  }

  function handleStoreChange(entry: unknown) {
    const change = entry as { changes: { added: Record<string, TLShape>; updated: Record<string, [TLShape, TLShape]>; removed: Record<string, TLShape> } };
    for (const shape of Object.values(change.changes.added)) pending.set(shape.id, shape);
    for (const [, [, shape]] of Object.entries(change.changes.updated)) pending.set(shape.id, shape);
    for (const shape of Object.values(change.changes.removed)) {
      pending.delete(shape.id);
      removed.set(shape.id, shape);
    }
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
        if (pending.get(shape.id) === shape) pending.delete(shape.id);
      }
      for (const shape of deletions) {
        const id = serverId(shape);
        if (id) await removeCanvasObject(client, shape, versions.get(id) ?? 1);
        if (removed.get(shape.id) === shape) removed.delete(shape.id);
      }
      status = "saved";
      error = null;
    } catch (caught) {
      showError(caught);
    }
  }

  async function promoteSelected(titleOverride?: string) {
    const shape = editor?.getSelectedShapes()[0];
    const id = shape ? serverId(shape) : null;
    if (!shape || !id) {
      promotion = "Select a saved canvas object first.";
      return;
    }
    try {
      const result = await client.itinerary.promoteCanvasObject({ tripId, canvasObjectId: id, day: page.data.trip.startsOn ?? null, title: titleOverride?.trim() || null });
      promotion = result.created ? "Added to itinerary as an idea." : "This idea is already on the itinerary.";
      if (shape && result.id) editor?.updateShape({ ...shape, meta: { ...shape.meta, waymarkItineraryId: result.id } });
      contextMenu = false;
      contextTitle = "";
    } catch (caught) {
      promotion = caught instanceof Error ? caught.message : "The idea could not be added to the itinerary.";
    }
  }

  async function saveSelectedAsPlace() {
    const shape = editor?.getSelectedShapes()[0];
    const id = shape ? serverId(shape) : null;
    if (!shape || !id || !contextTitle.trim()) return;
    try {
      const shapeProps = (shape as TLShape & { props?: { url?: unknown } }).props;
      await client.places.saveCanvasObjectAsPlace({ tripId, canvasObjectId: id, name: contextTitle.trim(), url: typeof shapeProps?.url === "string" ? shapeProps.url : null });
      promotion = "Saved as a place and linked to this canvas object.";
      contextMenu = false;
      contextTitle = "";
    } catch (caught) {
      promotion = caught instanceof Error ? caught.message : "The place could not be saved.";
    }
  }

  function openContextMenu(event: MouseEvent) {
    event.preventDefault();
    const selected = editor?.getSelectedShapes()[0];
    if (!selected || !serverId(selected)) return;
    contextMenu = true;
    contextTitle = "";
  }

  function dismissContextMenu(event: PointerEvent) {
    if ((event.target as HTMLElement).closest("[role=menu]")) return;
    contextMenu = false;
  }

  function handleCanvasKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") contextMenu = false;
  }

  function selectedRelationship() {
    const meta = editor?.getSelectedShapes()[0]?.meta as { waymarkType?: string; waymarkRecordId?: string; waymarkItineraryId?: string } | undefined;
    return meta;
  }

  function handleContextMenuOpen(open: boolean) {
    const selected = editor?.getSelectedShapes()[0];
    contextMenu = open && Boolean(selected && serverId(selected));
    if (contextMenu) contextTitle = "";
  }

  async function captureWebpage() {
    if (!captureUrl.trim() || captureStatus === "capturing") return;
    captureStatus = "capturing";
    promotion = null;
    try {
      const response = await fetch(`/api/trips/${tripId}/capture`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url: captureUrl.trim() }) });
      if (!response.ok) throw new Error("Capture failed. Check the URL and try again.");
      const result = await response.json() as { shapes: TLShape[] };
      editor?.createShapes(result.shapes);
      captureUrl = "";
      promotion = "Webpage screenshot added to the canvas.";
      captureStatus = "idle";
    } catch (caught) {
      captureStatus = "error";
      promotion = caught instanceof Error ? caught.message : "Webpage capture failed.";
    }
  }

  function showError(caught: unknown) {
    status = "error";
    error = caught instanceof Error ? caught.message : "Canvas changes could not be saved.";
  }

  type RealtimeMessage = { type: string; objects?: CanvasRecord[]; presence?: { memberId: string; displayName: string; color: string }[]; actorMemberId?: string; payload?: { objectId?: string; objectVersion?: number; data?: Record<string, unknown>; displayName?: string; color?: string; x?: number; y?: number } };
  function connectRealtime() {
    realtime?.close();
    realtime = new EventSource(`/realtime/trips/${tripId}`);
    realtime.onopen = () => { reconnectAttempt = 0; realtimeStatus = "connected"; error = null; };
    realtime.onmessage = (message) => applyRealtime(JSON.parse(message.data) as RealtimeMessage);
    realtime.onerror = () => {
      realtimeStatus = "reconnecting";
      realtime?.close();
      const delay = Math.min(30_000, 1_000 * 2 ** reconnectAttempt);
      reconnectAttempt += 1;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(connectRealtime, delay);
      if (status !== "saving") error = "Realtime connection lost. Reconnecting; changes still save.";
    };
  }

  function applyRealtime(event: RealtimeMessage) {
    if (!editor) return;
    if (event.presence) onlineMembers = event.presence;
    if (event.type === "presence.joined" && event.actorMemberId && event.payload?.displayName) onlineMembers = [...onlineMembers.filter((member) => member.memberId !== event.actorMemberId), { memberId: event.actorMemberId, displayName: event.payload.displayName, color: event.payload.color ?? "" }];
    if (event.type === "presence.left" && event.actorMemberId) onlineMembers = onlineMembers.filter((member) => member.memberId !== event.actorMemberId);
    if (event.type === "presence.cursor.updated" && event.actorMemberId && event.payload?.x !== undefined && event.payload?.y !== undefined) {
      const member = onlineMembers.find((candidate) => candidate.memberId === event.actorMemberId);
      if (member) remoteCursors = new Map(remoteCursors).set(event.actorMemberId, { x: event.payload.x, y: event.payload.y, displayName: member.displayName, color: member.color });
    }
    if (event.type === "snapshot" && event.objects) {
      const incoming = new Map(event.objects.map((record) => [record.id, record]));
      for (const existing of editor.getCurrentPageShapes()) {
        const id = serverId(existing);
        if (id && !incoming.has(id)) editor.deleteShapes([existing.id]);
      }
      for (const record of event.objects) {
        versions.set(record.id, record.version);
        const shape = recordToShape(record);
        const existing = editor.getCurrentPageShapes().find((candidate) => serverId(candidate) === record.id);
        if (existing) editor.updateShape({ ...shape, id: existing.id });
        else editor.createShapes([shape]);
      }
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

  function broadcastCursor(event: PointerEvent) {
    const now = Date.now();
    if (now - lastCursorSent < 75) return;
    lastCursorSent = now;
    const bounds = (event.currentTarget as HTMLElement).getBoundingClientRect();
    void fetch(`/realtime/trips/${tripId}/cursor`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ x: event.clientX - bounds.left, y: event.clientY - bounds.top }) });
  }

  onDestroy(() => {
    if (saveTimer) clearTimeout(saveTimer);
    if (reconnectTimer) clearTimeout(reconnectTimer);
    unsubscribe?.();
    realtime?.close();
    if (browser) document.removeEventListener("fullscreenchange", handleFullscreenChange);
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
    if (!browser) return;
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  });
</script>

<svelte:head>
  <title>Canvas · {page.data.trip.name}</title>
</svelte:head>

<svelte:window onpointerdown={dismissContextMenu} onkeydown={handleCanvasKeydown} />

<section bind:this={canvasSection} class="flex h-[calc(100svh-9rem)] min-h-[32rem] flex-col overflow-hidden border-y border-border bg-card fullscreen:h-svh fullscreen:rounded-none">
  <div class="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
    <div>
      <p class="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Shared planning board</p>
      <h1 class="text-lg font-semibold">Sketch the trip together</h1>
      <p class="text-xs text-muted-foreground">{onlineMembers.length} online</p>
    </div>
    <div class="flex w-full flex-wrap items-center gap-2 sm:w-auto">
      <Button variant="outline" size="sm" onclick={() => void promoteSelected()}>Add selected to itinerary</Button>
      <p class="text-xs text-muted-foreground" aria-live="polite">
        {#if status === "loading"}Loading canvas...{:else if status === "saving"}Saving...{:else if status === "error"}Save failed{:else}All changes saved{/if}
        · {realtimeStatus === "connected" ? "Live" : "Reconnecting"}
      </p>
      <Button variant="outline" size="sm" onclick={toggleFullscreen} aria-label={isFullscreen ? "Exit fullscreen" : "Open canvas fullscreen"}>
        {isFullscreen ? "Exit fullscreen" : "Fullscreen"}
      </Button>
    </div>
  </div>
  {#if promotion}<p class="border-b border-border px-4 py-2 text-xs text-muted-foreground" aria-live="polite">{promotion}</p>{/if}
  <form class="flex flex-wrap gap-2 border-b border-border px-4 py-2" onsubmit={(event) => { event.preventDefault(); void captureWebpage(); }}>
    <label class="sr-only" for="capture-url">Webpage URL</label>
    <input id="capture-url" class="min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring" type="url" bind:value={captureUrl} placeholder="Paste a public webpage URL to capture" />
    <Button type="submit" size="sm" variant="outline" disabled={captureStatus === "capturing"}>{captureStatus === "capturing" ? "Capturing..." : "Capture webpage"}</Button>
  </form>
  {#if error}
    <div class="border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive" role="alert">{error}</div>
  {/if}
  <ContextMenu.Root bind:open={contextMenu} onOpenChange={handleContextMenuOpen}>
    <ContextMenu.Trigger class="relative min-h-0 flex-1" role="application" aria-label="Shared planning canvas" onpointermove={broadcastCursor}>
      <TldrawCanvas onEditorMount={initialize} />
      {#each [...remoteCursors] as [memberId, cursor] (memberId)}<span class="pointer-events-none absolute rounded bg-background/90 px-1.5 py-0.5 text-[10px] shadow" style={`left:${cursor.x + 12}px;top:${cursor.y + 12}px;color:${cursor.color}`}>{cursor.displayName}</span>{/each}
    </ContextMenu.Trigger>
    {#if contextMenu}
      <ContextMenu.Content class="w-64 p-3">
        <p class="mb-2 text-xs font-semibold">Add object to itinerary</p>
        {#if selectedRelationship()?.waymarkType === "place"}<p class="mb-2 text-[11px] text-muted-foreground">Linked to a saved place</p>{/if}
        {#if selectedRelationship()?.waymarkItineraryId}<p class="mb-2 text-[11px] text-muted-foreground">Already linked to the itinerary</p>{/if}
        {#if selectedRelationship()?.waymarkType === "place" && selectedRelationship()?.waymarkRecordId}
          <a class="mb-2 block text-xs text-primary underline underline-offset-2" href={`/trips/${tripId}/places#${selectedRelationship()?.waymarkRecordId}`}>Open place</a>
        {/if}
        {#if selectedRelationship()?.waymarkItineraryId}
          <a class="mb-2 block text-xs text-primary underline underline-offset-2" href={`/trips/${tripId}/timeline#${selectedRelationship()?.waymarkItineraryId}`}>Open timeline item</a>
        {/if}
        <label class="sr-only" for="context-title">Itinerary title</label>
        <input id="context-title" class="mb-2 w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring" bind:value={contextTitle} placeholder="Title (optional)" onkeydown={(event) => { if (event.key === "Enter") void promoteSelected(contextTitle); }} />
        <Button class="w-full" size="sm" onclick={() => void promoteSelected(contextTitle)}>Add to itinerary</Button>
        <Button class="mt-2 w-full" variant="outline" size="sm" disabled={!contextTitle.trim()} onclick={() => void saveSelectedAsPlace()}>Save as place</Button>
      </ContextMenu.Content>
    {/if}
  </ContextMenu.Root>
</section>
