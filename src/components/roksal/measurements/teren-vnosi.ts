// R349 — MEASUREMENTS FAZA 6: EN VIR fetch + fail-verbose DTO pruning
// terenskih izvozov (R269 terenski pregled PDF + R284 zapisni list PDF +
// R285 zapisni list CSV — 3 stale kopije ~70 vrstic v measurements-tab.tsx).
// Vzorec kalkulator FAZA 5–7 (R325/R345–R347) + meritve FAZA 5 (R348
// izvoz-csv.ts): tab je samo žičenje, gradniki so čisti in testabilni.
//
// BAJTNA KONTRAKTA (iskreno, nič tihega):
//  • R269 dialekt (zKotom: false) — DTO BREZ kotStopinje ključa (key izostane;
//    spread pojavni vzorec) IN BREZ validacije kotStopinje/arMetadata.kot —
//    točno kot stale handler (pokvaren kotStopinje ne smeta zlomiti terenskega
//    pregleda, ker ga ta list NE uporablja).
//  • R284/R285 dialekt (zKotom: true) — kotStopinje prvorazredni stolpec +
//    validacija + legacy arMetadata.kot fallback (R283 dialekt m1/m2).
// Stale telesi R284 ≡ R285 sta bila bajtno identična (razen komentarjev) —
// zdaj 1 gradnik; R269 je ista resnica minus kot dialekt (LEKCIJA R347 2:
// stale kopije dihajo v function telesih — tu ×3).
import type { MeritveTerenVnos } from '@/lib/meritve-teren-pdf'

export interface TerenVnosiOpcije {
  /** false = R269 terenski pregled dialekt (DTO brez kotStopinje ključa —
   *  bajtni kontrakt lista); true = R284/R285 zapisni list dialekt (z
   *  kotStopinje + legacy arMetadata.kot fallbackom). */
  zKotom: boolean
}

/** Fail-verbose DTO pruning — ENA kopija (prej 3 stale telesa). Vsaka
 *  napaka nosi indeks krivca (vrstica ${i}) + id merilne vrstice (R264–R268
 *  vzorec; UI parser je toleranten {}, dokument resnice NIKOLI tiho ne
 *  preskoči pokvarene vrstice). */
