// ---------------------------------------------------------------------------
// R315 — 45. člen issue #1 (Deliverable 7 NA ZASLONU + DOKUMENTIRANO):
// končna verifikacija proti HEAD — za vsako območje audita (§1–§11) IZRECNO
// vezava na VERIFIKACIJSKE PLASTI (katere plasti verige dokazujejo območje)
// + sprejemni kriteriji iz issue #1 z mehanično izpeljavo in konkretnim
// dokazom.
//
// ČISTA projekcija EN VIR resnic (avtomatizacija-audit.ts: AVTOMATIZACIJA_AUDIT
// + RAZREDI; ta modul: DOKAZI_AUDITA + SPREJEMNI_KRITERIJI kot IZRECNO
// deklarirana registra — vzorec audita samega) — NIČ nove resnice brez
// dokumentiranega dokaza. WYSIWYG: vrstice, kriteriji in sklep so verbatim
// iz tega modula — zaslon, testi in docs berejo ISTE nize (vzorec R311/R312/
// R314).
//
// Veza na HEAD — iskrenost: verifikacija se izvede nad delovnim drevesom
// PRED vsakim commitom (tsc · eslint · vitest · build + needleji · smoke ·
// E2E ŽIVO · prod-qa) — drevo je byte-določeno s HEAD, zato je vezava na
// commit implicitna in reproduktibilna (isti drevesni hash = isti dokaz).
// Ta modul NE laže o času: ne nosi številke testa, ne datuma, ne commit
// hash-a — dokazne poti so KONKRETNE in strazar jih dokazuje na disku.
//
// Načela:
//  • 100 % determinizem: čista funkcija, nič ure, nič naključja.
//  • Fail-closed: audit brez dokazne vezave / neznana plast / prazen
//    kriterij / kriterij brez izpeljave ali dokaza → TypeError z imenom
//    graditelja (kanon R299/R302/R306 — niz preživi minifikacijo).
//  • Sklep številčno iz EN VIR: števci izračunani (nikoli trdo kodirani);
//    'AI-OBVEZNO: 0' drži, SAMO dokler je števec resnično 0 (iskrenost).
// ---------------------------------------------------------------------------

import { AVTOMATIZACIJA_AUDIT, RAZREDI } from '@/lib/avtomatizacija-audit'
import type { RazredAudita, VrstaAudita } from '@/lib/avtomatizacija-audit'
import { RAZRED_PRIKAZNO } from '@/lib/avtomatizacija-pregled'

// znaniRazredi — lokalno (R314 vzorec); RAZREDI uvožen EN VIR.
const znaniRazredi = new Set<string>(RAZREDI)

/** Verifikacijske plasti (polna veriga — vzorec worklog VERIFIKACIJA). */
export const VERIFIKACIJSKE_PLASTI = [
  'vitest',
  'build-needleji',
  'E2E ŽIVO',
  'prod-qa',
  'smoke',
] as const
export type VerifikacijskaPlast = (typeof VERIFIKACIJSKE_PLASTI)[number]

/** Dokazna vezava enega območja audita (deklarirano — vzorec audita). */
export interface DokazVezava {
  /** Katere plasti verige DOKAZIJO to območje (vsaj 1, vse znane). */
  readonly plasti: readonly VerifikacijskaPlast[]
  /** Iskrena opomba dokaza (kaj plast konkratno dokazuje). */
  readonly opomba: string
}

/**
 * R315 — vezava območij §1–§11 na verifikacijske plasti. Ključi MORAJO
 * biti verbatim iz AVTOMATIZACIJA_AUDIT (fail-closed join — manjkajoča
 * vezava = TypeError; tuj ključ = TypeError).
 */
