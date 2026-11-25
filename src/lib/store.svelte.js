import { get, getMany, set, setMany, keys, delMany } from 'idb-keyval';

import { BUILTIN_SHOPS, BUILTIN_TERMS, BUILTIN_DOCS } from './catalog.js';

const DATA_KEY = 'data:v1';
const sigKey = (id, kind) => `sig:${id}:${kind}`;

export function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function emptyPerson() {
  return { name: '', zip: '', city: '', address: '', phone: '', email: '' };
}

export function emptyItem() {
  return { id: uid(), term: '', qty: 1, unitPrice: '', mpid: '', nspid: '', spid: '' };
}

export function newShipment(prev) {
  return {
    id: uid(),
    trackingNum: '',
    shopId: prev?.shopId || '',
    currency: prev?.currency || 'JPY',
    date: '',
    shippingCost: '',
    items: [emptyItem()],
    docs: [],
    signatureId: prev?.signatureId || '',
    createdAt: Date.now(),
  };
}

function defaults() {
  const first = newShipment();
  return {
    profile: { ...emptyPerson(), parcelDiffers: false, parcel: emptyPerson() },
    shops: [],
    terms: [],
    docs: [],
    signatures: [],
    shipments: [first],
    currentShipmentId: first.id,
    settings: { rasterize: true },
  };
}

const isObject = (v) => Boolean(v) && typeof v === 'object' && !Array.isArray(v);
const text = (v, fallback = '') => (typeof v === 'string' ? v : typeof v === 'number' && Number.isFinite(v) ? String(v) : fallback);
const finite = (v) => typeof v === 'number' && Number.isFinite(v);
// Number inputs hold a number; a cleared one holds null (bound by Svelte) or '' (fresh rows).
const amount = (v, fallback = '') => (finite(v) ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : fallback);
const list = (v, keep) => (Array.isArray(v) ? v.filter(keep) : []);
const strings = (v) => [...new Set(list(v, (s) => typeof s === 'string'))];

// Keyed {#each} blocks throw on a repeated key, so a repeated id gets a fresh one.
function uniqueIds(records) {
  const seen = new Set();
  for (const r of records) {
    if (seen.has(r.id)) r.id = uid();
    seen.add(r.id);
  }
  return records;
}

function dropRepeatedIds(records) {
  const seen = new Set();
  return records.filter((r) => !seen.has(r.id) && seen.add(r.id));
}

function normalizePerson(p) {
  const src = isObject(p) ? p : {};
  return Object.fromEntries(Object.keys(emptyPerson()).map((k) => [k, text(src[k])]));
}

function normalizeItem(it) {
  return {
    id: text(it.id) || uid(),
    term: text(it.term),
    qty: amount(it.qty, 1),
    unitPrice: amount(it.unitPrice),
    mpid: text(it.mpid),
    nspid: text(it.nspid),
    spid: text(it.spid),
  };
}

function normalizeShipment(sh) {
  const items = uniqueIds(list(sh.items, isObject).map(normalizeItem));
  return {
    id: text(sh.id) || uid(),
    trackingNum: text(sh.trackingNum),
    shopId: text(sh.shopId),
    currency: text(sh.currency) || 'JPY',
    date: /^\d{4}-\d{2}-\d{2}$/.test(sh.date) ? sh.date : '',
    shippingCost: amount(sh.shippingCost),
    items: items.length ? items : [emptyItem()],
    docs: strings(sh.docs),
    signatureId: text(sh.signatureId),
    createdAt: finite(sh.createdAt) ? sh.createdAt : Date.now(),
  };
}

function normalizeShop(shop) {
  const out = { id: text(shop.id) || uid() };
  for (const k of ['label', 'name', 'country', 'zip', 'city', 'address']) out[k] = text(shop[k]);
  return out;
}

/** A signature is only usable with its image size and placement; anything else is dropped. */
function normalizeSignature(sig) {
  const p = sig.placement;
  const positive = (v) => finite(v) && v > 0;
  if (typeof sig.id !== 'string' || !sig.id || !positive(sig.width) || !positive(sig.height)) return null;
  if (!isObject(p) || !finite(p.x) || !finite(p.y) || !positive(p.width)) return null;
  const out = {
    id: sig.id,
    name: text(sig.name) || 'Aláírás',
    width: sig.width,
    height: sig.height,
    placement: { x: p.x, y: p.y, width: p.width },
    params: normalizeSignatureParams(sig.params),
  };
  if (finite(sig.createdAt)) out.createdAt = sig.createdAt;
  if (finite(sig.updatedAt)) out.updatedAt = sig.updatedAt;
  return out;
}

