<script>
  import { app, exportBackup, importBackup, resetAll } from '../lib/store.svelte.js';
  import { toast } from '../lib/toast.svelte.js';
  import ConfirmButton from '../components/ConfirmButton.svelte';
  import Modal from '../components/Modal.svelte';
  import Icon from '../components/Icon.svelte';

  let pendingFile = $state(null);
  let fileInput;

  async function doExport() {
    try {
      const blob = await exportBackup();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const d = new Date();
      a.href = url;
      a.download = `vamnyilatkozat-mentes-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.json`;
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      toast('A mentés letöltve.');
    } catch (err) {
      toast(`A mentés nem sikerült: ${err.message || err}`, 'error', 6000);
    }
  }

  function pick(e) {
    pendingFile = e.currentTarget.files?.[0] || null;
    e.currentTarget.value = '';
  }

  async function doImport() {
    const file = pendingFile;
    pendingFile = null;
    try {
      await importBackup(file);
      toast('A mentés visszatöltve.');
    } catch (err) {
      toast(err.message || String(err), 'error', 6000);
    }
  }

  async function doReset() {
    await resetAll();
    toast('Minden adat törölve ebből a böngészőből.');
  }
</script>

<div class="stack">
  <section class="card">
    <h2 class="section-title">Hol vannak az adataim?</h2>
    <p class="text">Kizárólag ebben a böngészőben (IndexedDB). Az oldal semmit nem küld szerverre, és nem használ külső szolgáltatást vagy követőkódot. Ha törlöd a böngésző adatait, vagy másik gépet, böngészőt használsz, az adatok ott nem lesznek meg. Ezért érdemes időnként menteni.</p>
    <p class="hint">Jelenleg: {app.data.shipments.length} küldemény, {app.data.shops.length} saját feladó, {app.data.signatures.length} aláírás.</p>
  </section>

  <section class="card">
    <h2 class="section-title">Mentés fájlba</h2>
    <p class="text">Egyetlen JSON fájl, benne minden adat és az aláírásképek is. A fájl a te gépedre töltődik le. Személyes adatokat tartalmaz, ezért úgy kezeld.</p>
    <button type="button" class="btn primary" onclick={doExport}><Icon name="download" size={16} /> Mentés letöltése</button>
  </section>

  <section class="card">
    <h2 class="section-title">Visszatöltés</h2>
    <p class="text">Egy korábbi mentés visszatöltése a mostani adatokat teljesen lecseréli.</p>
    <input bind:this={fileInput} type="file" accept="application/json,.json" class="sr-only" onchange={pick} />
    <button type="button" class="btn" onclick={() => fileInput.click()}><Icon name="upload" size={16} /> Mentés kiválasztása…</button>
  </section>

  <section class="card">
    <h2 class="section-title">Minden adat törlése</h2>
    <p class="text">Törli a küldeményeket, a saját adataidat, a feladókat, a listákat és az aláírásokat ebből a böngészőből.</p>
    <ConfirmButton label="Minden adat törlése" confirmLabel="Igen, mindent törlök" onconfirm={doReset} />
  </section>
</div>

{#if pendingFile}
  <Modal title="Mentés visszatöltése" onclose={() => (pendingFile = null)}>
    <p>A(z) <b>{pendingFile.name}</b> visszatöltése lecseréli az összes mostani adatot (küldemények, saját adatok, feladók, listák, aláírások). Ez nem vonható vissza.</p>
    {#snippet footer()}
      <button type="button" class="btn" onclick={() => (pendingFile = null)}>Mégse</button>
      <button type="button" class="btn danger armed" onclick={doImport}>Lecserélem</button>
    {/snippet}
  </Modal>
{/if}

<style>
  .text {
    margin: 0 0 10px;
    font-size: 14.5px;
  }
</style>
