/**
 * Field rectangles on page 1 of the Magyar Posta declaration (2026-10 edition, with
 * the M-PID / NS-PID / S-PID columns), in PDF user space (origin bottom-left, A4
 * 595.28 x 841.89). Derived from the template's AcroForm widget /Rect values. We draw
 * text directly at these rectangles with an embedded Unicode font instead of filling
 * AcroForm fields, to avoid WinAnsi encoding limits (ő, ű) and appearance-font issues.
 * Each rect is [x0, y0, x1, y1].
 */

const L = 186;
const R = 566;

export const SINGLE = {
  trackingNum: [L, 494, R, 508], // (1) Küldeményazonosító

  // (2) Feladó adatai: the foreign sender (shop)
  senderName: [L, 473, R, 487],
  senderCountry: [L, 458, R, 472],
  senderZip: [L, 442, R, 457],
  senderCity: [L, 427, R, 441],
  senderAddress: [L, 412, R, 426],

  // (3) Küldeményen szereplő címadatok: address as printed on the parcel (recipient)
  parcelName: [L, 391, R, 405],
  parcelCity: [L, 376, R, 390],
  parcelAddress: [L, 360, R, 374],
  parcelZip: [L, 345, R, 359],

  // (4) Nyilatkozatot benyújtó adatai: declarant
  declarantName: [L, 324, R, 338],
  declarantCity: [L, 309, R, 323],
  declarantAddress: [L, 293, R, 308],
  declarantZip: [L, 278, R, 292],
  declarantPhone: [L, 263, R, 277],
  declarantEmail: [L, 248, R, 262],

  // (12) Csatolt okmány, dokumentum
  attachedDocs: [200, 84, 565, 97],
  // (13) Szállítási költség
  shippingCost: [200, 68, 565, 83],

  // Dátum: ___ év ___ hónap ___ nap
  dateYear: [66, 46, 113, 60],
  dateMonth: [130, 46, 225, 60],
  dateDay: [261, 46, 285, 60],
};

// (5)-(11) item table columns (x ranges), shared by all rows
export const COLUMNS = {
  name: [29, 150], // (5) megnevezés
  qty: [152, 211], // (6) mennyiség
  unit: [214, 295], // (7) egységár
  total: [296, 349], // (8) összérték
  mpid: [351, 422], // (9) M-PID, kereskedői termékazonosító
  nspid: [424, 496], // (10) NS-PID, nem szabványos gyártói termékazonosító
  spid: [498, 565], // (11) S-PID, szabványos gyártói termékazonosító
};

const ROW_BOTTOMS = [180, 165.4, 150.7, 136, 121.3];
const ROW_HEIGHT = 14.2;

export const ROWS = ROW_BOTTOMS.map((y0) =>
  Object.fromEntries(
    Object.entries(COLUMNS).map(([key, [x0, x1]]) => [key, [x0, y0, x1, y0 + ROW_HEIGHT]])
  )
);

export const MAX_ROWS = ROWS.length;

// Signature placement: above the "Nyilatkozatot benyújtó aláírása" label (right side).
export const SIGNATURE_BOX = { x: 372, bottomY: 28, maxWidth: 188, maxHeight: 40 };
// Centre of the dotted signature line, measured on the 2026-10 template.
export const SIGNATURE_LINE_Y = 32.1;

export const PAGE = { width: 595.28, height: 841.89 };
