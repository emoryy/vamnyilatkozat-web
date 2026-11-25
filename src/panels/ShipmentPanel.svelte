<script>
  import {
    app, currentShipment, newShipment, emptyItem, allShops, findShop, shopLabel,
    termOptions, docOptions, remember, uid, blankShop, isBlankShop, removeShop,
  } from '../lib/store.svelte.js';
  import { CURRENCIES } from '../lib/catalog.js';
  import { formatMoney, itemRows, isFilledItem } from '../lib/declaration.js';
  import { todayIso } from '../lib/input.js';
  import { MAX_ROWS } from '../lib/field-map.js';
  import Combobox from '../components/Combobox.svelte';
  import ConfirmButton from '../components/ConfirmButton.svelte';
  import Icon from '../components/Icon.svelte';
  import ShopForm from '../components/ShopForm.svelte';
  import { toast } from '../lib/toast.svelte.js';

  let { onnavigate } = $props();

  let s = $derived(currentShipment());
  let shop = $derived(findShop(s.shopId));
  let shops = $derived(allShops());
  let ownShops = $derived(shops.filter((x) => !x.builtin));
  let builtinShops = $derived(shops.filter((x) => x.builtin));
  let terms = $derived(termOptions());
  let docChoices = $derived(docOptions().filter((o) => !s.docs.includes(o.value)));
  let newDoc = $state('');
  let editingShopId = $state(null);
  // The sender created here whose form is still open. Only such a one is dropped when
  // left empty; an existing sender emptied by hand may still be used by other shipments.
  let newShopId = null;

  const NEW_SHOP = '__new';

  function pickShop(value) {
    if (value !== editingShopId) finishShop();
    if (value === NEW_SHOP) createShop();
    else s.shopId = value;
  }

  // A new sender left completely empty was opened by mistake; it is not kept.
  function finishShop() {
    const id = newShopId;
    editingShopId = null;
    newShopId = null;
    const sh = id && app.data.shops.find((x) => x.id === id);
    if (sh && isBlankShop(sh)) removeShop(id);
  }

  function createShop() {
    finishShop();
    const shop = blankShop();
    app.data.shops = [shop, ...app.data.shops];
    s.shopId = shop.id;
    editingShopId = newShopId = shop.id;
  }

  // Switching to another shipment or tab closes the sender form like its Kész button.
  let shipmentId = $derived(s.id);
  $effect(() => {
    shipmentId;
    return finishShop;
  });

  // A shipment without a tracking number yet is named by the day it was created.
  function shipmentLabel(x) {
    const created = new Date(x.createdAt).toLocaleDateString('hu-HU');
    const parts = [x.trackingNum?.trim() || `Új küldemény (${created})`];
    const sh = findShop(x.shopId);
    if (sh) parts.push(shopLabel(sh));
    return parts.join(' · ');
  }

  let sortedShipments = $derived([...app.data.shipments].sort((a, b) => b.createdAt - a.createdAt));

  // Nothing entered yet: an untouched shipment.
  function isUntouched(x) {
    return !x.trackingNum?.trim() && !x.shopId && !x.docs.length
      && (x.shippingCost === '' || x.shippingCost === null) && !x.items.some(isFilledItem);
  }

  let untouched = $derived(isUntouched(s));

  function addShipment() {
    // A second empty shipment would only leave the user unsure which one to fill in.
    if (untouched) {
      toast('Ez a küldemény még üres: töltsd ki ezt, újat csak egy másik csomaghoz kell felvenni.');
      return;
    }
    const n = newShipment(s);
    app.data.shipments = [...app.data.shipments, n];
    app.data.currentShipmentId = n.id;
  }

  function duplicateShipment() {
    const copy = $state.snapshot(s);
    copy.id = uid();
    copy.trackingNum = '';
    copy.createdAt = Date.now();
    copy.items = copy.items.map((it) => ({ ...it, id: uid() }));
    app.data.shipments = [...app.data.shipments, copy];
    app.data.currentShipmentId = copy.id;
  }

  function deleteShipment() {
    const rest = app.data.shipments.filter((x) => x.id !== s.id);
    if (!rest.length) rest.push(newShipment(s));
    app.data.shipments = rest;
    app.data.currentShipmentId = [...rest].sort((a, b) => b.createdAt - a.createdAt)[0].id;
  }

  function addItem() {
    s.items.push(emptyItem());
  }

  function removeItem(i) {
    s.items.splice(i, 1);
    if (!s.items.length) s.items.push(emptyItem());
  }

  function moveItem(i, dir) {
    const j = i + dir;
    if (j < 0 || j >= s.items.length) return;
    const [it] = s.items.splice(i, 1);
    s.items.splice(j, 0, it);
  }

  function copyItem(i) {
    s.items.splice(i + 1, 0, { ...$state.snapshot(s.items[i]), id: uid() });
  }

  function addDoc(value) {
    const v = (value ?? newDoc).trim();
    if (!v) return;
    if (!s.docs.includes(v)) s.docs.push(v);
    remember('docs', v);
    newDoc = '';
  }

  function removeDoc(i) {
    s.docs.splice(i, 1);
  }

  function lineTotal(it) {
    const q = Number(it.qty) > 0 ? Number(it.qty) : 1;
    return (Number(it.unitPrice) || 0) * q;
  }

  let itemsTotal = $derived(s.items.reduce((sum, it) => sum + lineTotal(it), 0));
  // Blank rows are left off the form, so only filled ones count towards the continuation sheet.
  let filledCount = $derived(itemRows(s.items).length);
  // The number each row gets on the form; blank rows are not printed and get none.
  let printedNumbers = $derived.by(() => {
    let n = 0;
    return s.items.map((it) => (isFilledItem(it) ? ++n : null));
  });
