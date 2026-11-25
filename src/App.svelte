<script>
  import { app, SAVE_ERROR, takeOver } from './lib/store.svelte.js';
  import Toasts from './components/Toasts.svelte';
  import Preview from './components/Preview.svelte';
  import ShipmentPanel from './panels/ShipmentPanel.svelte';
  import ShopsPanel from './panels/ShopsPanel.svelte';
  import ProfilePanel from './panels/ProfilePanel.svelte';
  import SignaturesPanel from './panels/SignaturesPanel.svelte';
  import ListsPanel from './panels/ListsPanel.svelte';
  import BackupPanel from './panels/BackupPanel.svelte';

  const TABS = [
    { id: 'shipment', label: 'Küldemény' },
    { id: 'shops', label: 'Feladók' },
    { id: 'profile', label: 'Adataim' },
    { id: 'signature', label: 'Aláírás' },
    { id: 'lists', label: 'Listák' },
    { id: 'backup', label: 'Export / import' },
  ];

  function readTab() {
    try {
      return localStorage.getItem('tab') || 'shipment';
    } catch {
      return 'shipment';
    }
  }

  let tab = $state(readTab());

  function select(id) {
    tab = id;
    try {
      localStorage.setItem('tab', id);
    } catch {
      // Remembering the tab is only a convenience.
    }
  }

  let needsProfile = $derived(app.ready && !app.data.profile.name.trim());
  let needsSignature = $derived(app.ready && !app.data.signatures.length);
  // Only a failed load or a failed write stops saving; e.g. an unreadable signature image does not.
  let saving = $derived(app.autosave && !app.error.startsWith(SAVE_ERROR));
</script>

