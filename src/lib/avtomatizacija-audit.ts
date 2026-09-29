// ---------------------------------------------------------------------------
// R294 (issue #1 — Deliverables 3/4/5 + acceptance 'documentation clearly
// states where AI is actually used and where it is not') — AVTOMATIZACIJA
// AUDIT: EN VIR strojna resnica za
//   (a) pregled po območjih (feature-by-feature audit tabela — issue §1–11),
//   (b) seznam funkcij, ki IZRECNO koristijo AI (kandidati, NE povezane),
//   (c) skener prepovedanih nedeterminističnih / AI-vzorcev nad virom
//       (comment- + string-aware lexer — lažni pozitivi iz komentarjev in
//       URL-jev so izključeni BY DESIGN, ne po sreči).
//
// Načela:
//  • 100 % determinizem: čiste funkcije, nič ure, nič naključja; isti viri =
//      ista klasifikacija bajtno.
//  • Fail-closed: nepoznan vzorec/vrsta → TypeError; izjeme so IZRECNE po
//      poti (razlog OBVEZEN — brez tihih izjem, vzorec R290 izjeme-audit).
//  • Vsaka vrstica audita nosi implementacija/dokaz POTI — strazar test
//      dokazuje, da datoteke DEJANSKO obstajajo (tabela ne sme sanjati).
// ---------------------------------------------------------------------------

export const RAZREDI = [
  'DETERMINISTICNO',
  'SDK',
  'SKRIPTA',
  'AI_OPCIJSKO',
  'AI_ZAHTEVANO',
] as const
export type RazredAudita = (typeof RAZREDI)[number]

export interface VrstaAudita {
  /** Območje iz issue #1 (§1–§11). */
  obmocje: string
  /** Klasifikacija (RAZREDI). */
  razred: RazredAudita
  /** KONKRETNE poti implementacije (morajo obstajati — strazar). */
  implementacija: string[]
  /** KONKRETNE poti dokaza (testi — morajo obstajati — strazar). */
  dokaz: string[]
  /** Izrečena resnica opomb (npr. zaščita jedra, stub, …). */
  opomba: string
}

/** Feature-by-feature pregled (issue #1 §1–§11) — EN VIR za
 *  docs/automacija-audit.md (strazar: dokument ne sme divergirati). */
