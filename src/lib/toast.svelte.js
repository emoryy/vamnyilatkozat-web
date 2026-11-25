export const toasts = $state([]);

let next = 1;

export function toast(message, kind = 'ok', ms = 3500) {
  const id = next++;
  toasts.push({ id, message, kind });
  setTimeout(() => {
    const i = toasts.findIndex((t) => t.id === id);
    if (i >= 0) toasts.splice(i, 1);
  }, ms);
}
