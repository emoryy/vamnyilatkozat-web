import { get, set, keys, delMany } from 'idb-keyval';

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

function snapshot() {
  return JSON.stringify(app.data);
}

export function persistNow() {
  clearTimeout(saveTimer);
  const json = snapshot();
  if (json === lastSaved) return Promise.resolve();
  lastSaved = json;
  return set(DATA_KEY, JSON.parse(json)).catch((err) => {
    app.error = `A mentés nem sikerült: ${err.message || err}`;
  });
}

export async function init() {
  try {
    const stored = await get(DATA_KEY);
    if (stored) {
      app.data = { ...defaults(), ...stored, settings: { ...defaults().settings, ...(stored.settings || {}) } };
      if (!app.data.shipments.length) {
        const s = newShipment();
        app.data.shipments = [s];
        app.data.currentShipmentId = s.id;
      }
      if (!app.data.shipments.some((s) => s.id === app.data.currentShipmentId)) {
        app.data.currentShipmentId = app.data.shipments[0].id;
      }
    }
    for (const s of app.data.signatures) {
      const png = await get(sigKey(s.id, 'png'));
      if (png) setSigUrl(s.id, png);
    }
    lastSaved = snapshot();
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  } catch (err) {
    app.error = `A böngésző tárhelye nem érhető el (${err.message || err}). Privát ablakban vagy letiltott tárhellyel az adatok nem maradnak meg.`;
  }
  app.ready = true;

  $effect.root(() => {
    $effect(() => {
      snapshot();
      clearTimeout(saveTimer);
      saveTimer = setTimeout(persistNow, 300);
    });
  });
  window.addEventListener('pagehide', () => persistNow());
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
  await set(sigKey(meta.id, 'png'), png);
  if (source) await set(sigKey(meta.id, 'src'), source);
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
  await delMany([sigKey(id, 'png'), sigKey(id, 'src')]);
  await persistNow();
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

async function dataUrlToBlob(url) {
  const [head, b64] = url.split(',');
  const type = /data:([^;]+)/.exec(head)?.[1] || 'application/octet-stream';
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}

export async function exportBackup() {
  const images = {};
  for (const s of app.data.signatures) {
    const png = await get(sigKey(s.id, 'png'));
    const src = await get(sigKey(s.id, 'src'));
    images[s.id] = {
      png: png ? await blobToDataUrl(png) : null,
      src: src ? await blobToDataUrl(src) : null,
    };
  }
  const payload = {
    format: 'vamnyilatkozat-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    data: JSON.parse(snapshot()),
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
  await wipeAll();
  const data = { ...defaults(), ...payload.data };
  for (const [id, img] of Object.entries(payload.images || {})) {
    if (img.png) {
      const blob = await dataUrlToBlob(img.png);
      await set(sigKey(id, 'png'), blob);
      setSigUrl(id, blob);
    }
    if (img.src) await set(sigKey(id, 'src'), await dataUrlToBlob(img.src));
  }
  app.data = data;
  if (!app.data.shipments.length) {
    const s = newShipment();
    app.data.shipments = [s];
  }
  if (!app.data.shipments.some((s) => s.id === app.data.currentShipmentId)) {
    app.data.currentShipmentId = app.data.shipments[0].id;
  }
  await persistNow();
}

async function wipeAll() {
  const all = await keys();
  await delMany(all.filter((k) => typeof k === 'string' && (k.startsWith('sig:') || k === DATA_KEY)));
  for (const id of Object.keys(sigUrls)) setSigUrl(id, null);
  lastSaved = '';
}

export async function resetAll() {
  await wipeAll();
  app.data = defaults();
  await persistNow();
}