export const AVTOMATIZACIJA_AUDIT: readonly VrstaAudita[] = [
  {
    obmocje: '§1 Photo/VIZ',
    razred: 'DETERMINISTICNO',
    implementacija: [
      'src/components/roksal/photo-measure.tsx',
      'src/components/roksal/cv-studio.tsx',
      'src/components/roksal/map-measure.tsx',
      'src/app/api/viz/render/route.ts',
    ],
    dokaz: ['src/lib/viz/__tests__/viz-concurrency.test.ts'],
    opomba:
      'ročni 4-točkovni vnos + client-side izračuni; /api/viz/render je DOKUMENTIRAN fail-closed GPU stub (Qwen NI klican — job zapisi čakajo strežnik; brez AI odvisnosti)',
  },
  {
    obmocje: '§2 Measurements',
    razred: 'DETERMINISTICNO',
    implementacija: [
      'src/lib/meritve-povzetek.ts',
      'src/lib/meritve-csv.ts',
      'src/app/api/measurements/[id]/verzije/route.ts',
    ],
    dokaz: ['src/lib/__tests__/r276-verzije.test.ts'],
    opomba:
      'px→mm kalibracija, preverbe in verzioniranje (R276/R277) čiste funkcije; AR-Depth vir = API naprave (device SDK), ne model',
  },
  {
    obmocje: '§3 Railing/product configuration',
    razred: 'DETERMINISTICNO',
    implementacija: ['src/lib/product-sdk/index.ts'],
    dokaz: ['src/lib/product-sdk/__tests__/sdk-catalog.test.ts'],
    opomba:
      'Product SDK katalog (8 WoodCore profilov, server-authoritative) + 20 sejanih profilov; JEDRO ZAŠČITENO — brez AI sprememb (projektno pravilo)',
  },
  {
    obmocje: '§4 Calculator / quotation',
    razred: 'DETERMINISTICNO',
    implementacija: ['src/components/roksal/calculator-tab.tsx'],
    dokaz: ['src/lib/__tests__/r166-termini-prikaz.test.ts'],
    opomba:
      'material/kosi/marža iz shranjenih cen (pricing jedro ZAŠČITENO — brez AI sprememb); reproducibilno iz identičnih vhodov',
  },
  {
    obmocje: '§5 Inventory / suppliers / orders',
    razred: 'DETERMINISTICNO',
    implementacija: [
      'src/lib/zaloga-povzetek.ts',
      'src/lib/zamujena-dobava.ts',
    ],
    dokaz: ['src/lib/__tests__/r227-narocilnica-brez-strazar.test.ts'],
    opomba:
      'stanje/rezerve/pragovi čiste izpeljave (R227 fail-closed žig brez dobavitelja; R228 zamujena dobava)',
  },
  {
    obmocje: '§6 Documents',
    razred: 'DETERMINISTICNO',
    implementacija: ['src/lib/csv-export.ts', 'src/lib/dobicikonost-pdf.ts'],
    dokaz: ['src/lib/__tests__/r258-dobicikonost-pdf.test.ts'],
    opomba:
      '40+ PDF/CSV generatorjev, bajtni determinizem (FNV-1a file-ID, now KOT parameter); audit trail = AuditLog tabela (PostgreSQL)',
  },
  {
    obmocje: '§7 Installation / scheduling',
    razred: 'DETERMINISTICNO',
    implementacija: [
      'src/lib/logistika-vozni-red-pdf.ts',
      'src/lib/schedule-conflicts.ts',
    ],
    dokaz: ['src/lib/__tests__/r256-tedenski-vozni-red-pdf.test.ts'],
    opomba:
      'dodelitev/konflikti (409 z razlogi)/trajanje iz izrecnih pravil; vozni red PDF+CSV bratje (WYSIWYG)',
  },
  {
    obmocje: '§8 Customer portal',
    razred: 'DETERMINISTICNO',
    implementacija: ['src/lib/portal.ts'],
    dokaz: ['src/lib/__tests__/portal.test.ts'],
    opomba:
      'varni žetoni (expiracija/revokacija), deterministična preverba dovoljenj; brez AI odločitev',
  },
  {
    obmocje: '§9 Security',
    razred: 'DETERMINISTICNO',
    implementacija: ['src/lib/auth.ts', 'src/lib/api-keys.ts', 'src/lib/rate-limit.ts'],
    dokaz: ['src/lib/__tests__/api-key-lifecycle.test.ts'],
    opomba:
      'auth/RBAC/API-ključi/rate-limit/CSRF (403 fail-closed)/audit log — issue #1: NIČ AI za varnostne odločitve',
  },
  {
    obmocje: '§10 Mobile/PWA/offline',
    razred: 'DETERMINISTICNO',
    implementacija: ['src/lib/offline-queue.ts', 'src/app/api/sync/route.ts'],
    dokaz: ['src/lib/__tests__/r274-issue17-gate.test.ts'],
    opomba:
      'lokalna persistenca + sync s pogodbeno verzijo (v99 fail-closed gate R274), tombstones/conflict (R281/R282); geminiEstimate = passthrough polje (shranjeno, nikoli klicano)',
  },
  {
    obmocje: '§11 AI fallback architecture',
    razred: 'AI_OPCIJSKO',
    // R294 (revizija prekinjene inkarnacije — kanon R290): arhitektura je
    // RAZPAKETANA v src/lib/automation/ (katalog zmožnosti + registar
    // ponudnikov — DeterministicniPonudnik VEDNO, AiPonudnik neobvezen env
    // preklop ROKSAL_AI_PONUDNIK) + UI kartica na vodji; ta modul = AUDIT
    // orodje (tabela + kandidati + skener). Skupaj pokrijejo §11.
    implementacija: ['src/lib/automation/ponudniki.ts', 'src/lib/automation/katalog.ts', 'src/lib/avtomatizacija-audit.ts'],
    dokaz: ['src/lib/__tests__/r294-automation.test.ts', 'src/lib/__tests__/r294-avtomatizacija-audit.test.ts'],
    opomba:
      'AutomationProvider vmesnik obstaja (ponudniki.ts); AiPonudnik je privzeto NE registriran (env preklop) — aplikacija deluje brez AI po konstrukciji (absenca = fail-closed); vsaka AI zmožnost v katalogu izrecno deklarira deterministični nadomestek',
  },
]

/** Funkcije, ki IZRECNO koristijo AI — vsaka NE-IMPLEMENTIRANA kandidatka
 *  (issue #1 točka 5; NIKOLI lažna implementacija — status je obvezen). */
