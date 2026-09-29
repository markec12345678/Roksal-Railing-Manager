// R294 — ISSUE #1 («Professional automation») — PREDMET 11: AI fallback
// arhitektura. Čist adapter vmesnik: AutomationProvider (tukaj
// AutomatizacijskiPonudnik) z implementacijami DeterministicProvider
// (DeterministicniPonudnik — VEDNO na voljo) in AIProvider (AiPonudnik —
// NEOBVEZEN, okoljsko pogojen). Aplikacija deluje, ko AI ponudnik NI
// dosegljiv: `ponudnikZaZmoznost` vrne null (fail-closed), klicatelj pa
// uporabi deterministični nadomestek, ki ga katalog IZRECNO deklarira za
// vsako AI zmožnost (kanon katalog.ts).
//
// NIČ tukaj NE spreminja Product SDK / geometrije / BOM / pricing jedra —
// ponudniki so LE adapterji nad obstoječimi determinističnimi moduli.
//
// ASCII kanon: identifikatorji brez diakritike (naVoljo, zmoznosti).
// Determinizem: `naVoljo` je odločen ob KONSTRUKCIJI (env prebran enkrat) —
// isti objekt = isti odgovor, nič latentnega premikanja stanja.

import {
  AUTOMATIZACIJSKI_KATALOG,
  type AutomatizacijskaZmoznost,
  type AutomatizacijskaVrsta,
} from './katalog'

/** Vrsta ponudnika (kanon issue #1 §11: Deterministic/OpenCV/OCR/AI). */
export type PonudnikVrsta = 'deterministic' | 'opencv' | 'ocr' | 'ai'

export interface AutomatizacijskiPonudnik {
  /** Unikatni id ponudnika (npr. 'deterministicni') */
  readonly id: string
  readonly vrsta: PonudnikVrsta
  readonly opis: string
  /** Ali je ponudnik trenutno uporabljiv (fail-closed: false = nikoli rešen) */
  readonly naVoljo: boolean
  /** Id-ji zmožnosti iz kataloga, ki jih ponudnik servisira */
  zmoznosti(): readonly string[]
}

/** Env preklop za neobvezni AI ponudnik (privzeto IZKLJUČEN). */
export const AI_PONUDNIK_ENV = 'ROKSAL_AI_PONUDNIK'

/** DeterministicProvider — VEDNO na voljo (kanon: jedro deluje brez AI). */
export class DeterministicniPonudnik implements AutomatizacijskiPonudnik {
  readonly id = 'deterministicni'
  readonly vrsta: PonudnikVrsta = 'deterministic'
  readonly opis = 'Deterministično jedro: geometrija, poslovna pravila, izpeljave, izvozi (vedno na voljo)'
  readonly naVoljo = true

  zmoznosti(): readonly string[] {
    return AUTOMATIZACIJSKI_KATALOG.filter((z) => z.vrsta !== 'ai').map((z) => z.id)
  }
}

/** AIProvider — NEOBVEZEN (privzeto izključen; env preklop AI_PONUDNIK_ENV). */
export class AiPonudnik implements AutomatizacijskiPonudnik {
  readonly id = 'ai'
  readonly vrsta: PonudnikVrsta = 'ai'
  readonly opis = 'Neobvezna AI pomoč (VLM ocena fotografije, GPU render) — NIKOLI vir resnice'
  readonly naVoljo: boolean

  constructor(omogocen?: boolean) {
    this.naVoljo = omogocen ?? process.env[AI_PONUDNIK_ENV] === '1'
  }

  zmoznosti(): readonly string[] {
    return AUTOMATIZACIJSKI_KATALOG.filter((z) => z.vrsta === 'ai').map((z) => z.id)
  }
}

// ---- REGISTAR (determinističen: Map ohranja vrstni red vstavljanja) ----

const REGISTAR = new Map<string, AutomatizacijskiPonudnik>()

/** Registrira ponudnika. Podvojen id = NAPIAKA (fail-closed, determinizem). */
export function registrirajPonudnika(ponudnik: AutomatizacijskiPonudnik): void {
  if (REGISTAR.has(ponudnik.id)) {
    throw new Error(`Ponudnik z id '${ponudnik.id}' je že registriran — podvojena registracija je napaka (fail-closed).`)
  }
  REGISTAR.set(ponudnik.id, ponudnik)
}

/** Registrirani ponudniki v vrstnem redu registracije (fiksna kopija). */
export function registriraniPonudniki(): readonly AutomatizacijskiPonudnik[] {
  return [...REGISTAR.values()]
}

/**
 * Ponudnik za zmožnost — fail-closed: neznana zmožnost ALI ponudnik brez
 * `naVoljo` → null (nikoli izmišljen odgovor, nikoli tiha degradacija).
 */
export function ponudnikZaZmoznost(zmoznostId: string): AutomatizacijskiPonudnik | null {
  for (const ponudnik of REGISTAR.values()) {
    if (ponudnik.naVoljo && ponudnik.zmoznosti().includes(zmoznostId)) return ponudnik
  }
  return null
}

/** Je zmožnost dosegljiva? (fail-closed boolean resnica) */
export function jeZmoznostNaVoljo(zmoznostId: string): boolean {
  return ponudnikZaZmoznost(zmoznostId) !== null
}

/**
 * Privzeta nastavitev: DeterministicProvider VEDNO; AIProvider SAMO, če je
 * env preklop omogočen (in še ni registriran). Idempotentna — determinizem.
 */
export function privzetaNastavitev(): { ponudniki: number; aiNaVoljo: boolean } {
  if (![...REGISTAR.values()].some((p) => p.id === 'deterministicni')) {
    registrirajPonudnika(new DeterministicniPonudnik())
  }
  const aiNaVoljo = process.env[AI_PONUDNIK_ENV] === '1'
  const imaAi = [...REGISTAR.values()].some((p) => p.vrsta === 'ai')
  if (aiNaVoljo && !imaAi) registrirajPonudnika(new AiPonudnik(true))
  return { ponudniki: REGISTAR.size, aiNaVoljo }
}

/** Ponastavi registar (izključno za teste — deterministična izolacija). */
export function ponastaviZaTeste(): void {
  REGISTAR.clear()
}

/** Tipovni pomožnik: zmožnosti po vrsti iz kataloga (dokumentacijski kontrakt). */
export function zmoznostiPoVrsti(vrsta: AutomatizacijskaVrsta): readonly AutomatizacijskaZmoznost[] {
  return AUTOMATIZACIJSKI_KATALOG.filter((z) => z.vrsta === vrsta)
}
