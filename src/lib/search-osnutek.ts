// Roksal — R217 P1-d: konvergenca TRETJEGA signalca (iskanje → naročilni tok)
// ---------------------------------------------------------------------------
// ⌘K paleta ima od R215 skupino 'Nizka zaloga' (R216: klik → Osnutek dialog
// prek centralNavigate 4. argumenta) in zvonček od R216 deep-link 'stock'
// vrstico. Iskalni zadetki Materiala so bili EDINI signal, ki je videl
// artikel z nizko zalogo in ga NI povezal z naročilnim tokom — uporabnik,
// ki išče artikel po imenu/šifri in ga zadene, je moral nato ročno v Zalogo.
//
// Ta lib je EN VIR presojanja "ali je ta iskalni zadetek artikel pod
// minimumom, ki lahko odpre naročilni tok". Fail-closed po duhu projekta:
// če odgovor /api/search NIMA popolnih zaloga polj (starejši odgovor,
// sekanc med deployema), funkcija vrne null — UI NE trdi nizke zaloge in
// NE ponudi deep-linka (nič izmišljenega, brez lažnega badgea).
//
// Brez React odvisnosti — čisto enota, testirljivo brez montiranja komponent.
import type { ZalogaArtikelZaNarocilo } from '@/lib/zaloga-povzetek'

/** Iskalni zadetek Materiala iz /api/search. Zaloga polja so opcijska:
 * prisotna so od R217 dalje (API jih vrača za iskren badge + deep-link);
 * njihova odsotnost pomeni "ne moremo presoditi" — NI enako "ni nizke". */
export interface IskalniMaterial {
  id: string
  naziv: string
  sifra: string
  kolicinaZaloga?: number
  minimalnaZaloga?: number
  enota?: string
}

/** Vrne POPOLN artikel za osnutek deep-link (ZalogaArtikelZaNarocilo), ko
 * je zadetek pod ali NA minimumu in so vsa polja prisotna/veljavna; sicer
 * null (visoka zaloga, manjkajoča polja ali neveljavne vrednosti — vsak
 * sum gre na strani varnosti: ne ugibamo). Meja je <= — ISTA semantika kot
 * R215/R216 izpeljanka v paleti in zvončku (en podatkovni jezik čez
 * signalce). Preslikava sifra → sifraMateriala (IskalniMaterial je oblika
 * iskalnega odgovora, artikel pa oblika Zaloge — ENA preslikava tu, nikjer
 * drugje). */
export function osnutekIzIskanja(m: IskalniMaterial): ZalogaArtikelZaNarocilo | null {
  const { kolicinaZaloga, minimalnaZaloga, enota } = m
  if (typeof kolicinaZaloga !== 'number' || !Number.isFinite(kolicinaZaloga)) return null
  if (typeof minimalnaZaloga !== 'number' || !Number.isFinite(minimalnaZaloga)) return null
  if (typeof enota !== 'string' || enota.length === 0) return null
  if (kolicinaZaloga > minimalnaZaloga) return null
  return {
    id: m.id,
    sifraMateriala: m.sifra,
    naziv: m.naziv,
    kolicinaZaloga,
    enota,
    minimalnaZaloga,
  }
}
