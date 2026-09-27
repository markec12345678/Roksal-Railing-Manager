// R228 — NOVA TEMA (konvergenčna serija zaključena na 10 površinah R221–R227):
// zanesljivost dobav — 'Zamujena dobava' v vodjinem pregledu.
//
// Prej: vodja je videla 'odprta naročila' (navy — INFORMACIJA) in 'potekle
// opomnike' strank (red — ALARM), NI pa zamujenih dobav MATERIALA: naročilo
// z obljubljenim datumom dobave v preteklosti, ki še ni prejeto, je izgledalo
// kot 'čaka na dobavo' — obljuba brez izpolnitve je bila nevidna.
//
// Zdaj: (1) lib zamujena-dobava — jeZamujenaDobava (stroga veja: status
// dobesedno OSNUTEK/POSLANO/POTRJENO + datumDobave izrecen niz + veljaven
// datum + STROGO pred današnjo polnočjo; fail-closed: manjkajoča/pokvarena
// obljuba NIKOLI ni zamuda) + steviloZamujenihDobav (fail-verbose TypeError
// na ne-seznam) + narociloBeseda (slovenske oblike R220 vzorec);
// (2) vodja pregled — kartica ALARM (roksal-red družina) med brez-dobavitelja
// in odprtimi naročili, klik → Material → Naročila (subTab 'orders', R208
// protokol); (3) iskreno 'vse v redu' zahteva TUDI zamujeneDobave === 0;
// (4) CSV vodje vrstica 'Opozorila','Zamujena dobava' (IZVOŽENO = ZASLON —
// tudi ko je 0) + PDF opozorila vrstica (ISTO besedilo dimenzije).
//
// + [Mandatory] stil: team-tab — zadnje trdo kodirane stone klase → žetoni
//   (en razred obe temi): AVATAR_TINT[3] + STATUS_META.Deaktiviran chip →
//   bg-muted/text-muted-foreground; deaktivirana obroba → border-border
//   (deaktiviranost nosita chip + ikona + title — barvni dvojček odveč);
//   Deaktiviraj gumb → text-muted-foreground. 0 novih hex; r165/r227 PINi
//   sinhronizirani (stone IZGINIL, rdeča Zaklenjen ostaja).
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { jeZamujenaDobava, steviloZamujenihDobav, narociloBeseda } from '@/lib/zamujena-dobava'

function beri(rel: string): string {
  return readFileSync(join(process.cwd(), rel), 'utf8')
}

const vodja = beri('src/components/roksal/vodja-dashboard.tsx')
const csvLib = beri('src/lib/vodja-csv.ts')
const pdfLib = beri('src/lib/boss-report-pdf.ts')
const team = beri('src/components/roksal/team-tab.tsx')
const zamLib = beri('src/lib/zamujena-dobava.ts')

const DANAS = new Date('2026-09-28T00:00:00')
const VCERAJ = '2026-09-27T00:00:00.000Z'
const PRED_TEDNOM = '2026-09-21T00:00:00.000Z'
const DANES = '2026-09-28T14:00:00.000Z'
const JUTRI = '2026-09-29T00:00:00.000Z'

