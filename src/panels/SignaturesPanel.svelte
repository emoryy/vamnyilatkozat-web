<script>
  import { app, sigUrls, deleteSignature } from '../lib/store.svelte.js';
  import SignatureEditor from '../components/SignatureEditor.svelte';
  import ConfirmButton from '../components/ConfirmButton.svelte';
  import Icon from '../components/Icon.svelte';
  import { toast } from '../lib/toast.svelte.js';

  let fileInput;
  let editor = $state(null);
  let dropping = $state(false);

  function openFile(file) {
    if (!file) return;
    editor = { file, existing: null, defaultName: `Aláírás ${app.data.signatures.length + 1}` };
  }

  function pick(e) {
    openFile(e.currentTarget.files?.[0]);
    e.currentTarget.value = '';
  }

  function drop(e) {
    e.preventDefault();
    dropping = false;
    openFile(e.dataTransfer?.files?.[0]);
  }

  async function remove(id) {
    try {
      await deleteSignature(id);
    } catch (err) {
      toast(`Az aláíráskép nem törölhető: ${err.message || err}`, 'error', 6000);
    }
  }

  function makeFirst(i) {
    const list = [...app.data.signatures];
    const [s] = list.splice(i, 1);
    app.data.signatures = [s, ...list];
  }
</script>

<div class="stack">
  <p class="notice"><b>Nem kell kinyomtatni.</b> A nyilatkozatot nem szükséges papírra nyomtatni és kézzel aláírni: a képként elhelyezett aláírást is elfogadják, így a letöltött PDF közvetlenül beküldhető.</p>
  <p class="hint">Tölts fel egy fotót vagy szkennelt képet, amelyen egyetlen aláírásod van, fehér vagy világos papíron. A hátteret az oldal eltávolítja, utána a nyomtatvány aláírásvonalára igazíthatod. Több aláírást is felvehetsz, és küldeményenként választhatsz közülük.</p>

  <button
    type="button"
    class="drop"
    class:dropping
    onclick={() => fileInput.click()}
    ondragover={(e) => {
      e.preventDefault();
      dropping = true;
    }}
    ondragleave={() => (dropping = false)}
    ondrop={drop}
  >
    <Icon name="upload" size={22} />
    <span><b>Aláíráskép feltöltése</b><br />kattints, vagy húzd ide a képet (JPG, PNG, WebP)</span>
  </button>
  <input bind:this={fileInput} type="file" accept="image/*" class="sr-only" onchange={pick} />

  {#each app.data.signatures as sig, i (sig.id)}
    <article class="card sig">
      <div class="thumb">
        {#if sigUrls[sig.id]}<img src={sigUrls[sig.id]} alt={sig.name} />{/if}
        <i class="line"></i>
      </div>
      <div class="meta">
        <label class="field">
          <span>Név {#if i === 0}<span class="badge own">alapértelmezett</span>{/if}</span>
          <input type="text" bind:value={sig.name} />
        </label>
        <div class="row">
          <button type="button" class="btn small" onclick={() => (editor = { file: null, existing: $state.snapshot(sig) })}><Icon name="edit" size={16} /> Szerkesztés</button>
          {#if i > 0}<button type="button" class="btn small" onclick={() => makeFirst(i)}>Legyen az alapértelmezett</button>{/if}
          <ConfirmButton small label="Törlés" onconfirm={() => remove(sig.id)} />
        </div>
      </div>
    </article>
  {/each}
</div>

{#if editor}
  <SignatureEditor file={editor.file} existing={editor.existing} defaultName={editor.defaultName} onclose={() => (editor = null)} />
{/if}

<style>
  .drop {
    display: flex;
    align-items: center;
    gap: 14px;
    width: 100%;
    padding: 18px;
    border: 2px dashed var(--line-strong);
    border-radius: 10px;
    background: var(--card);
    color: var(--ink);
    text-align: left;
    cursor: pointer;
    font-size: 14px;
  }
  .drop:hover,
  .drop.dropping {
    border-color: var(--blue);
    background: var(--blue-soft);
  }
  .sig {
    display: grid;
    grid-template-columns: 180px 1fr;
    gap: 14px;
    align-items: center;
  }
  .thumb {
    position: relative;
    height: 70px;
    background: #fff;
    border: 1px solid var(--line);
    border-radius: 6px;
    display: grid;
    place-items: center;
    padding: 6px;
  }
  .thumb img {
    max-width: 100%;
    max-height: 100%;
    position: relative;
    z-index: 1;
  }
  .line {
    position: absolute;
    left: 10px;
    right: 10px;
    bottom: 16px;
    border-top: 1.5px dotted #8a8f9a;
  }
  .meta {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 0;
  }
  @media (max-width: 520px) {
    .sig {
      grid-template-columns: 1fr;
    }
  }
</style>
