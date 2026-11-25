import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

import { SINGLE, ROWS, MAX_ROWS, PAGE } from './field-map.js';

const TEMPLATE_URL = '/assets/nyilatkozat-2026-10.pdf';
const FONT_URL = '/assets/LiberationSerif-Regular.ttf';

const MONTHS_HU = [
  'január', 'február', 'március', 'április', 'május', 'június',
  'július', 'augusztus', 'szeptember', 'október', 'november', 'december',
];

const NONE = 'nincs';

// Rows that fit on one continuation page between its header (y 738) and a 30 pt bottom margin.
const CONTINUATION_ROWS = 40;

let assetsPromise = null;

function loadAssets() {
  if (!assetsPromise) {
    assetsPromise = Promise.all([
      fetch(TEMPLATE_URL).then((r) => {
        if (!r.ok) throw new Error(`Az űrlap nem tölthető be (${r.status})`);
        return r.arrayBuffer();
      }),
      fetch(FONT_URL).then((r) => {
        if (!r.ok) throw new Error(`A betűkészlet nem tölthető be (${r.status})`);
        return r.arrayBuffer();
      }),
    ]).catch((err) => {
      assetsPromise = null;
      throw err;
    });
  }
  return assetsPromise;
}

export function templateBytes() {
  return loadAssets().then(([template]) => template);
}