describe('R228 — lib jeZamujenaDobava: stroge veje (fail-closed)', () => {
  it('POSLANO + izrecen pretekel datum = zamujen', () => {
    expect(jeZamujenaDobava({ status: 'POSLANO', datumDobave: VCERAJ }, DANAS)).toBe(true)
  })

  it('OSNUTEK in POTRJENO sta prav tako odprta stanja', () => {
    expect(jeZamujenaDobava({ status: 'OSNUTEK', datumDobave: PRED_TEDNOM }, DANAS)).toBe(true)
    expect(jeZamujenaDobava({ status: 'POTRJENO', datumDobave: PRED_TEDNOM }, DANAS)).toBe(true)
  })

  it('DOBLJENO in PREKLICANO NIKOLI (zaprti statusi)', () => {
    expect(jeZamujenaDobava({ status: 'DOBLJENO', datumDobave: PRED_TEDNOM }, DANAS)).toBe(false)
    expect(jeZamujenaDobava({ status: 'PREKLICANO', datumDobave: PRED_TEDNOM }, DANAS)).toBe(false)
    expect(jeZamujenaDobava({ status: 'NEZNAN', datumDobave: PRED_TEDNOM }, DANAS)).toBe(false)
  })

  it('manjkajoč datum (null/undefined) = NI zamuden (manjkajoča obljuba ni prekršek)', () => {
    expect(jeZamujenaDobava({ status: 'POSLANO', datumDobave: null }, DANAS)).toBe(false)
    expect(jeZamujenaDobava({ status: 'POSLANO' }, DANAS)).toBe(false)
  })

  it('prazen niz = NI zamuden (fail-closed)', () => {
    expect(jeZamujenaDobava({ status: 'POSLANO', datumDobave: '' }, DANAS)).toBe(false)
  })

  it('pokvaren datum (NaN) = NI zamuden (fail-closed)', () => {
    expect(jeZamujenaDobava({ status: 'POSLANO', datumDobave: 'ni-datum' }, DANAS)).toBe(false)
  })

  it('meja: obljubljen ZA DANES še NI zamuden (dan traja do polnoči), včeraj JA', () => {
    expect(jeZamujenaDobava({ status: 'POSLANO', datumDobave: DANES }, DANAS)).toBe(false)
    expect(jeZamujenaDobava({ status: 'POSLANO', datumDobave: JUTRI }, DANAS)).toBe(false)
    expect(jeZamujenaDobava({ status: 'POSLANO', datumDobave: VCERAJ }, DANAS)).toBe(true)
  })
})

describe('R228 — lib steviloZamujenihDobav + narociloBeseda', () => {
  it('šteje SAMO zamujene od odprtih (mešan vhod)', () => {
    const n = steviloZamujenihDobav(
      [
        { status: 'POSLANO', datumDobave: VCERAJ },
        { status: 'POSLANO', datumDobave: JUTRI },
        { status: 'DOBLJENO', datumDobave: PRED_TEDNOM },
        { status: 'POSLANO', datumDobave: null },
      ],
      DANAS,
    )
    expect(n).toBe(1)
  })

  it('fail-verbose: ne-seznam → TypeError (jedro nikoli ne laže)', () => {
    expect(() => steviloZamujenihDobav('ne-seznam' as unknown as readonly unknown[], DANAS)).toThrow(TypeError)
    expect(() => steviloZamujenihDobav(null as unknown as readonly unknown[], DANAS)).toThrow(TypeError)
  })

  it('pokvarjeni vnosi se NE štejejo (fail-closed — brez lažnega žiga)', () => {
    const n = steviloZamujenihDobav(
      [null, 'x', 42, { datumDobave: VCERAJ }, { status: 5, datumDobave: VCERAJ }, { status: 'POSLANO', datumDobave: 7 }],
      DANAS,
    )
    expect(n).toBe(0)
  })

  it('prazen seznam = 0 (veljaven, ne napaka)', () => {
    expect(steviloZamujenihDobav([], DANAS)).toBe(0)
  })

  it('STROGOST v viru: dobesedni statusi, brez privzetih ničel ohlapnosti', () => {
    expect(zamLib).toContain("o.status === 'OSNUTEK' || o.status === 'POSLANO' || o.status === 'POTRJENO'")
    expect(zamLib).toContain('Number.isNaN(obljuba.getTime())')
    expect(zamLib).not.toContain('datumDobave ?? ')
    expect(zamLib).not.toContain('<= 0')
  })

  it('narociloBeseda: slovenske oblike (1 naročilo / 2 naročili / 3-4 naročila / drugo naročil)', () => {
    expect(narociloBeseda(1)).toBe('naročilo')
    expect(narociloBeseda(2)).toBe('naročili')
    expect(narociloBeseda(3)).toBe('naročila')
    expect(narociloBeseda(4)).toBe('naročila')
    expect(narociloBeseda(8)).toBe('naročil')
    expect(narociloBeseda(0)).toBe('naročil')
  })

  it('narociloBeseda: pokvarjen vnos → TypeError (determinizem, brez ugibanja)', () => {
    expect(() => narociloBeseda(-1)).toThrow(TypeError)
    expect(() => narociloBeseda(1.5)).toThrow(TypeError)
    expect(() => narociloBeseda(NaN)).toThrow(TypeError)
  })
})

