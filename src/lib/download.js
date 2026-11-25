/** Saves a blob as a file through a temporary link. */
export function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.append(a);
  a.click();
  a.remove();
  // Some browsers start reading the URL only after click() returns.
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