/** The editor feeds these straight into processSignature, where a non-number blanks the result. */
function normalizeSignatureParams(params) {
  const src = isObject(params) ? params : {};
  const c = src.crop;
  const crop = isObject(c) && [c.x, c.y, c.w, c.h].every(finite) ? { x: c.x, y: c.y, w: c.w, h: c.h } : null;
  return {
    crop,
    sensitivity: finite(src.sensitivity) ? Math.max(0, Math.min(1, src.sensitivity)) : 0.5,
    color: ['auto', 'blue', 'black'].includes(src.color) ? src.color : 'auto',
  };
}

/** Rebuilds stored or imported data field by field, so damaged values cannot reach the UI. */
function normalizeData(stored) {
  if (!isObject(stored)) throw new Error('Az adatok formátuma hibás.');
  const base = defaults();
  const profile = isObject(stored.profile) ? stored.profile : {};
  const settings = isObject(stored.settings) ? stored.settings : {};
  const data = {
    profile: {
      ...normalizePerson(profile),
      parcelDiffers: profile.parcelDiffers === true,
      parcel: normalizePerson(profile.parcel),
    },
    shops: uniqueIds(list(stored.shops, isObject).map(normalizeShop)),
    terms: strings(stored.terms),
    docs: strings(stored.docs),
    // A signature id also names its image keys, so a repeated one is dropped, not renamed.
    signatures: dropRepeatedIds(list(stored.signatures, isObject).map(normalizeSignature).filter(Boolean)),
    shipments: uniqueIds(list(stored.shipments, isObject).map(normalizeShipment)),
    currentShipmentId: text(stored.currentShipmentId),
    settings: { rasterize: typeof settings.rasterize === 'boolean' ? settings.rasterize : base.settings.rasterize },
  };
  // A shipment pointing at a dropped signature would silently be signed with the first one.
  const sigIds = new Set(data.signatures.map((sig) => sig.id));
  for (const sh of data.shipments) if (!sigIds.has(sh.signatureId)) sh.signatureId = '';
  if (!data.shipments.length) data.shipments = base.shipments;
  if (!data.shipments.some((sh) => sh.id === data.currentShipmentId)) {
    data.currentShipmentId = data.shipments[0].id;
  }
  return data;
}

export const app = $state({ ready: false, data: defaults(), error: '' });

// Object URLs of processed signature PNGs, keyed by signature id.
export const sigUrls = $state({});

function setSigUrl(id, blob) {
  if (sigUrls[id]) URL.revokeObjectURL(sigUrls[id]);
  if (blob) sigUrls[id] = URL.createObjectURL(blob);
  else delete sigUrls[id];
}

let saveTimer = null;
let lastSaved = '';
// Until the stored data was read (or replaced on purpose), any save would overwrite it with defaults.
let canSave = false;
let autosaving = false;
// An import or reset replacing the stored data; a second one at the same time would
// restore the wrong saving state when it finishes.
let replacing = false;
const BUSY = 'Egy visszatöltés vagy törlés már folyamatban van.';
const SAVE_ERROR = 'A mentés nem sikerült';

function snapshot() {
  return JSON.stringify(app.data);
}

/** Resolves to whether the current data is stored (false when saving is paused or failed). */
export function persistNow() {
  clearTimeout(saveTimer);
  if (!canSave) return Promise.resolve(false);
  const json = snapshot();
  if (json === lastSaved) return Promise.resolve(true);
  lastSaved = json;
  return set(DATA_KEY, JSON.parse(json)).then(
    () => {
      if (app.error.startsWith(SAVE_ERROR)) app.error = '';
      announceSave();
      return true;
    },
    (err) => {
      // Forget the failed snapshot so the next change or pagehide tries again.
      if (lastSaved === json) lastSaved = '';
      app.error = `${SAVE_ERROR}: ${err.message || err}`;
      return false;
    },
  );
}

// Every save is announced to the app's other open tabs, which reload the stored data,
// so two tabs don't keep overwriting each other with their own copy.
const channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel('vamnyilatkozat-data') : null;

function announceSave() {
  channel?.postMessage('saved');
}

async function reloadFromStorage() {
  if (!canSave || replacing) return;
  try {
    const stored = await get(DATA_KEY);
    const data = stored ? normalizeData(stored) : defaults();
    const pngs = await getMany(data.signatures.map((sig) => sigKey(sig.id, 'png')));
    clearTimeout(saveTimer);
    for (const id of Object.keys(sigUrls)) setSigUrl(id, null);
    data.signatures.forEach((sig, i) => {
      if (pngs[i] instanceof Blob) setSigUrl(sig.id, pngs[i]);
    });
    lastSaved = JSON.stringify(data);
    app.data = data;
  } catch {
    // Keep showing this tab's copy; its next save stores it as before.
  }
}