describe('R228 — vodja pregled: kartica + iskreno vse-v-redu + EN VIR', () => {
  it('EN VIR: steviloZamujenihDobav iz ISTEGA orders fetcha (brez nove zahteve)', () => {
    expect(vodja).toContain("import { steviloZamujenihDobav, narociloBeseda } from '@/lib/zamujena-dobava'")
    expect(vodja).toContain('const zamujeneDobave = steviloZamujenihDobav(')
  })

  it('kartica: ALARM rdeča družina + CalendarX + tabular-nums + slovenske oblike', () => {
    expect(vodja).toContain('border-roksal-red/20 bg-roksal-red/5')
    expect(vodja).toContain('<CalendarX className="h-4 w-4 shrink-0 text-roksal-red"')
    expect(vodja).toContain('{stats.zamujeneDobave > 0 && (')
    expect(vodja).toContain('{narociloBeseda(stats.zamujeneDobave)}')
  })

  it('kartica: iskren aria-label + title + klik → Material → Naročila (R208 subTab protokol)', () => {
    expect(vodja).toContain('aria-label={`Zamujena dobava (${stats.zamujeneDobave}) — odpre Material → Naročila`}')
    expect(vodja).toContain('title="Obljubljeni datum dobave je pretekel, naročilo pa še ni prejeto"')
    expect(vodja).toContain("detail: { tab: 'more', more: 'material', subTab: 'orders' }")
  })

  it('iskreno vse-v-redu: zahteva TUDI zamujeneDobave === 0 (R224 lekcija)', () => {
    expect(vodja).toContain(
      'stats.potekliOpomniki === 0 && stats.nizkaZaloga === 0 && stats.odprtaNarocila === 0 && stats.brezDobavitelja === 0 && stats.zamujeneDobave === 0',
    )
  })

  it('stats interface nosi zamujeneDobave (tipizirana resnica)', () => {
    expect(vodja).toContain('zamujeneDobave: number')
  })
})

describe('R228 — IZVOŽENO = ZASLON: CSV + PDF (ISTO besedilo dimenzije)', () => {
  it('CSV vodje: vrstica Opozorila/Zamujena dobava VEDNO prisotna (tudi ko 0)', () => {
    expect(csvLib).toContain("lines.push(kpiLine('Opozorila', 'Zamujena dobava', String(counter(kpi.zamujeneDobave, 'zamujeneDobave'))))")
    expect(csvLib).toContain('zamujeneDobave: number')
  })

  it('PDF: stats tip + opozorila vrstica (ISTO besedilo kot zaslon)', () => {
    expect(pdfLib).toContain('zamujeneDobave: number')
    expect(pdfLib).toContain('if (s.zamujeneDobave > 0) opozorila.push(')
    expect(pdfLib).toContain('z pretečenim rokom dobave — izterjaj dobavo pri dobavitelju')
  })
})

describe('R228 — [Mandatory] stil: team-tab 100 % na žetonih (0 novih hex, stone izginil)', () => {
  it('team-tab: NI več stone klas', () => {
    expect(team).not.toContain('stone-')
  })

  it('AVATAR_TINT nevtralni ton + Deaktiviran chip na žetonih (en razred obe temi)', () => {
    expect(team).toContain("'bg-muted text-muted-foreground',")
    expect(team).toContain("chip: 'bg-muted text-muted-foreground',")
  })

  it('deaktivirana vrstica na žetonu border-border (rdeča Zaklenjen ostaja — PIN r165/r227)', () => {
    expect(team).toContain("'border-border opacity-75'")
    expect(team).toContain('border-roksal-red/40 dark:border-roksal-red/50')
  })

  it('Deaktiviraj gumb na žetonu text-muted-foreground', () => {
    expect(team).toContain('className="h-7 text-[11px] text-muted-foreground hover:bg-secondary"')
  })
})
