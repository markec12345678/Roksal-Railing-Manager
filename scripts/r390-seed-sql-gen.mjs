#!/usr/bin/env node
/**
 * R390 (issue #13, korak R170 iz §14) — GENERATOR SEED SQLJA za migracijo
 * 20261008080000_r390_product_catalog.
 *
 * NAČELO (§14 + §8): vrednosti v seedu so IZKLJUČNO izpeljane iz
 * data/roksal-catalog.json (byte-exact — polja se NE ročno prepisujejo;
 * ta generator JE dokaz sledljivosti: enak vhod → enak SQL). Izpeljave
 * (interniOkrepitev, aplikacije, kompatibilnost) so DOKUMENTIRANE preslikave
 * katalogovih besedil — vsaka s citatom vira v opisu/viru vrstice.
 *
 * Uporaba: node scripts/r390-seed-sql-gen.mjs >> <migracija>/migration.sql
 * (pripne se za DDL del; idempotentno glede vhoda — deterministicen izpis).
 */
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const catalog = JSON.parse(readFileSync(join(ROOT, 'data/roksal-catalog.json'), 'utf8'))

/** SQL literal — enojni narekovaji podvojeni (byte-varno). */
function sql(text) {
  return `'${String(text).replace(/'/g, "''")}'`
}
/** JSON kolona — zapis z istim vrstnim redom ključev objekta (stabilen). */
function sqlJson(value) {
  return sql(JSON.stringify(value))
}
const now = 'CURRENT_TIMESTAMP'

// ── Verzija kataloga v1 (seed) ──────────────────────────────────────────────
const checksum = createHash('sha256')
  .update(readFileSync(join(ROOT, 'data/roksal-catalog.json'), 'utf8'))
  .digest('hex')
  .slice(0, 16)

const out = []
out.push('-- Verzija kataloga v1 — seed; vir: data/roksal-catalog.json')
out.push(`-- (round ${catalog.round}; retrievedAt ${catalog.retrievedAt}; sha256[0:16] ${checksum}).`)
out.push(`INSERT INTO "ProductCatalogVersion" ("id", "verzija", "status", "veljavnostOd", "opomba", "createdAt")`)
out.push(`VALUES ('katalog-v1', 1, 'ACTIVE', ${now}, ${sql(
  `Seed v1 — TOČNO iz data/roksal-catalog.json (round ${catalog.round}, retrievedAt ${catalog.retrievedAt}); ` +
    `pravice: ${catalog.rightsPolicy}`,
)}, ${now}) ON CONFLICT ("id") DO NOTHING;`)

// ── Družina WoodCore ────────────────────────────────────────────────────────
out.push('-- Družina: WoodCore (edina v katalogu; paleta + splošna pravila = družinska resnica).')
out.push(
  `INSERT INTO "ProductFamily" ("id", "sifra", "naziv", "material", "garancija", "uradnaStran", "barvnaPaletaJson", "splosnaPravilaJson", "pravice", "aktivna", "createdAt", "updatedAt")`,
)
out.push(
  `VALUES ('fam-woodcore', ${sql('woodcore')}, ${sql(catalog.family)}, ${sql(catalog.material)}, ${sql(
    catalog.warranty,
  )}, ${sql(catalog.officialSite)}, ${sqlJson(catalog.colorPalette.colors)}, ${sqlJson(
    catalog.generalMountingRules,
  )}, 'pending', true, ${now}, ${now}) ON CONFLICT ("id") DO NOTHING;`,
)

// ── Interna okrepitev (§14) — DOKUMENTIRANA preslikava fixing/posebnosti ────
// true SAMO kjer besedilo kataloga dokumentira cev v sredini profila; opis
// cita vir (§8 — NE izmišljamo).
const OKREPIXVEZ = {
  'woodcore-romb-67': 'OBVEZNA aluminijasta cev v sredini romba — montaža brez nje NI mogoča (specialFeatures)',
  'woodcore-romb-67-vertical': 'Obvezna alu cev (kot prečna varianta) — pritrditev v alu cev v sredini romba od zadaj (specialFeatures + fixing)',
  'woodcore-kubo-80-42': 'Alu cev v notranjosti (od leve proti desni): 20×60×2 mm, 25×25×2 mm, 20×20×2 mm (specialFeatures)',
  'woodcore-polna-57-32': 'RF vijaki skozi cev iz zadnje strani — vijak približno 2/3 globine profila (fixing)',
}

