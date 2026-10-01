// R354 — FAZA 8: teren izvozi ORKESTRACIJA — kontrolni tok treh bratov
// (teren PDF R269 + zapisni list PDF R284 + zapisni list CSV R285) izluščen
// VERBATIM iz taba (vzorec FAZA 5/R348 izvoz-csv, FAZA 6/R349 teren-vnosi,
// FAZA 7/R350 pdf-seznam; args objekt — vzorec R346/R325):
//   • lib NE pozna toastov — vrača DISKRIMINIRAN REZULTAT (manjka-projekt /
//     prazno / uspeh-pdf / uspeh-csv / napaka): fail-verbose resnica (razlog
//     napake) gre Z REZULTATOM — komponenta (render plast) ga preslika v
//     toast z VERBATIM besedili (UI resnica ostane v UI — NI dvojnega
//     besedila, NI tihe degradacije: prazno/manjka-projekt/napaka so VSE
//     vidne veje, nobena ne nastaje datoteke);
//   • EN VIR: fetchMeritveTerenVnosi (FAZA 6 — isti prune za vse tri izvoze)
//     + meritevTerenPregled (WYSIWYG povzetek — ISTA resnica kot KPI/tabela/
//     sklep/lista; EN izračun na izvoz) + generate*/zapisniListCsv (bajtni
//     kontrakt izvozov NESPREMENJEN — iste funkcije, isti DTO, isti sort,
//     ista imena datotek);
//   • projektIme = POSREDOVAN od klicatelja (točno to, kar pokaže izbirnik;
//     brez izbire → null — jedro pošteno pokaže 'Brez imena projekta',
//     brez izmišljenih imen);
//   • downloadCsvText ostane v tabu (prenos = brskalniški kanon — vzorec
//     kalkulator FAZA 5–7: prenos ostaja v tabu prek kanona downloadCsvText);
//     lib vrne {csv, imeDatoteke, vrstic} — čista projekcija.
// ---------------------------------------------------------------------------

import type { MeritveTerenPovzetek, MeritveTerenVnos } from '@/lib/meritve-teren-pdf'
import { meritevTerenPregled, generateMeritveTerenPdf } from '@/lib/meritve-teren-pdf'
import { generateTerenskiZapisniPdf } from '@/lib/terenski-zapisni-pdf'
import { zapisniListCsv, zapisniListCsvFilename } from '@/lib/terenski-zapisni-csv'
import { fetchMeritveTerenVnosi } from './teren-vnosi'

/** Trije teren izvozi — ISTI fetch/prazno/napaka kontrakt, različen cilj. */
export type TerenIzvozVrsta = 'teren-pdf' | 'zapisni-pdf' | 'zapisni-csv'

/** Kontekst posredovan od komponente (UI resnica: izbirnik + trenutek). */
export interface TerenIzvozKontekst {
  /** Izbirni projekt ali null (noben projekt ni izbran). */
  readonly selectedProject: string | null
  /** Ime projekta točno kot ga pokaže izbirnik; brez izbire → null. */
  readonly projektIme: string | null
  /** Trenutek izvoza (ime datoteke + časovni žigi dokumenta). */
  readonly zdaj: Date
}

/** Diskriminiran rezultat — VSE veje so VIDNE (fail-verbose, nič tihega). */
export type TerenIzvozRezultat =
  | { readonly izid: 'manjka-projekt' }
  | { readonly izid: 'prazno' }
  | { readonly izid: 'uspeh-pdf'; readonly povzetek: MeritveTerenPovzetek }
  | {
      readonly izid: 'uspeh-csv'
      readonly csv: string
      readonly imeDatoteke: string
      readonly vrstic: number
    }
  | { readonly izid: 'napaka'; readonly sporocilo: string }

/**
 * Izvede EN teren izvoz od začetka do konca: projekt guard → FRESH fetch
 * (FAZA 6 EN VIR, fail-verbose DTO pruning) → prazno guard (fail-closed:
 * prazen seznam ne nastaja dokumenta) → gradnja (PDF se sam shrani; CSV =
 * čista projekcija, prenos v klicatelju) → diskriminiran rezultat. Napaka
 * se NIKOLI ne pogoltne — razlog gre v `sporocilo` (klicatelj pokaže toast).
 */
export async function izvediTerenIzvoz(
  vrsta: TerenIzvozVrsta,
  kontekst: TerenIzvozKontekst,
): Promise<TerenIzvozRezultat> {
  if (!kontekst.selectedProject) return { izid: 'manjka-projekt' }
  try {
    // Terenski pregled = brez kota (R269); zapisni list (PDF+CSV) = s kotom
    // (R284/R285 — izpolnjevalni list nosi tudi kot; EN VIR fetchMeritveTerenVnosi
    // dialektalno stikalo zKotom nosi OBA kontrakta EKSPLICITNO).
    const zKotom = vrsta !== 'teren-pdf'
    const vnosi: MeritveTerenVnos[] = await fetchMeritveTerenVnosi(kontekst.selectedProject, {
      zKotom,
    })
    if (vnosi.length === 0) return { izid: 'prazno' }

    if (vrsta === 'zapisni-csv') {
      // EN VIR R285 lib: validacija + akcijski sort + R186 pariteta + prazni
      // fizični stolpci — čisto jedro, komponenta je samo žičenje (Y7).
      const { csv, vrstic } = zapisniListCsv(vnosi)
      return {
        izid: 'uspeh-csv',
        csv,
        imeDatoteke: zapisniListCsvFilename(kontekst.zdaj),
        vrstic,
      }
    }

    // ENA izpeljava: povzetek za toast = ISTA resnica kot KPI IN sklep na
    // listu (WYSIWYG — EN VIR meritevTerenPregled).
    const { povzetek } = meritevTerenPregled(vnosi)
    if (vrsta === 'teren-pdf') {
      generateMeritveTerenPdf(vnosi, { now: kontekst.zdaj, projektIme: kontekst.projektIme })
    } else {
      generateTerenskiZapisniPdf(vnosi, { now: kontekst.zdaj, projektIme: kontekst.projektIme })
    }
    return { izid: 'uspeh-pdf', povzetek }
  } catch (err) {
    // Fail-verbose: izvoz ne sme tiho spodleteti — razlog gre z rezultatom.
    return {
      izid: 'napaka',
      sporocilo: err instanceof Error ? err.message : `Neznana napaka (${String(err)}).`,
    }
  }
}
