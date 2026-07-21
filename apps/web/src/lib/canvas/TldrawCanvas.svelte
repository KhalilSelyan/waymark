<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import React from "react";
  import { createRoot, type Root } from "react-dom/client";
  import { Tldraw, type Editor } from "tldraw";
  import "tldraw/tldraw.css";

  let { onEditorMount }: { onEditorMount: (editor: Editor) => void | Promise<void> } = $props();

  let host: HTMLDivElement;
  let root: Root | undefined;

  onMount(() => {
    root = createRoot(host);
    root.render(
      React.createElement(Tldraw, {
        onMount: (editor: Editor) => {
          void onEditorMount(editor);
        },
      }),
    );
  });

  onDestroy(() => root?.unmount());
</script>

<div bind:this={host} class="h-full min-h-0 w-full [&_.tl-background]!:bg-background"></div>
