<script>
  import {
    app, currentShipment, newShipment, emptyItem, allShops, findShop, shopLabel,
    termOptions, docOptions, remember, uid,
  } from '../lib/store.svelte.js';
  import { CURRENCIES } from '../lib/catalog.js';
  import { formatMoney, itemRows } from '../lib/declaration.js';
  import { todayIso } from '../lib/input.js';
  import { MAX_ROWS } from '../lib/field-map.js';
  import Combobox from '../components/Combobox.svelte';
  import ConfirmButton from '../components/ConfirmButton.svelte';
  import Icon from '../components/Icon.svelte';

  let { onnavigate } = $props();

  let s = $derived(currentShipment());
  let shop = $derived(findShop(s.shopId));
  let shops = $derived(allShops());
  let ownShops = $derived(shops.filter((x) => !x.builtin));
  let builtinShops = $derived(shops.filter((x) => x.builtin));
  let terms = $derived(termOptions());
  let docChoices = $derived(docOptions().filter((o) => !s.docs.includes(o.value)));
  let newDoc = $state('');

  function shipmentLabel(x) {
    const parts = [x.trackingNum?.trim() || 'Követési szám nélkül'];
    const sh = findShop(x.shopId);
    if (sh) parts.push(shopLabel(sh));
    return parts.join(' · ');
  }

  let sortedShipments = $derived([...app.data.shipments].sort((a, b) => b.createdAt - a.createdAt));

  function addShipment() {
    const n = newShipment(s);
    app.data.shipments = [...app.data.shipments, n];
    app.data.currentShipmentId = n.id;
  }

  function duplicateShipment() {
    const copy = JSON.parse(JSON.stringify($state.snapshot(s)));
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
</script>

<div class="stack">
  <div class="picker card">
    <label class="field">
      <span>Küldemény</span>
      <select bind:value={app.data.currentShipmentId}>
        {#each sortedShipments as x (x.id)}
          <option value={x.id}>{shipmentLabel(x)}</option>
        {/each}
      </select>
    </label>
    <div class="row">
      <button type="button" class="btn small" onclick={addShipment}><Icon name="plus" size={16} /> Új küldemény</button>
      <button type="button" class="btn small" onclick={duplicateShipment}><Icon name="copy" size={16} /> Másolat</button>
      <ConfirmButton small label="Törlés" confirmLabel="Biztosan törlöd?" onconfirm={deleteShipment} />
    </div>
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
      <p class="hint date-hint">Rögzített dátum. <button type="button" class="link" onclick={() => (s.date = '')}>Legyen mindig a mai nap</button></p>
    {:else}
      <p class="hint date-hint">A dátum mindig a mai nap, amíg nem választasz másikat.</p>
    {/if}
  </section>

  <section class="card">
    <h2 class="section-title"><b class="num">(2)</b> Feladó</h2>
    <label class="field">
      <span>Webshop, amelyik feladta</span>
      <select bind:value={s.shopId}>
        <option value="">Válassz feladót…</option>
        {#if ownShops.length}
          <optgroup label="Saját feladók">
            {#each ownShops as x (x.id)}<option value={x.id}>{shopLabel(x)}</option>{/each}
          </optgroup>
        {/if}
        <optgroup label="Ismert japán webshopok">
          {#each builtinShops as x (x.id)}<option value={x.id}>{shopLabel(x)}</option>{/each}
        </optgroup>
      </select>
    </label>
    {#if shop}
      <address class="addr">
        <strong>{shop.name}</strong><br />
        {shop.zip} {shop.city}, {shop.country}<br />
        {shop.address}
      </address>
    {/if}
    <p class="hint">Nincs a listában? <button type="button" class="link" onclick={() => onnavigate('shops')}>Vegyél fel új feladót</button></p>
  </section>

  <section class="card">
    <div class="items-head">
      <h2 class="section-title"><b class="num">(5)-(11)</b> Tételek</h2>
      <span class="hint">{s.items.length} tétel{#if filledCount > MAX_ROWS}, ebből {filledCount - MAX_ROWS} pótlapra kerül{/if}</span>
    </div>

    <ol class="items">
      {#each s.items as it, i (it.id)}
        <li class="item">
          <div class="item-top">
            <span class="idx mono">{i + 1}.</span>
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
    <h2 class="section-title"><b class="num">(12)</b> Csatolt okmányok, dokumentumok</h2>
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
  .date-hint {
    margin-top: 8px;
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
    .item-grid {
      grid-template-columns: 1fr 1fr;
      padding-left: 0;
    }
  }
</style>