// ── Aplikacije (§14) — DOKUMENTIRANA preslikava ─────────────────────────────
// iz kategorije + posebnosti + (KUBO) uradnega fasadnega vira; maxRazmakMm iz
// maxPostSpacingMm zapisa (KUBO: podkonstrukcija do 100 cm iz fasadnega vira).
const APLIKACIJE = {
  'woodcore-romb-67': [
    ['HORIZONTALNA_OGRAJA', 'horizontal', 1450, 'kategorija precna+pokoncna; maxPostSpacingMm.horizontal = 1450'],
    ['POKONCNA_OGRAJA', 'vertical', 1450, 'kategorija precna+pokoncna; maxPostSpacingMm.vertical = 1450'],
  ],
  'woodcore-polna-128': [
    ['HORIZONTALNA_OGRAJA', 'horizontal', 1100, 'kategorija precna+pokoncna; maxPostSpacingMm.horizontal = 1100'],
    ['POKONCNA_OGRAJA', 'vertical', 1800, 'kategorija precna+pokoncna; maxPostSpacingMm.vertical = 1800'],
  ],
  'woodcore-deska-150': [
    ['TERASA', 'horizontal', 1330, 'naziv "(terasna)"; posebnost "Terasna deska KLASIK/RUSTIK"; maxPostSpacingMm.horizontal = 1330'],
  ],
  'woodcore-polna-57-32': [
    ['POKONCNA_OGRAJA', 'vertical', 1500, 'kategorija pokoncna; maxPostSpacingMm.vertical = 1500'],
  ],
  'woodcore-polna-100': [
    ['POKONCNA_OGRAJA', 'vertical', 1800, 'posebnost "Primerne SAMO za pokončno ograjo (ne za teraso/prečno)"; maxPostSpacingMm.vertical = 1800'],
  ],
  'woodcore-polna-128-vertical': [
    ['POKONCNA_OGRAJA', 'vertical', 1800, 'kategorija pokoncna; maxPostSpacingMm.vertical = 1800'],
  ],
  'woodcore-romb-67-vertical': [
    ['POKONCNA_OGRAJA', 'vertical', 1450, 'kategorija pokoncna; maxPostSpacingMm.vertical = 1450'],
  ],
  'woodcore-kubo-80-42': [
    ['FASADA', 'vertical', 1000, 'uradni vir je FASADNA stran (montaža SAMO vertikalno); "Podkonstrukcija (alu cevi) razmak do 100 cm"'],
  ],
}

// ── Produktni vrstice ───────────────────────────────────────────────────────
out.push('-- Produktni vrstice (8 profilov) — polja byte-exact iz kataloga;')
out.push('-- razmakKvalifikatorji = NE-baza/h/v ključi maxPostSpacingMm zapisa.')
for (const p of catalog.profiles) {
  const kv = Object.entries(p.maxPostSpacingMm)
    .filter(([k, v]) => k !== 'horizontal' && k !== 'vertical' && v !== null)
    .map(([k, v]) => ({ key: k, maxSpacingMm: v }))
  const okrepitev = OKREPIXVEZ[p.productId] ?? null
  out.push(
    `INSERT INTO "Product" ("id", "familyId", "catalogVersionId", "sifra", "naziv", "kategorija", "faceWidthMm", "thicknessMm", "standardLengthsJson", "fixingMetoda", "screwsVisible", "interniOkrepitev", "okrepitevOpis", "maxPostSpacingH", "maxPostSpacingV", "maxRailSpacingV", "razmakKvalifikatorjiJson", "gapMinMm", "gapMaxMm", "rocajJson", "posebnostiJson", "pravice", "viriJson", "aktivna", "createdAt", "updatedAt")`,
  )
  out.push(
    `VALUES ('prod-${p.productId}', 'fam-woodcore', 'katalog-v1', ${sql(p.productId)}, ${sql(
      p.profile,
    )}, ${sql(p.category)}, ${p.faceWidthMm}, ${p.thicknessMm.toFixed(2)}, ${sqlJson(
      p.standardLengthsMm,
    )}, ${sql(p.fixing)}, ${p.screwsVisible}, ${okrepitev !== null}, ${
      okrepitev !== null ? sql(okrepitev) : 'NULL'
    }, ${p.maxPostSpacingMm.horizontal ?? 'NULL'}, ${p.maxPostSpacingMm.vertical ?? 'NULL'}, ${
      p.maxRailSpacingMm?.vertical ?? 'NULL'
    }, ${sqlJson(kv)}, ${p.recommendedGapMm.min}, ${p.recommendedGapMm.max}, ${sqlJson(
      p.handle,
    )}, ${sqlJson(p.specialFeatures)}, ${sql(p.rights)}, ${sqlJson(p.sourceUrls)}, true, ${now}, ${now}) ON CONFLICT ("id") DO NOTHING;`,
  )
}

// ── Aplikacijske vrstice ────────────────────────────────────────────────────
out.push('-- Aplikacijske vrstice (§14 eksplicitni kontekst) — samo DOKUMENTIRANE')
out.push('-- kombinacije; PREDELNA_STENA/STROP: noben produkt jih nima dokumentirane.')
let appIdx = 0
for (const [sifra, rows] of Object.entries(APLIKACIJE)) {
  for (const [aplikacija, orientacija, maxRazmak, vir] of rows) {
    appIdx += 1
    out.push(
      `INSERT INTO "ProductApplication" ("id", "productId", "aplikacija", "orientacija", "maxRazmakMm", "vir", "createdAt")`,
    )
    out.push(
      `VALUES ('app-${String(appIdx).padStart(2, '0')}', 'prod-${sifra}', ${sql(aplikacija)}, ${sql(
        orientacija,
      )}, ${maxRazmak ?? 'NULL'}, ${sql(vir)}, ${now}) ON CONFLICT ("id") DO NOTHING;`,
    )
  }
}

