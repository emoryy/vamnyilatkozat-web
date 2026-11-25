<script>
  import { COUNTRIES } from '../lib/catalog.js';
  import Icon from './Icon.svelte';

  // `shop` is a live entry of the saved shops list; edits apply as they are typed.
  let { shop, ondone, doneLabel = 'Kész' } = $props();
  const listId = `countries-${Math.random().toString(36).slice(2, 9)}`;
</script>

<div class="grid-2">
  <label class="field span-2">
    <span>Név (ahogy a számlán, csomagon szerepel)</span>
    <input type="text" bind:value={shop.name} placeholder="pl. Example Hobby Co., Ltd." />
  </label>
  <label class="field span-2">
    <span>Megjelenő név a listában <i class="opt">(nem kötelező)</i></span>
    <input type="text" bind:value={shop.label} placeholder="pl. Kedvenc boltom" />
  </label>
  <label class="field">
    <span>Ország</span>
    <input type="text" list={listId} bind:value={shop.country} />
  </label>
  <label class="field">
    <span>Irányítószám</span>
    <input class="mono" type="text" bind:value={shop.zip} />
  </label>
  <label class="field span-2">
    <span>Település</span>
    <input type="text" bind:value={shop.city} />
  </label>
  <label class="field span-2">
    <span>Közelebbi cím</span>
    <input type="text" bind:value={shop.address} placeholder="utca, házszám, épület, kerület" />
  </label>
</div>
<datalist id={listId}>
  {#each COUNTRIES as c (c)}<option value={c}></option>{/each}
</datalist>
<div class="row end">
  <button type="button" class="btn primary small" onclick={ondone}><Icon name="check" size={16} /> {doneLabel}</button>
</div>

<style>
  .opt {
    font-style: normal;
    font-weight: 400;
    color: var(--ink-3);
  }
  .end {
    justify-content: flex-end;
    margin-top: 10px;
  }
</style>
