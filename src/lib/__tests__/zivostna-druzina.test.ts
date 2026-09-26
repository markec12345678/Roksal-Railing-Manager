// ŽIVOSTNA DRUŽINA — KANONIČNA TABELA 20 POVRŠIN (R186 konsolidacija)
// ---------------------------------------------------------------------------
// Zgodovina: družina pečatov 'Osveženo ob' + refetch-on-focus je rasla od R170
// (Termini, Logistika) čez R171 (dashboard), R177 (zaloga, dokumenti, varnost),
// R178 (CRM, plošča, ekipa), R180 (vodja, računi), R181 (zapisnik, posli,
// ponudbe), R182 (obvestila, material), R183 (fotografije, meritve) do R184
// (omejitve, seje). Vsaka runda je v SVOJI testni datoteki nosila KUMULATIVNO
// kopijo družinske tabele (r177 ×6, r178 ×9, r180 ×11, r181 ×14, r182 ×16,
// r183 ×18, r184 ×20) — 7 kopij istega seznama, vsaka nova runda je kopijo
// podaljšala. R186 tabelo KONSOLIDIRA v ENO kanonično mesto:
//  • nova površina = ENA vrstica v DRUŽINA_20 + metapodatki (setN/minNullN)
//    + per-površinski opis v rundi, ki jo uvaja (SCOPED trditve ostanejo tam);
//  • kumulativne kopije v r177/r178/r180/r181/r182/r183/r184 so IZTISNJENE
//    (per-površinski opisi teh rund ostanejo nedotaknjeni — konsolidira se
//    SAMO družinska popolnost, ne posebnosti površin).
// Načela družine (nespremenjena, vsaka odstopitev = bug):
//  1. Refetch-on-focus prek družinskega hooka useRefetchOnFocus (30 s vrata
//     R170) — EN VIR loaderja (mount + fokus + 'Poskusi znova' + mutacije).
//  2. Pečat 'Osveženo ob' = čas zadnjega USPEŠNEGA branja primarnega vira;
//     napaka/omrežje → null (fail-closed — NIČ lažne svežine nad napako).
//  3. EN VIR RESNICE: casOznaka() (@/lib/osvezitev-fokus, sl-SI 24-urno s
//     sekundami) — komponente NE formatirajo pečata same (toLocaleTimeString
//     za pečat PREPOVEDAN; domensko formatiranje je dovoljeno).
//  4. tight-header klasni niz IDENTIČEN (hidden sm:flex + History +
//     tabular-nums + tooltip); Logistika = DOKUMENTIRANA polnvrstična
//     varianta R170 (ni defect); pečat viden TOČKO, ko stanje != null.
// Metapodatki setN/minNullN so preverjeni na dejanskih virih (R186 grep + 
// per-površinski testi rund ostajajo avtoriteta za SCOPED vzorce).
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const srcOf = (p: string): string => readFileSync(join(process.cwd(), p), 'utf8')

const TIGHT_HEADER_CLASS = 'className="hidden items-center gap-1 text-[11px] text-muted-foreground sm:flex"'
const TOOLTIP = 'title="Čas zadnje uspešne osvežitve podatkov"'
const HISTORY_ICON = /<History className="h-3 w-3 shrink-0" aria-hidden="true" \/>/
const HOOK_IMPORT = "import { useRefetchOnFocus } from '@/hooks/use-refetch-on-focus'"
const CAS_IMPORT = "import { casOznaka } from '@/lib/osvezitev-fokus'"

