#!/usr/bin/env node
/**
 * R393 (issue #13, korak R171 iz §15) — GENERATOR SEED SQLJA za migracijo
 * 20261009080000_r393_engineering_rules.
 *
 * NAČELO (§15 + §8): vrednosti v seedu so IZKLJUČNO izpeljane iz
 * data/roksal-catalog.json (byte-exact citati — polja se NE ročno
 * prepisujejo; ta generator JE dokaz sledljivosti: enak vhod → enak SQL)
 * + IZRECNO dokumentiranih konstant src/lib/calculator.ts (checkCompliance —
 * citati z vrsticami vira; vključno z NEDOSLEDNOSTMI, odkrito zabeleženimi:
 * §15 "Ne uporabljati nepreverjenih ali napačnih standard reference kot
 * production compliance truth" — NE popravljamo tiho, NE izmišljamo:
 * zabeležimo odkrito, popravek = nova verzija pravila prek API-ja).
 *
 * Uporaba: node scripts/r393-seed-sql-gen.mjs >> <migracija>/migration.sql
 * (pripne se za DDL del; idempotentno glede vhoda — determinističen izpis).
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

const checksum = createHash('sha256')
  .update(readFileSync(join(ROOT, 'data/roksal-catalog.json'), 'utf8'))
  .digest('hex')
  .slice(0, 16)

/** Determinističen id iz šifre (EXACT preslikava — kanon R374/R390). */
const idOdSifre = (sifra) => `rule-${sifra.toLowerCase()}`
const verIdOdSifre = (sifra) => `rulever-${sifra.toLowerCase()}-1`

/** Vir zapisa kataloga — citat z roundom + retrievedAt + sha. */
const KATALOG_VIR = `data/roksal-catalog.json (round ${catalog.round}; retrievedAt ${catalog.retrievedAt}; sha256[0:16] ${checksum}; officialSite ${catalog.officialSite})`
/** Verzija SDK, ki porablja razmak pravila (src/lib/product-sdk/rules.ts). */
const SDK_VERZIJA = 'sdk-S+8'

const out = []
out.push('')
out.push('-- ============================================================================')
out.push('-- SEED — izključno iz data/roksal-catalog.json + dokumentiranih konstant')
out.push('-- src/lib/calculator.ts (generator: scripts/r393-seed-sql-gen.mjs —')
out.push('-- byte-exact citati, brez ročnega prepisovanja). Deterministični id-ji +')
out.push('-- ON CONFLICT DO NOTHING (kanon R374/R390). VSA verzija 1 = ACTIVE,')
out.push('-- overitev INFORMATIVNO, reviewedAt/reviewerId NULL (§8 honest — NIČ')
out.push('-- dokumentiranih virov NI uradno preverjeno s strani projektanta/statika).')
out.push('-- ============================================================================')

// ── Splošna pravila montaže (§15 iz generalMountingRules — 9 citatov) ───────
// Kategorije: 1–7 MONTAZA, 8 (razmak desk) RAZMAK, 9 (WPC odtenek) MATERIAL +
// vir SEKUNDARNI_VIR (montaze-mlakar.si — citat v samem pravilu).
const SPLOSNE_KATEGORIJE = [
  'MONTAZA', 'MONTAZA', 'MONTAZA', 'MONTAZA', 'MONTAZA', 'MONTAZA', 'MONTAZA',
  'RAZMAK', 'MATERIAL',
]
const SPLOSNE_SIFRE = [
  'MONT-SPLOSNO-01', 'MONT-SPLOSNO-02', 'MONT-SPLOSNO-03', 'MONT-SPLOSNO-04',
  'MONT-SPLOSNO-05', 'MONT-SPLOSNO-06', 'MONT-SPLOSNO-07',
  'RAZMAK-DESKE-SPLOSNO', 'MATERIAL-WPC-ODTENNEK',
]
const SPLOSNA_NAZIVA = [
  'Predvrtanje vseh profilov', 'Minimalni odmik vijaka od reza',
  'Odmik vijaka — konstrukcija na plošči', 'Odmik vijaka — bočna montaža na ploč',
  'Odstranitev obstoječih varjenih delov', 'Spajanje desk na dolžino',
  'Ravnina stebrov', 'Priporočen razmak med deskami', 'WPC barvni odtenek — staranje',
]