if (channel) channel.onmessage = () => reloadFromStorage();

function startAutosave() {
  canSave = true;
  if (autosaving) return;
  autosaving = true;
  $effect.root(() => {
    $effect(() => {
      snapshot();
      clearTimeout(saveTimer);
      saveTimer = setTimeout(persistNow, 300);
    });
  });
  window.addEventListener('pagehide', () => persistNow());
}

export async function init() {
  let loaded = false;
  let phase = 'read';
  try {
    const stored = await get(DATA_KEY);
    phase = 'parse';
    if (stored) app.data = normalizeData(stored);
    phase = 'images';
    loaded = true;
    lastSaved = snapshot();
    const pngs = await getMany(app.data.signatures.map((s) => sigKey(s.id, 'png')));
    app.data.signatures.forEach((s, i) => {
      // A damaged value would make createObjectURL throw and skip every later preview.
      if (pngs[i] instanceof Blob) setSigUrl(s.id, pngs[i]);
    });
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  } catch (err) {
    const why = err.message || err;
    app.error = {
      read: `A böngésző tárhelye nem érhető el (${why}). Privát ablakban vagy letiltott tárhellyel az adatok nem maradnak meg.`,
      parse: `A tárolt adatok sérültek (${why}). Amíg nem töltesz vissza egy mentést, vagy nem törlöd az adatokat, semmi nem mentődik.`,
      images: `Az aláírásképek nem tölthetők be (${why}).`,
    }[phase];
  }
  app.ready = true;
  if (loaded) startAutosave();
}

// ---- lookups

export function allShops() {
  return [...app.data.shops.map((s) => ({ ...s, builtin: false })), ...BUILTIN_SHOPS.map((s) => ({ ...s, builtin: true }))];
}

export function findShop(id) {
  return app.data.shops.find((s) => s.id === id) || BUILTIN_SHOPS.find((s) => s.id === id) || null;
}

export function shopLabel(shop) {
  return shop ? shop.label || shop.name || 'Névtelen feladó' : '';
}

export function termOptions() {
  return mergeUnique(app.data.terms, BUILTIN_TERMS);
}

export function docOptions() {
  return mergeUnique(app.data.docs, BUILTIN_DOCS);
}

function mergeUnique(own, builtin) {
  const seen = new Set();
  const out = [];
  for (const [list, isOwn] of [[own, true], [builtin, false]]) {
    for (const v of list) {
      const k = v.toLocaleLowerCase('hu');
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({ value: v, own: isOwn });
    }
  }
  return out;
}

/** Adds a typed value to the user's own list unless it is already known. */
export function remember(listName, value) {
  const v = (value || '').trim();
  if (!v) return;
  const builtin = listName === 'terms' ? BUILTIN_TERMS : BUILTIN_DOCS;
  const k = v.toLocaleLowerCase('hu');
  const known = [...app.data[listName], ...builtin].some((x) => x.toLocaleLowerCase('hu') === k);
  if (!known) app.data[listName] = [...app.data[listName], v];
}

export function currentShipment() {
  return app.data.shipments.find((s) => s.id === app.data.currentShipmentId) || app.data.shipments[0];
}

// ---- signatures (images live in their own IndexedDB keys)

export async function saveSignature(meta, { png, source }) {
  if (!canSave) throw new Error('a tárolt adatok nem töltődtek be, ezért most semmi nem menthető');
  // One transaction, so a failed write cannot leave a new PNG next to an old source.
  await setMany([[sigKey(meta.id, 'png'), png], ...(source ? [[sigKey(meta.id, 'src'), source]] : [])]);
  setSigUrl(meta.id, png);
  const i = app.data.signatures.findIndex((s) => s.id === meta.id);
  if (i >= 0) app.data.signatures[i] = meta;
  else app.data.signatures = [...app.data.signatures, meta];
  await persistNow();
}

export function signatureSource(id) {
  return get(sigKey(id, 'src'));
}

export function signaturePng(id) {
  return get(sigKey(id, 'png'));
}

export async function deleteSignature(id) {
  app.data.signatures = app.data.signatures.filter((s) => s.id !== id);
  for (const s of app.data.shipments) if (s.signatureId === id) s.signatureId = '';
  setSigUrl(id, null);
  // The images go only once the data without the signature is stored; otherwise the
  // stored data still refers to them.
  if (!(await persistNow())) return;
  await delMany([sigKey(id, 'png'), sigKey(id, 'src')]);
}

// ---- backup

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