export function pruneMeritveTerenVrstice(
  vrstice: Array<Record<string, unknown>>,
  opcije: TerenVnosiOpcije,
): MeritveTerenVnos[] {
  return vrstice.map((m, i) => {
    if (typeof m.id !== 'string' || m.id === '') {
      throw new TypeError(`meritev vrstica ${i}: manjkajoč id v odgovoru API-ja`)
    }
    if (typeof m.createdAt !== 'string' || m.createdAt === '') {
      throw new TypeError(`meritev vrstica ${i} (${m.id}): manjkajoč createdAt v odgovoru API-ja`)
    }
    if (typeof m.dolzinaMm !== 'number' || !Number.isFinite(m.dolzinaMm) || m.dolzinaMm < 0) {
      throw new TypeError(`meritev vrstica ${i} (${m.id}): dolzinaMm mora biti ne-negativno končno število, ne ${String(m.dolzinaMm)}`)
    }
    if (typeof m.visinaMm !== 'number' || !Number.isFinite(m.visinaMm) || m.visinaMm < 0) {
      throw new TypeError(`meritev vrstica ${i} (${m.id}): visinaMm mora biti ne-negativno končno število, ne ${String(m.visinaMm)}`)
    }
    // R277 (issue #16 §6) — verzija + vir: fail-verbose tipovna preverba
    // (pokvaren vir NE sme tiho priti na list kot String(number); verzija
    // = pozitivno celo število ALI null/izostanek = legacy).
    if (
      m.verzija !== null &&
      m.verzija !== undefined &&
      (typeof m.verzija !== 'number' || !Number.isInteger(m.verzija) || (m.verzija as number) < 1)
    ) {
      throw new TypeError(`meritev vrstica ${i} (${m.id}): verzija mora biti pozitivno celo število ALI null, ne ${String(m.verzija)}`)
    }
    if (m.vir !== null && m.vir !== undefined && typeof m.vir !== 'string') {
      throw new TypeError(`meritev vrstica ${i} (${m.id}): vir mora biti niz ALI null, ne ${String(m.vir)}`)
    }
    // R284/R285 dialekt — kot (X2/Y2 EN VIR R186 r[5] = kotStopinje):
    // prvorazredni DTO stolpec; pokvaren tip = fail-verbose (NIČ tihega
    // String(number) na listu); odsoten = null. V R269 dialektu se kot NE
    // dotaknemo (stale handler ga NI poznal — bajtni kontrakt).
    let kot: number | null = null
    if (opcije.zKotom && m.kotStopinje !== null && m.kotStopinje !== undefined) {
      if (typeof m.kotStopinje !== 'number' || !Number.isFinite(m.kotStopinje)) {
        throw new TypeError(`meritev vrstica ${i} (${m.id}): kotStopinje mora biti končno število ALI null, ne ${String(m.kotStopinje)}`)
      }
      kot = m.kotStopinje
    }
    // arMetadata parse — fail-verbose (ISTI kontrakt R269/R284/R285 —
    // pokvaren vir NIKOLI tiho preskočen).
    let ar: Record<string, unknown> = {}
    if (m.arMetadata !== null && m.arMetadata !== undefined) {
      if (typeof m.arMetadata !== 'string') {
        throw new TypeError(`meritev vrstica ${i} (${m.id}): arMetadata mora biti niz ALI null, ne ${String(m.arMetadata)}`)
      }
      if (m.arMetadata.trim() !== '') {
        try {
          const parsed: unknown = JSON.parse(m.arMetadata)
          if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
            throw new TypeError('ni objekt')
          }
          ar = parsed as Record<string, unknown>
        } catch {
          throw new TypeError(`meritev vrstica ${i} (${m.id}): arMetadata ni razumljen kot JSON objekt (pokvaren vir)`)
        }
      }
    }
    if (opcije.zKotom && kot === null && typeof ar.kot === 'number' && Number.isFinite(ar.kot)) {
      // legacy dialekt (m1/m2) — kot živi v arMetadata.kot (R283 fikstura)
      kot = ar.kot
    }
    return {
      id: m.id,
      createdAt: m.createdAt,
      dolzinaMm: m.dolzinaMm,
      visinaMm: m.visinaMm,
      // R269 dialekt: ključ kotStopinje IZOSTANE (bajtni kontrakt — stale
      // handler ni vrnil ključa); R284/R285: ključ vedno prisoten.
      ...(opcije.zKotom ? { kotStopinje: kot } : {}),
      tipMeritve: (ar.tipMeritve ?? null) as string | null,
      oznaka: (ar.oznaka ?? null) as string | null,
      status: (m.status ?? ar.status ?? null) as string | null,
      lokacija: (ar.lokacija ?? null) as string | null,
      opomba: (ar.opomba ?? null) as string | null,
      verzija: (m.verzija ?? null) as number | null,
      vir: (m.vir ?? null) as string | null,
    }
  })
}

/** FRESH fetch /api/measurements?projectId (R244–R268 precedens — polna
 *  resnica projekta ob kliku, ne filtrirani state) + res.ok razlog +
 *  ne-polje TypeError + EN VIR pruning. Handler v tabu ostane lastnik
 *  guardov UI resnice (dvoklik, brez projekta, prazen seznam, tosti). */
export async function fetchMeritveTerenVnosi(
  projectId: string,
  opcije: TerenVnosiOpcije,
): Promise<MeritveTerenVnos[]> {
  const res = await fetch(`/api/measurements?projectId=${projectId}`, {
    credentials: 'same-origin',
  })
  if (!res.ok) {
    throw new Error(`GET /api/measurements → HTTP ${res.status}`)
  }
  const data: unknown = await res.json()
  if (!Array.isArray(data)) {
    throw new TypeError('Odgovora /api/measurements ni mogoče prebrati (ni polja).')
  }
  return pruneMeritveTerenVrstice(data as Array<Record<string, unknown>>, opcije)
}
