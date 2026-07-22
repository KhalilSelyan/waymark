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
    --color-low: #0a0e13;
    --color-muted-1: #121820;
    --color-muted-2: #1a232d;
    --color-text: #e5edf5;
    --color-text-2: #9aaabd;
    --color-selected: #7dd3fc;
  }

  :global(.tl-background) {
    background-color: #0a0e13 !important;
    background-image: radial-gradient(circle, rgba(125, 211, 252, 0.16) 1px, transparent 1px) !important;
    background-size: 24px 24px !important;
  }
</style>
