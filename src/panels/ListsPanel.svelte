<script>
  import { app, remember } from '../lib/store.svelte.js';
  import { BUILTIN_TERMS, BUILTIN_DOCS } from '../lib/catalog.js';
  import Icon from '../components/Icon.svelte';

  const LISTS = [
    { key: 'terms', title: 'Megnevezések', num: '(5)', builtin: BUILTIN_TERMS, placeholder: 'pl. Fém kulcstartó dísz' },
    { key: 'docs', title: 'Csatolt okmányok, dokumentumok', num: '(12)', builtin: BUILTIN_DOCS, placeholder: 'pl. Vámérték-igazolás' },
  ];

  let drafts = $state({ terms: '', docs: '' });
  let openBuiltin = $state({ terms: false, docs: false });

  function add(key) {
    remember(key, drafts[key]);
    drafts[key] = '';
  }

  function remove(key, value) {
    app.data[key] = app.data[key].filter((v) => v !== value);
  }
</script>

<div class="stack">
  <p class="hint">Amit egy küldeménynél új megnevezésként vagy dokumentumként beírsz, az automatikusan ide kerül, így legközelebb választható. Innen törölheted is őket.</p>

  {#each LISTS as list (list.key)}
    <section class="card">
      <h2 class="section-title"><b class="num">{list.num}</b> {list.title}</h2>
      <form class="add" onsubmit={(e) => { e.preventDefault(); add(list.key); }}>
        <input class="input" type="text" bind:value={drafts[list.key]} placeholder={list.placeholder} aria-label={`Új elem: ${list.title}`} />
        <button type="submit" class="btn" disabled={!drafts[list.key].trim()}><Icon name="plus" size={16} /> Felvétel</button>
      </form>
      {#if app.data[list.key].length}
        <ul class="own">
          {#each app.data[list.key] as v (v)}
            <li>
              <span>{v}</span>
              <button type="button" class="icon-btn danger" aria-label={`${v} törlése`} title="Törlés" onclick={() => remove(list.key, v)}><Icon name="trash" size={16} /></button>
            </li>
          {/each}
        </ul>
      {:else}
        <p class="hint">Még nincs saját elem.</p>
      {/if}
      <button type="button" class="btn ghost small" onclick={() => (openBuiltin[list.key] = !openBuiltin[list.key])} aria-expanded={openBuiltin[list.key]}>
        {openBuiltin[list.key] ? 'Beépítettek elrejtése' : `Beépített elemek (${list.builtin.length})`}
      </button>
      {#if openBuiltin[list.key]}
        <ul class="builtin">
          {#each list.builtin as v (v)}<li>{v}</li>{/each}
        </ul>
      {/if}
    </section>
  {/each}
</div>

<style>
  .add {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 8px;
    margin-bottom: 10px;
  }
  .own {
    list-style: none;
    margin: 0 0 8px;
    padding: 0;
    border: 1px solid var(--line);
    border-radius: 8px;
  }
  .own li {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 3px 4px 3px 12px;
    border-bottom: 1px solid var(--line);
    font-size: 14px;
  }
  .own li:last-child {
    border-bottom: none;
  }
  .builtin {
    margin: 6px 0 0;
    padding-left: 20px;
    font-size: 14px;
    color: var(--ink-2);
    columns: 2;
    column-gap: 24px;
  }
  @media (max-width: 520px) {
    .builtin {
      columns: 1;
    }
  }
</style>