<div class="shell">
  <header class="masthead">
    <div class="brand">
      <svg class="mark" viewBox="0 0 64 64" aria-hidden="true">
        <rect x="6" y="10" width="52" height="44" rx="4" fill="#fffdf8" stroke="currentColor" stroke-width="4" />
        <path d="M14 22h24M14 31h30M14 40h18" stroke="currentColor" stroke-width="4" stroke-linecap="round" />
        <circle cx="47" cy="40" r="9" fill="none" stroke="var(--red)" stroke-width="4" />
      </svg>
      <div>
        <h1>Vámnyilatkozat-kitöltő</h1>
        <p>Nyilatkozat automatikus postai vámkezelésű küldeményhez, 2026-10-es nyomtatvány</p>
      </div>
    </div>
    <p class="local">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
      Minden adat csak ebben a böngészőben marad, semmit nem küldünk el.
    </p>
  </header>

  <main>
    <aside class="sidebar">
      <nav class="tabs" aria-label="Szakaszok">
        {#each TABS as t (t.id)}
          <button
            type="button"
            class="tab"
            class:active={tab === t.id}
            aria-current={tab === t.id ? 'page' : undefined}
            onclick={() => select(t.id)}
          >
            {t.label}
            {#if (t.id === 'profile' && needsProfile) || (t.id === 'signature' && needsSignature)}<i class="dot" title="Még nincs kitöltve"></i>{/if}
          </button>
        {/each}
      </nav>

      <div class="panel">
        {#if app.error}<p class="notice warn">{app.error}</p>{/if}
        {#if !app.ready}
          <p class="hint">Betöltés…</p>
        {:else if tab === 'shipment'}
          <ShipmentPanel onnavigate={select} />
        {:else if tab === 'shops'}
          <ShopsPanel />
        {:else if tab === 'profile'}
          <ProfilePanel />
        {:else if tab === 'signature'}
          <SignaturesPanel />
        {:else if tab === 'lists'}
          <ListsPanel />
        {:else if tab === 'backup'}
          <BackupPanel />
        {/if}
      </div>

      {#if app.ready}
        <p class="save-status" class:bad={!saving}>
          {#if app.lock === 'lost'}
            Ez a lap szünetel, az alkalmazás egy másik lapon fut.
          {:else if !saving}
            Az adatok mentése most nem működik, lásd a figyelmeztetést.
          {:else}
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7" /></svg>
            Minden változás automatikusan mentődik ebben a böngészőben.
          {/if}
        </p>
      {/if}
      <footer class="disclaimer">
        Nem hivatalos segédeszköz, a Magyar Posta Zrt.-hez nincs köze. A kitöltött nyomtatvány tartalmáért a nyilatkozatot benyújtó felel.
      </footer>
    </aside>

    <section class="preview-area" aria-label="Előnézet">
      {#if app.ready}<Preview onnavigate={select} />{/if}
    </section>
  </main>
</div>

{#if app.lock === 'elsewhere' || app.lock === 'lost'}
  <div class="lock-veil" role="dialog" aria-modal="true" aria-labelledby="lock-title">
    <div class="lock-card">
      <h2 id="lock-title">{app.lock === 'lost' ? 'Ez a lap szünetel' : 'Az alkalmazás egy másik lapon már nyitva van'}</h2>
      <p>
        {#if app.lock === 'lost'}
          Az alkalmazást egy másik lapon kezdted használni, ezért ez a lap nem ment többé, hogy ne írja felül a másik lap adatait.
        {:else}
          Hogy a két lap ne írja felül egymás adatait, egyszerre csak egy lapon használható.
        {/if}
      </p>
      <p class="sub">Ha itt folytatod, a másik lap szünetel, és ez a lap a legutóbb mentett adatokkal indul.</p>
      <button type="button" class="btn primary" onclick={takeOver}>Használom ezen a lapon</button>
    </div>
  </div>
{/if}

<Toasts />

<style>
  .shell {
    height: 100%;
    display: grid;
    grid-template-rows: auto 1fr;
  }
  .masthead {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    padding: 12px 20px;
    border-bottom: 1px solid var(--line-strong);
    background: var(--paper);
    flex-wrap: wrap;
  }
  .brand {
    display: flex;
    gap: 12px;
    align-items: center;
  }
  .mark {
    width: 40px;
    height: 40px;
    color: var(--ink);
    flex: none;
  }
  h1 {
    font-size: 23px;
    font-weight: 800;
    line-height: 1.1;
  }
  .brand p {
    margin: 2px 0 0;
    font-size: 13px;
    color: var(--ink-2);
  }
  .local {
    display: flex;
    align-items: center;
    gap: 7px;
    margin: 0;
    font-size: 13.5px;
    font-weight: 600;
    color: var(--green);
    background: var(--green-soft);
    border: 1px solid #b6dbc3;
    padding: 5px 11px;
    border-radius: 99px;
  }
  main {
    display: grid;
    grid-template-columns: minmax(460px, 600px) 1fr;
    min-height: 0;
  }
  .sidebar {
    display: flex;
    flex-direction: column;
    min-height: 0;
    border-right: 1px solid var(--line-strong);
    background: var(--paper);
  }
  .tabs {
    display: flex;
    align-items: flex-end;
    gap: 4px;
    padding: 10px 10px 0;
    background: var(--paper-2);
    /* The bottom line is a shadow, so the active tab can cover it without negative margins
       (which made the bar scroll vertically). */
    box-shadow: inset 0 -1px 0 var(--line-strong);
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-width: thin;
  }
  .tab {
    position: relative;
    flex: none;
    border: 1px solid var(--line-strong);
    background: #d9ceb8;
    padding: 7px 11px 8px;
    font-family: var(--f-display);
    font-weight: 600;
    font-size: 14.5px;
    color: var(--ink-2);
    border-radius: 7px 7px 0 0;
    cursor: pointer;
    white-space: nowrap;
    box-shadow: inset 0 -3px 4px -3px rgba(24, 32, 47, 0.18);
  }
  .tab:hover {
    color: var(--ink);
    background: #e6dcc8;
  }
  .tab.active {
    background: var(--paper);
    border-bottom-color: var(--paper);
    color: var(--ink);
    padding-top: 9px;
    box-shadow: none;
  }
  .tab.active::before {
    content: '';
    position: absolute;
    left: -1px;
    right: -1px;
    top: -1px;
    height: 3px;
    border-radius: 7px 7px 0 0;
    background: var(--red);
  }
  .dot {
    display: inline-block;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--red);
    margin-left: 5px;
    vertical-align: 2px;
  }
  .panel {
    position: relative;
    flex: 1;
    overflow: auto;
    padding: 16px 16px 24px;
  }
  .lock-veil {
    position: fixed;
    inset: 0;
    z-index: 90;
    display: grid;
    place-items: center;
    padding: 16px;
    background: rgba(20, 24, 32, 0.6);
  }
  .lock-card {
    max-width: 480px;
    background: var(--paper);
    border: 1px solid var(--line-strong);
    border-top: 4px solid var(--red);
    border-radius: 10px;
    padding: 20px 22px;
    box-shadow: 0 30px 80px -20px rgba(0, 0, 0, 0.55);
  }
  .lock-card h2 {
    font-size: 20px;
    font-weight: 800;
    margin-bottom: 8px;
  }
  .lock-card p {
    margin: 0 0 10px;
    font-size: 15px;
  }
  .lock-card .sub {
    font-size: 14px;
    color: var(--ink-2);
    margin-bottom: 16px;
  }
  .save-status {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 0;
    padding: 7px 16px;
    font-size: 13px;
    font-weight: 600;
    color: var(--green);
    border-top: 1px solid var(--line);
    background: var(--green-soft);
  }
  .save-status.bad {
    color: var(--red);
    background: var(--red-soft);
  }
  .disclaimer {
    font-size: 12.5px;
    color: var(--ink-2);
    padding: 10px 16px;
    border-top: 1px solid var(--line);
    background: var(--paper-2);
  }
  .preview-area {
    min-height: 0;
    background:
      radial-gradient(circle at 1px 1px, rgba(255, 255, 255, 0.05) 1px, transparent 0) 0 0 / 18px 18px,
      var(--desk);
    color: var(--desk-ink);
    display: flex;
    flex-direction: column;
  }
  @media (max-width: 980px) {
    .shell {
      height: auto;
    }
    main {
      grid-template-columns: minmax(0, 1fr);
    }
    .sidebar {
      border-right: none;
    }
    .panel {
      overflow: visible;
    }
    .preview-area {
      min-height: 80vh;
    }
  }
  @media (max-width: 520px) {
    .masthead {
      padding: 10px 16px;
    }
    .panel {
      padding: 14px 16px 20px;
    }
  }
</style>
