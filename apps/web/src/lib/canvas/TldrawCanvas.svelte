<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import React from "react";
  import { createRoot, type Root } from "react-dom/client";
  import { Tldraw, type Editor } from "tldraw";
  import "tldraw/tldraw.css";
  import { WebpageCardShapeUtil } from "./WebpageCardShapeUtil";

  let { onEditorMount }: { onEditorMount: (editor: Editor) => void | Promise<void> } = $props();

  let host: HTMLDivElement;
  let root: Root | undefined;

  onMount(() => {
    root = createRoot(host);
    root.render(
      React.createElement(Tldraw, {
        shapeUtils: [WebpageCardShapeUtil],
        onMount: (editor: Editor) => {
          void onEditorMount(editor);
        },
      }),
    );
  });

  onDestroy(() => root?.unmount());
</script>

<div bind:this={host} class="h-full min-h-0 w-full"></div>

<style>
  :global(.tl-container) {
    --color-low: #0a0a0a;
    --color-muted-1: #141416;
    --color-muted-2: #1b1b1e;
    --color-text: #f5f5f5;
    --color-text-2: #a3a3a3;
    --color-selected: #7dd3fc;
  }

  :global(.tl-background) {
    background-color: #0e0e11 !important;
    background-image: linear-gradient(rgba(255, 255, 255, 0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.035) 1px, transparent 1px) !important;
    background-size: 24px 24px !important;
  }
</style>
