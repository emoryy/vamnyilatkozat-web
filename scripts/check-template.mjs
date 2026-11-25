// The Magyar Posta form is not redistributed with the source: whoever builds the app
// downloads it. This check runs before `dev` and `build`, and pins the exact edition the
// field coordinates in src/lib/field-map.js were measured on.
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('../public/assets/', import.meta.url));
const TARGET = `${dir}nyilatkozat-2026-10.pdf`;
// The name the form has when downloaded from posta.hu.
const DOWNLOADED = `${dir}Nyilatkozat_automatikus_postai_vamkezelesu_kuldemenyhez_WEB.pdf`;
const SHA256 = 'd10c15d815a7a86e2ae117d150bcdac2fa11d0783a5675131bd7d321cbb813aa';

const sha = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');

function fail(message) {
  console.error(`\n${message}\n
A nyomtatványt (2026-10-es kiadás) a Magyar Posta oldaláról kell letölteni:
  https://www.posta.hu/vam
majd a letöltött Nyilatkozat_automatikus_postai_vamkezelesu_kuldemenyhez_WEB.pdf
fájlt a public/assets/ mappába tenni. A fájlt ez a szkript ellenőrzi és nevezi át.\n`);
  process.exit(1);
}

if (!existsSync(TARGET) && existsSync(DOWNLOADED)) {
  if (sha(DOWNLOADED) !== SHA256) {
    fail('A public/assets/ mappában lévő nyomtatvány nem a 2026-10-es kiadás (eltér az ellenőrzőösszege), ezért a mezők helye nem biztos, hogy egyezik.');
  }
  copyFileSync(DOWNLOADED, TARGET);
}
if (!existsSync(TARGET)) fail('Hiányzik a nyomtatvány: public/assets/nyilatkozat-2026-10.pdf');
if (sha(TARGET) !== SHA256) {
  fail('A public/assets/nyilatkozat-2026-10.pdf nem a 2026-10-es kiadás (eltér az ellenőrzőösszege), ezért a mezők helye nem biztos, hogy egyezik.');
}