out.push('-- Splošna pravila montaže (9) — byte-exact citati generalMountingRules;')
out.push('-- calculatorVerzija NULL = ročna navodila (NE porablja jih kalkulator);')
out.push('-- standardReferenca NULL = katalog NE citira standardov (§8 — NE izmišljamo).')
catalog.generalMountingRules.forEach((besedilo, i) => {
  const sifra = SPLOSNE_SIFRE[i]
  const jeSekundarni = i === 8
  const vir = jeSekundarni ? 'SEKUNDARNI_VIR' : 'KATALOG_PROIZVAJALCA'
  const virZapis = jeSekundarni
    ? `sekundaren vir: montaze-mlakar.si (citirano v ${KATALOG_VIR}; generalMountingRules[8])`
    : `${KATALOG_VIR}; generalMountingRules[${i}]`
  out.push(`INSERT INTO "EngineeringRule" ("id", "sifra", "naziv", "kategorija", "aplikacija", "productId", "orientacija", "aktivno", "createdAt", "updatedAt")`)
  out.push(`VALUES (${sql(idOdSifre(sifra))}, ${sql(sifra)}, ${sql(SPLOSNA_NAZIVA[i])}, ${sql(SPLOSNE_KATEGORIJE[i])}, NULL, NULL, NULL, true, ${now}, ${now}) ON CONFLICT ("id") DO NOTHING;`)
  out.push(`INSERT INTO "EngineeringRuleVersion" ("id", "ruleId", "verzija", "status", "vsebina", "strukturaJson", "vir", "virZapis", "standardReferenca", "standardVerzija", "jurisdikcija", "overitev", "calculatorVerzija", "veljavnostOd", "veljavnostDo", "reviewedAt", "reviewerId", "createdById", "createdAt")`)
  out.push(`VALUES (${sql(verIdOdSifre(sifra))}, ${sql(idOdSifre(sifra))}, 1, 'ACTIVE', ${sql(besedilo)}, NULL, '${vir}', ${sql(virZapis)}, NULL, NULL, NULL, 'INFORMATIVNO', NULL, ${now}, NULL, NULL, NULL, NULL, ${now}) ON CONFLICT ("id") DO NOTHING;`)
})

// ── Produktni razmaki (§15 iz zapisov profilov — SDK jih porablja) ──────────
out.push("-- Produktni razmaki (23) — byte-exact iz zapisov profilov; struktura")
out.push('-- {maxSpacingMm}/{minMm,maxMm}; calculatorVerzija sdk-S+8 = porablja')
out.push('-- Product SDK geometry (src/lib/product-sdk/rules.ts resolve*); KUBO')
out.push('-- pokončno BREZ maxPostSpacing → BREZ pravila (odkrito — SDK zahteva')
out.push('-- eksplicitne pozicije, kanon S+8.1 §3).')
for (const p of catalog.profiles) {
  const razmaki = []
  if (p.maxPostSpacingMm.horizontal !== null && p.maxPostSpacingMm.horizontal !== undefined) {
    razmaki.push([`RAZMAK-PODSTEBRI-H-${p.productId}`, `Max razmak stebrov (prečno) — ${p.profile}`, 'horizontal', { maxSpacingMm: p.maxPostSpacingMm.horizontal }, `maxPostSpacingMm.horizontal = ${p.maxPostSpacingMm.horizontal} mm`])
  }
  if (p.maxPostSpacingMm.vertical !== null && p.maxPostSpacingMm.vertical !== undefined) {
    razmaki.push([`RAZMAK-PODSTEBRI-V-${p.productId}`, `Max razmak stebrov (pokončno) — ${p.profile}`, 'vertical', { maxSpacingMm: p.maxPostSpacingMm.vertical }, `maxPostSpacingMm.vertical = ${p.maxPostSpacingMm.vertical} mm`])
  }
  if (p.maxRailSpacingMm && p.maxRailSpacingMm.vertical !== null && p.maxRailSpacingMm.vertical !== undefined) {
    razmaki.push([`RAZMAK-PODCEVI-V-${p.productId}`, `Max razmak cevi (pokončno) — ${p.profile}`, 'vertical', { maxSpacingMm: p.maxRailSpacingMm.vertical }, `maxRailSpacingMm.vertical = ${p.maxRailSpacingMm.vertical} mm`])
  }
  razmaki.push([`RAZMAK-PODDESKAMI-${p.productId}`, `Priporočen razmak med deskami — ${p.profile}`, null, { minMm: p.recommendedGapMm.min, maxMm: p.recommendedGapMm.max }, `recommendedGapMm = ${p.recommendedGapMm.min}–${p.recommendedGapMm.max} mm`])
  for (const [sifra, naziv, orientacija, struktura, virPolje] of razmaki) {
    const virZapis = `${KATALOG_VIR}; ${virPolje}`
    out.push(`INSERT INTO "EngineeringRule" ("id", "sifra", "naziv", "kategorija", "aplikacija", "productId", "orientacija", "aktivno", "createdAt", "updatedAt")`)
    out.push(`VALUES (${sql(idOdSifre(sifra))}, ${sql(sifra)}, ${sql(naziv)}, 'RAZMAK', NULL, ${sql(`prod-${p.productId}`)}, ${orientacija ? sql(orientacija) : 'NULL'}, true, ${now}, ${now}) ON CONFLICT ("id") DO NOTHING;`)
    out.push(`INSERT INTO "EngineeringRuleVersion" ("id", "ruleId", "verzija", "status", "vsebina", "strukturaJson", "vir", "virZapis", "standardReferenca", "standardVerzija", "jurisdikcija", "overitev", "calculatorVerzija", "veljavnostOd", "veljavnostDo", "reviewedAt", "reviewerId", "createdById", "createdAt")`)
    out.push(`VALUES (${sql(verIdOdSifre(sifra))}, ${sql(idOdSifre(sifra))}, 1, 'ACTIVE', ${sql(`${naziv} — katalog proizvajalca dokumentira: ${virPolje} (vir porablja Product SDK geometry)`)}, ${sqlJson(struktura)}, 'KATALOG_PROIZVAJALCA', ${sql(virZapis)}, NULL, NULL, NULL, 'INFORMATIVNO', ${sql(SDK_VERZIJA)}, ${now}, NULL, NULL, NULL, NULL, ${now}) ON CONFLICT ("id") DO NOTHING;`)
  }
}

