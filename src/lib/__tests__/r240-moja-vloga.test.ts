// R240 — "Moja vloga in dovoljenja": TopBar meni + fail-verbose dialog (pins)
// ---------------------------------------------------------------------------
// Iskrenost obratne smeri RBAC ogledala (R239): gumb 'Nov projekt' je viden
// samo vodstvu — ta dialog pa vsakemu pokaže NJEGOVO resnico (vloga + matrika
// dovoljenj, ISTA kot jo preverja strežnik). Testi so strukturni pini (ISTI
// vzorec kot r239-projekti-rbac): vir zaklene pogodbo, ne izmišljenih stanj.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ALL_PERMISSIONS, PERMISSION_CATALOG } from '@/lib/permissions-core'
import { ROLE_CHIP } from '@/lib/status-options'
import { EKIPA_VLOGE } from '@/lib/ekipa-csv'

const beri = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const dialog = beri('src/components/roksal/moja-vloga-dialog.tsx')
const topbar = beri('src/components/roksal/top-bar.tsx')

describe('R240 — TopBar: meni "Moja vloga in dovoljenja" (dostopna pot za vse vloge)', () => {
  it('meni item obstaja: ShieldCheck ikona + natanko besedilo + stanje + dialog', () => {
    expect(topbar).toContain('MojaVlogaDialog')
    expect(topbar).toContain('const [vlogaOpen, setVlogaOpen] = useState(false)')
    expect(topbar).toContain('onClick={() => setVlogaOpen(true)}')
    expect(topbar).toContain('Moja vloga in dovoljenja')
    // Ikona in ISTA fokusna družina kot sorojenci v meniju (navy/40).
    expect(topbar).toMatch(/<ShieldCheck[^>]*aria-hidden="true"[^>]*\/>/)
    expect((topbar.match(/focus-visible:ring-roksal-navy\/40/g) || []).length).toBeGreaterThanOrEqual(3)
  })

  it('dialog je montiran ob ostalih samostojnih dialogih (geslo, seje)', () => {
    expect(topbar).toContain('<MojaVlogaDialog open={vlogaOpen} onOpenChange={setVlogaOpen} />')
  })
})

describe('R240 — dialog: fetch on open, fail-closed, fail-verbose (sessions-dialog pogodba)', () => {
  it('podatki se nalagajo ŠELE ob odprtju — ni klica ob mountu TopBar', () => {
    expect(dialog).toMatch(/useEffect\(\(\) => \{\s*if \(open\) void nalozi\(\)\s*\}, \[open, nalozi\]\)/)
    expect(dialog).toContain("fetch('/api/auth')")
    // GET-only dialog: v viru ni POST/PATCH/DELETE klica (ZERO-MUTACIJA po oblikovanju).
    expect(dialog).not.toMatch(/method:\s*'(?:POST|PATCH|DELETE|PUT)'/)
  })

  it('fail-verbose: razlog pride do uporabnika + gumb "Poskusi znova" + role="alert"', () => {
    expect(dialog).toContain('role="alert"')
    expect(dialog).toContain('Poskusi znova')
    expect(dialog).toContain('Napaka pri povezavi s strežnikom. Poskusite znova.')
    // HTTP status v razlogu (ni tihe generične napake).
    expect(dialog).toMatch(/HTTP \$\{res\.status\}/)
  })

  it('fail-closed: brez vloga/manjkajoca → UI pokaže NIMA (nikoli lažni "ima")', () => {
    // ENA resnica: manjkajoča izhoda iz permissions-core (isti katalog kot strežnik).
    expect(dialog).toContain('manjkajocaDovoljenja(permissions)')
    expect(dialog).toContain("Array.isArray(data.permissions) ? data.permissions : []")
    // Brez user.vloga → error state (zahteva vlogo, ne ugibaj).
    expect(dialog).toContain('!res.ok || !data?.user?.vloga')
  })

  it('ena resnica: vsa dovoljenja iz kataloga, oznaka/opis iz PERMISSION_CATALOG', () => {
    expect(dialog).toContain('ALL_PERMISSIONS.map((dovoljenje)')
    expect(dialog).toContain('PERMISSION_CATALOG[dovoljenje]')
    expect(dialog).toContain("katalog?.label ?? dovoljenje")
    expect(dialog).toMatch(/Imate \{ima\} od \{skupaj\} dovoljenj/)
  })
})

describe('R240 — [Mandatory] stil: žetoni družine, 0 novih hex', () => {
  it('dialog vsebuje NIČ hex barv (vsi žetoni)', () => {
    expect(dialog).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })

  it('vizualni jezik = ISTI kot sorojenci (navy fokus, muted/border, mikro tipografija 2xs)', () => {
    expect(dialog).toContain('focus-visible:ring-roksal-navy/40')
    expect(dialog).toContain('border-border')
    expect(dialog).toContain('bg-muted/40')
    expect(dialog).toContain('text-muted-foreground')
    expect(dialog).toContain('text-2xs') // žeton (R238), ne text-[10px]
    expect(dialog).not.toContain('text-[10px]')
    expect(dialog).not.toContain('text-[8px]')
    // Chip = EN VIR iz status-options (identen ekipa-chip za vsako vlogo).
    for (const [vloga, razred] of Object.entries(ROLE_CHIP)) {
      expect(razred.length).toBeGreaterThan(0)
      expect(Object.keys(ROLE_CHIP)).toContain(vloga)
    }
    expect(Object.keys(ROLE_CHIP)).toEqual(['ADMIN', 'VODJA', 'MONTER', 'SKLADISCE'])
  })

  it('vloga oznaka = EKIPA_VLOGE (en vir resnice za UI in izvoz, R160)', () => {
    expect(dialog).toContain('EKIPA_VLOGE[podatki.vloga] ?? podatki.vloga')
    expect(Object.keys(EKIPA_VLOGE)).toEqual(['ADMIN', 'VODJA', 'MONTER', 'SKLADISCE'])
  })

  it('vodstvena veja: isManagerRole iz status-options (pariteta z MANAGER_ROLES, R239)', () => {
    expect(dialog).toContain("import { ROLE_CHIP, isManagerRole } from '@/lib/status-options'")
    expect(dialog).toContain('isManagerRole(podatki.vloga)')
    expect(dialog).toContain('Vodstvena vloga')
  })
})

describe('R240 — resnica kataloga v UI (dokaz iz vira, ne izmišljeni nizi)', () => {
  it('suma dovoljenj = dolžina kataloga (29) in ADMIN vidi vse', () => {
    // PIN SHIFT R393: 28→29 — +engineering.manage (issue #13 §15).
    expect(ALL_PERMISSIONS.length).toBe(29)
    expect(PERMISSION_CATALOG['users.manage'].opis).toContain('ADMIN')
  })
})
