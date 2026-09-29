// R294 — ISSUE #1 («Professional automation») — PREDMET 4: feature-by-feature
// audit tabela KOT KODA (EN VIR). Vsaka glavna Roksal funkcija je razvrščena
// po kanonu issue #1: deterministic / SDK / script / AI-optional.
// DOKTRINA: AI je NIKOLI obvezen — vsak 'ai' vnos IZRECNO deklarira
// deterministični nadomestek (id druge zmožnosti v tem katalogu), tako da
// aplikacija deluje tudi, ko AI ponudnik ni dosegljiv (issue #1 §11).
// Testi (r294-automation.test.ts) vsiljujejo: unikatni id, veljavna vrsta,
// obstoječ modul, pokritost vseh 10 območij, AI-nadomestni kontrakt,
// zamrznjeno deterministično stanje.
//
// ASCII kanon (lekcija R292/R293): identifikatorji BREZ diakritike
// (obmocje, stObmocij); opis vsebine smejo imeti diakritiko (stringi
// preživijo minifikacijo).

export const OBMOCJA = [
  'Photo/VIZ',
  'Meritve',
  'Konfiguracija izdelka',
  'Kalkulator / ponudba',
  'Zaloga / dobavitelji / naročila',
  'Dokumenti',
  'Montaža / razporejanje',
  'Strankin portal',
  'Varnost',
  'Mobilno / PWA / offline',
] as const

export type Obmocje = (typeof OBMOCJA)[number]

export type AutomatizacijskaVrsta = 'deterministic' | 'sdk' | 'script' | 'ai'

export interface AutomatizacijskaZmoznost {
  /** Unikatni ASCII id (npr. 'meritve.ai-ocena-foto') */
  readonly id: string
  /** Razred po kanonu issue #1 */
  readonly vrsta: AutomatizacijskaVrsta
  /** Območje poslovanja (issue #1 §1–§10) */
  readonly obmocje: Obmocje
  /** Iskren opis resnice funkcije */
  readonly opis: string
  /** Pot modula v repozitoriju (test vsiljuje obstoj) */
  readonly modul: string
  /** SAMO za 'ai': id deterministične nadomestne zmožnosti (kontrakt §11) */
  readonly nadomestek?: string
}