export const DOKAZI_AUDITA: Readonly<Record<string, DokazVezava>> = {
  '§1 Photo/VIZ': {
    plasti: ['vitest', 'build-needleji', 'E2E ŽIVO', 'prod-qa'],
    opomba: 'cv-studio/viz jedro: vitest viz kontraktni testi + E2E ŽIVO VIZ scenariji + odtis ZERO-MUTACIJA',
  },
  '§2 Measurements': {
    plasti: ['vitest', 'E2E ŽIVO', 'prod-qa'],
    opomba: 'meritve: geometrijska jedra (vitest) + verzije ruta ŽIVO (Z1b) + meritve UI E2E',
  },
  '§3 Railing/product configuration': {
    plasti: ['vitest', 'build-needleji'],
    opomba: 'katalog + konfiguracija: SDK jedro je ključavica (AI nič) — komponentni skener + kontraktni testi',
  },
  '§4 Calculator / quotation': {
    plasti: ['vitest', 'build-needleji', 'E2E ŽIVO', 'prod-qa'],
    opomba: 'kalkulator: istovhodna reproducibilnost (vitest) + I/O meja ŽIVO (Z0ai) + kalkulator E2E',
  },
  '§5 Inventory / suppliers / orders': {
    plasti: ['vitest', 'build-needleji', 'E2E ŽIVO'],
    opomba: 'zaloga/naročila: zalogoslovna jedra + CSV/PDF izvozi (vitest) + E2E ŽIVO material/naročila',
  },
  '§6 Documents': {
    plasti: ['vitest', 'E2E ŽIVO'],
    opomba: 'PDF/CSV jedra: %PDF- magija preverba + FNV podpisi (vitest) + E2E ŽIVO izvozi bajtno',
  },
  '§7 Installation / scheduling': {
    plasti: ['vitest', 'build-needleji'],
    opomba: 'termini/konflikti: deterministicna jedra (urAgregat, konflikti pregled) + koledar izvozi',
  },
  '§8 Customer portal': {
    plasti: ['vitest', 'build-needleji', 'E2E ŽIVO'],
    opomba: 'portal: token vrata + deterministična dovoljenja (vitest) + portal E2E + r172 dark stražar',
  },
  '§9 Security': {
    plasti: ['vitest', 'E2E ŽIVO', 'prod-qa', 'smoke'],
    opomba: 'RBAC/vrata: deny-first 403 dokazi ŽIVO (Z2b users) + v99 sync gate + kontrakt NIČ (/api/sync) + CSRF dimni probei',
  },
  '§10 Mobile/PWA/offline': {
    plasti: ['vitest', 'build-needleji', 'E2E ŽIVO', 'smoke'],
    opomba: 'PWA/offline: sync vrsta + kvota sprostitev (smoke manifest 307) + E2E ŽIVO pwa-status',
  },
  '§11 AI fallback architecture': {
    plasti: ['vitest', 'build-needleji', 'prod-qa'],
    opomba: 'AutomationProvider: DeterministicniPonudnik VEDNO na voljo, AiPonudnik privzeto IZKLJUČEN fail-closed',
  },
}

/** Sprejemni kriterij iz issue #1 z mehanično izpeljavo + konkretnim dokazom. */
export interface SprejemniKriterij {
  /** Kriterij — verbatim namen iz issue #1 (slovenščina, iskreno). */
  readonly kriterij: string
  /** KAKO se kriterij mehanično preverja (izpeljava, ne mnenje). */
  readonly izpeljava: string
  /** KONKRETEN dokaz (pot/artefakt v repozitoriju ali verigi). */
  readonly dokaz: string
}

/**
 * R315 — sprejemni kriteriji iz issue #1 (8 točk) — vsak z izpeljavo in
 * dokazom. Deklariran register (fail-closed oblika — prazen/neznan = TypeError).
 */