export function formatMoney(value, currency) {
  const n = Number(value) || 0;
  const str = n
    .toLocaleString('hu-HU', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
    .replace(/[  ]/g, ' ');
  return currency ? `${str} ${currency}` : str;
}

function fittedSize(font, text, maxWidth, base, min = 5.5) {
  let size = base;
  while (size > min && font.widthOfTextAtSize(text, size) > maxWidth) {
    size -= 0.5;
  }
  return size;
}

function drawInRect(page, font, text, rect, { base = 9, pad = 3, align = 'left', baseline, min } = {}) {
  if (text === undefined || text === null || text === '') return;
  const str = String(text);
  const [x0, y0, x1, y1] = rect;
  const maxWidth = x1 - x0 - pad * 2;
  const size = fittedSize(font, str, maxWidth, base, min);
  const h = y1 - y0;
  const y = baseline !== undefined ? baseline : y0 + (h - size) / 2 + size * 0.2;
  const textWidth = font.widthOfTextAtSize(str, size);
  let x = x0 + pad;
  if (align === 'right') x = x1 - pad - textWidth;
  else if (align === 'center') x = x0 + (x1 - x0 - textWidth) / 2;
  page.drawText(str, { x, y, size, font, color: rgb(0, 0, 0) });
}

/**
 * Draws text on one line, shrinking down to `oneLineMin`; if it still does not fit,
 * wraps it onto two lines at the largest size (down to `min`) where both fit.
 */
function drawFitted(page, font, text, rect, { base = 9, pad = 3, oneLineMin = 6.5, min = 4.5 } = {}) {
  if (!text) return;
  const str = String(text);
  const [x0, y0, x1, y1] = rect;
  const maxWidth = x1 - x0 - pad * 2;
  const h = y1 - y0;

  const oneLine = fittedSize(font, str, maxWidth, base, oneLineMin);
  if (font.widthOfTextAtSize(str, oneLine) <= maxWidth) {
    drawInRect(page, font, str, rect, { base, pad, min: oneLineMin });
    return;
  }

  const splitAt = (size) => {
    const words = str.split(/\s+/);
    let first = '';
    let i = 0;
    for (; i < words.length; i++) {
      const trial = first ? `${first} ${words[i]}` : words[i];
      if (first && font.widthOfTextAtSize(trial, size) > maxWidth) break;
      first = trial;
    }
    return [first, words.slice(i).join(' ')];
  };

  let size = Math.min(base, (h - 1) / 2.1);
  let lines = splitAt(size);
  while (size > min && lines.some((l) => font.widthOfTextAtSize(l, size) > maxWidth)) {
    size -= 0.25;
    lines = splitAt(size);
  }
  const lineHeight = size * 1.05;
  const top = y0 + (h + lineHeight * 2) / 2;
  lines.forEach((l, i) => {
    page.drawText(l, { x: x0 + pad, y: top - lineHeight * (i + 1) + size * 0.2, size, font });
  });
}

function clean(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

export function itemRows(items) {
  return (items || [])
    .filter((it) => clean(it.term) || Number(it.unitPrice) || clean(it.mpid) || clean(it.nspid) || clean(it.spid))
    .map((it) => {
      const qty = Number(it.qty) > 0 ? Number(it.qty) : 1;
      const unit = Number(it.unitPrice) || 0;
      return {
        term: clean(it.term),
        qty,
        unit,
        total: unit * qty,
        mpid: clean(it.mpid) || NONE,
        nspid: clean(it.nspid) || NONE,
        spid: clean(it.spid) || NONE,
      };
    });
}

function drawContinuationPage(doc, font, rows, startIndex, currency) {
  const page = doc.addPage([PAGE.width, PAGE.height]);
  const left = 30;
  page.drawText('Küldeménytartalom (folytatás)', { x: left, y: 800, size: 13, font });
  page.drawText(`(a nyilatkozat ${startIndex}. tételétől)`, { x: left, y: 784, size: 9, font });

  const cols = {
    idx: [left, left + 18],
    name: [left + 20, 214],
    qty: [216, 250],
    unit: [252, 322],
    total: [324, 380],
    mpid: [382, 448],
    nspid: [450, 500],
    spid: [502, 565],
  };
  const right = new Set(['unit', 'total']);
  let y = 758;
  const drawRow = (cells, size = 8.5) => {
    for (const [key, [x0, x1]] of Object.entries(cols)) {
      const rect = [x0, y, x1, y + 16];
      if (key === 'name') {
        drawFitted(page, font, cells[key], rect, { base: size, oneLineMin: 6.5 });
      } else {
        drawInRect(page, font, cells[key], rect, { base: size, align: right.has(key) ? 'right' : 'left' });
      }
    }
  };

  drawRow({
    idx: '#', name: 'Megnevezés (5)', qty: 'Menny.', unit: 'Egységár', total: 'Összérték',
    mpid: 'M-PID (9)', nspid: 'NS-PID (10)', spid: 'S-PID (11)',
  });
  y -= 4;
  page.drawLine({ start: { x: left, y: y + 2 }, end: { x: 565, y: y + 2 }, thickness: 0.5 });
  y -= 16;

  rows.forEach((r, i) => {
    drawRow({
      idx: String(startIndex + i),
      name: r.term,
      qty: `${r.qty} db`,
      unit: `${formatMoney(r.unit, currency)} / db`,
      total: formatMoney(r.total, currency),
      mpid: r.mpid,
      nspid: r.nspid,
      spid: r.spid,
    });
    y -= 18;
  });
}

/**
 * Builds the filled declaration.
 * input: { trackingNum, sender, parcel, declarant, currency, items, shippingCost,
 *          docs: [label], date: Date, signature?: { png: Uint8Array, width, height,
 *          placement: { x, y, width } } }
 * Returns { bytes, signatureDpi } where signatureDpi is the resolution at which the
 * placed signature equals its source pixels (null without a signature).
 */
export async function buildDeclaration(input) {
  const [template, fontBytes] = await loadAssets();
  const doc = await PDFDocument.load(template);
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(fontBytes, { subset: true });

  // Page 1 is the form; the rest is the official guide and privacy notice.
  while (doc.getPageCount() > 1) doc.removePage(doc.getPageCount() - 1);
  const page = doc.getPage(0);

  const currency = input.currency || '';
  const sender = input.sender || {};
  const parcel = input.parcel || {};
  const declarant = input.declarant || {};

  drawInRect(page, font, clean(input.trackingNum), SINGLE.trackingNum);

  drawInRect(page, font, sender.name, SINGLE.senderName);
  drawInRect(page, font, sender.country, SINGLE.senderCountry);
  drawInRect(page, font, sender.zip, SINGLE.senderZip);
  drawInRect(page, font, sender.city, SINGLE.senderCity);
  drawInRect(page, font, sender.address, SINGLE.senderAddress);

  drawInRect(page, font, parcel.name, SINGLE.parcelName);
  drawInRect(page, font, parcel.city, SINGLE.parcelCity);
  drawInRect(page, font, parcel.address, SINGLE.parcelAddress);
  drawInRect(page, font, parcel.zip, SINGLE.parcelZip);

  drawInRect(page, font, declarant.name, SINGLE.declarantName);
  drawInRect(page, font, declarant.city, SINGLE.declarantCity);
  drawInRect(page, font, declarant.address, SINGLE.declarantAddress);
  drawInRect(page, font, declarant.zip, SINGLE.declarantZip);
  drawInRect(page, font, declarant.phone, SINGLE.declarantPhone);
  drawInRect(page, font, declarant.email, SINGLE.declarantEmail);

  const rows = itemRows(input.items);
  rows.slice(0, MAX_ROWS).forEach((r, i) => {
    const cell = ROWS[i];
    drawFitted(page, font, r.term, cell.name, { base: 8.5 });
    drawInRect(page, font, `${r.qty} db`, cell.qty, { align: 'right' });
    drawInRect(page, font, `${formatMoney(r.unit, currency)} / db`, cell.unit, { align: 'right', base: 8.5 });
    drawInRect(page, font, formatMoney(r.total, currency), cell.total, { align: 'right', base: 8.5 });
    drawInRect(page, font, r.mpid, cell.mpid, { base: 8 });
    drawInRect(page, font, r.nspid, cell.nspid, { base: 8 });
    drawInRect(page, font, r.spid, cell.spid, { base: 8 });
  });

  drawFitted(page, font, (input.docs || []).filter(Boolean).join(', '), SINGLE.attachedDocs, { base: 9 });

  if (input.shippingCost !== '' && input.shippingCost !== null && input.shippingCost !== undefined) {
    drawInRect(page, font, formatMoney(input.shippingCost, currency), SINGLE.shippingCost);
  }

  // Baseline just above the dotted line, below the printed "év / hónap / nap" labels.
  const when = input.date || new Date();
  const dateBaseline = 46;
  drawInRect(page, font, String(when.getFullYear()), SINGLE.dateYear, { align: 'center', baseline: dateBaseline });
  drawInRect(page, font, MONTHS_HU[when.getMonth()], SINGLE.dateMonth, { align: 'center', baseline: dateBaseline });
  drawInRect(page, font, String(when.getDate()), SINGLE.dateDay, { align: 'center', baseline: dateBaseline });

  let signatureDpi = null;
  const sig = input.signature;
  if (sig && sig.png && sig.placement) {
    const img = await doc.embedPng(sig.png);
    const { x, y, width } = sig.placement;
    const height = (width * sig.height) / sig.width;
    page.drawImage(img, { x, y, width, height });
    signatureDpi = sig.width / (width / 72);
  }

  for (let i = MAX_ROWS; i < rows.length; i += CONTINUATION_ROWS) {
    drawContinuationPage(doc, font, rows.slice(i, i + CONTINUATION_ROWS), i + 1, currency);
  }

  try {
    doc.getForm().flatten();
  } catch {
    // The fields are empty; the drawn content does not depend on the AcroForm.
  }

  doc.setTitle('Nyilatkozat automatikus postai vámkezelésű küldeményhez');
  doc.setProducer('Vámnyilatkozat-kitöltő');
  doc.setCreator('Vámnyilatkozat-kitöltő');

  const bytes = await doc.save();
  return { bytes, signatureDpi, itemCount: rows.length };
}
