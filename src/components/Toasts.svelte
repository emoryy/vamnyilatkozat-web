<script>
  import { toasts } from '../lib/toast.svelte.js';
</script>

<div class="toasts" role="status" aria-live="polite">
  {#each toasts as t (t.id)}
    <div class="toast {t.kind}">{t.message}</div>
  {/each}
</div>

<style>
  .toasts {
    position: fixed;
    right: 18px;
    bottom: 18px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    z-index: 100;
    max-width: min(420px, calc(100vw - 32px));
  }
  .toast {
    background: var(--ink);
    color: #fff;
    padding: 10px 14px;
    border-radius: 8px;
    font-size: 14px;
    box-shadow: 0 10px 30px -12px rgba(0, 0, 0, 0.5);
    border-left: 4px solid #7fd0a0;
    animation: rise 0.18s ease-out;
  }
  .toast.error {
    border-left-color: #ff8a80;
  }
  @keyframes rise {
    from {
      transform: translateY(8px);
      opacity: 0;
    }
  }
</style>