export const SPREJEMNI_KRITERIJI: readonly SprejemniKriterij[] = [
  {
    kriterij: 'vsako večje področje Roksala je audirano',
    izpeljava: 'audit pokriva §1–§11 (števec izračunan iz EN VIR audita, ne trdo)',
    dokaz: 'src/lib/avtomatizacija-audit.ts (AVTOMATIZACIJA_AUDIT ×11)',
  },
  {
    kriterij: 'deterministične/SDK/skriptne implementacije povsod, kjer so tehnično ustrezne',
    izpeljava: 'razredna porazdelitev audita: DETERMINISTICNO + SDK + SKRIPTA števec > 0, AI le kjer utemeljeno',
    dokaz: 'src/lib/avtomatizacija-pregled.ts (sklep izračunan) + pregledajAvtomatizacijo skener 0 kršitev',
  },
  {
    kriterij: 'AI je neobvezen — jedro deluje brez AI',
    izpeljava: 'AI_ZAHTEVANO števec iz audita === 0 (izračunan, nič trdo kodirano)',
    dokaz: 'src/lib/automation/katalog.ts (AiPonudnik privzeto IZKLJUČEN fail-closed) + ai-raba-pregled',
  },
  {
    kriterij: 'vsi kritični tokovi gredo skozi teste',
    izpeljava: 'polna vitest veriga + build-needleji delegirana generacijska veriga per runda',
    dokaz: 'src/lib/__tests__/ (vitest) + scripts/r*-build-needles.sh (FAIL=0 per runda)',
  },
  {
    kriterij: 'Vercel build/deploy uspešen',
    izpeljava: 'EPOCH build-guard per runda: health build čas > commit meja (git-izpeljana meja)',
    dokaz: 'scripts/r*-prod-qa.sh (Z0 build-guard; ESKALACIJA veja ob zastoju — iskrenost)',
  },
  {
    kriterij: 'obstoječi VIZ scenariji ostanejo funkcionalni',
    izpeljava: 'E2E ŽIVO VIZ + cv-studio scenariji + odtis bajtno identičen pre==post (ZERO-MUTACIJA)',
    dokaz: 'scripts/r*-e2e-browser.sh (Z0 blok + odtis r276+r281+r283+r287)',
  },
  {
    kriterij: 'nič regresij: prijava, projekti, meritve, kalkulator, dokumenti, zaloga, portal, razporejanje, PWA/offline, VIZ',
    izpeljava: 'polne E2E regresije ŽIVO per runda + needleji vseh generacij (delegirana veriga R227→trenutna)',
    dokaz: 'scripts/r*-e2e-browser.sh (polne regresije) + scripts/r*-build-needles.sh (veriga)',
  },
  {
    kriterij: 'dokumentacija jasno ločuje, kjer se AI dejansko uporablja in kjer ne',
    izpeljava: 'docs audit + zaslon (ai-raba-pregled) + ta dokument — ista resnica, NIČ dvojnega sklepa',
    dokaz: 'docs/automacija-audit.md + docs/koncna-verifikacija-head.md + src/lib/ai-raba-pregled.ts',
  },
]

/** Ena vrstica končne verifikacije (join audita z dokazno vezavo). */
export interface KoncnaVerifikacijaVrstica {
  /** Območje iz issue #1 (§1–§11) — verbatim. */
  readonly obmocje: string
  /** Klasifikacija — verbatim iz audita. */
  readonly razred: RazredAudita
  /** Prikazno ime razreda (verbatim iz RAZRED_PRIKAZNO). */
  readonly razredPrikazno: string
  /** Verifikacijske plasti za to območje — verbatim iz vezave. */
  readonly plasti: readonly VerifikacijskaPlast[]
  /** Število plasti (izračunano). */
  readonly stPlasti: number
  /** Opomba dokaza — verbatim iz vezave. */
  readonly opombaDokaza: string
}

/** Končna verifikacija (45. člen — zaslon + testi + docs berejo ISTI niz). */
export interface KoncnaVerifikacija {
  /** Vrstice po območjih (ISTI vrstni red kot audit — nič prerazporejanja). */
  readonly vrstice: readonly KoncnaVerifikacijaVrstica[]
  /** Sprejemni kriteriji — verbatim (nič lepega prepisovanja). */
  readonly kriteriji: readonly SprejemniKriterij[]
  /** Števci plasti čez vsa območja (izračunani). */
  readonly poPlasti: Readonly<Record<VerifikacijskaPlast, number>>
  readonly stObmocij: number
  readonly stObmocijZDokazi: number
  readonly stKriterijev: number
  /** AI-OBVEZNO števec (izračunan iz audita — iskrenost). */
  readonly stAiObveznih: number
  /** EN VIR sklep WYSIWYG (izračunani števci). */
  readonly sklep: string
}

/**
 * Zgrodi končno verifikacijo iz EN VIR resnic. Privzeti vhodi = EN VIR
 * (parametrizirani SAMO za teste fail-closed poti — produkcija vedno kliče
 * brez argumentov).
 */