export interface AiKandidat {
  funkcija: string
  zakaj: string
  status: 'NE-IMPLEMENTIRANO — kandidat (nič povezano)'
}
export const AI_KANDIDATI: readonly AiKandidat[] = [
  {
    funkcija: 'Segmentacija ograje na terenskih fotografijah (VIZ ozadje)',
    zakaj:
      'ročno označevanje stare ograje na realnih fotograhijah je počasno; CV hevristike na divjih posnetkih niso dovolj zanesljive — tu bi moral model POMAGATI, ne odločati',
    status: 'NE-IMPLEMENTIRANO — kandidat (nič povezano)',
  },
  {
    funkcija: 'OCR rokopisnih terenskih zapiskov',
    zakaj:
      'rokapis na terenu ni čitljiv za deterministični OCR; uporabnik vseeno vpisuje strukturo ročno (OCR bi bil samo predlog)',
    status: 'NE-IMPLEMENTIRANO — kandidat (nič povezano)',
  },
  {
    funkcija: 'Razčlenjevanje prostega besedila opisa obsega (CRM zapiski)',
    zakaj:
      'prosto besedilo strank ni struktuirano; predlog strukture bi skrajšal vpis — vse odločitve ostanejo človeške',
    status: 'NE-IMPLEMENTIRANO — kandidat (nič povezano)',
  },
]

// ---------------------------------------------------------------------------
// SKENER — comment- + string-aware odstranitev komentarjev (ohranja vrstice
// preslikavo 1:1 — komentar postane presledki, \n se ohranijo), potem
// iskanje prepovedanih vzorcev. URL-ji ('https://…') živijo v nizih in so
// zato varni (// znotraj niza NI komentar).
// ---------------------------------------------------------------------------

export interface PrepovedanVzorec {
  ime: string
  vzorec: string
  razlaga: string
}

/** Prepovedani vzorci (issue #1: determinizem + nič AI odvisnosti). */
export const PREPOVEDANI_VZORCI: readonly PrepovedanVzorec[] = [
  {
    ime: 'AI-API-gostitelj',
    vzorec:
      'api\\.openai\\.com|api\\.anthropic\\.com|dashscope|ollama|huggingface|generativelanguage\\.googleapis\\.com|api\\.groq\\.com|api\\.mistral\\.ai|api\\.deepseek\\.com|api\\.cohere\\.ai|openrouter\\.ai|qwen|z-ai-web-dev-sdk',
    razlaga: 'zunanji AI/LLM klic — jedro mora biti deterministično (AI samo kot izrecen, dokumentiran adapter)',
  },
  {
    ime: 'Math.random',
    vzorec: 'Math\\.random\\s*\\(',
    razlaga: 'naključje v jedru = nedeterminističen izhod (isti vhod NI isti rezultat)',
  },
  {
    ime: 'Date.now',
    vzorec: 'Date\\.now\\s*\\(',
    razlaga: 'stena ure v jedru = nedeterminizem; referenčni trenutek pride KOT parameter',
  },
  {
    ime: 'locale-odvisni-izpis',
    vzorec: 'toLocaleDateString\\s*\\(|toLocaleTimeString\\s*\\(|toLocaleString\\s*\\(',
    razlaga: 'ICU/lokal odvisen izpis — isti vhod na različnih strojih = različen izpis',
  },
  {
    ime: 'localeCompare',
    vzorec: 'localeCompare\\s*\\(',
    razlaga: 'lokal odvisno razvrščanje — kanon je navadno < po UTF-16 (R245/R250)',
  },
  {
    ime: 'new-Date-brez-argumenta',
    vzorec: 'new Date\\s*\\(\\s*\\)',
    razlaga: 'jedro ne sme brati stene ure — now KOT parameter (F4)',
  },
]

/** Izjeme po TOČNI poti — vsaka z OBVEZNIM razlogom (fail-closed: izjema
 *  brez razloga = programerska napaka, NIKOLI tiho dovoljena).
 *
 *  OBSEG skena (doktrina): izvozna jedra (PDF/CSV libs) so BREZ IZJEM
 *  (bajtni determinizem); spodnje izjeme so operacijska stena ura (zapisi v
 *  bazo, TTL/preteki, trajanja jobov, ID-ji) ali prikazni helperji — stena
 *  ura je tam LAST OPERACIJE, ne resnica izvoza. Route handlerji (src/app/api)
 *  so I/O meje (isti razlog) in so izven skena jedra. */
