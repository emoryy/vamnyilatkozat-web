import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

import { fontBytes, formatMoney, wrapLines, MONTHS_HU } from './declaration.js';
import { PAGE } from './field-map.js';

/** The statement's name in the declaration's (12) attached-documents list. */
export const POINTS_DOC = 'Nyilatkozat a pontbeváltásról';

const MARGIN = 56.7;
const LINE_HEIGHT = 1.3;
const BLANK = '……………';

// Numbers read with a leading vowel: 5… (öt), 1 (egy), 1xxx (ezer), 1xxxxxx (egymillió).
function numberTakesAz(word) {
  const digits = /^\d+/.exec(word)?.[0];
  if (!digits) return null;
  return digits[0] === '5' || (digits[0] === '1' && digits.length % 3 === 1);
}

// "a" or "az" by the first sound of a word.
export function article(word) {
  const n = numberTakesAz(word);
  if (n !== null) return n ? 'az' : 'a';
  return /^[aáeéiíoóöőuúüű]/i.test(word) ? 'az' : 'a';
}

// A tracking number is read letter by letter; these letter names start with a vowel
// (el, em, en, er, es, ef, iksz, ipszilon).
export function articleForCode(code) {
  const n = numberTakesAz(code);
  if (n !== null) return n ? 'az' : 'a';
  return /^[aáeéiíoóöőuúüűflmnrsxy]/i.test(code) ? 'az' : 'a';
}

// Point values can be fractions of a cent, so they keep more decimals than money does.
function formatRate(value) {
  return Number(value)
    .toLocaleString('hu-HU', { maximumFractionDigits: 6 })
    .replace(/[\u00a0\u202f]/g, ' ');
}

// "2026-11-26" -> "2026. november 26.", the way the declaration writes its date.
function formatDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  return m ? `${m[1]}. ${MONTHS_HU[Number(m[2]) - 1]} ${Number(m[3])}.` : BLANK;
}

/** "Store Credit, Points" -> „Store Credit” és „Points” */
export function quotedNames(text) {
  const names = String(text || '')
    .split(/[,;]/)
    .map((n) => n.trim().replace(/^[„"“”']+|[„"“”']+$/g, ''))
    .filter(Boolean)
    .map((n) => `„${n}”`);
  if (names.length < 2) return names.join('');
  return `${names.slice(0, -1).join(', ')} és ${names[names.length - 1]}`;
}

function paragraphs({ trackingNum, shopName, orderId, used, rate, names, currency, date, name }) {
  const tracking = trackingNum || BLANK;
  const trackingArticle = trackingNum ? articleForCode(trackingNum) : 'a(z)';
  const shop = shopName ? `${article(shopName)} ${shopName}` : `a(z) ${BLANK}`;
  const order = orderId ? `leadott, ${orderId} azonosítójú rendeléshez` : 'leadott rendeléshez';
  const out = [
    { text: `Nyilatkozat ${trackingArticle} ${tracking} ragszámú küldemény rendelésekor igénybevett kedvezményről`, size: 20 },
    { text: '', size: 12 },
    { text: `Ezúton nyilatkozom, hogy ${shop} webáruházban ${order} kapcsolódó ${tracking} ragszámú küldeményhez pontokat váltottam be.`, size: 14 },
  ];
  const quoted = quotedNames(names);
  if (quoted) out.push({ text: `A mellékelt dokumentumokban ez ${quoted} megnevezéssel szerepel.`, size: 14 });
  out.push({ text: `Beváltott pontok száma: ${used === '' ? BLANK : formatMoney(used)} pont`, size: 14 });
  out.push({ text: `A pontok beváltási aránya: 1 pont = ${rate === '' ? BLANK : formatRate(rate)} ${currency}`, size: 14 });
  out.push({ text: '', size: 12 });
  out.push({ text: `Kelt: ${formatDate(date)}`, size: 14 });
  if (name) out.push({ text: `Név: ${name}`, size: 14 });
  return out;
}

/**
 * Builds the statement about redeemed shop points that goes with the declaration.
 * input: { trackingNum, shopName, orderId, used, rate, names, currency, date: 'YYYY-MM-DD', name,
 *          signature?: { png, width, height, placement: { width } } }
 * Returns { bytes, signatureDpi } like buildDeclaration.
 */
export async function buildPointsStatement(input) {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(await fontBytes(), { subset: true });
  const page = doc.addPage([PAGE.width, PAGE.height]);
  const maxWidth = PAGE.width - MARGIN * 2;
  let y = PAGE.height - MARGIN;
  for (const p of paragraphs(input)) {
    const step = p.size * LINE_HEIGHT;
    if (!p.text) {
      y -= step;
      continue;
    }
    for (const line of wrapLines(font, p.text, p.size, maxWidth)) {
      y -= step;
      page.drawText(line, { x: MARGIN, y, size: p.size, font, color: rgb(0, 0, 0) });
    }
  }
  // The signature goes under the last line at the size it has on the declaration.
  let signatureDpi = null;
  const sig = input.signature;
  if (sig?.png) {
    const img = await doc.embedPng(sig.png);
    const width = sig.placement.width;
    const height = (width * sig.height) / sig.width;
    page.drawImage(img, { x: MARGIN, y: y - height - 14, width, height });
    signatureDpi = sig.width / (width / 72);
  }
  doc.setTitle(POINTS_DOC);
  doc.setProducer('Vámnyilatkozat-kitöltő');
  doc.setCreator('Vámnyilatkozat-kitöltő');
  return { bytes: await doc.save(), signatureDpi };
}