// VRSTNI RED = ustaljen (tabela v docs/automacija-audit.md je odraz tega
// polja — spremembe LE tukaj; testi vsiljujejo usklajenost).
export const AUTOMATIZACIJSKI_KATALOG: readonly AutomatizacijskaZmoznost[] = Object.freeze([
  // ---- §1 Photo/VIZ ----
  {
    id: 'viz.scena-razumevanje',
    vrsta: 'deterministic',
    obmocje: 'Photo/VIZ',
    opis: 'Razumevanje scene s fotografije — determinističen CV pipeline (brez AI)',
    modul: 'src/lib/cv-studio/scene.ts',
  },
  {
    id: 'viz.stanje-iskreno',
    vrsta: 'deterministic',
    obmocje: 'Photo/VIZ',
    opis: 'VIZ korak izpiše ISKRENO stanje (AI FINISH = planirano, čaka na GPU — nikoli lažnega uspeha)',
    modul: 'src/components/viz/step-result.tsx',
  },
  {
    id: 'viz.ai-render',
    vrsta: 'ai',
    obmocje: 'Photo/VIZ',
    opis: 'VIZ render job (GPU) — iskren stub: stanje queued, NI produkcija odvisnost',
    modul: 'src/app/api/viz/render/route.ts',
    nadomestek: 'viz.stanje-iskreno',
  },
  // ---- §2 Meritve ----
  {
    id: 'meritve.dolocanje',
    vrsta: 'deterministic',
    obmocje: 'Meritve',
    opis: 'Določanje meritev (dolžine/višine/koti) iz merilnih vhodov — čista geometrija',
    modul: 'src/lib/measure.ts',
  },
  {
    id: 'meritve.verzije',
    vrsta: 'deterministic',
    obmocje: 'Meritve',
    opis: 'Zgodovina verzij meritve — korekcije NE prepišejo prejšnjih verzij (R276)',
    modul: 'src/lib/meritev-verzije.ts',
  },
  {
    id: 'meritve.ai-ocena-foto',
    vrsta: 'ai',
    obmocje: 'Meritve',
    opis: 'AI ocena meritve iz navadne fotografije (VLM pomožna — neobvezna pomoč, ne vir resnice)',
    modul: 'src/app/api/measure/photo/route.ts',
    nadomestek: 'meritve.dolocanje',
  },
  // ---- §3 Konfiguracija izdelka (jedro — ZAKLENJENO za AI spremembe) ----
  {
    id: 'produkt.sdk',
    vrsta: 'deterministic',
    obmocje: 'Konfiguracija izdelka',
    opis: 'Product SDK — izdelki/profili/pravila združljivosti (AI/Qwen NI source-of-truth)',
    modul: 'src/lib/product-sdk/index.ts',
  },
  {
    id: 'produkt.steklo-model',
    vrsta: 'deterministic',
    obmocje: 'Konfiguracija izdelka',
    opis: 'Model stekla/nagiba — deterministična geometrija',
    modul: 'src/lib/glass-model.ts',
  },
  // ---- §4 Kalkulator / ponudba (jedro — ZAKLENJENO za AI spremembe) ----
  {
    id: 'cenovalnica.kalkulator',
    vrsta: 'deterministic',
    obmocje: 'Kalkulator / ponudba',
    opis: 'Cenovalno jedro — enaki vhodi = enaka ponudba (reproduzibilno)',
    modul: 'src/lib/calculator.ts',
  },
  {
    id: 'cenovalnica.inzeniring',
    vrsta: 'deterministic',
    obmocje: 'Kalkulator / ponudba',
    opis: 'Inženirska pravila kalkulatorja (poraba/odpad/pravila združljivosti)',
    modul: 'src/lib/calc-engineering.ts',
  },
  // ---- §5 Zaloga / dobavitelji / naročila ----
  {
    id: 'zaloga.skladisce',
    vrsta: 'deterministic',
    obmocje: 'Zaloga / dobavitelji / naročila',
    opis: 'Zalogovni izračuni (stanje/premiki/rezervacije) — čista poslovna logika',
    modul: 'src/lib/inventory.ts',
  },
  {
    id: 'zaloga.loti',
    vrsta: 'deterministic',
    obmocje: 'Zaloga / dobavitelji / naročila',
    opis: 'Sledljivost materiala (loti + dodelitve)',
    modul: 'src/lib/lots.ts',
  },
  // ---- §6 Dokumenti ----
  {
    id: 'dokumenti.pdf',
    vrsta: 'sdk',
    obmocje: 'Dokumenti',
    opis: 'PDF dokumenti (ponudbe/listine) — jsPDF SDK pod determinističnimi predlogami',
    modul: 'src/lib/document-pdf.ts',
  },
  {
    id: 'izvoz.csv-druzina',
    vrsta: 'deterministic',
    obmocje: 'Dokumenti',
    opis: 'Izvozna družina CSV (WYSIWYG bratje PDF) — bajtni determinizem',
    modul: 'src/lib/dobicikonost-projekti-csv.ts',
  },
  // ---- §7 Montaža / razporejanje ----
  {
    id: 'logistika.vozni-red',
    vrsta: 'deterministic',
    obmocje: 'Montaža / razporejanje',
    opis: 'Tedenski vozni red + razgled — razporejanje iz izrečenih pravil (R256/R292)',
    modul: 'src/lib/tedenski-vozni-red-csv.ts',
  },
  {
    id: 'logistika.ics',
    vrsta: 'deterministic',
    obmocje: 'Montaža / razporejanje',
    opis: 'iCalendar izvoz terminov (standardni format, čista izpeljava)',
    modul: 'src/lib/ics.ts',
  },
  {
    id: 'oprema.zivljenjski-krog',
    vrsta: 'deterministic',
    obmocje: 'Montaža / razporejanje',
    opis: 'Življenjski krog opreme (dodelitve/stanja) — pravilni stroj',
    modul: 'src/lib/equipment-lifecycle.ts',
  },
  // ---- §8 Strankin portal ----
  {
    id: 'stranke.crm-deep-link',
    vrsta: 'deterministic',
    obmocje: 'Strankin portal',
    opis: 'CRM deep-link + poudarjanje stranke (R288) — deterministična odločitev',
    modul: 'src/lib/crm-deep-link.ts',
  },
  // ---- §9 Varnost (NIČ AI odločitev — kanon issue #1 §9) ----
  {
    id: 'dostop.pravice',
    vrsta: 'deterministic',
    obmocje: 'Varnost',
    opis: 'RBAC/dostopne pravice — NIČ AI odločitev v varnosti (kanon issue #1 §9)',
    modul: 'src/lib/access.ts',
  },
  {
    id: 'varnost.csrf',
    vrsta: 'deterministic',
    obmocje: 'Varnost',
    opis: 'Zaščita CSRF (fail-closed)',
    modul: 'src/lib/csrf.ts',
  },
  {
    id: 'varnost.api-kljuci',
    vrsta: 'deterministic',
    obmocje: 'Varnost',
    opis: 'Validacija API ključev (deterministična)',
    modul: 'src/lib/api-keys.ts',
  },
  {
    id: 'varnost.audit',
    vrsta: 'deterministic',
    obmocje: 'Varnost',
    opis: 'Revizijski dnevnik (audit trail)',
    modul: 'src/lib/audit.ts',
  },
  {
    id: 'varnost.seje',
    vrsta: 'deterministic',
    obmocje: 'Varnost',
    opis: 'Avtentikacija/seje — deterministična validacija',
    modul: 'src/lib/auth.ts',
  },
  // ---- §10 Mobilno / PWA / offline ----
  {
    id: 'pwa.sink-konflikti',
    vrsta: 'deterministic',
    obmocje: 'Mobilno / PWA / offline',
    opis: 'Sinhronizacija + detekcija konfliktov (deterministična rekonsiliacija)',
    modul: 'src/lib/sync-conflicts.ts',
  },
  {
    id: 'pwa.idempotencija',
    vrsta: 'deterministic',
    obmocje: 'Mobilno / PWA / offline',
    opis: 'Idempotenca sync operacij (retry varno)',
    modul: 'src/lib/idempotency.ts',
  },
])