// ── Pravila iz calculator.ts (§15 — NEPREVERJENE standardne reference) ───────
// Konstante TOČNO kot v viru (citat z vrsticami); NEDOSLEDNOSTI odkrito:
// NE popravljamo (popravek = nova verzija pravila prek API-ja — stroj §15).
// calculatorVerzija NULL = checkCompliance/veter-po-lokaciji NIMA lastne
// verzije formule (calc-engineering R150 verzionira SAMO ovojnice
// railing/anchoring/wind) — odkrito zabeleženo (§15 calculator version).
const KALKULATORSKA_PRAVILA = [
  {
    sifra: 'RAZMIK-ODPRINE-110',
    naziv: 'Max odprina med palicami (110 mm)',
    kategorija: 'RAZMAK',
    vsebina: 'Razmik med palicami (odprina) ≤ 110 mm — vir citira "SIST EN 1264" z utemeljitvijo "krogla 100mm ne sme pastiti". NEDOSLEDNOST odkrito zabeležena: krogla ⌀100 mm BI padla skozi odprino 110 mm — citirana referenca in vrednost se NE ujemata z utemeljitvijo; referenca NI preverjena (§15).',
    struktura: { maxGapMm: 110, utemeljitevKroglaMm: 100 },
    vir: 'INTERNI_INZENIRING',
    virZapis: 'src/lib/calculator.ts:581-592 (checkCompliance, maxGapAllowed = 110) — checkCompliance NIMA lastne verzije formule (calc-engineering R150 verzionira samo railing/anchoring/wind ovojnice)',
    standardReferenca: 'SIST EN 1264',
    standardVerzija: null,
    jurisdikcija: null,
  },
  {
    sifra: 'VISINA-OGRAJE-1000',
    naziv: 'Min višina ograje (1000 mm)',
    kategorija: 'GEOMETRIJA',
    vsebina: 'Višina ograje ≥ 1000 mm (balkoni, lože, terase in podobno — neodvisno od višine padca; nad 20 m: 1100 mm). Vir sam opozarja: "Vrednost je namenoma konservativna — preveri jo z veljavno zakonodajo in projektnimi pogoji."',
    struktura: { minHeightMm: 1000, minHeightAbove20mMm: 1100 },
    vir: 'INTERNI_INZENIRING',
    virZapis: 'src/lib/calculator.ts:594-611 (checkCompliance, minHeight) — checkCompliance NIMA lastne verzije formule (calc-engineering R150 verzionira samo railing/anchoring/wind ovojnice)',
    standardReferenca: 'Pravilnik o minimalnih tehničnih zahtevah za graditev stanovanjskih stavb',
    standardVerzija: null,
    jurisdikcija: 'SI',
  },
  {
    sifra: 'RAZMAK-STEBROV-1500',
    naziv: 'Max razmak stebrov (1500 mm)',
    kategorija: 'RAZMAK',
    vsebina: 'Razmak med stebri ≤ 1500 mm — vir NE imenuje standarda (komentar "(SIST EN)" BREZ številke — odkrito nezvezno). Izpis "Skladno statika stebrov" NE pomeni statične preverbe: statike NI bilo (§15 ločitev — informativno).',
    struktura: { maxPostSpacingMm: 1500 },
    vir: 'INTERNI_INZENIRING',
    virZapis: 'src/lib/calculator.ts:613-624 (checkCompliance, maxPostSpacing = 1500) — checkCompliance NIMA lastne verzije formule (calc-engineering R150 verzionira samo railing/anchoring/wind ovojnice)',
    standardReferenca: null,
    standardVerzija: null,
    jurisdikcija: null,
  },
  {
    sifra: 'OBREMENITEV-HORIZONTALNA-KNM',
    naziv: 'Horizontalna obremenitev po kategorijah',
    kategorija: 'OBREMENITEV',
    vsebina: 'Horizontalna obremenitev: kategorija A = 0,74 kN/m (stanovanjsko), B = 1,0 kN/m (javno), C = 1,5 kN/m (intenzivno javno). Vir citira "EVS EN 1991-1-1" in IZRECNO priznava ločitev §15 v samem izpisu: "informativno — predpostavimo da statiko naredi odgovorni projektant".',
    struktura: { kategorijaAKnM: 0.74, kategorijaBKnM: 1.0, kategorijaCKnM: 1.5 },
    vir: 'INTERNI_INZENIRING',
    virZapis: 'src/lib/calculator.ts:626-635 (checkCompliance, requiredLoad) — checkCompliance NIMA lastne verzije formule (calc-engineering R150 verzionira samo railing/anchoring/wind ovojnice)',
    standardReferenca: 'EVS EN 1991-1-1',
    standardVerzija: null,
    jurisdikcija: null,
  },
  {
    sifra: 'VETER-SIST-1991-1-4',
    naziv: 'Vetrni izračun po lokaciji (SI)',
    kategorija: 'OBREMENITEV',
    vsebina: 'Vetrni izračun po lokaciji — vir citira "SIST EN 1991-1-4 NA Slovenija" in opozarja, da je določanje cone "poenostavljeno za Slovenijo"; terenske kategorije I–IV s faktorji 1,0 / 0,91 / 0,82 / 0,73.',
    struktura: { terenskiFaktorji: { I: 1.0, II: 0.91, III: 0.82, IV: 0.73 } },
    vir: 'INTERNI_INZENIRING',
    virZapis: 'src/lib/calculator.ts:927-971 (calculateWindLoadByLocation) + 139-140 (terrainFactors) — calculateWindLoadByLocation NIMA lastne verzije formule (calc-engineering R150 verzionira samo railing/anchoring/wind ovojnice)',
    standardReferenca: 'SIST EN 1991-1-4',
    standardVerzija: null,
    jurisdikcija: 'SI',
  },
]
out.push('-- Pravila iz calculator.ts (5) — INTERNI_INZENIRING; standardReferenca')
out.push('-- TOČNO kot jo citira vir (NE popravljamo tiho — §15); NEDOSLEDNOSTI')
out.push('-- (110 mm vs krogla 100 mm; "SIST EN" brez številke; EVS namesto SIST)')
out.push('-- odkrito zabeležene v vsebini; overitev INFORMATIVNO + reviewedAt NULL.')
for (const r of KALKULATORSKA_PRAVILA) {
  out.push(`INSERT INTO "EngineeringRule" ("id", "sifra", "naziv", "kategorija", "aplikacija", "productId", "orientacija", "aktivno", "createdAt", "updatedAt")`)
  out.push(`VALUES (${sql(idOdSifre(r.sifra))}, ${sql(r.sifra)}, ${sql(r.naziv)}, ${sql(r.kategorija)}, NULL, NULL, NULL, true, ${now}, ${now}) ON CONFLICT ("id") DO NOTHING;`)
  out.push(`INSERT INTO "EngineeringRuleVersion" ("id", "ruleId", "verzija", "status", "vsebina", "strukturaJson", "vir", "virZapis", "standardReferenca", "standardVerzija", "jurisdikcija", "overitev", "calculatorVerzija", "veljavnostOd", "veljavnostDo", "reviewedAt", "reviewerId", "createdById", "createdAt")`)
  out.push(`VALUES (${sql(verIdOdSifre(r.sifra))}, ${sql(idOdSifre(r.sifra))}, 1, 'ACTIVE', ${sql(r.vsebina)}, ${sqlJson(r.struktura)}, ${sql(r.vir)}, ${sql(r.virZapis)}, ${r.standardReferenca ? sql(r.standardReferenca) : 'NULL'}, ${r.standardVerzija ? sql(r.standardVerzija) : 'NULL'}, ${r.jurisdikcija ? sql(r.jurisdikcija) : 'NULL'}, 'INFORMATIVNO', NULL, ${now}, NULL, NULL, NULL, NULL, ${now}) ON CONFLICT ("id") DO NOTHING;`)
}

out.push('-- SKUPAJ: 37 pravil (9 splošnih + 23 produktnih + 5 kalkulatorjevih),')
out.push('-- vsako s točno ENO verzijo 1 ACTIVE, overitev INFORMATIVNO,')
out.push('-- reviewedAt/reviewerId NULL (§8 honest — uradne projektantske/statistične')
out.push('-- preverbe ŠE NI — vpišejo se prek /api/engineering-rules z overitev')
out.push('-- PROJEKTANTSKA/STATISTICNA + reviewerId + reviewedAt).')

process.stdout.write(out.join('\n') + '\n')
