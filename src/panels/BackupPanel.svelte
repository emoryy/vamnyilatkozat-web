<script>
  import { app, exportBackup, importBackup, resetAll } from '../lib/store.svelte.js';
  import { toast } from '../lib/toast.svelte.js';
  import { todayIso } from '../lib/input.js';
  import { downloadBlob } from '../lib/download.js';
  import ConfirmButton from '../components/ConfirmButton.svelte';
  import Modal from '../components/Modal.svelte';
  import Icon from '../components/Icon.svelte';

  let pendingFile = $state(null);
  let fileInput;

  async function doExport() {
    try {
      downloadBlob(await exportBackup(), `vamnyilatkozat-mentes-${todayIso()}.json`);
      toast('Az export letöltve.');
    } catch (err) {
      toast(`Az export nem sikerült: ${err.message || err}`, 'error', 6000);
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
      toast('Az import kész, az adatok betöltve.');
    } catch (err) {
      toast(err.message || String(err), 'error', 6000);
    }
  }

  async function doReset() {
    try {
      await resetAll();
      toast('Minden adat törölve ebből a böngészőből.');
    } catch (err) {
      toast(err.message || String(err), 'error', 6000);
    }
  }
</script>

<div class="stack">
  <section class="card">
    <h2 class="section-title">Hol vannak az adataim?</h2>
    <p class="text">Minden, amit beírsz vagy feltöltesz, automatikusan mentődik, de kizárólag ebben a böngészőben (IndexedDB). Az oldal semmit nem küld szerverre, és nem használ külső szolgáltatást vagy követőkódot.</p>
    <p class="text">Ez a fül arra való, hogy az adataidat fájlba exportáld, és onnan visszatöltsd: például másik gépre vagy böngészőbe költözéshez, vagy arra az esetre, ha a böngésző adatai törlődnének.</p>
    <p class="hint">Jelenleg: {app.data.shipments.length} küldemény, {app.data.shops.length} saját feladó, {app.data.signatures.length} aláírás.</p>
  </section>

  <section class="card">
    <h2 class="section-title">Exportálás fájlba</h2>
    <p class="text">Egyetlen JSON fájl, benne minden adat és az aláírásképek is. A fájl a te gépedre töltődik le. Személyes adatokat tartalmaz, ezért úgy kezeld.</p>
    <button type="button" class="btn primary" onclick={doExport}><Icon name="download" size={16} /> Exportálás (letöltés)</button>
  </section>

  <section class="card">
    <h2 class="section-title">Importálás fájlból</h2>
    <p class="text">Egy korábban exportált fájl betöltése a mostani adatokat teljesen lecseréli.</p>
    <input bind:this={fileInput} type="file" accept="application/json,.json" class="sr-only" onchange={pick} />
    <button type="button" class="btn" onclick={() => fileInput.click()}><Icon name="upload" size={16} /> Exportált fájl kiválasztása…</button>
  </section>

  <section class="card">
    <h2 class="section-title">Minden adat törlése</h2>
    <p class="text">Törli a küldeményeket, a saját adataidat, a feladókat, a listákat és az aláírásokat ebből a böngészőből.</p>
    <ConfirmButton label="Minden adat törlése" confirmLabel="Igen, mindent törlök" onconfirm={doReset} />
  </section>
</div>

{#if pendingFile}
  <Modal title="Importálás fájlból" onclose={() => (pendingFile = null)}>
    <p>A(z) <b>{pendingFile.name}</b> importálása lecseréli az összes mostani adatot (küldemények, saját adatok, feladók, listák, aláírások). Ez nem vonható vissza.</p>
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
