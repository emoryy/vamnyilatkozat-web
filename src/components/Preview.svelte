<script>
  import { app } from '../lib/store.svelte.js';
  import { currentSpec, resolveInput, missingParts, fileNameFor } from '../lib/input.js';
  import { buildDeclaration } from '../lib/declaration.js';
  import { openPdf, renderPage, rasterizePdf } from '../lib/pdfjs.js';
  import { toast } from '../lib/toast.svelte.js';
  import { downloadBlob } from '../lib/download.js';
  import Icon from './Icon.svelte';

  // `onclose` is set where the preview is an overlay (phones); it adds a close button.
  let { onnavigate, onclose } = $props();

  const RASTER_DPI = 300;
  const MIN_RASTER_DPI = 200;

  let pagesEl;
  let scroller;
  let busy = $state(false);
  let downloading = $state(false);
  let error = $state('');
  let pageCount = $state(0);
  let width = $state(0);
  let height = $state(0);
  let fit = $state(readFit());

  function readFit() {
    try {
      return localStorage.getItem('previewFit') === 'page' ? 'page' : 'width';
    } catch {
      return 'width';
    }
  }

  function setFit(v) {
    fit = v;
    try {
      localStorage.setItem('previewFit', v);
    } catch {
      // Only a convenience.
    }
  }

  let spec = $derived(currentSpec());
  let specKey = $derived(JSON.stringify(spec));
  let missing = $derived(missingParts(spec));

  let seq = 0;
  let timer;

  $effect(() => {
    const key = specKey;
    const w = fit === 'page' ? Math.min(width, Math.max(240, (height - 48) * (595.28 / 841.89) + 48)) : width;
    if (!key || !w) return;
    clearTimeout(timer);
    timer = setTimeout(() => render(JSON.parse(key), w), seq === 0 ? 0 : 350);
    return () => clearTimeout(timer);
  });

  $effect(() => {
    const ro = new ResizeObserver(([entry]) => {
      const w = Math.floor(entry.contentRect.width);
      const h = Math.floor(entry.contentRect.height);
      if (Math.abs(w - width) > 8) width = w;
      if (Math.abs(h - height) > 8) height = h;
    });
    ro.observe(scroller);
    return () => ro.disconnect();
  });

  async function render(s, w) {
    const my = ++seq;
    busy = true;
    try {
      const { bytes } = await buildDeclaration(await resolveInput(s));
      if (my !== seq) return;
      const doc = await openPdf(bytes);
      try {
        const cssWidth = Math.min(w - 48, 980);
        const canvases = [];
        for (let i = 1; i <= doc.numPages; i++) {
          const page = await doc.getPage(i);
          const base = page.getViewport({ scale: 1 });
          const scale = (cssWidth / base.width) * (window.devicePixelRatio || 1);
          const canvas = await renderPage(page, scale);
          canvas.style.width = `${cssWidth}px`;
          canvas.className = 'sheet';
          canvases.push(canvas);
        }
        if (my !== seq) return;
        // Swap only when every page is ready, so the preview never blanks out.
        pagesEl.replaceChildren(...canvases);
        pageCount = canvases.length;
        error = '';
      } finally {
        doc.destroy();
      }
    } catch (err) {
      if (my === seq) error = err.message || String(err);
    } finally {
      if (my === seq) busy = false;
    }
  }

  async function download() {
    // Read afresh: the derived spec keeps the date of the last edit, which is yesterday
    // after midnight.
    const spec = currentSpec();
    if (!spec) return;
    downloading = true;
    try {
      const { bytes, signatureDpi } = await buildDeclaration(await resolveInput(spec));
      let out = bytes;
      if (app.data.settings.rasterize) {
        // Stay at the signature's own resolution so it is not upscaled, but never so low
        // that a small signature scan blurs the printed text of the whole form.
        const dpi = Math.max(MIN_RASTER_DPI, Math.min(RASTER_DPI, signatureDpi || RASTER_DPI));
        out = await rasterizePdf(bytes, dpi);
      }
      const fileName = fileNameFor(spec);
      downloadBlob(new Blob([out], { type: 'application/pdf' }), fileName);
      toast(`Letöltve: ${fileName}`);
    } catch (err) {
      toast(`A PDF nem készült el: ${err.message || err}`, 'error', 6000);
    } finally {
      downloading = false;
    }
  }
</script>

