import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { PDFDocument } from 'pdf-lib';

import { PAGE } from './field-map.js';
import { canvasToBlob } from './signature-image.js';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export function openPdf(bytes) {
  // pdf.js transfers the buffer to its worker, so it gets a copy.
  return pdfjs.getDocument({
    data: bytes.slice(),
    isEvalSupported: false,
    enableXfa: false,
    useSystemFonts: false,
  }).promise;
}

/** Renders one page into a new canvas at `scale` canvas px per PDF pt. */
export async function renderPage(page, scale) {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  await page.render({ canvas, canvasContext: canvas.getContext('2d'), viewport, annotationMode: pdfjs.AnnotationMode.DISABLE }).promise;
  return canvas;
}

/**
 * Renders a region of page 1 (PDF pt, y measured from the bottom) into a canvas.
 * Used as the background of the signature placement editor.
 */
export async function renderRegion(bytes, crop, pxPerPt) {
  const doc = await openPdf(bytes);
  try {
    const page = await doc.getPage(1);
    const full = await renderPage(page, pxPerPt);
    const out = document.createElement('canvas');
    out.width = Math.round((crop.x1 - crop.x0) * pxPerPt);
    out.height = Math.round((crop.yTop - crop.yBottom) * pxPerPt);
    out.getContext('2d').drawImage(
      full,
      Math.round(crop.x0 * pxPerPt), Math.round((PAGE.height - crop.yTop) * pxPerPt), out.width, out.height,
      0, 0, out.width, out.height,
    );
    return out;
  } finally {
    doc.destroy();
  }
}

async function canvasToBytes(canvas, type, quality) {
  return new Uint8Array(await (await canvasToBlob(canvas, type, quality)).arrayBuffer());
}

/**
 * Flattens a PDF into page images (no selectable text or vectors) at `dpi`.
 */
export async function rasterizePdf(bytes, dpi, title) {
  const src = await openPdf(bytes);
  try {
    const out = await PDFDocument.create();
    for (let i = 1; i <= src.numPages; i++) {
      const page = await src.getPage(i);
      const canvas = await renderPage(page, dpi / 72);
      const ctx = canvas.getContext('2d');
      // Opaque white under the page so transparent areas don't turn black.
      ctx.globalCompositeOperation = 'destination-over';
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const png = await canvasToBytes(canvas, 'image/png');
      const img = await out.embedPng(png);
      const { width, height } = page.getViewport({ scale: 1 });
      out.addPage([width, height]).drawImage(img, { x: 0, y: 0, width, height });
    }
    out.setTitle(title);
    out.setProducer('Vámnyilatkozat-kitöltő');
    out.setCreator('Vámnyilatkozat-kitöltő');
    return await out.save();
  } finally {
    src.destroy();
  }
}
