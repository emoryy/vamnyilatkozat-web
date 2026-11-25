# Vámnyilatkozat-kitöltő

Statikus webapp a Magyar Posta „Nyilatkozat automatikus postai vámkezelésű küldeményhez” nyomtatványának (2026-10-es kiadás) kitöltéséhez. Minden a böngészőben fut: a PDF-et a böngésző állítja elő, az adatok (saját adatok, feladók, küldemények, listák, aláírásképek) a böngésző IndexedDB-jében maradnak. Nincs szerveroldali komponens, nincs külső kérés.

Nem hivatalos eszköz, a Magyar Posta Zrt.-hez nincs köze.

## Fejlesztés

```bash
npm install
npm run dev       # http://127.0.0.1:47619
npm run build     # dist/
```

## Felépítés

- `src/lib/declaration.js`: a nyomtatvány kitöltése pdf-lib-bel. A szöveg a mezők téglalapjaiba kerül beágyazott Unicode betűkészlettel (LiberationSerif), nem az AcroForm mezőkbe, az `ő` / `ű` betűk miatt. Az 5 sornál több tétel pótlapra kerül.
- `src/lib/field-map.js`: a mezők koordinátái a 2026-10-es nyomtatványon.
- `src/lib/pdfjs.js`: előnézet és a „Képként (laposítva)” letöltés pdf.js-sel. A laposítás felbontása az aláíráskép saját felbontása (hogy ne nagyítódjon fel), de legalább 200 és legfeljebb 300 DPI, hogy egy kis felbontású aláírás miatt ne mosódjon el a nyomtatvány szövege.
- `src/lib/signature-image.js`: aláíráskép feldolgozása: papír-háttér becslése (egyenetlen megvilágításhoz is), Otsu-küszöb, apró foltok eltávolítása összefüggő komponensek alapján, levágás a tintára. A fotó 90 fokonként forgatható; ha EXIF-forgatási jelzése van, a szerkesztő egy kattintással vissza tudja állítani a jelzés nélküli állást, mert asztalra lefelé fotózott papírnál ez a jelzés gyakran hibás.
- `src/lib/store.svelte.js`: állapot és tárolás (IndexedDB, idb-keyval). Minden tárolóművelet (automatikus mentés, aláírás mentése és törlése, import, teljes törlés, újratöltés egy másik lap mentése után) egyetlen sorban, egymás után fut, és a több kulcsot érintő írások egy tranzakcióban mennek. Egyszerre csak egy lap használhatja (Web Locks): egy második lap figyelmeztet, és átveheti az alkalmazást, ekkor az első lap szünetel és nem ment. A tárolt és az importált adatot `normalizeData` mezőnként ellenőrzi.
- `src/lib/catalog.js`: beépített feladók, megnevezések, dokumentumtípusok.
- `public/_headers`: Cloudflare Pages fejlécek, szigorú CSP (`connect-src 'self'`), így az oldal külső címre nem küldhet adatot.

## Beépített feladócímek

A címek a webshopok saját jogi közlemény / cégadat oldaláról származnak (2026-11-25), a Mandarake boltoké a Mandarake számlákról. Nem szerepel: Hobby Search (az oldal automatikusan nem érhető el, a cím csak cégjegyzékből ismert), Suruga-ya (nem érhető el), Plaza Japan és Goods Republic (nem közölnek címet).

## Telepítés

Cloudflare Pages, projekt: `vamnyilatkozat` (https://vamnyilatkozat.pages.dev). A `cf` CLI Pages-re nem tud feltölteni, ezért wranglerrel, a projekthez hozzá nem adva:

```bash
npm run build
npx wrangler pages deploy dist --project-name vamnyilatkozat --branch master
```

## Harmadik fél tartalma

- `public/assets/nyilatkozat-2026-10.pdf`: a Magyar Posta nyilvánosan letölthető nyomtatványa, változatlanul.
- `public/assets/LiberationSerif-Regular.ttf`: Liberation Fonts, SIL Open Font License 1.1 (`public/assets/LiberationSerif-LICENSE.txt`).
- Felület betűkészletek (Bricolage Grotesque, Public Sans, IBM Plex Mono): SIL Open Font License 1.1, a `@fontsource` csomagokból, helyben kiszolgálva.
