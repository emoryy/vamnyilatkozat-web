import { SIGNATURE_BOX, SIGNATURE_LINE_Y } from './field-map.js';

const MAX_SOURCE_SIDE = 2400;

export const INK_COLORS = {
  auto: null,
  blue: [24, 44, 128],
  black: [22, 22, 26],
};

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

export function canvasToBlob(canvas, type = 'image/png', quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('A kép nem menthető.'))), type, quality);
  });
}

export async function blobToCanvas(blob) {
  const bmp = await createImageBitmap(blob);
  const c = makeCanvas(bmp.width, bmp.height);
  c.getContext('2d').drawImage(bmp, 0, 0);
  bmp.close();
  return c;
}

/**
 * Reads an uploaded photo or scan into a canvas on white (transparent areas count as
 * paper), honouring EXIF orientation and capping the longer side.
 */
export async function loadSourceImage(file) {
  let bmp;
  try {
    bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error('A fájl nem olvasható képként. JPG, PNG vagy WebP képet tölts fel.');
  }
  const scale = Math.min(1, MAX_SOURCE_SIDE / Math.max(bmp.width, bmp.height));
  const c = makeCanvas(bmp.width * scale, bmp.height * scale);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  return c;
}

function percentile(hist, count, p) {
  const target = count * p;
  let acc = 0;
  for (let i = 0; i < 256; i++) {
    acc += hist[i];
    if (acc >= target) return i;
  }
  return 255;
}

/** Paper brightness per pixel: a coarse grid of bright percentiles, max-filtered and interpolated. */
function estimateBackground(lum, W, H) {
  const cell = Math.max(12, Math.round(Math.max(W, H) / 24));
  const gw = Math.ceil(W / cell);
  const gh = Math.ceil(H / cell);
  const grid = new Float32Array(gw * gh);
  const hist = new Uint32Array(256);
  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      hist.fill(0);
      let n = 0;
      const x1 = Math.min(W, (gx + 1) * cell);
      const y1 = Math.min(H, (gy + 1) * cell);
      for (let y = gy * cell; y < y1; y++) {
        for (let x = gx * cell; x < x1; x++) {
          hist[lum[y * W + x] | 0]++;
          n++;
        }
      }
      grid[gy * gw + gx] = percentile(hist, n, 0.9);
    }
  }
  // A cell covered mostly by ink would read as dark paper; its neighbours fix that.
  const maxed = new Float32Array(gw * gh);
  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      let m = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const x = gx + dx;
          const y = gy + dy;
          if (x >= 0 && y >= 0 && x < gw && y < gh) m = Math.max(m, grid[y * gw + x]);
        }
      }
      maxed[gy * gw + gx] = m;
    }
  }
  const bg = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    const fy = Math.min(gh - 1, Math.max(0, (y + 0.5) / cell - 0.5));
    const y0 = Math.floor(fy);
    const y1 = Math.min(gh - 1, y0 + 1);
    const ty = fy - y0;
    for (let x = 0; x < W; x++) {
      const fx = Math.min(gw - 1, Math.max(0, (x + 0.5) / cell - 0.5));
      const x0 = Math.floor(fx);
      const x1 = Math.min(gw - 1, x0 + 1);
      const tx = fx - x0;
      const top = maxed[y0 * gw + x0] * (1 - tx) + maxed[y0 * gw + x1] * tx;
      const bot = maxed[y1 * gw + x0] * (1 - tx) + maxed[y1 * gw + x1] * tx;
      bg[y * W + x] = Math.max(1, top * (1 - ty) + bot * ty);
    }
  }
  return bg;
}

function otsu(values) {
  const hist = new Uint32Array(256);
  for (let i = 0; i < values.length; i++) hist[Math.min(255, (values[i] * 255) | 0)]++;
  const total = values.length;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sumB = 0;
  let wB = 0;
  let best = 0;
  let thr = 0;
  for (let i = 0; i < 256; i++) {
    wB += hist[i];
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sumB += i * hist[i];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) ** 2;
    if (between > best) {
      best = between;
      thr = i;
    }
  }
  return thr / 255;
}

/** 8-connected labelling of `mask`; returns { labels, areas }. */
function labelComponents(mask, W, H) {
  const labels = new Int32Array(W * H);
  const areas = [0];
  const stack = [];
  let next = 1;
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || labels[start]) continue;
    const id = next++;
    let area = 0;
    labels[start] = id;
    stack.push(start);
    while (stack.length) {
      const p = stack.pop();
      area++;
      const px = p % W;
      const py = (p - px) / W;
      for (let dy = -1; dy <= 1; dy++) {
        const y = py + dy;
        if (y < 0 || y >= H) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const x = px + dx;
          if (x < 0 || x >= W) continue;
          const q = y * W + x;
          if (mask[q] && !labels[q]) {
            labels[q] = id;
            stack.push(q);
          }
        }
      }
    }
    areas.push(area);
  }
  return { labels, areas };
}

function dilate(mask, W, H) {
  const out = new Uint8Array(mask.length);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!mask[y * W + x]) continue;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= H) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          if (xx >= 0 && xx < W) out[yy * W + xx] = 1;
        }
      }
    }
  }
  return out;
}

