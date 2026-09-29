/**
 * R287 — (k) opomnik portal akcija — ZAPRTJE evalvacije (odprta od R251,
 * 8 rund 'vrednotenje nadaljuje'): signal 7 'opomnik' v zvončku + portal
 * dejanje (klik → CRM, R182 protokol — pariteta followup/invoice). Sorojenec
 * zamujena-dobava R228 (tu za STRANKE, tam za MATERIAL — ISTA strogost).
 *
 * EN VIR: /api/crm odgovor, ki ga CrmTab že izriše — opomnikStatus je
 * VERBATIM strežniški izračun (R251 kanon: API je izračunal status ob
 * fetch-u; klient/lib NE izračunava svojega — sekundni premik čez polnoč bi
 * dal lažen alarm). Ta lib torej NE razsoja AKTIVEN/POTEKEL — samo prevaja
 * že-izračunani status v zvončkove vrstice.
 *
 * STROGOST (fail-closed, ISTA družina kot zamujena-dobava R228):
 * - opomnikStatus razen 'AKTIVEN'/'POTEKEL' (NI, undefined, tuj niz) → vnos
 *   preskočen (nikoli lažnega žiga);
 * - status brez veljavnega opomnikDatum (null/prazen/pokvaren) → vnos
 *   preskočen (status brez datuma je pokvaren vnos — brez izmišljenih dni);
 * - vrstni red: POTEKEL najprej (alarm), nato AKTIVEN po datumu naraščajoče
 *   (najbližji rok prvi); max = omejitev vrstic (vzorec followup/invoice
 *   slice(0, 6)).
 *
 * DNI resnica = samo ZA PRIKAZ, KOLEDARSKO iskreno (polnočna sidrišča —
 * vzorec zamujena R228 'striktno pred polnočjo'; rok še danes → 'danes'/
 * 'rok danes', ne napačnega '1 dni'); status ostane verbatim (lib NE prečka
 * statusa in dni — R251: ±1 dan je dokumentiran rob).
 *
 * Vsaka funkcija je čista in deterministična (isti vhod → isti izid; danas
 * je IZRECEN argument — brez skrite ure). Client-safe: brez uvozov.
 */

/** Najmanjši prerez stranke za zvončkovo vrstico (podmnožica /api/crm
 * customers — client-safe; opomnikDatum je ISO niz iz Prisme). */
export interface OpomnikZvonekVnos {
  id: string
  ime: string
  opomnikDatum?: string | null
  opomnikOpis?: string | null
  /** VERBATIM strežniški izračun (/api/crm) — lib ga NE izračunava. */
  opomnikStatus?: 'NI' | 'AKTIVEN' | 'POTEKEL'
}

/** Ena zvončkova vrstica (klicatelj preslika v NotificationItem). */
export interface OpomnikZvonekVrstica {
  /** `opomnik-${id stranke}` — dedup/id protokol zvončka. */
  id: string
  ime: string
  /** Kratek namen opomnika; brez opisa = datum (iskrena praznina). */
  opis: string
  /** 'POTEKEL · zapadlo X dni' / 'POTEKEL · danes' / 'še X dni' / 'rok danes'. */
  meta: string
  /** POTEKEL = true (roksal-red ALARM); AKTIVEN = false (roksal-amber). */
  alarm: boolean
}

/** Skupni validacijski sprehod (R289 izvleček — javno vedenje NESPREMENJENO,
 * R287 ×15 pinov ščiti): vrne VSE veljavne nosilce (POTEKEL najprej v
 * prihajajočem vrstnem redu odgovora, AKTIVEN po datumu naraščajoče). EN VIR
 * za vrstice IN presežek — presežek NE more divergirati od vrstic, ker
 * uporablja ISTI sprehod (R251/WYSIWYG kanon). */
