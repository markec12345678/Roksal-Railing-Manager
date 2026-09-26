// R186 — izvoz meritev v CSV (vzorec vodja-csv R163 / nagibi-csv R157 /
// punch-csv R158 / crm-csv R159 / ponudbe-csv R161 / audit-csv R162: BOM za
// Excel, escape navedkov, deterministično ime datoteke; čisto jedro je
// client-safe in 100 % testabilno — komponenta je samo žičenje).
// ---------------------------------------------------------------------------
// Motiv: meritve so TERENSKI NABOR PODATKOV za pripravo ograje (razdalje,
// višine, koti, štebricki) — do zdaj samo zaslonski pogled. Pisarna jih za
// pripravo rezov/ponudbe potrebuje MAŠINETNO BERLJIVE (Excel/arhiv). Izvoz je
// PONUDBA VIDNIH meritev (upošteva status filter + foto filter — isto pravilo
// kot zaloga 'Izvozi vidno zalogo kot CSV').
//
// Ločilo: vejica (,) — usklajeno z novejšo družino izvozov (R157-R163);
// vsa besedilna polja citirana (narekovaj podvojen).
//
// Načela:
//  • IZVOŽENO = ZASLON: isti status fallback kot UI ((status || 'OSNUTEK'),
//    isti tip fallback ((tipMeritve || 'RAZDALJA') — razdalje so privzeti
//    tip razpredenja). Nič izmišljenega: odsotna polja → PRAZNO polje
//    (ne 'n/a', ne ugibanje).
//  • Determinizem: čista funkcija nad izrecnimi vhodi — brez Date.now() v
//    jedru (referenčni datum pride KOT PARAMETER, tudi v imenu datoteke);
//    vrstni red vrstic = vrstni red vhoda (vidni seznam; jedro NE preureja).
//  • Fail-closed: manjkajoč/pokvaren vnos → TypeError (nikoli tihega izvoza
//    polpdatkov — dolžina/visina so FIZIKALNE mere, negativna ali
//    ne-končna vrednost je podatkovna napaka, ki je NE izvozimo).
//  • Kanonične enote: dolzina_mm/visina_mm so kot v bazi (mm); originalna
//    vrednost + enota replicirata shranjeni P3 vnos (zaslonska pretvorba je
//    del UI, ne izvoza — arhiv ostane enoznačen).

/** Meritev za izvoz — IZSEK client vmesnika Measurement (measurements-tab.tsx).
 *  Polja so odprta (string/number/null) — jedro sam validira in fail-closed. */
export interface MeritevZaIzvoz {
  id: string
  createdAt: string
  dolzinaMm: number
  visinaMm: number
  tipMeritve?: string | null
  oznaka?: string | null
  status?: string | null
  lokacija?: string | null
  opomba?: string | null
  tipPodlage?: string | null
  kotStopinje?: number | null
  steviloStebrov?: number | null
  enota?: string | null
  originalnaVrednost?: number | null
  tipStebra?: string | null
  materialStebra?: string | null
  visinaStebraMm?: number | null
  pozicijaMm?: number | null
  notranjiKot?: number | null
  zunanjiKot?: number | null
}

/** Ena CSV vrstica iz merch. Odprta polja → '' (pošteno prazno); status/tip
 *  z ISTIM fallbackom kot UI. */
