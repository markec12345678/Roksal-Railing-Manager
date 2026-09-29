// ---------------------------------------------------------------------------
// R290 — PRIHODKI PO MESECIH (plačila dimenzija — iz R250 predala 'naslednji:
// plačila dimenzija (Invoice placanoAt časovnica — prihodki per mesec)').
// Izriše se v Finance → Računi (invoice-manager) — sekcija pod Povzetkom.
//
// EN VIR resnice (nič dvojnega):
//  • vrstice = PrihodkiPdfVnos (R250) — ISTA oblika, ISTA validacija
//    (preveriPrihodkiVnos UVOŽEN, ne kopiran), ISTI računovodski sort
//    (sortirajPrihodki UVOŽEN — FP seštevanje je f(množica), ne f(vrstni
//    red odgovora), vzorec povprecniRazpon R248);
//  • komponenta (invoice-manager) preslika /api/invoices v PrihodkiPdfVnos
//    ENKRAT (useMemo prihodkiVnosi) — PDF izvoz (R250) IN ta sekcija
//    poganjata IZ ISTEGA polja (WYSIWYG po konstrukciji).
//
// Semantične odločitve (T1–T6, zapisane pred razvojem):
//  T1 prihodek = SAMO PLACAN, mesec = placanoAt.slice(0, 7) ('YYYY-MM');
//     placanoAt je validiran že v preveriPrihodkiVnos (ISO) — string
//     rezanje BREZ Date API-ja (100 % deterministično, nič časovnih pasov).
//  T2 IZDAN = v teku (izdani, neplačani) — iskren povzetek ŠTEVEC + ZNESEK,
//     NE po mesecih (mesec plačila ne znan; mesec izdaje bi bil napačen
//     trenutek resnice za prihodek).
//  T3 OSNUTEK in STORNIRAN = števca (iskrena resnica — nič tihega
//     izginjanja; stornirani so IZKLJUČENI iz vseh zneskov in POIMENOVANI).
//  T4 fail-closed: ne-polje → TypeError; pokvaren vnos → TypeError
//     (preveriPrihodkiVnos — prelomljen seznam, vzorec R287; nikoli tiho
//     spregledan).
//  T5 prazen seznam → povzetek z ničlami + prazen meseci (iskrena
//     praznina — UI pokaže pošteno kopico, ne lažnih 0-vrstic).
//  T6 mnostevnica računBeseda(n) po OBSTOJEČI konvenciji repozitorija
//     (terminiBeseda R167/stranka R215: 1 račun; 2 računa; 3/4 računi;
//     0, 5+ računov; izjeme 11–14 → računov; 21 → račun, 22 → računa,
//     23/24 → računi; 112 → računov).
// ---------------------------------------------------------------------------

import {
  preveriPrihodkiVnos,
  sortirajPrihodki,
  type PrihodkiPdfVnos,
} from './prihodki-pdf'

export interface PrihodkiMesecVrstica {
  /** 'YYYY-MM' (mesec plačila — iz placanoAt). */
  mesec: string
  /** Število plačanih računov v mesecu. */
  stRacunov: number
  /** Vsota zneskov plačanih računov v mesecu (EUR). */
  prihodki: number
}

export interface PrihodkiMeseciPovzetek {
  /** Meseci plačil NARAŠČajoče (lexicographic 'YYYY-MM' — deterministično). */
  meseci: PrihodkiMesecVrstica[]
  /** Vsota vseh prihodkov (plačanih) — ISTA vsota kot vsota meseci. */
  skupajPrihodki: number
  /** Skupno število plačanih računov. */
  skupajRacunov: number
  /** IZDAN — v teku: število + znesek (izdani, neplačani). */
  stIzdanih: number
  znesekIzdanih: number
  /** OSNUTEK — števec (izključeni iz zneskov). */
  stOsnutkov: number
  /** STORNIRAN — števec (iskrena resnica; izključeni iz zneskov). */
  stStorniranih: number
}

/** Slovenščina mnostevnica 'račun' po konvenciji repozitorija (terminiBeseda
 *  R167 vzorec — dvojina in 11–14 izjeme izrecno). */
export function racunBeseda(n: number): string {
  if (!Number.isInteger(n) || n < 0) {
    throw new TypeError(`racunBeseda: pričakovano celo število ≥ 0, ne ${String(n)}`)
  }
  const d = n % 100
  if (d >= 11 && d <= 14) return 'računov'
  const e = n % 10
  if (e === 1) return 'račun'
  if (e === 2) return 'računa'
  if (e === 3 || e === 4) return 'računi'
  return 'računov'
}

/** Deterministična razčlenitev prihodkov po mesecih plačila. Čist funkcijski
 *  klic (vhod nespremenjen); sortira PO ŠTEVILKI (uvožen sortirajPrihodki)
 *  pred seštevanjem — enaka množica v drugem vrstnem redu = isti rezultat. */
export function prihodkiPoMesecih(
  vnosi: readonly PrihodkiPdfVnos[],
): PrihodkiMeseciPovzetek {
  if (!Array.isArray(vnosi)) {
    throw new TypeError('prihodkiPoMesecih: pričakovano polje prihodkovih vrstic (PrihodkiPdfVnos[])')
  }
  for (let i = 0; i < vnosi.length; i++) {
    preveriPrihodkiVnos(vnosi[i], i)
  }
  const sortirani = sortirajPrihodki([...vnosi])
  const poMesecu = new Map<string, { st: number; vsota: number }>()
  let skupajPrihodki = 0
  let skupajRacunov = 0
  let stIzdanih = 0
  let znesekIzdanih = 0
  let stOsnutkov = 0
  let stStorniranih = 0
  for (const v of sortirani) {
    if (v.status === 'PLACAN') {
      // placanoAt je po preveriPrihodkiVnos ISO niz 'YYYY-MM-DD…' (PLACAN
      // brez placanoAt = že TypeError) — rezanje je deterministično.
      const mesec = (v.placanoAt ?? '').slice(0, 7)
      const obst = poMesecu.get(mesec)
      if (obst) {
        obst.st += 1
        obst.vsota += v.znesek
      } else {
        poMesecu.set(mesec, { st: 1, vsota: v.znesek })
      }
      skupajRacunov += 1
      skupajPrihodki += v.znesek
    } else if (v.status === 'IZDAN') {
      stIzdanih += 1
      znesekIzdanih += v.znesek
    } else if (v.status === 'OSNUTEK') {
      stOsnutkov += 1
    } else {
      stStorniranih += 1
    }
  }
  const meseci = [...poMesecu.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([mesec, ag]) => ({ mesec, stRacunov: ag.st, prihodki: ag.vsota }))
  return {
    meseci,
    skupajPrihodki,
    skupajRacunov,
    stIzdanih,
    znesekIzdanih,
    stOsnutkov,
    stStorniranih,
  }
}