export interface AvtomatizacijaIzjema {
  pot: string
  dovoljeni: readonly string[]
  razlog: string
}
export const AVTOMATIZACIJA_IZJEME: readonly AvtomatizacijaIzjema[] = [
  {
    pot: 'src/lib/offline-queue.ts',
    dovoljeni: ['Math.random', 'Date.now', 'new-Date-brez-argumenta', 'localeCompare'],
    razlog: 'odjemalski čakalni vrsti: unikatni ID pred sync (Math.random + Date.now), retry/updatedAt metadata (stena ura = last operacije); sort po ISO-nizih (localeCompare — ISO datetime se razvršča enako v vsakem locale-u)',
  },
  {
    pot: 'src/lib/idempotency.ts',
    dovoljeni: ['Math.random', 'Date.now'],
    razlog: 'GC prob (verjetnostno čiščenje zastarelih ključev) + TTL prag — operacijska stena ura, NI resnična jedra',
  },
  {
    pot: 'src/lib/jobs.ts',
    dovoljeni: ['Date.now', 'new-Date-brez-argumenta'],
    razlog: 'trajanja izvajanja jobov (durationMs) + zagoni — operacijska telemetrija, NI resnična jedra',
  },
  {
    pot: 'src/lib/measurement-drafts.ts',
    dovoljeni: ['Date.now'],
    razlog: 'osnutek ID iz časa nastanka (unikatnost) — operacijski metadata',
  },
  {
    pot: 'src/lib/password.ts',
    dovoljeni: ['Date.now', 'new-Date-brez-argumenta'],
    razlog: 'preteki (expiresAt ≤ zdaj) + revokacijski žigi v bazi — varnostna operacija, stena ura je njena definicija',
  },
  {
    pot: 'src/lib/session-registry.ts',
    dovoljeni: ['Date.now', 'new-Date-brez-argumenta'],
    razlog: 'seje: expiracija (gt/lte pragovi) + revokacije — stena ura je definicija seje',
  },
  {
    pot: 'src/lib/session.ts',
    dovoljeni: ['Date.now'],
    razlog: 'JWT exp/validacija (exp = zdaj + ttl; preverba exp ≤ zdaj) — stena ura je definicija žetona',
  },
  {
    pot: 'src/lib/user-lifecycle.ts',
    dovoljeni: ['Date.now', 'new-Date-brez-argumenta'],
    razlog: 'življenjski cikel uporabnikov (pozivi/aktivacije pretečejo) — operacijska stena ura',
  },
  {
    pot: 'src/lib/viz/pipeline.ts',
    dovoljeni: ['Date.now'],
    razlog: 'VIZ job telemetrija (čas koraka) — operacijski metadata',
  },
  {
    pot: 'src/lib/viz/repository.ts',
    dovoljeni: ['Date.now', 'new-Date-brez-argumenta'],
    razlog: 'VIZ job zapisi (createdAt/updatedAt/expiresAt) — operacijska stena ura; Qwen NI klican (stub)',
  },
  {
    pot: 'src/lib/viz/gc.ts',
    dovoljeni: ['new-Date-brez-argumenta'],
    razlog: 'GC zastarelih VIZ jobov — prag je stena ura po definiciji',
  },
  {
    pot: 'src/lib/notifications.ts',
    dovoljeni: ['new-Date-brez-argumenta'],
    razlog: 'sentAt/openedAt/revokedAt žigi v bazi — operacijski metadata (opts.now ?? new Date() kanon), NI resnična jedra',
  },
  {
    pot: 'src/lib/numbering.ts',
    dovoljeni: ['new-Date-brez-argumenta'],
    razlog: 'letnica dokumentne številke (YYYY-NNN) iz trenutnega leta — dokumentna operacija, letnica je del definicije',
  },
  {
    pot: 'src/lib/inventory.ts',
    dovoljeni: ['new-Date-brez-argumenta'],
    razlog: 'datumDobave zapis ob potrditvi naročila — operacijski žig v bazi',
  },
  {
    pot: 'src/lib/csv-export.ts',
    dovoljeni: ['new-Date-brez-argumenta'],
    razlog: 'todayStamp(now: Date = new Date()) — DOKUMENTIRAN kanonski seam: parameter obstaja, izvozni klicatelji podajo fiksni trenutek (F4)',
  },
  {
    pot: 'src/lib/aktivnost-oznaka.ts',
    dovoljeni: ['locale-odvisni-izpis', 'new-Date-brez-argumenta'],
    razlog: 'prikazna oznaka aktivnosti (UI helpers — prikazni trenutek, NE izvozna resnica)',
  },
  {
    pot: 'src/lib/meritve-povzetek.ts',
    dovoljeni: ['locale-odvisni-izpis'],
    razlog: 'prikazno formatiranje žiga meritev (now KOT parameter; UI izpis, NE strojni izvoz)',
  },
  {
    pot: 'src/lib/opomnik-zvonek.ts',
    dovoljeni: ['locale-odvisni-izpis'],
    razlog: 'prikazni datum opomnika v zvončku (UI izpis, NE izvozna resnica)',
  },
  {
    pot: 'src/lib/osvezitev-fokus.ts',
    dovoljeni: ['locale-odvisni-izpis'],
    razlog: 'casOznaka — EN VIR pečat svežine (prikazni trenutek; vsi UI pečati ga uvažajo)',
  },
  {
    pot: 'src/lib/schedule-conflicts.ts',
    dovoljeni: ['locale-odvisni-izpis'],
    razlog: 'človeški opis konflikta termina (sporočilo uporabniku, NE strojni izvoz)',
  },
  {
    pot: 'src/lib/rate-limit.ts',
    dovoljeni: ['Date.now'],
    razlog: 'rate-limit okna so po definiciji odvisna od stene ure (operacijska zaščita, NI resnična jedra)',
  },
  {
    pot: 'src/lib/termini-prikaz.ts',
    dovoljeni: ['locale-odvisni-izpis'],
    razlog: 'prikazni helperji termina (UI izpis trenutka; izvozi uporabljajo cenikDatumIso/todayStamp — bajtni kanon)',
  },
  {
    pot: 'src/lib/wind-service.ts',
    dovoljeni: ['new-Date-brez-argumenta'],
    razlog: 'timestamp = čas poizvedbe (metadata klica), NI podatkovna resnica; demo vrednosti FIKSNE (R294)',
  },
  {
    pot: 'src/app/api/viz/render/route.ts',
    dovoljeni: ['AI-API-gostitelj'],
    razlog: 'DOKUMENTIRAN GPU stub — Qwen NI klican (job zapisi, "planirano, čaka na GPU strežnik"); brez tega ruta ne bi bila iskreno opisana',
  },
  {
    pot: 'src/app/api/sync/route.ts',
    dovoljeni: ['AI-API-gostitelj'],
    razlog: 'geminiEstimate = passthrough podatkovno polje iz mobilne AR aplikacije (shranjeno, NIKOLI klicano) — podatki-at-rest niso AI odvisnost',
  },
  {
    pot: 'src/app/api/measure/photo/route.ts',
    dovoljeni: ['AI-API-gostitelj'],
    razlog: 'VLM ocena terenske fotografije — NEOBVEZNA pomoč uporabniku, NIKOLI vir resnice: deterministična ročna meritev (R278) + SDK validacija (meritve.dolocanje) pokrijeta proces brez AI; katalog deklarira nadomestek',
  },
]