</script>

<div class="stack">
  <div class="picker card">
    <div class="row">
      <button type="button" class="btn small" onclick={addShipment}><Icon name="plus" size={16} /> Új küldemény</button>
      <button type="button" class="btn small" onclick={duplicateShipment}><Icon name="copy" size={16} /> Másolat</button>
      <ConfirmButton small label="Törlés" confirmLabel="Biztosan törlöd?" onconfirm={deleteShipment} />
    </div>
    {#if app.data.shipments.length > 1}
      <label class="field">
        <span>Szerkesztett küldemény ({app.data.shipments.length} mentett közül)</span>
        <select bind:value={app.data.currentShipmentId}>
          {#each sortedShipments as x (x.id)}
            <option value={x.id}>{shipmentLabel(x)}</option>
          {/each}
        </select>
      </label>
    {:else}
      <div class="field">
        <span>Szerkesztett küldemény</span>
        <strong class="current">{shipmentLabel(s)}</strong>
      </div>
    {/if}
    {#if untouched}
      <p class="hint start">Itt kezdheted: töltsd ki lent az adatokat, az előnézet közben frissül. Új küldeményt akkor vegyél fel, ha egy másik csomaghoz is nyilatkozat kell.</p>
    {/if}
  </div>

  <section class="card">
    <h2 class="section-title">Alapadatok</h2>
    <div class="grid-2">
      <label class="field span-2">
        <span><b class="num">(1)</b> Küldeményazonosító (követési szám)</span>
        <input class="mono" type="text" bind:value={s.trackingNum} placeholder="pl. EB123456789JP" autocomplete="off" />
      </label>
      <label class="field">
        <span>Dátum</span>
        <input type="date" value={s.date || todayIso()} onchange={(e) => (s.date = e.currentTarget.value === todayIso() ? '' : e.currentTarget.value)} />
      </label>
      <label class="field">
        <span>Devizanem</span>
        <select bind:value={s.currency}>
          {#each CURRENCIES as c (c)}<option value={c}>{c}</option>{/each}
        </select>
      </label>
    </div>
    {#if s.date}
      <p class="hint">Rögzített dátum. <button type="button" class="link" onclick={() => (s.date = '')}>Legyen mindig a mai nap</button></p>
    {:else}
      <p class="hint">A dátum mindig a mai nap, amíg nem választasz másikat.</p>
    {/if}
  </section>

  <section class="card">
    <h2 class="section-title"><b class="num">(2)</b> Feladó</h2>
    <div class="field">
      <label for="shop-select">Webshop, amelyik feladta</label>
      <div class="shop-pick">
        <select id="shop-select" value={s.shopId} onchange={(e) => pickShop(e.currentTarget.value)}>
          <option value="">Válassz feladót…</option>
          {#if ownShops.length}
            <optgroup label="Saját feladók">
              {#each ownShops as x (x.id)}<option value={x.id}>{shopLabel(x)}</option>{/each}
            </optgroup>
          {/if}
          <optgroup label="Ismert japán webshopok">
            {#each builtinShops as x (x.id)}<option value={x.id}>{shopLabel(x)}</option>{/each}
          </optgroup>
          <optgroup label="Nincs a listában?">
            <option value={NEW_SHOP}>＋ Új feladó felvétele…</option>
          </optgroup>
        </select>
        <button type="button" class="btn" onclick={createShop}><Icon name="plus" size={16} /> Új feladó</button>
      </div>
    </div>
    {#if shop && editingShopId === shop.id}
      <div class="inline-form">
        <p class="hint">Írd be a feladót úgy, ahogy a számlán vagy a csomagon szerepel. A saját feladóid közé kerül, máskor is választható.</p>
        <ShopForm {shop} doneLabel="Kész" ondone={finishShop} />
      </div>
    {:else if shop}
      <address class="addr">
        <strong>{shop.name || 'Név nélkül'}</strong><br />
        {shop.zip} {shop.city}, {shop.country}<br />
        {shop.address}
        {#if app.data.shops.some((x) => x.id === shop.id)}
          <button type="button" class="link edit" onclick={() => (editingShopId = shop.id)}>Szerkesztés</button>
        {/if}
      </address>
    {:else}
      <p class="hint">Ha a webshop nincs a listában, vedd fel az „Új feladó” gombbal: egyszer kell megadni, utána mindig választható.</p>
    {/if}
  </section>

  <section class="card">
    <div class="items-head">
      <h2 class="section-title"><b class="num">(5)-(11)</b> Tételek</h2>
      <span class="hint">{filledCount} tétel{#if filledCount > MAX_ROWS}, ebből {filledCount - MAX_ROWS} pótlapra kerül{/if}</span>
    </div>

    <ol class="items">
      {#each s.items as it, i (it.id)}
        <li class="item">
          <div class="item-top">
            <span class="idx mono" title={printedNumbers[i] ? undefined : 'Üres sor, nem kerül a nyomtatványra'}>{printedNumbers[i] ? `${printedNumbers[i]}.` : '·'}</span>
            <div class="field grow">
              <span class="sr-only">Megnevezés</span>
              <Combobox bind:value={it.term} options={terms} label="Megnevezés" placeholder="Megnevezés, pl. Műanyag gyűjtői figura (dísztárgy)" oncommit={(v) => remember('terms', v)} />
            </div>
            <div class="item-tools">
              <button type="button" class="icon-btn" title="Feljebb" aria-label="Feljebb" onclick={() => moveItem(i, -1)} disabled={i === 0}><Icon name="up" size={16} /></button>
              <button type="button" class="icon-btn" title="Lejjebb" aria-label="Lejjebb" onclick={() => moveItem(i, 1)} disabled={i === s.items.length - 1}><Icon name="down" size={16} /></button>
              <button type="button" class="icon-btn" title="Tétel másolása" aria-label="Tétel másolása" onclick={() => copyItem(i)}><Icon name="copy" size={16} /></button>
              <button type="button" class="icon-btn danger" title="Tétel törlése" aria-label="Tétel törlése" onclick={() => removeItem(i)}><Icon name="trash" size={16} /></button>
            </div>
          </div>
          <div class="item-grid">
            <label class="field">
              <span><b class="num">(6)</b> Menny. (db)</span>
              <input type="number" min="1" step="1" inputmode="numeric" bind:value={it.qty} />
            </label>
            <label class="field">
              <span><b class="num">(7)</b> Egységár ({s.currency})</span>
              <input type="number" min="0" step="any" inputmode="decimal" bind:value={it.unitPrice} placeholder="0" />
            </label>
            <div class="field">
              <span><b class="num">(8)</b> Összérték</span>
              <output class="total mono">{formatMoney(lineTotal(it), s.currency)}</output>
            </div>
            <label class="field">
              <span><b class="num">(9)</b> M-PID</span>
              <input class="mono" type="text" bind:value={it.mpid} placeholder="nincs" title="Kereskedői termékazonosító (a webshop saját cikkszáma)" />
            </label>
            <label class="field">
              <span><b class="num">(10)</b> NS-PID</span>
              <input class="mono" type="text" bind:value={it.nspid} placeholder="nincs" title="Nem szabványos gyártói termékazonosító (pl. a gyártó saját sorszáma)" />
            </label>
            <label class="field">
              <span><b class="num">(11)</b> S-PID</span>
              <input class="mono" type="text" bind:value={it.spid} placeholder="nincs" title="Szabványos gyártói termékazonosító (JAN / EAN vonalkód)" />
            </label>
          </div>
        </li>
      {/each}
    </ol>
    <div class="row between">
      <button type="button" class="btn small" onclick={addItem}><Icon name="plus" size={16} /> Új tétel</button>
      <span class="sum">Tételek összesen: <b class="mono">{formatMoney(itemsTotal, s.currency)}</b></span>
    </div>
    <p class="hint">Az üresen hagyott azonosítók helyére „nincs” kerül. M-PID: a webshop cikkszáma, NS-PID: a gyártó saját száma, S-PID: JAN/EAN vonalkód.</p>
  </section>

  <section class="card">
    <h2 class="section-title"><b class="num">(12)</b> Csatolt okmányok, dokumentumok listája</h2>
    <p class="hint docs-hint">Itt csak a nyilatkozathoz csatolt dokumentumok megnevezését adod meg (pl. számla, fizetési igazolás), ezek kerülnek a (12) rovatba. Magukat a fájlokat nem kell ide feltölteni.</p>
    {#if s.docs.length}
      <ul class="chips">
        {#each s.docs as d, i (d)}
          <li class="chip">
            {d}
            <button type="button" aria-label={`${d} eltávolítása`} onclick={() => removeDoc(i)}><Icon name="x" size={14} /></button>
          </li>
        {/each}
      </ul>
    {/if}
    <div class="doc-add">
      <Combobox bind:value={newDoc} options={docChoices} label="Csatolt dokumentum" placeholder="Válassz vagy írj be egy dokumentumot" oncommit={(v) => v && addDoc(v)} />
      <button type="button" class="btn" onclick={() => addDoc()} disabled={!newDoc.trim()}><Icon name="plus" size={16} /> Hozzáadás</button>
    </div>
  </section>

  <section class="card">
    <div class="grid-2">
      <label class="field">
        <span><b class="num">(13)</b> Szállítási költség ({s.currency})</span>
        <input type="number" min="0" step="any" inputmode="decimal" bind:value={s.shippingCost} placeholder="0, ha ingyenes volt" />
      </label>
      <label class="field">
        <span>Aláírás</span>
        {#if app.data.signatures.length}
          <select bind:value={s.signatureId}>
            <option value="">Az első ({app.data.signatures[0].name})</option>
            {#each app.data.signatures as sig (sig.id)}<option value={sig.id}>{sig.name}</option>{/each}
          </select>
        {:else}
          <button type="button" class="btn" onclick={() => onnavigate('signature')}>Aláírás feltöltése</button>
        {/if}
      </label>
    </div>
  </section>
</div>

<style>
  .picker {
    display: flex;
    flex-direction: column;
    gap: 10px;
    background: var(--paper-2);
  }
  .link {
    border: none;
    background: none;
    padding: 0;
    color: var(--blue);
    text-decoration: underline;
    cursor: pointer;
    font-size: inherit;
  }
  .picker .field {
    margin-top: 12px;
  }
  .current {
    font-family: var(--f-display);
    font-size: 16px;
  }
  .picker .start {
    margin: 0;
  }
  .shop-pick {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 8px;
  }
  .inline-form {
    margin-top: 12px;
    padding: 12px;
    border: 1px solid var(--line-strong);
    border-left: 3px solid var(--blue);
    border-radius: 0 8px 8px 0;
    background: var(--paper);
  }
  .inline-form .hint {
    margin: 0 0 10px;
  }
  .edit {
    display: block;
    margin-top: 6px;
    font-size: 13.5px;
  }
  /* The .card prefix outweighs the global spacing rule for hints under a control. */
  .card > .docs-hint {
    margin: -4px 0 12px;
  }
  .addr {
    font-style: normal;
    margin-top: 10px;
    padding: 8px 12px;
    border-left: 3px solid var(--line-strong);
    background: var(--paper);
    font-size: 14px;
    line-height: 1.5;
  }
  .items-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 8px;
  }
  .items {
    list-style: none;
    margin: 0 0 10px;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .item {
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 10px;
    background: var(--paper);
  }
  .item:nth-child(n + 6) {
    border-style: dashed;
  }
  .item-top {
    display: flex;
    gap: 8px;
    align-items: center;
    margin-bottom: 8px;
  }
  .idx {
    font-weight: 500;
    color: var(--red);
    width: 24px;
    flex: none;
  }
  .grow {
    flex: 1;
  }
  .item-tools {
    display: flex;
  }
  .item-tools .icon-btn {
    width: 28px;
    height: 28px;
  }
  .item-tools .icon-btn:disabled {
    opacity: 0.3;
    cursor: default;
  }
  .item-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px 10px;
    padding-left: 32px;
  }
  .total {
    padding: 7px 0;
    font-size: 15px;
  }
  .between {
    justify-content: space-between;
  }
  .sum {
    font-size: 14px;
  }
  .chips {
    list-style: none;
    padding: 0;
    margin: 0 0 10px;
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: var(--blue-soft);
    color: var(--blue);
    border: 1px solid #b9c6e6;
    border-radius: 99px;
    padding: 3px 4px 3px 11px;
    font-size: 14px;
    font-weight: 600;
  }
  .chip button {
    border: none;
    background: none;
    color: inherit;
    cursor: pointer;
    display: grid;
    place-items: center;
    width: 22px;
    height: 22px;
    border-radius: 50%;
  }
  .chip button:hover {
    background: #c7d3ef;
  }
  .doc-add {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 8px;
  }
  @media (max-width: 520px) {
    .item-top {
      flex-wrap: wrap;
    }
    .item-top .grow {
      order: 3;
      flex-basis: 100%;
    }
    .item-tools {
      margin-left: auto;
    }
    .item-grid {
      grid-template-columns: 1fr 1fr;
      padding-left: 0;
    }
  }
</style>
