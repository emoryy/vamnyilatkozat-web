<script>
  import { app, uid, shopLabel, blankShop, isBlankShop, removeShop } from '../lib/store.svelte.js';
  import { BUILTIN_SHOPS } from '../lib/catalog.js';
  import ConfirmButton from '../components/ConfirmButton.svelte';
  import ShopForm from '../components/ShopForm.svelte';
  import Icon from '../components/Icon.svelte';

  let editingId = $state(null);
  let showBuiltin = $state(false);

  function add(from) {
    const shop = from ? { ...from, id: uid(), label: `${shopLabel(from)} (saját)` } : blankShop();
    delete shop.builtin;
    app.data.shops = [shop, ...app.data.shops];
    editingId = shop.id;
  }

  // A sender closed while completely empty was opened by mistake; it is not kept.
  function done(shop) {
    editingId = null;
    if (isBlankShop(shop) && !usedBy(shop.id)) removeShop(shop.id);
  }

  function remove(id) {
    removeShop(id);
    if (editingId === id) editingId = null;
  }

  function usedBy(id) {
    return app.data.shipments.filter((s) => s.shopId === id).length;
  }
</script>

<div class="stack">
  <p class="hint">A <b class="num">(2)</b> „Feladó adatai” rovat: a külföldi webshop, amelyik a csomagot feladta. Az ismert japán webshopok eleve választhatók, sajátot itt vehetsz fel.</p>

  <div class="row">
    <button type="button" class="btn primary" onclick={() => add(null)}><Icon name="plus" size={16} /> Új feladó</button>
  </div>

  {#if !app.data.shops.length}
    <div class="empty">Még nincs saját feladód. Ha a webshop nincs az ismertek között, vedd fel itt.</div>
  {/if}

  {#each app.data.shops as shop (shop.id)}
    <article class="card shop">
      {#if editingId === shop.id}
        <ShopForm {shop} ondone={() => done(shop)} />
      {:else}
        <div class="shop-view">
          <div>
            <h3>{shopLabel(shop)}</h3>
            <p>{shop.name}<br />{shop.zip} {shop.city}, {shop.country}<br />{shop.address}</p>
            {#if usedBy(shop.id)}<span class="badge">{usedBy(shop.id)} küldeményben</span>{/if}
          </div>
          <div class="row">
            <button type="button" class="btn small" onclick={() => (editingId = shop.id)}><Icon name="edit" size={16} /> Szerkesztés</button>
            <ConfirmButton small label="Törlés" onconfirm={() => remove(shop.id)} />
          </div>
        </div>
      {/if}
    </article>
  {/each}

  <section>
    <button type="button" class="btn ghost" onclick={() => (showBuiltin = !showBuiltin)} aria-expanded={showBuiltin}>
      <span class="chev" class:open={showBuiltin}><Icon name="chevron" size={16} /></span>
      Ismert japán webshopok ({BUILTIN_SHOPS.length})
    </button>
    {#if showBuiltin}
      <ul class="builtin">
        {#each BUILTIN_SHOPS as shop (shop.id)}
          <li>
            <div>
              <strong>{shop.label}</strong>
              <span>{shop.name} · {shop.zip} {shop.city} · {shop.address}</span>
            </div>
            <button type="button" class="btn small" onclick={() => add(shop)} title="Saját, szerkeszthető példány készítése">Másolat</button>
          </li>
        {/each}
      </ul>
      <p class="hint">A beépített címek a webshopok saját jogi közlemény / cégadat oldaláról származnak (2026. november). Ha a csomagon vagy a számlán más cím áll, készíts belőle másolatot, és javítsd ki.</p>
    {/if}
  </section>
</div>

<style>
  h3 {
    font-size: 16px;
    font-weight: 800;
    margin-bottom: 4px;
  }
  .shop-view {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: flex-start;
  }
  .shop-view p {
    margin: 0 0 6px;
    font-size: 14px;
    color: var(--ink-2);
  }
  .chev {
    display: inline-grid;
    transform: rotate(-90deg);
    transition: transform 0.15s;
  }
  .chev.open {
    transform: none;
  }
  .builtin {
    list-style: none;
    margin: 6px 0 8px;
    padding: 0;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--card);
  }
  .builtin li {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    border-bottom: 1px solid var(--line);
    font-size: 14px;
  }
  .builtin li:last-child {
    border-bottom: none;
  }
  .builtin span {
    display: block;
    color: var(--ink-2);
    font-size: 13px;
  }
  @media (max-width: 520px) {
    .shop-view {
      flex-direction: column;
    }
  }
</style>