export interface Kršitev {
  pot: string
  vzorec: string
  vrstica: number
  razlaga: string
  okoli: string
}

/** Odstrani komentarje z ohranitvijo vrstične strukture (komentar → presledki,
 *  \n ostanejo) IN ohranja nize + REGEX literale (// znotraj '…'/"…"/`…`/…/… NI
 *  komentar). R294 LEKCIJE:
 *   (1) zaporedje stanj: komentarji PRED nizi (backtick znotraj // komentarja
 *       ne sme odpreti lažnega niza);
 *   (2) regex literali (/…/g z navedki znotraj — npr. /"/g) MORAJO biti
 *       prepoznani (hevuristika prejšnjega znaka — klasični JS lexer pristop),
 *       sicer lažni nizi pokvarijo vse nadaljnje vrstice. */
export function odstraniKomentarje(vir: string): string {
  if (typeof vir !== 'string') {
    throw new TypeError('odstraniKomentarje: pričakovan niz (vir)')
  }
  const izhod: string[] = []
  let i = 0
  let niz: string | null = null
  let vRegexu = false
  let vRazreduZnakov = false
  let zadnjiPomemben = '' // zadnji ne-presledkovni znak izven niza/komentarja
  let zadnjaBeseda = '' // zadnja identifikatorska beseda (za regex hevuristiko)
  while (i < vir.length) {
    const c = vir[i]
    const naslednji = vir[i + 1]
    if (niz !== null) {
      izhod.push(c)
      if (c === '\\') {
        izhod.push(naslednji ?? '')
        i += 2
        continue
      }
      if (c === niz) niz = null
      i += 1
      continue
    }
    if (vRegexu) {
      izhod.push(c)
      if (c === '\\') {
        izhod.push(naslednji ?? '')
        i += 2
        continue
      }
      if (c === '[') vRazreduZnakov = true
      else if (c === ']') vRazreduZnakov = false
      else if (c === '/' && !vRazreduZnakov) {
        // zastavice (g, i, m, s, u, y, d)
        while (i + 1 < vir.length && /[a-z]/.test(vir[i + 1])) {
          izhod.push(vir[i + 1])
          i += 1
        }
        vRegexu = false
        zadnjiPomemben = '/'
      }
      i += 1
      continue
    }
    if (c === '/' && naslednji === '/') {
      while (i < vir.length && vir[i] !== '\n') {
        izhod.push(' ')
        i += 1
      }
      continue
    }
    if (c === '/' && naslednji === '*') {
      izhod.push('  ')
      i += 2
      while (i < vir.length && !(vir[i] === '*' && vir[i + 1] === '/')) {
        izhod.push(vir[i] === '\n' ? '\n' : ' ')
        i += 1
      }
      if (i < vir.length) {
        izhod.push('  ')
        i += 2
      }
      continue
    }
    if (c === '"' || c === "'" || c === '`') {
      niz = c
      zadnjiPomemben = c
      izhod.push(c)
      i += 1
      continue
    }
    if (c === '/' && naslednji !== '/' && naslednji !== '*' && jeRegexKontekst(zadnjiPomemben, zadnjaBeseda)) {
      // regex literAL (NE deljenje) — hevuristika prejšnjega žetona
      vRegexu = true
      vRazreduZnakov = false
      izhod.push(c)
      i += 1
      continue
    }
    if (/[A-Za-z0-9_$]/.test(c)) {
      zadnjaBeseda += c
    } else {
      zadnjaBeseda = ''
    }
    if (!/\s/.test(c)) zadnjiPomemben = c
    izhod.push(c)
    i += 1
  }
  return izhod.join('')
}

