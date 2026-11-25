<script>
  import { app } from '../lib/store.svelte.js';

  let p = $derived(app.data.profile);
</script>

<div class="stack">
  <p class="hint">Ezek az adatok minden nyilatkozatra rákerülnek. <span class="local-note"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>Csak ebben a böngészőben tárolódnak.</span></p>

  <section class="card">
    <h2 class="section-title"><b class="num">(4)</b> Nyilatkozatot benyújtó adatai</h2>
    <div class="grid-2">
      <label class="field span-2">
        <span>Név</span>
        <input type="text" bind:value={p.name} autocomplete="name" />
      </label>
      <label class="field">
        <span>Irányítószám</span>
        <input class="mono" type="text" bind:value={p.zip} autocomplete="postal-code" inputmode="numeric" />
      </label>
      <label class="field">
        <span>Település</span>
        <input type="text" bind:value={p.city} autocomplete="address-level2" />
      </label>
      <label class="field span-2">
        <span>Cím (utca, házszám)</span>
        <input type="text" bind:value={p.address} autocomplete="street-address" />
      </label>
      <label class="field">
        <span>Telefonszám</span>
        <input type="tel" bind:value={p.phone} autocomplete="tel" />
      </label>
      <label class="field">
        <span>E-mail-cím</span>
        <input type="email" bind:value={p.email} autocomplete="email" />
      </label>
    </div>
  </section>

  <section class="card">
    <h2 class="section-title"><b class="num">(3)</b> Küldeményen szereplő címadatok</h2>
    <label class="check">
      <input type="checkbox" bind:checked={p.parcelDiffers} />
      A csomagon más név vagy cím szerepel
    </label>
    {#if p.parcelDiffers}
      <div class="grid-2 parcel">
        <label class="field span-2">
          <span>Név</span>
          <input type="text" bind:value={p.parcel.name} />
        </label>
        <label class="field">
          <span>Irányítószám</span>
          <input class="mono" type="text" bind:value={p.parcel.zip} inputmode="numeric" />
        </label>
        <label class="field">
          <span>Település</span>
          <input type="text" bind:value={p.parcel.city} />
        </label>
        <label class="field span-2">
          <span>Cím (utca, házszám)</span>
          <input type="text" bind:value={p.parcel.address} />
        </label>
      </div>
    {:else}
      <p class="hint">A (3) rovatba is a fenti név és cím kerül.</p>
    {/if}
  </section>
</div>

<style>
  .parcel {
    margin-top: 12px;
  }
  .check {
    margin-bottom: 4px;
  }
</style>
