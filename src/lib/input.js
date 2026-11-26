import { app, sigUrls, findShop, shopName, currentShipment, signaturePng } from './store.svelte.js';
import { POINTS_DOC } from './points-statement.js';

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
  const usable = (x) => (x && sigUrls[x.id] ? x : null);
  const sig = usable(chosen);
  const shop = findShop(s.shopId);
  const pts = s.points;
  const docs = [...s.docs];
  if (pts.enabled && !docs.includes(POINTS_DOC)) docs.push(POINTS_DOC);
  return {
    trackingNum: s.trackingNum,
    sender: shop ? { name: shop.name, country: shop.country, zip: shop.zip, city: shop.city, address: shop.address } : null,
    parcel: { name: parcelSrc.name, zip: parcelSrc.zip, city: parcelSrc.city, address: parcelSrc.address },
    declarant: { name: p.name, zip: p.zip, city: p.city, address: p.address, phone: p.phone, email: p.email },
    currency: s.currency,
    items: s.items.map(({ term, qty, unitPrice, mpid, nspid, spid }) => ({ term, qty, unitPrice, mpid, nspid, spid })),
    shippingCost: s.shippingCost,
    docs,
    date: s.date || todayIso(),
    points: pts.enabled
      ? {
          shopName: shopName(shop),
          orderId: pts.orderId.trim(),
          used: pts.used === null ? '' : pts.used,
          rate: Number(pts.rate) > 0 ? Number(pts.rate) : '',
          names: pts.names,
          sign: pts.sign,
          // Without a choice of its own it is signed like the declaration.
          signature: pts.sign ? sigSpec(usable(d.signatures.find((x) => x.id === pts.signatureId) || chosen)) : null,
        }
      : null,
    signature: sigSpec(sig),
  };
}

function sigSpec(sig) {
  return sig ? { id: sig.id, version: sig.updatedAt, width: sig.width, height: sig.height, placement: { ...sig.placement } } : null;
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
    // Only the newest version of a signature is ever asked for again.
    for (const k of pngCache.keys()) if (k.startsWith(`${id}:`)) pngCache.delete(k);
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
  // `tab` is the sidebar tab where the missing part is filled in.
  if (!spec.trackingNum?.trim()) out.push({ label: 'Követési szám', tab: 'shipment' });
  if (!spec.sender?.name?.trim()) out.push({ label: 'Feladó', tab: 'shipment' });
  if (!spec.declarant.name?.trim()) out.push({ label: 'Saját név', tab: 'profile' });
  if (!spec.declarant.address?.trim() || !spec.declarant.city?.trim()) out.push({ label: 'Saját cím', tab: 'profile' });
  if (!spec.items.some((i) => i.term?.trim())) out.push({ label: 'Tétel megnevezése', tab: 'shipment' });
  if (!spec.signature) out.push({ label: 'Aláírás', tab: 'signature' });
  if (spec.points?.used === '') out.push({ label: 'Beváltott pontok', tab: 'shipment' });
  if (spec.points?.rate === '') out.push({ label: 'Pont értéke', tab: 'shipment' });
  if (spec.points?.sign && !spec.points.signature && spec.signature) out.push({ label: 'Aláírás a pontnyilatkozatra', tab: 'shipment' });
  return out;
}

function trackingPart(spec) {
  return (spec.trackingNum || '').trim().replace(/[^\p{L}\p{N}._-]+/gu, '_');
}

export function fileNameFor(spec) {
  const base = trackingPart(spec);
  // The official form's own file name, followed by the tracking number.
  const form = 'Nyilatkozat_automatikus_postai_vamkezelesu_kuldemenyhez_WEB';
  return base ? `${form}_${base}.pdf` : `${form}.pdf`;
}

export function pointsFileNameFor(spec) {
  const base = trackingPart(spec);
  return base ? `Nyilatkozat_pontbevaltasrol_${base}.pdf` : 'Nyilatkozat_pontbevaltasrol.pdf';
}

/** The points statement generator's input for a spec (signature loaded), or null when none is needed. */
export async function pointsInput(spec) {
  if (!spec.points) return null;
  const s = spec.points.signature;
  const png = s ? await signatureBytes(s.id, s.version) : null;
  return {
    ...spec.points,
    signature: png ? { ...s, png } : null,
    trackingNum: spec.trackingNum.trim(),
    currency: spec.currency,
    date: spec.date,
    name: spec.declarant.name.trim(),
  };
}