// The background estimate depends only on the source and the crop, so sensitivity and
// colour changes reuse it. Weakly keyed: it goes away with the source canvas.
const darknessCache = new WeakMap();

function darknessMap(source, c) {
  const key = `${c.x},${c.y},${c.w},${c.h}`;
  const hit = darknessCache.get(source);
  if (hit && hit.key === key) return hit;

  const W = Math.round(c.w);
  const H = Math.round(c.h);
  const work = makeCanvas(W, H);
  const wctx = work.getContext('2d', { willReadFrequently: true });
  wctx.fillStyle = '#fff';
  wctx.fillRect(0, 0, W, H);
  wctx.drawImage(source, c.x, c.y, c.w, c.h, 0, 0, W, H);
  const rgba = wctx.getImageData(0, 0, W, H).data;
  const N = W * H;

  const lum = new Float32Array(N);
  for (let i = 0; i < N; i++) lum[i] = 0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2];
  const bg = estimateBackground(lum, W, H);
  const dark = new Float32Array(N);
  for (let i = 0; i < N; i++) dark[i] = Math.max(0, Math.min(1, 1 - lum[i] / bg[i]));

  const entry = { key, W, H, rgba, dark, otsu: otsu(dark) };
  darknessCache.set(source, entry);
  return entry;
}

/**
 * Cuts the ink out of a photo or scan of one signature: paper becomes transparent,
 * stray specks are dropped, and the result is trimmed to the ink.
 * options: crop {x, y, w, h} in source px (null = whole image),
 *          sensitivity 0..1 (higher keeps fainter strokes), color 'auto' | 'blue' | 'black'.
 * Returns a canvas, or null if no ink was found.
 */
export function processSignature(source, { crop = null, sensitivity = 0.5, color = 'auto' } = {}) {
  const c = crop && crop.w > 4 && crop.h > 4 ? crop : { x: 0, y: 0, w: source.width, h: source.height };
  const { W, H, rgba, dark, otsu: otsuLevel } = darknessMap(source, c);
  const work = makeCanvas(W, H);
  const wctx = work.getContext('2d');
  // Every output pixel is written below; the source colours are read from the cached `rgba`.
  const img = wctx.createImageData(W, H);
  const d = img.data;
  const N = W * H;

  const k = 1.6 - Math.max(0, Math.min(1, sensitivity));
  const thr = Math.max(0.08, otsuLevel * k);
  const lo = thr * 0.75;
  const span = thr * 0.5;
  const alpha = new Float32Array(N);
  const strong = new Uint8Array(N);
  let inkTotal = 0;
  for (let i = 0; i < N; i++) {
    const a = Math.max(0, Math.min(1, (dark[i] - lo) / span));
    alpha[i] = a;
    if (a >= 0.5) {
      strong[i] = 1;
      inkTotal++;
    }
  }
  if (!inkTotal) return null;

  const { labels, areas } = labelComponents(strong, W, H);
  const minArea = Math.max(6, inkTotal * 0.002);
  const kept = new Uint8Array(N);
  for (let i = 0; i < N; i++) if (labels[i] && areas[labels[i]] >= minArea) kept[i] = 1;
  // Soft edge pixels survive only next to a kept stroke.
  const near = dilate(dilate(kept, W, H), W, H);

  let rgb = INK_COLORS[color];
  if (!rgb) {
    let r = 0;
    let g = 0;
    let b = 0;
    let n = 0;
    for (let i = 0; i < N; i++) {
      if (kept[i] && alpha[i] >= 0.99) {
        r += rgba[i * 4];
        g += rgba[i * 4 + 1];
        b += rgba[i * 4 + 2];
        n++;
      }
    }
    rgb = n ? [r / n, g / n, b / n].map((v) => Math.round(v * 0.85)) : INK_COLORS.black;
  }

  let minX = W;
  let minY = H;
  let maxX = -1;
  let maxY = -1;
  for (let i = 0; i < N; i++) {
    const a = near[i] ? alpha[i] : 0;
    d[i * 4] = rgb[0];
    d[i * 4 + 1] = rgb[1];
    d[i * 4 + 2] = rgb[2];
    d[i * 4 + 3] = Math.round(a * 255);
    if (a > 0.02) {
      const x = i % W;
      const y = (i - x) / W;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return null;
  wctx.putImageData(img, 0, 0);

  const pad = 4;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(W - 1, maxX + pad);
  maxY = Math.min(H - 1, maxY + pad);
  const out = makeCanvas(maxX - minX + 1, maxY - minY + 1);
  out.getContext('2d').drawImage(work, minX, minY, out.width, out.height, 0, 0, out.width, out.height);
  return out;
}

/** Default spot on the signature line: fitted into the box, the lower fifth hanging below the line. */
export function defaultPlacement(width, height) {
  const scale = Math.min(SIGNATURE_BOX.maxWidth / width, SIGNATURE_BOX.maxHeight / height);
  const w = width * scale;
  const h = height * scale;
  return {
    x: SIGNATURE_BOX.x + (SIGNATURE_BOX.maxWidth - w) / 2,
    y: SIGNATURE_LINE_Y - h * 0.2,
    width: w,
  };
}