/** Ključne besede, za katerimi '/' pomeni ZAČETEK regexa (ne deljenja). */
const REGEX_KLJUCNE = new Set([
  'return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void',
  'throw', 'case', 'do', 'else', 'yield', 'await',
])

/** Hevuristika regex-vs-deljenje: '/' je regex, če je prejšnji pomemben znak
 *  operator/odpirajoči oklepaj ALI je prejšnja beseda ključna beseda. */
function jeRegexKontekst(zadnjiPomemben: string, zadnjaBeseda: string): boolean {
  if (zadnjiPomemben === '') return true // začetek vira
  if ('([{,;=:!&|?<>+-*%~^'.includes(zadnjiPomemben)) return true
  if (zadnjaBeseda !== '' && REGEX_KLJUCNE.has(zadnjaBeseda)) return true
  return false
}

/** Pregled virov → kršitve (deterministično; indeks krivca = pot + vrstica).
 *  Izjeme so po TOČNI poti in po IMENU vzorca (razlog obvezen).
 *  SEAM pravilo: `now: Date = new Date()` / `?? new Date()` / `= Date.now()`
 *  PRIVZETE vrednosti parametrov so dokumentiran kanon (parameter obstaja —
 *  klicatelj lahko poda fiksni trenutek) → NE štejejo kot kršitev.
 *  Skener preskoči SVOJO datoteko (detektor ne more vsebovati sebe kot
 *  kršitev — vzorci so njegova definicija). */