export function meritevVrstica(m: MeritevZaIzvoz): string[] {
  if (!m || typeof m !== 'object' || Array.isArray(m)) {
    throw new TypeError('meritevVrstica: pričakovana meritev (MeritevZaIzvoz)')
  }
  if (typeof m.id !== 'string' || m.id === '') {
    throw new TypeError(`meritevVrstica: pričakovan id (ne-prazen string), ne ${String(m.id)}`)
  }
  if (typeof m.createdAt !== 'string' || m.createdAt === '') {
    throw new TypeError(`meritevVrstica: pričakovan createdAt (ISO 8601 string), ne ${String(m.createdAt)}`)
  }
  // Kanonični datum izvoza: ISO 8601 iz baze (mašinetno berljiv; časovni
  // izris je del UI, ne arhiva). Pokvaren datum → TypeError (fail-closed —
  // preverba PRED toISOString, ki bi sicer vrgel RangeError).
  const parsed = new Date(m.createdAt)
  if (Number.isNaN(parsed.getTime())) {
    throw new TypeError(`meritevVrstica: createdAt ni razumljen kot datum: ${String(m.createdAt)}`)
  }
  const datum = parsed.toISOString()
  for (const [ime, v] of [
    ['dolzinaMm', m.dolzinaMm],
    ['visinaMm', m.visinaMm],
  ] as const) {
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) {
      throw new TypeError(`meritevVrstica: pričakovana ${ime} (ne-negativno končno število mm), ne ${String(v)}`)
    }
  }
  // IZVOŽENO = ZASLON: isti fallbacki kot razpredenje (razdalje = privzeti
  // tip; OSNUTEK = privzeti status).
  const tip = m.tipMeritve ?? 'RAZDALJA'
  const status = m.status ?? 'OSNUTEK'
  return [
    datum,
    m.oznaka ?? '',
    tip,
    String(m.dolzinaMm),
    String(m.visinaMm),
    m.kotStopinje == null ? '' : String(m.kotStopinje),
    m.steviloStebrov == null ? '' : String(m.steviloStebrov),
    m.tipPodlage ?? '',
    m.enota ?? '',
    m.originalnaVrednost == null ? '' : String(m.originalnaVrednost),
    m.tipStebra ?? '',
    m.materialStebra ?? '',
    m.visinaStebraMm == null ? '' : String(m.visinaStebraMm),
    m.pozicijaMm == null ? '' : String(m.pozicijaMm),
    m.notranjiKot == null ? '' : String(m.notranjiKot),
    m.zunanjiKot == null ? '' : String(m.zunanjiKot),
    status,
    m.lokacija ?? '',
    m.opomba ?? '',
  ]
}

const GLAVA = [
  'datum',
  'oznaka',
  'tip',
  'dolzina_mm',
  'visina_mm',
  'kot_stopinje',
  'stevilo_stebrov',
  'tip_podlage',
  'enota',
  'originalna_vrednost',
  'tip_stebra',
  'material_stebra',
  'visina_stebra_mm',
  'pozicija_mm',
  'notranji_kot',
  'zunanji_kot',
  'status',
  'lokacija',
  'opomba',
]

/** Citiranje besedilnih polj (narekovaj podvojen) — vzorec vodja-csv. */
function citiraj(v: string): string {
  return `"${v.replace(/"/g, '""')}"`
}

/** Niz vrstic CSV tabele (brez BOM): glava + vrstice v vrstnem redu vhoda. */
export function meritveCsvVrstice(meritve: readonly MeritevZaIzvoz[]): string[] {
  if (!Array.isArray(meritve)) {
    throw new TypeError('meritveCsvVrstice: pričakovano polje meritev (MeritevZaIzvoz[])')
  }
  const vrstice = meritve.map((m) => meritevVrstica(m).map(citiraj).join(','))
  return [GLAVA.map(citiraj).join(','), ...vrstice]
}

/** Celoten CSV niz: BOM + vrstice (vzorec vodja-csv — '\n' zaključki). */
export function meritveCsv(meritve: readonly MeritevZaIzvoz[]): { csv: string; vrstic: number } {
  const lines = meritveCsvVrstice(meritve)
  return { csv: '\uFEFF' + lines.join('\n'), vrstic: lines.length }
}

/** Deterministično ime datoteke: meritve_<YYYY-MM-DD>.csv (referenčni datum
 *  pride KOT parameter — jedro ne bere ure). */
export function meritveCsvFilename(isoDatum: string): string {
  if (typeof isoDatum !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(isoDatum)) {
    throw new TypeError('meritveCsvFilename: pričakovan ISO datum (YYYY-MM-DD)')
  }
  const mesec = Number(isoDatum.slice(5, 7))
  const dan = Number(isoDatum.slice(8, 10))
  if (mesec < 1 || mesec > 12 || dan < 1 || dan > 31) {
    throw new TypeError(`meritveCsvFilename: nemogoč datum: ${isoDatum}`)
  }
  return `meritve_${isoDatum}.csv`
}
