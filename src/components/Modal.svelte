<script>
  let { title, onclose, children, footer, wide = false } = $props();
  let dialog;

  $effect(() => {
    dialog.showModal();
    return () => dialog.open && dialog.close();
  });
</script>

<dialog bind:this={dialog} class:wide oncancel={(e) => { e.preventDefault(); onclose(); }}>
  <header>
    <h2>{title}</h2>
    <button type="button" class="icon-btn" onclick={onclose} aria-label="Bezárás">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
    </button>
  </header>
  <div class="body">{@render children()}</div>
  {#if footer}<footer>{@render footer()}</footer>{/if}
</dialog>

<style>
  dialog {
    border: 1px solid var(--line-strong);
    border-radius: 10px;
    padding: 0;
    background: var(--paper);
    color: var(--ink);
    width: min(720px, calc(100vw - 24px));
    max-height: calc(100vh - 24px);
    /* The dynamic height excludes a phone browser's address and tool bars. */
    max-height: calc(100dvh - 24px);
    box-shadow: 0 30px 80px -20px rgba(0, 0, 0, 0.55);
  }
  dialog.wide {
    width: min(1040px, calc(100vw - 24px));
  }
  dialog::backdrop {
    background: rgba(20, 24, 32, 0.55);
  }
  dialog[open] {
    display: flex;
    flex-direction: column;
  }
  header {
    flex: none;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 14px 18px;
    border-bottom: 1px solid var(--line);
  }
  h2 {
    font-size: 19px;
    font-weight: 800;
  }
  /* Without min-height: 0 the body cannot shrink, and a tall body pushes the header and
     footer out of the dialog. */
  .body {
    flex: 1 1 auto;
    min-height: 0;
    padding: 16px 18px;
    overflow: auto;
  }
  footer {
    flex: none;
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: 12px 18px;
    border-top: 1px solid var(--line);
    background: var(--paper-2);
  }
  @media (max-width: 600px) {
    dialog,
    dialog.wide {
      width: 100vw;
      max-width: 100vw;
      max-height: 100dvh;
      height: 100dvh;
      margin: 0;
      border: none;
      border-radius: 0;
    }
    header {
      padding: 10px 16px;
    }
    .body {
      padding: 14px 16px;
    }
    footer {
      padding: 10px 16px;
    }
  }
</style>