export function pregledajAvtomatizacijo(
  viri: readonly { pot: string; vsebina: string }[],
): Kršitev[] {
  if (!Array.isArray(viri)) {
    throw new TypeError('pregledajAvtomatizacijo: pričakovano polje virov')
  }
  const SEAM_PRED = /\?\?\s*$/
  const SEAM_PRIVZETO = /:\s*[A-Za-z0-9_$][A-Za-z0-9_$<>\[\]|.\s]*=\s*$/
  const izjeme = new Map<string, AvtomatizacijaIzjema>()
  for (const iz of AVTOMATIZACIJA_IZJEME) {
    if (!iz.pot || !Array.isArray(iz.dovoljeni) || typeof iz.razlog !== 'string' || iz.razlog.trim() === '') {
      throw new TypeError(`pregledajAvtomatizacijo: izjema brez razloga/dovoljenih (${String(iz.pot)})`)
    }
    izjeme.set(iz.pot, iz)
  }
  const kršitve: Kršitev[] = []
  for (const vir of viri) {
    if (!vir || typeof vir.pot !== 'string' || typeof vir.vsebina !== 'string') {
      throw new TypeError('pregledajAvtomatizacijo: pričakovano { pot, vsebina }')
    }
    if (vir.pot === 'src/lib/avtomatizacija-audit.ts') continue // skener sam (definicija vzorcev)
    const izjema = izjeme.get(vir.pot)
    const brezKomentarjev = odstraniKomentarje(vir.vsebina)
    for (const v of PREPOVEDANI_VZORCI) {
      if (izjema?.dovoljeni.includes(v.ime)) continue
      const re = new RegExp(v.vzorec, 'g')
      let m: RegExpExecArray | null
      while ((m = re.exec(brezKomentarjev)) !== null) {
        const vrstica = brezKomentarjev.slice(0, m.index).split('\n').length
        const lineText = brezKomentarjev.split('\n')[vrstica - 1] ?? ''
        // pred = del VRSTICE pred zadetkom (m.index je dokumentni offset —
        // line-lokalni offset = m.index − začetek vrstice v dokumentu)
        const zacetekVrstice = brezKomentarjev.lastIndexOf('\n', m.index - 1) + 1
        const pred = brezKomentarjev.slice(zacetekVrstice, m.index)
        if (
          (v.ime === 'new-Date-brez-argumenta' || v.ime === 'Date.now') &&
          (SEAM_PRED.test(pred) || SEAM_PRIVZETO.test(pred))
        ) {
          continue // privzeta vrednost parametra / ?? fallback — dokumentiran kanon
        }
        kršitve.push({
          pot: vir.pot,
          vzorec: v.ime,
          vrstica,
          razlaga: v.razlaga,
          okoli: lineText.trim().slice(0, 120),
        })
      }
    }
  }
  return kršitve
}

// ---------------------------------------------------------------------------
// KOMPONENTNI SLOJ (R295 — issue #1 nadaljevanje: skener razširjen na
// src/components). Prikazni sloj ima DRUGAČNO politiko kot jedro:
//   - ARTIFACT domena (komponenta z jsPDF importom — vgrajena PDF logika,
//     npr. račun/ponudba/delovni list) = bajtni determinizem TUDI v
//     komponentah: locale* + localeCompare NIKOLI — EN VIR pomožniki iz
//     csv-export.ts (slDatumKratko/slCasDolgo/formatSlDecimalno, R294/R295);
//   - stena ura (new Date()/Date.now) v prikaznem sloju = opazovalec "zdaj"
//     (zadnja osvežitev, urni prikaz, zapadlost UI) — LAST OPERACIJE, ne
//     resnica izvoza → NI vzorec komponentnega skena;
//   - Math.random v komponentah = SAMO prek izjem (unikatni ID pred sync,
//     shadcn skeleton dekoracija) — vsaka z obveznim razlogom;
//   - AI gostitelji = NIKOLI (isto jedro pravilo).
// ---------------------------------------------------------------------------

/** Izjeme komponentnega skena po TOČNI poti — vsaka z OBVEZNIM razlogom
 *  (isti fail-closed kontrakt kot AVTOMATIZACIJA_IZJEME). */
export const AVTOMATIZACIJA_IZJEME_KOMPONENTE: readonly AvtomatizacijaIzjema[] = [
  {
    pot: 'src/components/roksal/photo-tab.tsx',
    dovoljeni: ['Math.random'],
    razlog: 'unikatni ID ne sinhronizirane analize pred sync (ann_ + Date.now + Math.random) — isti vzorec kot src/lib/offline-queue.ts izjema R294; ni resnica izvoza',
  },
  {
    pot: 'src/components/roksal/cv-studio.tsx',
    dovoljeni: ['Math.random'],
    razlog: 'unikatni ID lokalne CV seje pred sync (id- + Date.now + Math.random) — unikatnost entropy, ni resnica izvoza',
  },
  {
    pot: 'src/components/roksal/floor-plan-tab.tsx',
    dovoljeni: ['Math.random'],
    razlog: 'unikatni ID lokalen tloris element pred sync (prefix_ + Date.now + Math.random) — unikatnost entropy, ni resnica izvoza',
  },
  {
    pot: 'src/components/roksal/measurement-studio.tsx',
    dovoljeni: ['Math.random'],
    razlog: 'unikatni ID merilne seje pred sync (ms- + Date.now + Math.random) — unikatnost entropy, ni resnica izvoza',
  },
  {
    pot: 'src/components/roksal/ar-scanner.tsx',
    dovoljeni: ['Math.random'],
    razlog: 'unikatni ID AR meritve pred sync (Date.now + Math.random) — unikatnost entropy, ni resnica izvoza',
  },
  {
    pot: 'src/components/ui/sidebar.tsx',
    dovoljeni: ['Math.random'],
    razlog: 'shadcn/ui UPSTREAM SidebarMenuSkeleton: dekorativna naključna širina 50-90 % med nalaganjem (loading skeleton) — ni podatkovni prikaz, ni resnica izvoza, ni AI',
  },
]