function opomnikZvonekNosilci(
  vhodi: readonly unknown[],
): { vnos: OpomnikZvonekVnos; datum: Date }[] {
  const potekli: { vnos: OpomnikZvonekVnos; datum: Date }[] = []
  const aktivni: { vnos: OpomnikZvonekVnos; datum: Date }[] = []
  for (const v of vhodi) {
    if (v === null || typeof v !== 'object') continue
    const kandidat = v as OpomnikZvonekVnos
    if (typeof kandidat.id !== 'string' || kandidat.id === '') continue
    if (typeof kandidat.ime !== 'string' || kandidat.ime.trim() === '') continue
    // Status VERBATIM (R251 kanon): le natanko dve znani vrednosti ustvarita
    // vrstico — vse ostalo (NI/undefined/tuj niz) je tiho odsotna (fail-closed,
    // nikoli lažnega žiga).
    if (kandidat.opomnikStatus !== 'AKTIVEN' && kandidat.opomnikStatus !== 'POTEKEL') continue
    // Status brez veljavnega datuma = pokvaren vnos (brez izmišljenih dni).
    if (typeof kandidat.opomnikDatum !== 'string' || kandidat.opomnikDatum === '') continue
    const datum = new Date(kandidat.opomnikDatum)
    if (Number.isNaN(datum.getTime())) continue
    const nosilec = { vnos: kandidat, datum }
    if (kandidat.opomnikStatus === 'POTEKEL') potekli.push(nosilec)
    else aktivni.push(nosilec)
  }
  // AKTIVEN po datumu naraščajoče (najbližji rok prvi); POTEKEL ostane v
  // prihajajočem vrstnem redu odgovora (strežnik že sortira po createdAt —
  // lib NE izmišljuje druge resnice).
  aktivni.sort(
    (a, b) => a.datum.getTime() - b.datum.getTime(),
  )
  return [...potekli, ...aktivni]
}

/** Zvončkove opomniške vrstice iz /api/crm customers (fail-closed per vnos;
 * seznam MORA biti seznam — TypeError, ISTA družina kot steviloZamujenihDobav
 * R228). `danas` je začetek trenutnega dneva (polnoč) — klicatelj ga poda
 * IZRECNO (determinizem). */
export function opomnikZvonekVrstice(
  vhodi: readonly unknown[],
  danas: Date,
  max = 6,
): OpomnikZvonekVrstica[] {
  if (!Array.isArray(vhodi)) {
    throw new TypeError('R287: vhodi mora biti seznam strank')
  }
  const vrstice = (nosilec: { vnos: OpomnikZvonekVnos; datum: Date }): OpomnikZvonekVrstica => {
    const { vnos: c, datum } = nosilec
    const potekel = c.opomnikStatus === 'POTEKEL'
    const opis =
      typeof c.opomnikOpis === 'string' && c.opomnikOpis.trim() !== ''
        ? c.opomnikOpis
        : `Opomnik · ${datum.toLocaleDateString('sl-SI')}`
    let meta: string
    // DNI = samo za prikaz, KOLEDARSKO iskreno (polnočna sidrišča — vzorec
    // zamujena R228 'striktno pred polnočjo'; danes zaradi roka → 'danes'/
    // 'rok danes', ne napačnega '1 dni'). Status ostane verbatim (R251 kanon).
    const danasPolnoc = new Date(danas.getFullYear(), danas.getMonth(), danas.getDate()).getTime()
    const datumPolnoc = new Date(datum.getFullYear(), datum.getMonth(), datum.getDate()).getTime()
    const dni = Math.round((datumPolnoc - danasPolnoc) / 86400000)
    if (potekel) {
      meta = dni < 0 ? `POTEKEL · zapadlo ${-dni} dni` : 'POTEKEL · danes'
    } else {
      meta = dni > 0 ? `še ${dni} dni` : 'rok danes'
    }
    return { id: `opomnik-${c.id}`, ime: c.ime, opis, meta, alarm: potekel }
  }
  return opomnikZvonekNosilci(vhodi).slice(0, Math.max(0, max)).map(vrstice)
}

/** R289 — ISKREN PRESEŽEK (dopolnitev R287 — family-wide zvonček kanon):
 * koliko VELJAVNIH opomniških vnosov NI vidnih v zvončku (zvonček prikazuje
 * največ `max` vrstic — vzorec followup/invoice slice(0, 6)) — brez tega
 * žigona bi 7. opomnik tiho izginil (LAŽNA VARNOST, vzorec R152/R182).
 *
 * EN VIR: ISTI validacijski sprehod kot opomnikZvonekVrstice (opomnikZvonekNosilci
 * R289 izvleček) — presežek = veljavni − prikazani, NIKOLI drugačen izračun
 * veljavnosti (R251/WYSIWYG kanon). Pokvareni vnosi (NI status, brez datuma,
 * ne-objektni) NE štejeta v presežek — nikoli napihnjenega alarma.
 *
 * Fail-closed: ne-seznam → TypeError (ISTA družina kot vrstice R287);
 * max < 0 = brez omejitve pomena (Math.max(0, max) — pariteta vrstic).
 * Determinizem: čista funkcija, brez ure/brez uvozov (client-safe). */
export function opomnikZvonekPresezek(
  vhodi: readonly unknown[],
  max = 6,
): number {
  if (!Array.isArray(vhodi)) {
    throw new TypeError('R289: vhodi mora biti seznam strank')
  }
  return Math.max(0, opomnikZvonekNosilci(vhodi).length - Math.max(0, max))
}
