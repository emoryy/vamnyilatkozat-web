<script>
  let { name, size = 18 } = $props();
  const PATHS = {
    plus: 'M12 5v14M5 12h14',
    trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
    copy: 'M9 9h11v11H9zM5 15V4h11',
    download: 'M12 4v11m0 0l-4.5-4.5M12 15l4.5-4.5M5 20h14',
    upload: 'M12 20V9m0 0l-4.5 4.5M12 9l4.5 4.5M5 4h14',
    edit: 'M4 20h4L19 9l-4-4L4 16v4zM13 7l4 4',
    x: 'M6 6l12 12M18 6L6 18',
    check: 'M5 12.5l4.5 4.5L19 7',
    chevron: 'M7 10l5 5 5-5',
    refresh: 'M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7',
    up: 'M12 19V5m0 0l-6 6m6-6l6 6',
    down: 'M12 5v14m0 0l-6-6m6 6l6-6',
  };
</script>

<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d={PATHS[name]} />
</svg>
