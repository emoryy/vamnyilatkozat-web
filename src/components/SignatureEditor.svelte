<script>
  import { onMount, untrack } from 'svelte';
  import { saveSignature, signatureSource, uid } from '../lib/store.svelte.js';
  import {
    loadSourceImage, processSignature, defaultPlacement, canvasToBlob, blobToCanvas, rotateCanvas,
  } from '../lib/signature-image.js';
  import { renderRegion } from '../lib/pdfjs.js';
  import { templateBytes } from '../lib/declaration.js';
  import { SIGNATURE_LINE_Y } from '../lib/field-map.js';
  import { toast } from '../lib/toast.svelte.js';
  import Modal from './Modal.svelte';

  // `file` for a new upload, `existing` (signature meta) to edit one.
  let { file = null, existing = null, defaultName = 'Aláírás', onclose } = $props();

  // Part of the form shown behind the signature, in PDF pt (y measured from the bottom).
  const CROP = { x0: 340, x1: 585, yTop: 75, yBottom: 5 };
  const CROP_W = CROP.x1 - CROP.x0;
  const CROP_H = CROP.yTop - CROP.yBottom;

  // The editor works on a copy taken when it opens.
  const initial = untrack(() => ({ existing, defaultName }));
  let name = $state(initial.existing?.name || initial.defaultName);
  let sensitivity = $state(initial.existing?.params?.sensitivity ?? 0.5);
  let color = $state(initial.existing?.params?.color || 'auto');
  let crop = $state(initial.existing?.params?.crop || null);
  // Clockwise quarter turns of the photo; phones often store a paper shot sideways.
  let rotation = $state(initial.existing?.params?.rotation || 0);
  let placement = $state(initial.existing?.placement ? { ...initial.existing.placement } : null);

  // The photo as loaded, and `source`, the same turned by `rotation`, which crop and
  // processing work on.
  let original = $state.raw(null);
  let source = $state.raw(null);
  let closed = false;
  let sourceUrl = $state('');
  let processed = $state.raw(null);
  let processedUrl = $state('');
  let bgUrl = $state('');
  let loadError = $state('');
  let encodeError = $state('');
  let saving = $state(false);
  let showLine = $state(true);

  onMount(() => {
    // A URL created after the editor closed would never be revoked by the cleanup below.
    const keepUrl = (url) => {
      if (closed) URL.revokeObjectURL(url);
      return !closed;
    };
    (async () => {
      try {
        let canvas;
        if (file) canvas = await loadSourceImage(file);
        else {
          // A backup may carry a signature without its original photo.
          const stored = await signatureSource(existing.id);
          if (!(stored instanceof Blob)) throw new Error('Ennek az aláírásnak nincs meg az eredeti képe, ezért nem szerkeszthető. Tölts fel helyette új képet.');
          canvas = await blobToCanvas(stored);
        }
        original = canvas;
      } catch (err) {
        loadError = err.message || String(err);
      }
    })();
    (async () => {
      try {
        const bg = await renderRegion(await templateBytes(), CROP, 4);
        const url = URL.createObjectURL(await canvasToBlob(bg));
        if (keepUrl(url)) bgUrl = url;
      } catch {
        // The placement still works on a blank background.
      }
    })();
    return () => {
      closed = true;
      // A processing run still encoding its PNG sees itself superseded and revokes its own URL.
      procSeq++;
      for (const u of [sourceUrl, processedUrl, bgUrl]) if (u) URL.revokeObjectURL(u);
    };
  });

  $effect(() => {
    const orig = original;
    const deg = rotation;
    if (!orig) return undefined;
    const turned = rotateCanvas(orig, deg);
    source = turned;
    encodeError = '';
    let stale = false;
    canvasToBlob(turned, 'image/jpeg', 0.9)
      .then((blob) => {
        if (stale || closed) return;
        if (sourceUrl) URL.revokeObjectURL(sourceUrl);
        sourceUrl = URL.createObjectURL(blob);
      })
      .catch((err) => {
        // Without this the crop area would show "Kép betöltése…" for good. Shown in the crop
        // area only, so the rotate buttons stay usable for another try.
        if (!stale && !closed) encodeError = err.message || String(err);
      });
    return () => {
      stale = true;
    };
  });

  // A crop and a placement made for the old orientation no longer fit.
  function rotate(quarter) {
    // The old-orientation image would map crop drags with the new size until the turned one is ready.
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    sourceUrl = '';
    rotation = (rotation + quarter + 360) % 360;
    crop = null;
    placement = null;
  }

  // ---- processing (debounced; large photos take a moment)

  let procTimer;
  let procSeq = 0;
  // Saving waits for the result of the current settings, so the stored params match the stored image.
  let pending = $state(false);
  $effect(() => {
    const src = source;
    const params = { crop: crop ? { ...crop } : null, sensitivity, color };
    if (!src || dragging) return;
    pending = true;
    clearTimeout(procTimer);
    // Numbered when scheduled, so a run still encoding the previous settings cannot clear
    // `pending` and let a save store its image with these newer params.
    const my = ++procSeq;
    procTimer = setTimeout(async () => {
      try {
        const out = processSignature(src, params);
        const url = out ? URL.createObjectURL(await canvasToBlob(out)) : '';
        // A newer run started while this one encoded its PNG: its result wins.
        if (my !== procSeq) {
          if (url) URL.revokeObjectURL(url);
          return;
        }
        if (processedUrl) URL.revokeObjectURL(processedUrl);
        processed = out;
        processedUrl = url;
        if (out && !placement) placement = defaultPlacement(out.width, out.height);
      } catch (err) {
        if (my === procSeq) toast(`Az aláírás nem dolgozható fel: ${err.message || err}`, 'error', 6000);
      } finally {
        if (my === procSeq) pending = false;
      }
    }, 120);
    return () => clearTimeout(procTimer);
  });

  // ---- crop rectangle drawn on the source image

  let cropBox = $state();
  let dragging = $state(false);
  let dragStart = null;

  function toSourcePx(e) {
    const r = cropBox.getBoundingClientRect();
    const k = source.width / r.width;
    return {
      x: Math.max(0, Math.min(source.width, (e.clientX - r.left) * k)),
      y: Math.max(0, Math.min(source.height, (e.clientY - r.top) * k)),
    };
  }

  function cropDown(e) {
    // Without the image the box is a placeholder whose size does not map to the photo.
    if (!source || !sourceUrl) return;
    e.preventDefault();
    cropBox.setPointerCapture(e.pointerId);
    dragStart = toSourcePx(e);
    dragging = true;
    crop = { x: dragStart.x, y: dragStart.y, w: 0, h: 0 };
  }

  function cropMove(e) {
    if (!dragging) return;
    const p = toSourcePx(e);
    crop = {
      x: Math.min(p.x, dragStart.x),
      y: Math.min(p.y, dragStart.y),
      w: Math.abs(p.x - dragStart.x),
      h: Math.abs(p.y - dragStart.y),
    };
  }

  function cropUp() {
    if (!dragging) return;
    dragging = false;
    if (!crop || crop.w < 12 || crop.h < 12) crop = null;
    else crop = { x: Math.round(crop.x), y: Math.round(crop.y), w: Math.round(crop.w), h: Math.round(crop.h) };
  }

  function pct(v, total) {
    return `${(v / total) * 100}%`;
  }

  // ---- placement on the signature line

  let stageWidth = $state(0);
  let k = $derived(stageWidth / CROP_W);
  let heightPt = $derived(processed && placement ? (placement.width * processed.height) / processed.width : 0);
  let moving = null;

  function placeDown(e) {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    e.currentTarget.focus();
    moving = { x: e.clientX, y: e.clientY, start: { ...placement } };
  }

  function placeMove(e) {
    if (!moving) return;
    placement.x = moving.start.x + (e.clientX - moving.x) / k;
    placement.y = moving.start.y - (e.clientY - moving.y) / k;
  }

  function placeUp() {
    moving = null;
  }

  function placeKey(e) {
    const step = e.shiftKey ? 2 : 0.25;
    const moves = { ArrowUp: [0, step], ArrowDown: [0, -step], ArrowLeft: [-step, 0], ArrowRight: [step, 0] };
    if (moves[e.key]) {
      e.preventDefault();
      placement.x += moves[e.key][0];
      placement.y += moves[e.key][1];
    } else if (e.key === '+' || e.key === '-') {
      e.preventDefault();
      resize(placement.width + (e.key === '+' ? 2 : -2));
    }
  }

  // Resizing keeps the bottom-centre point fixed, so the signature stays on the line.
  function resize(w) {
    const nw = Math.max(40, Math.min(240, Number(w)));
    const cx = placement.x + placement.width / 2;
    placement.width = nw;
    placement.x = cx - nw / 2;
  }

  function resetPlacement() {
    if (processed) placement = defaultPlacement(processed.width, processed.height);
  }

  async function save() {
    if (!processed || !placement || pending) return;
    saving = true;
    try {
      const png = await canvasToBlob(processed);
      const sourceBlob = file ? await canvasToBlob(original, 'image/jpeg', 0.92) : null;
      const now = Date.now();
      const meta = {
        id: existing?.id || uid(),
        name: name.trim() || defaultName,
        width: processed.width,
        height: processed.height,
        placement: { x: placement.x, y: placement.y, width: placement.width },
        params: { crop: crop ? { ...crop } : null, sensitivity, color, rotation },
        createdAt: existing?.createdAt || now,
        updatedAt: now,
      };
      await saveSignature(meta, { png, source: sourceBlob });
      toast('Aláírás elmentve.');
      onclose();
    } catch (err) {
      toast(`Az aláírás nem menthető: ${err.message || err}`, 'error', 6000);
    } finally {
      saving = false;
    }
  }