function dataUrlToBlob(url) {
  const [head, b64] = url.split(',');
  const type = /data:([^;]+)/.exec(head)?.[1] || 'application/octet-stream';
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}

export async function exportBackup() {
  // Taken first, so a signature added while the images are read is not exported without its image.
  const data = JSON.parse(snapshot());
  const ids = data.signatures.map((s) => s.id);
  const stored = await getMany(ids.flatMap((id) => [sigKey(id, 'png'), sigKey(id, 'src')]));
  // A damaged stored value is left out instead of failing the whole export.
  const toDataUrl = (v) => (v instanceof Blob ? blobToDataUrl(v) : null);
  const images = {};
  for (const [i, id] of ids.entries()) {
    images[id] = { png: await toDataUrl(stored[2 * i]), src: await toDataUrl(stored[2 * i + 1]) };
  }
  const payload = {
    format: 'vamnyilatkozat-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    data,
    images,
  };
  return new Blob([JSON.stringify(payload)], { type: 'application/json' });
}

export async function importBackup(file) {
  let payload;
  try {
    payload = JSON.parse(await file.text());
  } catch {
    throw new Error('A fájl nem érvényes JSON.');
  }
  if (payload?.format !== 'vamnyilatkozat-backup' || !payload.data) {
    throw new Error('Ez nem a Vámnyilatkozat-kitöltő mentése.');
  }
  // Decode everything before wiping, so a damaged backup leaves the current data intact.
  const data = normalizeData(payload.data);
  const sigIds = new Set(data.signatures.map((s) => s.id));
  const images = [];
  try {
    for (const [id, img] of Object.entries(isObject(payload.images) ? payload.images : {})) {
      // Images of signatures dropped by normalizeData would only be stored and never used.
      if (!sigIds.has(id)) continue;
      images.push({
        id,
        png: img?.png ? dataUrlToBlob(img.png) : null,
        src: img?.src ? dataUrlToBlob(img.src) : null,
      });
    }
  } catch {
    throw new Error('A mentésben lévő aláíráskép sérült.');
  }
  // A signature without its image would look selectable but leave the PDF unsigned.
  const withPng = new Set(images.filter((i) => i.png).map((i) => i.id));
  data.signatures = data.signatures.filter((s) => withPng.has(s.id));
  for (const sh of data.shipments) if (sh.signatureId && !withPng.has(sh.signatureId)) sh.signatureId = '';
  // The new images and data go in one transaction, so a failed write (e.g. the storage
  // quota) changes nothing, not even images whose ids the current data shares; the old
  // keys are dropped only afterwards.
  // Saving is paused meanwhile, so an autosave of the old data cannot land after the new one.
  if (replacing) throw new Error(BUSY);
  replacing = true;
  const couldSave = canSave;
  canSave = false;
  const json = JSON.stringify(data);
  const entries = [];
  for (const { id, png, src } of images) {
    if (png) entries.push([sigKey(id, 'png'), png]);
    if (src) entries.push([sigKey(id, 'src'), src]);
  }
  entries.push([DATA_KEY, JSON.parse(json)]);
  try {
    try {
      await setMany(entries);
    } catch (err) {
      canSave = couldSave;
      // An edit made while the import ran was not saved; save it now.
      persistNow();
      throw new Error(`A mentés nem tölthető vissza: ${err.message || err}`);
    }
    // The new data is stored by now; old keys left behind by a failed cleanup are only unused.
    await wipeAll(new Set(entries.map(([k]) => k))).catch(() => {});
    for (const { id, png } of images) if (png) setSigUrl(id, png);
    app.data = data;
    app.error = '';
    lastSaved = json;
    startAutosave();
    announceSave();
  } finally {
    replacing = false;
  }
}

async function wipeAll(keep = new Set()) {
  clearTimeout(saveTimer);
  const all = await keys();
  await delMany(all.filter((k) => typeof k === 'string' && (k.startsWith('sig:') || k === DATA_KEY) && !keep.has(k)));
  for (const id of Object.keys(sigUrls)) setSigUrl(id, null);
  lastSaved = '';
}

export async function resetAll() {
  if (replacing) throw new Error(BUSY);
  replacing = true;
  // Saving is paused while the keys are deleted, so nothing written meanwhile outlives the reset.
  const couldSave = canSave;
  canSave = false;
  try {
    await wipeAll().catch((err) => {
      canSave = couldSave;
      // Nothing was deleted; an edit made meanwhile was not saved, so save it now.
      persistNow();
      throw err;
    });
    app.data = defaults();
    app.error = '';
    startAutosave();
    await persistNow();
  } finally {
    replacing = false;
  }
  if (app.error) throw new Error(app.error);
}