/** Pregled komponentnega sloja → kršitve (deterministično; indeks krivca =
 *  pot + vrstica). Vzorci: AI gostitelji + Math.random (vse komponente,
 *  izjeme po točni poti) + locale* + localeCompare (SAMO ARTIFACT domena —
 *  komponenta z jsPDF importom). SEAM pravilo identično jedru. */
export function pregledajKomponente(
  viri: readonly { pot: string; vsebina: string }[],
): Kršitev[] {
  if (!Array.isArray(viri)) {
    throw new TypeError('pregledajKomponente: pričakovano polje virov')
  }
  const SEAM_PRED = /\?\?\s*$/
  const SEAM_PRIVZETO = /:\s*[A-Za-z0-9_$][A-Za-z0-9_$<>\[\]|.\s]*=\s*$/
  const JSPDF_IMPORT = /from\s+(['"])jspdf\1/
  const izjeme = new Map<string, AvtomatizacijaIzjema>()
  for (const iz of AVTOMATIZACIJA_IZJEME_KOMPONENTE) {
    if (!iz.pot || !Array.isArray(iz.dovoljeni) || typeof iz.razlog !== 'string' || iz.razlog.trim() === '') {
      throw new TypeError(`pregledajKomponente: izjema brez razloga/dovoljenih (${String(iz.pot)})`)
    }
    izjeme.set(iz.pot, iz)
  }
  const vzorci = PREPOVEDANI_VZORCI.filter(
    (v) =>
      v.ime === 'AI-API-gostitelj' ||
      v.ime === 'Math.random' ||
      v.ime === 'locale-odvisni-izpis' ||
      v.ime === 'localeCompare',
  )
  const kršitve: Kršitev[] = []
  for (const vir of viri) {
    if (!vir || typeof vir.pot !== 'string' || typeof vir.vsebina !== 'string') {
      throw new TypeError('pregledajKomponente: pričakovano { pot, vsebina }')
    }
    if (vir.pot === 'src/lib/avtomatizacija-audit.ts') continue // skener sam (definicijska datoteka)
    const artifactDomena = JSPDF_IMPORT.test(odstraniKomentarje(vir.vsebina))
    const izjema = izjeme.get(vir.pot)
    const brezKomentarjev = odstraniKomentarje(vir.vsebina)
    for (const v of vzorci) {
      const artifactVzorec = v.ime === 'locale-odvisni-izpis' || v.ime === 'localeCompare'
      if (artifactVzorec && !artifactDomena) continue // prikazni sloj: stena ura/locale UI je opazovalec, ne resnica
      if (izjema?.dovoljeni.includes(v.ime)) continue
      const re = new RegExp(v.vzorec, 'g')
      let m: RegExpExecArray | null
      while ((m = re.exec(brezKomentarjev)) !== null) {
        const vrstica = brezKomentarjev.slice(0, m.index).split('\n').length
        const lineText = brezKomentarjev.split('\n')[vrstica - 1] ?? ''
        const zacetekVrstice = brezKomentarjev.lastIndexOf('\n', m.index - 1) + 1
        const pred = brezKomentarjev.slice(zacetekVrstice, m.index)
        if (SEAM_PRED.test(pred) || SEAM_PRIVZETO.test(pred)) {
          continue // privzeta vrednost parametra / ?? fallback — dokumentiran kanon
        }
        kršitve.push({
          pot: vir.pot,
          vzorec: v.ime,
          vrstica,
          razlaga: v.razlaga,
          okoli: lineText.trim().slice(0, 120),
        })
      }
    }
  }
  return kršitve
}
