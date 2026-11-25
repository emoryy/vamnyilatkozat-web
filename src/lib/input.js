import { app, sigUrls, findShop, currentShipment, signaturePng } from './store.svelte.js';

/** Plain, serialisable description of the current declaration (signature bytes excluded). */
export function currentSpec() {
  const d = app.data;
  const s = currentShipment();
  if (!s) return null;
  const p = d.profile;
  const parcelSrc = p.parcelDiffers ? p.parcel : p;
  const chosen = d.signatures.find((x) => x.id === s.signatureId) || d.signatures[0] || null;
  // Only signatures whose stored image loaded have a URL; any other would leave the PDF
  // unsigned while nothing is reported missing.
  const sig = chosen && sigUrls[chosen.id] ? chosen : null;
  const shop = findShop(s.shopId);
  return {
    trackingNum: s.trackingNum,
    sender: shop ? { name: shop.name, country: shop.country, zip: shop.zip, city: shop.city, address: shop.address } : null,
    parcel: { name: parcelSrc.name, zip: parcelSrc.zip, city: parcelSrc.city, address: parcelSrc.address },
    declarant: { name: p.name, zip: p.zip, city: p.city, address: p.address, phone: p.phone, email: p.email },
    currency: s.currency,
    items: s.items.map(({ term, qty, unitPrice, mpid, nspid, spid }) => ({ term, qty, unitPrice, mpid, nspid, spid })),
    shippingCost: s.shippingCost,
    docs: [...s.docs],
    date: s.date || todayIso(),
    signature: sig ? { id: sig.id, version: sig.updatedAt, width: sig.width, height: sig.height, placement: { ...sig.placement } } : null,
  };
}

export function todayIso() {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
}

export function parseIsoDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date();
}

const pngCache = new Map();

async function signatureBytes(id, version) {
  const key = `${id}:${version}`;
  if (!pngCache.has(key)) {
    const bytes = signaturePng(id).then(async (blob) => (blob instanceof Blob ? new Uint8Array(await blob.arrayBuffer()) : null));
    // A failed read is retried on the next render instead of failing every later one.
    bytes.catch(() => pngCache.delete(key));
    pngCache.set(key, bytes);
  }
  return pngCache.get(key);
}

/** Turns a spec into the generator's input, loading the signature image. */
export async function resolveInput(spec) {
  let signature = null;
  if (spec.signature) {
    const png = await signatureBytes(spec.signature.id, spec.signature.version);
    if (png) signature = { ...spec.signature, png };
  }
  return { ...spec, date: parseIsoDate(spec.date), signature };
}

export function missingParts(spec) {
  const out = [];
  if (!spec) return out;
  if (!spec.trackingNum?.trim()) out.push('követési szám');
  if (!spec.sender) out.push('feladó');
  if (!spec.declarant.name?.trim()) out.push('saját név');
  if (!spec.declarant.address?.trim() || !spec.declarant.city?.trim()) out.push('saját cím');
  if (!spec.items.some((i) => i.term?.trim())) out.push('tétel megnevezése');
  if (!spec.signature) out.push('aláírás');
  return out;
}

export function fileNameFor(spec) {
  const base = (spec.trackingNum || '').trim().replace(/[^\p{L}\p{N}._-]+/gu, '_');
  return base ? `Nyilatkozat ${base}.pdf` : 'Vámnyilatkozat.pdf';
}
