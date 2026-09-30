// Roksal Field - API: I/O meja telesa zahteve (R309 — migracijski val)
// ─────────────────────────────────────────────────────────────────────
// EN VIR 400-guarda za telesa mutirajočih zahtevkov (POST/PUT/PATCH):
// pokvarjen / manjkajoč / ne-objektni JSON je NAPAKA ODJEMALCA (400),
// ne strežnika (500) — izrecen fail-closed PRED uporabo, brez tihega
// 500 v monitoring (kanon ovojnice { error }).
//
// Vzorec je R308 izrecno postavil na calculator (prej: throw znotraj
// try → splošni catch → 500); R309 ga dvigne v EN VIR za VSE
// route-handlerje (migracijski val: 26 handlerjev / 32 klicnih mest
// + calculator kot vzorčni potrošnik).
// /api/sync je IZRECNO izvzet (kontrakt NIČ — nič se ne spreminja).
import { NextResponse } from 'next/server'

/** Kanonično sporočilo I/O mejne napake telesa (EN VIR — samo tu). */
export const API_TELO_NAPAKA = 'Neveljavno telo zahteve — pričakovan JSON objekt'

/**
 * Telo handlerju po meji: znani objekt-iz-JSON. Meja jamči SAMO
 * objektnost (typeof === 'object' in ≠ null) — resnica polj živi v
 * zod/domenski plasti (zgodovinska oklapanost request.json(): any je
 * IZRECNA, neimplicitna; brez skritih tipovih pretresov po 74 mestih).
 * (no-explicit-any je v tem repozitoriju izklopljen — zavedno.)
 */
export type JsonTelo = { [kljuc: string]: any }

/** Izkid prebiranja telesa: uspeh z objektom ALI gotov 400 odgovor. */
export type JsonTeloIzid =
  | { ok: true; telo: JsonTelo }
  | { ok: false; odgovor: NextResponse }

/**
 * Preberi telo zahteve kot JSON objekt — NIKOLI ne meče:
 * pokvarjen JSON, prazno telo, nizi/številke/null → gotov 400 odgovor
 * z ovojnico { error }. Polja (telo.ok === false) handler preprosto
 * vrne; uspeh nosi telo kot Record (nadaljnja validacija ostane
 * zod/domenski plasti — ta funkcija je SAMO I/O meja).
 */
export async function preberiJsonTelo(request: Request): Promise<JsonTeloIzid> {
  const telo = (await request.json().catch(() => null)) as unknown
  if (typeof telo !== 'object' || telo === null) {
    return {
      ok: false,
      odgovor: NextResponse.json({ error: API_TELO_NAPAKA }, { status: 400 }),
    }
  }
  return { ok: true, telo: telo as JsonTelo }
}
