# ROKSAL ASSET RIGHTS REGISTER (S+7 §3, §4)

> **STATUS: VSE PRAVICE = `pending`.** Nobeno dovoljenje še NI pridobljeno.
> Dokler je status `pending`, se Roksal fotografije uporabljajo **IZKLJUČNO za
> interno razvoj/evalvacijo** tega projekta. **NE** objavljamo jih kot
> produkcijske katalog slike in **NE** trdimo, da imamo komercialno pravico
> uporabe. Ta dokument je obvezen del definition-of-done (spec S+7 §15).

## Pravno okvir

- Vse fotografije izhajajo z uradne strani **https://roksal.com/** (© Roksal d.o.o.,
  "Vse pravice pridržane" v nogi strani) ali iz iskanja slik, ki je indeksiralo
  vire na roksal.com domeni.
- Javna dostopnost ≠ dovoljenje za uporabo. Za produkcijsko uporabo je potreben
  pisni dogovor z ROKSAL d.o.o. (info@roksal.com, Savska Loka 21, 4000 Kranj).
- Prednosti dogovora: Roksal je naveden kot prvi referenčni proizvajalec projekta
  (S+7 cilj) — assets so zanj promocijska vrednost; prositi za pisno dovoljenje za
  uporabo produktnih/profilnih fotografij v vizualizacijskem orodju.

## Register assetov

Datum preverjanja: **2026-09-23** · Metoda: page_reader + image-search (OSS zrcadlo)
· Direkten HTTP iz peskovnika je blokiran (dokazano S+6/S+7).

| Asset ID | Datoteka (evaluation/roksal-assets/) | Vir (source URL) | Tip (§6) | Avtor | Rights | asset_quality | Opombe |
|---|---|---|---|---|---|---|---|
| ra-romb-amazon-installed | t1-romb-amazon-reference.jpg | roksal.com galerija/produktne strani (indeksirano prek image-search, OSS zrcadlo `z-cdn.chatglm.cn/image-search-mcp/images-ppt/06fa9a896fb0.jpg`) | REFERENCE + začasni PRODUCT vhod za S7-T1 | Roksal d.o.o. (domneni) | pending | insufficient (za uradni produkt asset) / usable (za interno evalvacijo) | vgrajena ograja, ni čistega profila; perspektiva rahla |
| ra-polna128-brown-installed | t2-polna128-reference.jpg | OSS zrcadlo `.../60d8dce20233.jpg` (vir: roksal.com galerija) | REFERENCE + začasni PRODUCT vhod za S7-T2 | Roksal d.o.o. (domneni) | pending | insufficient / usable | zasebni zaslon, skoraj čelno; odtenek = toplo rjava (ni potrjen Rustic Oak) |
| ra-polna100-vertical-installed | t3-polna100-vertical-reference.jpg | OSS zrcadlo `.../2308dd52a5b7.jpg` (vir: roksal.com galerija) | REFERENCE + začasni PRODUCT vhod za S7-T3 | Roksal d.o.o. (domneni) | pending | insufficient / usable | pokončna ograja na balkonu; svetlejši odtenek kot Burma Teak referenca — ZABELEŽENO, ne prikrito |
| ra-polna57-32-exhibit | polna-57-32-salon-NOV-PROFIL.jpg | OSS zrcadlo `.../b81c44e4942e.jpg` (salonski eksponat "NOV PROFIL") | REFERENCE | Roksal d.o.o. | pending | insufficient | salonski eksponat z napisom — NI produktna fotografija |
| ra-romb-pokoncna-exhibit | romb-pokoncna-salon.jpg | OSS zrcadlo `.../767f20ada3f4.jpg` | REFERENCE | Roksal d.o.o. | pending | insufficient | salonski eksponat |
| ra-palette-romb | (NI prenešena — samo URL) | `https://roksal.com/wp-content/uploads/2024/09/BARVNA_LESTVICA_3-rombi4-1024x268.png` | MATERIAL/TEXTURE (paleta) | Roksal d.o.o. | pending | insufficient | direktnej prenos blokiran; barvna imena iz tekstovnih virov |

## Kaj MANJKA (iskreno — spec §4)

- **Ni čistega PROFIL IMAGE vira** (posamezna deska na nevtralnem ozadju) za noben
  profil → vsi `asset_quality = insufficient` za uradno produktno uporabo.
- **Ni tileable MATERIAL/TEXTURE vira** — tekstura za C-metodo se vzorči iz
  referenčnih fotografij (interno, deterministično).
- Ni uradnih hex/RAL vrednosti odtenkov — vse `approxHex` v merilnem poročilu so
  IZMERJENI približki iz fotografij (dokumentirano, brez statusa uradnosti).
- 3 testni produkti (T1/T2/T3) uporabljajo fotografije VGRAJENIH ograj kot začasne
  produktné vhode — to je dovoljeno za interno evalvacijo, NE za produkcijo.

## Potrebna dejanja za `granted`

1. Pisno povpraševanje na info@roksal.com (dovoljenje za uporabo produktnih +
   profilnih fotografij WoodCore profilov v vizualizacijskem orodju).
2. Po pridobitvi: posodobiti `rights: granted` v `data/roksal-catalog.json` + ta
   register + zabeležiti datum in obseg dovoljenja.
3. V primeru zavrnitve: `rights: rejected` → asseti se umaknijo iz repozitorija,
   proceduralni renderer (B/C) ostane edini vir oblike (geometrija+barva po
   katalogu ni avtorsko zaščitena fotografija).

## Obvladovanje tveganja (trenutno stanje `pending`)

- Asseti so v `evaluation/` (NE v `public/`) — niso servisirani kot statika
  produkcijske aplikacije.
- Noben asset ni v produkcijski UI (spec S+7: brez novih UI funkcij).
- Katalog (`data/roksal-catalog.json`) vsebuje FAKTE (dimenzije, montaža, viri) —
  dejstva o izdelku niso predmet avtorskih pravic fotografij.