<div class="toolbar">
  <div class="status">
    {#if onclose}
      <button type="button" class="close" onclick={onclose} aria-label="Előnézet bezárása">
        <Icon name="x" size={20} />
      </button>
    {/if}
    <span class="title">Előnézet</span>
    {#if busy}
      <span class="pill working">frissül…</span>
    {:else if pageCount}
      <span class="pill">{pageCount} oldal</span>
    {/if}
  </div>
  <div class="actions">
    <div class="seg" role="group" aria-label="Nagyítás">
      <button type="button" class:on={fit === 'page'} aria-pressed={fit === 'page'} onclick={() => setFit('page')}>Egész oldal</button>
      <button type="button" class:on={fit === 'width'} aria-pressed={fit === 'width'} onclick={() => setFit('width')}>Szélesség</button>
    </div>
    <label class="check flat" title="A letöltött PDF oldalai képpé alakulnak, így a szöveg utólag nem szerkeszthető.">
      <input type="checkbox" bind:checked={app.data.settings.rasterize} />
      Képként (laposítva)
    </label>
    <button type="button" class="btn post" onclick={download} disabled={downloading || !spec}>
      <Icon name="download" />
      {downloading ? 'Készül…' : 'PDF letöltése'}
    </button>
  </div>
</div>

{#if missing.length}
  <div class="missing">
    <strong>Hiányzik még:</strong>
    <ul>
      {#each missing as m (m.label)}
        <li><button type="button" onclick={() => onnavigate(m.tab)} title="Ugrás a kitöltéshez">{m.label}</button></li>
      {/each}
    </ul>
  </div>
{/if}
{#if error}
  <p class="missing err">Hiba az előnézetben: {error}</p>
{/if}

<div class="scroller" bind:this={scroller}>
  <div class="pages" bind:this={pagesEl} class:dim={busy}></div>
</div>

<style>
  .toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    padding: 10px 20px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    background: var(--desk-2);
    flex-wrap: wrap;
  }
  .status {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .close {
    display: none;
    border: 1px solid rgba(255, 255, 255, 0.3);
    background: transparent;
    color: #fff;
    border-radius: 6px;
    width: 36px;
    height: 36px;
    place-items: center;
    cursor: pointer;
  }
  @media (max-width: 980px) {
    .close {
      display: inline-grid;
    }
  }
  .title {
    font-family: var(--f-display);
    font-weight: 800;
    font-size: 17px;
  }
  .pill {
    font-family: var(--f-mono);
    font-size: 12px;
    padding: 2px 8px;
    border-radius: 99px;
    background: rgba(255, 255, 255, 0.1);
    color: #dde1e8;
  }
  .pill.working {
    background: #4b5a7c;
    color: #fff;
  }
  .actions {
    display: flex;
    align-items: center;
    gap: 10px 14px;
    flex-wrap: wrap;
  }
  @media (max-width: 520px) {
    .toolbar {
      padding: 10px 16px;
    }
    .pages {
      padding: 16px;
    }
  }
  .seg {
    display: inline-flex;
    border: 1px solid rgba(255, 255, 255, 0.25);
    border-radius: 6px;
    overflow: hidden;
  }
  .seg button {
    border: none;
    background: transparent;
    color: #dde1e8;
    padding: 6px 10px;
    font-size: 13.5px;
    cursor: pointer;
  }
  .seg button + button {
    border-left: 1px solid rgba(255, 255, 255, 0.25);
  }
  .seg button:hover {
    background: rgba(255, 255, 255, 0.08);
  }
  .seg button.on {
    background: #e9ecf2;
    color: var(--ink);
    font-weight: 600;
  }
  .flat {
    color: var(--desk-ink);
    font-size: 14px;
  }
  .flat input {
    accent-color: var(--post-light);
  }
  .missing {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 12px;
    margin: 0;
    padding: 9px 20px;
    font-size: 14px;
    background: #4a3a1f;
    color: #ffe7b8;
  }
  .missing ul {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .missing li button {
    border: 1px solid #c9a35c;
    background: #5e4a27;
    color: #fff3d9;
    border-radius: 99px;
    padding: 2px 11px;
    font-size: 13.5px;
    font-weight: 600;
    cursor: pointer;
  }
  .missing li button:hover {
    background: #75602f;
  }
  .missing.err {
    background: #5a2420;
    color: #ffd9d4;
  }
  .scroller {
    flex: 1;
    overflow: auto;
    min-height: 0;
  }
  .pages {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 22px;
    padding: 24px;
    transition: opacity 0.2s;
  }
  .pages.dim {
    opacity: 0.85;
  }
  .pages :global(.sheet) {
    display: block;
    background: #fff;
    box-shadow:
      0 1px 2px rgba(0, 0, 0, 0.35),
      0 18px 40px -18px rgba(0, 0, 0, 0.7);
  }
</style>
