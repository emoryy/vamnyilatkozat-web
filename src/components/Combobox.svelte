<script>
  // Free-text input with a filtered suggestion list. `options` is [{ value, own }].
  let { value = $bindable(''), options = [], placeholder = '', oncommit, id, label = '', mono = false } = $props();

  let open = $state(false);
  let active = $state(-1);
  let input;
  const listId = `cb-${Math.random().toString(36).slice(2, 9)}`;

  let filtered = $derived.by(() => {
    const q = (value || '').trim().toLocaleLowerCase('hu');
    const list = q ? options.filter((o) => o.value.toLocaleLowerCase('hu').includes(q)) : options;
    return list.slice(0, 60);
  });

  function choose(v) {
    value = v;
    open = false;
    active = -1;
    oncommit?.(v);
  }

  function keydown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      open = true;
      active = Math.min(filtered.length - 1, active + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      active = Math.max(0, active - 1);
    } else if (e.key === 'Enter') {
      if (open && active >= 0 && filtered[active]) {
        e.preventDefault();
        choose(filtered[active].value);
      } else {
        open = false;
        oncommit?.(value);
      }
    } else if (e.key === 'Escape') {
      open = false;
    }
  }

  function blur() {
    // Let a click on an option land before the list closes.
    setTimeout(() => {
      if (document.activeElement !== input) {
        if (open) oncommit?.(value);
        open = false;
      }
    }, 120);
  }
</script>

<div class="combo">
  <input
    bind:this={input}
    {id}
    class="input"
    class:mono
    type="text"
    autocomplete="off"
    role="combobox"
    aria-label={label || undefined}
    aria-expanded={open}
    aria-controls={listId}
    aria-autocomplete="list"
    {placeholder}
    bind:value
    onfocus={() => (open = true)}
    oninput={() => {
      open = true;
      active = -1;
    }}
    onkeydown={keydown}
    onblur={blur}
  />
  {#if open && filtered.length}
    <ul id={listId} role="listbox">
      {#each filtered as o, i (o.value)}
        <li
          role="option"
          aria-selected={i === active}
          class:active={i === active}
          onmousedown={(e) => {
            e.preventDefault();
            choose(o.value);
          }}
        >
          <span>{o.value}</span>
          {#if o.own}<span class="badge own">saját</span>{/if}
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .combo {
    position: relative;
    min-width: 0;
  }
  .combo input {
    width: 100%;
    background: var(--field);
    border: 1px solid var(--field-border);
    box-shadow: inset 0 1px 2px rgba(24, 32, 47, 0.07);
    border-radius: var(--radius);
    padding: 7px 10px;
    font-size: 15px;
  }
  .combo input:focus {
    border-color: var(--blue);
    outline: none;
    box-shadow: 0 0 0 3px var(--blue-soft);
  }
  ul {
    position: absolute;
    z-index: 20;
    left: 0;
    right: 0;
    top: calc(100% + 3px);
    margin: 0;
    padding: 4px;
    list-style: none;
    background: var(--field);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius);
    box-shadow: 0 14px 30px -12px rgba(24, 32, 47, 0.45);
    max-height: 260px;
    overflow: auto;
    min-width: 260px;
  }
  li {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    align-items: center;
    padding: 6px 8px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
  }
  li:hover,
  li.active {
    background: var(--blue-soft);
  }
</style>