</script>

<Modal title={existing ? 'Aláírás szerkesztése' : 'Új aláírás'} wide {onclose}>
  {#if loadError}
    <p class="notice warn">{loadError}</p>
  {:else}
    <div class="editor">
      <section class="step">
        <h3><span class="n">1</span> Kivágás</h3>
        <p class="hint">Ha a kép el van fordulva, forgasd a helyes állásba. Ha a képen más is van (pl. a papír széle, egyéb írás), húzz egy keretet az aláírás köré; keret nélkül az egész kép számít.</p>
        <div
          class="crop-box"
          bind:this={cropBox}
          onpointerdown={cropDown}
          onpointermove={cropMove}
          onpointerup={cropUp}
          onpointercancel={cropUp}
          role="presentation"
        >
          {#if sourceUrl}
            <img src={sourceUrl} alt="A feltöltött kép" draggable="false" />
            {#if crop && source}
              <div
                class="crop-rect"
                style:left={pct(crop.x, source.width)}
                style:top={pct(crop.y, source.height)}
                style:width={pct(crop.w, source.width)}
                style:height={pct(crop.h, source.height)}
              ></div>
            {/if}
          {:else if encodeError}
            <p class="notice warn pad">A kép nem jeleníthető meg: {encodeError}</p>
          {:else}
            <p class="hint pad">Kép betöltése…</p>
          {/if}
        </div>
        <div class="row">
          <button type="button" class="btn small" onclick={() => rotate(-90)} title="Forgatás balra 90 fokkal" aria-label="Forgatás balra 90 fokkal">↺ 90°</button>
          <button type="button" class="btn small" onclick={() => rotate(90)} title="Forgatás jobbra 90 fokkal" aria-label="Forgatás jobbra 90 fokkal">↻ 90°</button>
          <button type="button" class="btn small" onclick={() => (crop = null)} disabled={!crop}>Teljes kép</button>
        </div>

        <h3><span class="n">2</span> Tisztítás</h3>
        <label class="field">
          <span>Érzékenység: {Math.round(sensitivity * 100)}%</span>
          <input type="range" min="0" max="1" step="0.05" bind:value={sensitivity} />
        </label>
        <p class="hint">Ha halvány vonalak hiányoznak, növeld; ha a papír szennyeződései, árnyékai is megmaradnak, csökkentsd.</p>
        <fieldset class="colors">
          <legend class="label">Tinta színe</legend>
          <label class="check"><input type="radio" bind:group={color} value="auto" /> Az eredeti</label>
          <label class="check"><input type="radio" bind:group={color} value="blue" /> Kék</label>
          <label class="check"><input type="radio" bind:group={color} value="black" /> Fekete</label>
        </fieldset>
        <div class="result checker">
          {#if processedUrl}
            <img src={processedUrl} alt="A kivágott aláírás" />
          {:else if source}
            <p class="hint">Nem található aláírás a képen. Növeld az érzékenységet, vagy vágd ki pontosabban.</p>
          {/if}
        </div>
      </section>

      <section class="step">
        <h3><span class="n">3</span> Elhelyezés a vonalon</h3>
        <p class="hint">Húzd az aláírást a pontozott vonalra (a kisbetűk üljenek a vonalon). Billentyűvel: nyilak (Shift: nagyobb lépés), + és − a mérethez.</p>
        <div class="stage" bind:clientWidth={stageWidth} style:aspect-ratio={`${CROP_W} / ${CROP_H}`}>
          {#if bgUrl}<img class="bg" src={bgUrl} alt="" draggable="false" />{/if}
          {#if showLine && k}
            <div class="guide" style:top={`${(CROP.yTop - SIGNATURE_LINE_Y) * k}px`}></div>
          {/if}
          {#if processedUrl && placement && k}
            <button
              type="button"
              class="sig"
              aria-label="Aláírás a nyomtatványon: húzd, vagy mozgasd a nyilakkal"
              style:left={`${(placement.x - CROP.x0) * k}px`}
              style:top={`${(CROP.yTop - placement.y - heightPt) * k}px`}
              style:width={`${placement.width * k}px`}
              onpointerdown={placeDown}
              onpointermove={placeMove}
              onpointerup={placeUp}
              onpointercancel={placeUp}
              onkeydown={placeKey}
            >
              <img src={processedUrl} alt="" draggable="false" />
            </button>
          {/if}
        </div>
        {#if placement}
          <label class="field size">
            <span>Méret: {Math.round(placement.width)} pt széles</span>
            <input type="range" min="40" max="240" step="1" value={placement.width} oninput={(e) => resize(e.currentTarget.value)} />
          </label>
        {/if}
        <div class="row">
          <label class="check"><input type="checkbox" bind:checked={showLine} /> Segédvonal</label>
          <button type="button" class="btn small" onclick={resetPlacement} disabled={!processed}>Alaphelyzet</button>
        </div>

        <label class="field name">
          <span>Név</span>
          <input type="text" bind:value={name} placeholder="pl. Hosszú aláírás" />
        </label>
      </section>
    </div>
  {/if}

  {#snippet footer()}
    <button type="button" class="btn" onclick={onclose}>Mégse</button>
    <button type="button" class="btn primary" onclick={save} disabled={!processed || pending || saving}>{saving ? 'Mentés…' : 'Mentés'}</button>
  {/snippet}
</Modal>

<style>
  .editor {
    display: grid;
    grid-template-columns: 1fr 1.15fr;
    gap: 22px;
  }
  .step {
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-width: 0;
  }
  h3 {
    font-size: 16px;
    font-weight: 800;
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 4px;
  }
  .n {
    display: inline-grid;
    place-items: center;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: var(--ink);
    color: #fff;
    font-size: 12.5px;
    font-family: var(--f-mono);
  }
  .crop-box {
    position: relative;
    overflow: hidden;
    border: 1px solid var(--line-strong);
    border-radius: 6px;
    background: #fff;
    cursor: crosshair;
    touch-action: none;
    user-select: none;
    max-height: 260px;
    display: flex;
    justify-content: center;
  }
  .crop-box img {
    display: block;
    max-width: 100%;
    max-height: 260px;
    pointer-events: none;
  }
  .crop-box:has(img) {
    display: block;
    width: fit-content;
    max-width: 100%;
  }
  .crop-rect {
    position: absolute;
    border: 2px solid var(--red);
    box-shadow: 0 0 0 9999px rgba(24, 32, 47, 0.45);
    pointer-events: none;
  }
  .pad {
    padding: 30px;
  }
  .colors {
    border: none;
    padding: 0;
    margin: 0;
    display: flex;
    gap: 16px;
    flex-wrap: wrap;
    align-items: center;
  }
  .colors legend {
    margin-bottom: 4px;
  }
  .checker {
    background-color: #fff;
    background-image:
      linear-gradient(45deg, #eee 25%, transparent 25%),
      linear-gradient(-45deg, #eee 25%, transparent 25%),
      linear-gradient(45deg, transparent 75%, #eee 75%),
      linear-gradient(-45deg, transparent 75%, #eee 75%);
    background-size: 16px 16px;
    background-position: 0 0, 0 8px, 8px -8px, -8px 0;
  }
  .result {
    border: 1px solid var(--line-strong);
    border-radius: 6px;
    min-height: 90px;
    display: grid;
    place-items: center;
    padding: 10px;
  }
  .result img {
    max-width: 100%;
    max-height: 140px;
  }
  .stage {
    position: relative;
    width: 100%;
    background: #fff;
    border: 1px solid var(--line-strong);
    border-radius: 6px;
    overflow: hidden;
    touch-action: none;
    user-select: none;
  }
  .bg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }
  .guide {
    position: absolute;
    left: 0;
    right: 0;
    height: 0;
    border-top: 1.5px dashed rgba(179, 48, 42, 0.75);
    pointer-events: none;
  }
  .sig {
    position: absolute;
    padding: 0;
    border: none;
    background: none;
    line-height: 0;
    cursor: grab;
    outline: 1px dashed rgba(29, 58, 120, 0.55);
  }
  .sig img {
    width: 100%;
    pointer-events: none;
  }
  .sig:active {
    cursor: grabbing;
  }
  .sig:focus-visible {
    outline: 2px solid var(--blue);
  }
  .name {
    margin-top: 8px;
  }
  @media (max-width: 860px) {
    .editor {
      grid-template-columns: 1fr;
    }
  }
</style>
