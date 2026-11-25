<script>
  // Two-step destructive button: the first click arms it, the second one acts.
  let { onconfirm, label, confirmLabel = 'Biztosan?', small = false, title = '' } = $props();
  let armed = $state(false);
  let timer;

  function click() {
    if (armed) {
      clearTimeout(timer);
      armed = false;
      onconfirm();
      return;
    }
    armed = true;
    timer = setTimeout(() => (armed = false), 3000);
  }
</script>

<button type="button" class="btn danger" class:small class:armed {title} onclick={click} onblur={() => (armed = false)}>
  {armed ? confirmLabel : label}
</button>