export function koncnaVerifikacija(
  audit: readonly VrstaAudita[] = AVTOMATIZACIJA_AUDIT,
  dokazi: Readonly<Record<string, DokazVezava>> = DOKAZI_AUDITA,
  kriteriji: readonly SprejemniKriterij[] = SPREJEMNI_KRITERIJI,
): KoncnaVerifikacija {
  if (!Array.isArray(audit)) {
    throw new TypeError('koncnaVerifikacija: pričakovan audit (seznam vrstic)')
  }
  if (audit.length === 0) {
    throw new TypeError('koncnaVerifikacija: audit brez vrstic (§1–§11 obvezna)')
  }
  if (dokazi === null || typeof dokazi !== 'object' || Array.isArray(dokazi)) {
    throw new TypeError('koncnaVerifikacija: pričakovane dokazne vezave (objekt po območjih)')
  }
  if (!Array.isArray(kriteriji)) {
    throw new TypeError('koncnaVerifikacija: pričakovani sprejemni kriteriji (seznam)')
  }
  if (kriteriji.length === 0) {
    throw new TypeError('koncnaVerifikacija: sprejemni kriteriji brez vrstic (issue #1 — 8 kriterijev)')
  }

  const znanePlasti = new Set<string>(VERIFIKACIJSKE_PLASTI)
  const videniKljuci = new Set<string>()
  const vrstice: KoncnaVerifikacijaVrstica[] = []
  const poPlasti = {
    'vitest': 0,
    'build-needleji': 0,
    'E2E ŽIVO': 0,
    'prod-qa': 0,
    'smoke': 0,
  } as Record<VerifikacijskaPlast, number>

  for (const v of audit) {
    if (typeof v.obmocje !== 'string' || v.obmocje.trim().length === 0) {
      throw new TypeError('koncnaVerifikacija: vrstica audita brez območja (fail-closed)')
    }
    if (videniKljuci.has(v.obmocje)) {
      throw new TypeError(`koncnaVerifikacija: podvojeno območje ${v.obmocje} (EN VIR join — nič dvojnikov)`)
    }
    videniKljuci.add(v.obmocje)
    if (!znaniRazredi.has(v.razred)) {
      throw new TypeError(
        `koncnaVerifikacija: vrstica ${v.obmocje} z NEZNANIM razredom ${String(v.razred)}`,
      )
    }
    const vezava = dokazi[v.obmocje]
    if (!vezava || !Array.isArray(vezava.plasti) || vezava.plasti.length === 0) {
      throw new TypeError(
        `koncnaVerifikacija: območje ${v.obmocje} brez dokazne vezave (vsako območje rabi vsaj eno plast — končna verifikacija ne sme sanjati)`,
      )
    }
    if (typeof vezava.opomba !== 'string' || vezava.opomba.trim().length === 0) {
      throw new TypeError(
        `koncnaVerifikacija: vezava ${v.obmocje} brez opombe (iskren dokaz je obvezen)`,
      )
    }
    for (const p of vezava.plasti) {
      if (!znanePlasti.has(p)) {
        throw new TypeError(
          `koncnaVerifikacija: vezava ${v.obmocje} z NEZNANO plastjo ${String(p)} (plasti: ${VERIFIKACIJSKE_PLASTI.join('/')})`,
        )
      }
      poPlasti[p] += 1
    }
    vrstice.push({
      obmocje: v.obmocje,
      razred: v.razred,
      razredPrikazno: RAZRED_PRIKAZNO[v.razred],
      plasti: vezava.plasti,
      stPlasti: vezava.plasti.length,
      opombaDokaza: vezava.opomba,
    })
  }

  for (const k of kriteriji) {
    if (typeof k.kriterij !== 'string' || k.kriterij.trim().length === 0) {
      throw new TypeError('koncnaVerifikacija: kriterij brez vsebine (fail-closed)')
    }
    if (typeof k.izpeljava !== 'string' || k.izpeljava.trim().length === 0) {
      throw new TypeError(
        `koncnaVerifikacija: kriterij »${k.kriterij.slice(0, 40)}« brez izpeljave (mehanična preverba je obvezna)`,
      )
    }
    if (typeof k.dokaz !== 'string' || k.dokaz.trim().length === 0) {
      throw new TypeError(
        `koncnaVerifikacija: kriterij »${k.kriterij.slice(0, 40)}« brez dokaza (končna verifikacija ne sme sanjati)`,
      )
    }
  }

  const stObmocij = vrstice.length
  const stObmocijZDokazi = vrstice.filter((v) => v.stPlasti > 0).length
  const stKriterijev = kriteriji.length
  const stAiObveznih = audit.filter((v) => v.razred === 'AI_ZAHTEVANO').length
  const plastiSklep = VERIFIKACIJSKE_PLASTI.filter((p) => poPlasti[p] > 0)
  const sklep =
    `Končna verifikacija: ${stObmocijZDokazi}/${stObmocij} območij z dokaznimi plastmi · ` +
    `${stKriterijev} sprejemnih kriterijev · plasti v dokazih: ${plastiSklep.join(', ') || 'nič'} · ` +
    `AI-OBVEZNO: ${stAiObveznih}` +
    (stAiObveznih === 0 ? ' — jedro deluje brez AI' : ' — vsako AI-obvezno območje zahteva izrecno utemeljitev')
  return { vrstice, kriteriji, poPlasti, stObmocij, stObmocijZDokazi, stKriterijev, stAiObveznih, sklep }
}