export interface AutomatizacijaPovzetek {
  readonly skupaj: number
  readonly deterministicnih: number
  readonly sdk: number
  readonly skriptov: number
  readonly ai: number
  /** AI zmožnosti z izrečenim determinističnim nadomestkom (kontrakt §11) */
  readonly aiZNadomestkom: number
  /** Število pokritih območij poslovanja (issue #1 §1–§10) */
  readonly stObmocij: number
}

// EN VIR povzetka (UI kartica vodje + testi + docs) — izpeljava iz kataloga,
// NIKOLI ročno vpisana številka (WYSIWYG resnica).
export function avtomatizacijaPovzetek(
  katalog: readonly AutomatizacijskaZmoznost[] = AUTOMATIZACIJSKI_KATALOG,
): AutomatizacijaPovzetek {
  const poVrsti = { deterministic: 0, sdk: 0, script: 0, ai: 0 } as Record<AutomatizacijskaVrsta, number>
  const obmocija = new Set<Obmocje>()
  let aiZNadomestkom = 0
  for (const z of katalog) {
    poVrsti[z.vrsta] += 1
    obmocija.add(z.obmocje)
    if (z.vrsta === 'ai' && typeof z.nadomestek === 'string' && z.nadomestek.length > 0) aiZNadomestkom += 1
  }
  return {
    skupaj: katalog.length,
    deterministicnih: poVrsti.deterministic,
    sdk: poVrsti.sdk,
    skriptov: poVrsti.script,
    ai: poVrsti.ai,
    aiZNadomestkom,
    stObmocij: obmocija.size,
  }
}