// KANONIČNA DRUŽINSKA TABELA — 20 površin (R170–R184).
// [ime, datoteka, stanje, setter, setN (natanko), minNullN (vsaj)]
//  • termini: stanje 'zdaj' je R170 posebnost — pečat IZ bralnega časa brez
//    ločenega stanja pečata (setZdaj tudi pomika agregate; minNull 1 =
//    konservativno, SCOPED trditve v r170).
//  • logistika: minNull 2 od 3 (tretja je metapodatkovni izvoz — domenska).
//  • vodja: fail-closed prek clearOnFail (ENA skupna točka, klicana iz vseh
//    3 fail poti) — minNull 1.
const DRUŽINA_20: Array<[string, string, string, string, number, number]> = [
  ['termini', 'termini-card', 'zdaj', 'setZdaj', 1, 1],
  ['logistika', 'logistics-tab', 'zadnjaOsvezitev', 'setZadnjaOsvezitev', 1, 2],
  ['dashboard', 'dashboard-tab', 'projektiOsvezitev', 'setProjektiOsvezitev', 1, 2],
  ['zaloga', 'inventory-tab', 'zalogaOsvezitev', 'setZalogaOsvezitev', 1, 2],
  ['dokumenti', 'documents-tab', 'dokumentiOsvezitev', 'setDokumentiOsvezitev', 2, 2],
  ['varnost', 'safety-tab', 'vremeOsvezitev', 'setVremeOsvezitev', 1, 2],
  ['CRM stranke', 'crm-tab', 'strankeOsvezitev', 'setStrankeOsvezitev', 1, 2],
  ['plošča', 'deal-pipeline', 'ploscaOsvezitev', 'setPloscaOsvezitev', 1, 2],
  ['ekipa', 'team-tab', 'ekipaOsvezitev', 'setEkipaOsvezitev', 1, 2],
  ['vodja', 'vodja-dashboard', 'vodjaOsvezitev', 'setVodjaOsvezitev', 1, 1],
  ['računi', 'invoice-manager', 'racuniOsvezitev', 'setRacuniOsvezitev', 1, 2],
  ['zapisnik', 'punch-list', 'zapisnikOsvezitev', 'setZapisnikOsvezitev', 1, 2],
  ['posli', 'jobs-panel', 'posliOsvezitev', 'setPosliOsvezitev', 1, 2],
  ['ponudbe', 'quote-followup', 'ponudbeOsvezitev', 'setPonudbeOsvezitev', 1, 3],
  ['obvestila', 'notification-center', 'obvestilaOsvezitev', 'setObvestilaOsvezitev', 1, 2],
  ['material', 'material-intelligence-tab', 'materialOsvezitev', 'setMaterialOsvezitev', 1, 2],
  ['fotografije', 'photo-tab', 'fotkeOsvezitev', 'setFotkeOsvezitev', 1, 2],
  ['meritve', 'measurements-tab', 'meritveOsvezitev', 'setMeritveOsvezitev', 2, 6],
  ['omejitve', 'rate-limit-panel', 'omejitveOsvezitev', 'setOmejitveOsvezitev', 1, 3],
  ['seje', 'sessions-dialog', 'sejeOsvezitev', 'setSejeOsvezitev', 1, 3],
]

const vir = (datoteka: string): string => srcOf(`src/components/roksal/${datoteka}.tsx`)

describe('ŽIVOSTNA DRUŽINA (kanon) — 20 površin: EN VIR casOznaka + družinski hook + tooltip', () => {
  it.each(DRUŽINA_20)('%s: casOznaka EN VIR + {casOznaka(%s)} + hook + tooltip', (ime, datoteka, stanje) => {
    const src = vir(datoteka)
    expect(src).toContain(CAS_IMPORT)
    expect(src).toContain(`{casOznaka(${stanje})}`)
    expect(src).toContain(HOOK_IMPORT)
    // tooltip: standardni niz POVŠOD; Logistika ima dokumentirano podaljšano
    // varianto ('... podatkov logistike' — R170 polnvrstična)
    expect(
      src.includes(TOOLTIP) || src.includes('title="Čas zadnje uspešne osvežitve podatkov logistike"'),
      `${ime}: manjka pečatov tooltip`,
    ).toBe(true)
    // History ikona v pečatu (vseh 20)
    expect(src).toMatch(HISTORY_ICON)
    // besedilo pečata
    expect(src).toContain('Osveženo ob')
  })

  it('kanon ima TOČNO 20 površin (nova površina = ENA vrstica + metapodatki + per-površinski opis v rundi)', () => {
    expect(DRUŽINA_20).toHaveLength(20)
    // datoteke v tabeli dejansko obstajajo (zaščita pred tipkarskimi napakami)
    for (const [, datoteka] of DRUŽINA_20) {
      expect(() => vir(datoteka), datoteka).not.toThrow()
    }
  })
})

describe('ŽIVOSTNA DRUŽINA (kanon) — fail-closed žičenje: set N× + null ≥ M×', () => {
  it.each(DRUŽINA_20)(
    '%s: %s natanko %i× set, vsaj %i× null (fail-closed pečat)',
    (ime, datoteka, _stanje, setter, setN, minNullN) => {
      const src = vir(datoteka)
      expect(
        src.split(`${setter}(new Date())`).length - 1,
        `${ime}: število ${setter}(new Date())`,
      ).toBe(setN)
      expect(
        src.split(`${setter}(null)`).length - 1,
        `${ime}: število ${setter}(null)`,
      ).toBeGreaterThanOrEqual(minNullN)
    },
  )
})

describe('ŽIVOSTNA DRUŽINA (kanon) — tight-header klasni niz', () => {
  const BREZ_LOGISTIKE = DRUŽINA_20.filter(([ime]) => ime !== 'logistika')

  it.each(BREZ_LOGISTIKE)('%s: tight-header klasni niz IDENTIČEN (hidden sm:flex) + standardni tooltip', (ime, datoteka) => {
    const src = vir(datoteka)
    expect(src).toContain(TIGHT_HEADER_CLASS)
    expect(src).toContain(TOOLTIP)
  })

  it('logistika: DOKUMENTIRANA polnvrstična varianta R170 (Osveženo ob v polni vrstici, ni defect)', () => {
    const src = vir('logistics-tab')
    expect(src).toContain('Osveženo ob <span className="tabular-nums">{casOznaka(zadnjaOsvezitev)}</span>')
    expect(src).toContain('title="Čas zadnje uspešne osvežitve podatkov logistike"')
  })
})