// ── Dodatki (§14 Fixing/Accessory) ──────────────────────────────────────────
out.push('-- Dodatki: 5 kataloških (šifra = EXACT id dodatka iz kataloga).')
for (const a of catalog.accessories) {
  out.push(
    `INSERT INTO "ProductAccessory" ("id", "sifra", "familyId", "naziv", "dimenzijeJson", "notranjeMereJson", "opis", "aktivna", "createdAt", "updatedAt")`,
  )
  out.push(
    `VALUES ('acc-${a.id}', ${sql(a.id)}, 'fam-woodcore', ${sql(a.name)}, ${
      a.dimensionMm ? sqlJson(a.dimensionMm) : 'NULL'
    }, ${a.innerMm ? sqlJson(a.innerMm) : 'NULL'}, ${a.note ? sql(a.note) : 'NULL'}, true, ${now}, ${now}) ON CONFLICT ("id") DO NOTHING;`,
  )
}

// ── Kompatibilnost (§14) — SAMO dokumentirani pari ──────────────────────────
// Vir citatov: opisi dodatkov + posebnosti profilov + handle zapisi.
const KOMPATIBILNOST = [
  ['prod-woodcore-romb-67', 'acc-rocaj-poln-92x45', 'handle.note: "Ročaj 92×45×5800 (notranja 55×30) se uporablja kot vrhnji zaključek"'],
  ['prod-woodcore-romb-67', 'acc-cep-romb-levo-desno', 'posebnost: "Zaključek: levi/desni čep ALI letvica" + dodatek "Levi/desni čep za zaključek romb profila"'],
  ['prod-woodcore-romb-67', 'acc-letvica-zakljucna', 'posebnost: "Zaključek: levi/desni čep ALI letvica" + dodatek "Zaključna letvica (opcija prečne romb ograje)"'],
  ['prod-woodcore-romb-67', 'acc-stebricek-alu', 'dodatek: "Kotnik levo+desno za romb; spodnji del za nevidno pritrjevanje"'],
  ['prod-woodcore-romb-67-vertical', 'acc-cep-romb-levo-desno', 'posebnost: "Pokončno s razmaki: vidna alu cev — vsaka deska zaprta s čepi ali detajl konstrukcije"'],
  ['prod-woodcore-romb-67-vertical', 'acc-stebricek-alu', 'dodatek: "Kotnik levo+desno za romb" (pokončna romb varianta)'],
  ['prod-woodcore-polna-128', 'acc-rocaj-poln-92x45', 'handle.available=true, dimenzije 92×45×5800 = dodatek "Ročaj za ograjo – poln profil"'],
  ['prod-woodcore-deska-150', 'acc-rocaj-poln-92x45', 'handle.available=true, dimenzije 92×45×5800 = dodatek "Ročaj za ograjo – poln profil"'],
  ['prod-woodcore-deska-150', 'acc-pokrovcek-terasna', 'posebnost: "Zaključni pokrovček na voljo" + dodatek "Zaključni pokrovček za terasno desko"'],
  ['prod-woodcore-polna-57-32', 'acc-rocaj-poln-92x45', 'handle.available=true, dimenzije 92×45×5800 = dodatek "Ročaj za ograjo – poln profil"'],
  ['prod-woodcore-polna-100', 'acc-rocaj-poln-92x45', 'handle.available=true (note: "Ročaj 95×45 na zalogi samo v WHITE; ostali v polnem profilu 92×45")'],
  ['prod-woodcore-polna-128-vertical', 'acc-rocaj-poln-92x45', 'handle.available=true, dimenzije 92×45×5800 = dodatek "Ročaj za ograjo – poln profil"'],
]
out.push('-- Kompatibilnost: 12 DOKUMENTIRANIH parov (vir = besedilo kataloga);')
out.push('-- KUBO nima nobenega (odkrito — fasadni kontekst dodatkov ne imenuje).')
let cIdx = 0
for (const [productId, accId, opis] of KOMPATIBILNOST) {
  cIdx += 1
  out.push(
    `INSERT INTO "ProductCompatibility" ("id", "productId", "kompatibilenProductId", "kompatibilenDodatekId", "opis", "createdAt")`,
  )
  out.push(
    `VALUES ('compat-${String(cIdx).padStart(2, '0')}', '${productId}', NULL, '${accId}', ${sql(
      opis,
    )}, ${now}) ON CONFLICT ("id") DO NOTHING;`,
  )
}

out.push('-- ProductVariant + ProductSupplierMapping: seed PRAZEN (§8 — colorsCount')
out.push('-- je ŠTEVEC ne enumeracija; dobaviteljske preslikave katalog NE dokumentira).')
out.push('-- vpiše jih pisarca prek /api/catalog r390.')

process.stdout.write(out.join('\n') + '\n')
