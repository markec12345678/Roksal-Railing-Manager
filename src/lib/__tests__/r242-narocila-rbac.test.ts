// ---------------------------------------------------------------------------
// R242 — P1-i wave 4: RBAC UI ogledalo na Naročila površini
// (material-intelligence-tab) + PDF dolžinski zaklep (glifni subset).
// ---------------------------------------------------------------------------
//   • API vrata obstajajo že od R135/§10: PATCH /api/material-orders —
//     prehodi ≠ DOBLJENO → procurement.approve, DOBLJENO → approve ALI
//     receive ("prejem je skladiščna operacija"); POST → procurement.create.
//     UI do R242 ni poznal pravic: MONTER (brez procurement.*) je videl VSE
//     štiri akcije (vsak klik = 403), SKLADISCE (samo procurement.receive)
//     je videl akcije, ki mu API prepove (samo DOBLJENO je njegov prehod).
//   • R242 ogledalo (TOČNO R239/R241 vzorec):
//       – pravice z GET /api/auth (EN VIR RESNICE, R135), fetch-on-mount,
//         napaka → [] (fail-closed);
//       – vrata po TOČNI API matriki: Označi-kot-poslano/Potrdi/Prekliči =
//         lahkoOdobri, Dobljeno = lahkoPrejme (approve ALI receive);
//       – obrambni AND v handleOrderStatus (vrata v vratah, R239) + AND na
//         odpiranju prejemnega/preklicnega dialoga;
//       – vlogo-osveščen vodič samoBranjeNarocil — viden ŠELE ko pravice
//         znane (null = tišina), navaja TOČNO imeni pravic iz vrat;
//       – fail-verbose: forbidden() {error, detail} — detail PRED error
//         (R241 vzorec; generični 'Prepovedano' ne sme zasenčiti razloga).
//   • [Mandatory] stil — press-scale pariteta ISTIH akcij čez kontekste:
//     izvozne pilule Naročila/Dobavitelji + Nov dobavitelj CTA + štirje
//     statusni prehodi + Osnutek dialog footer (CSV/PDF/Shrani) dozdaj brez
//     mikro-pritiska, sorojenci v headerju pa z njim — zdaj ISTI jezik;
//     vodič izključno žetoni (0 novih hex v obeh datotekah).
//
// Strukturni pini (r238/r240/r241 vzorec): vir = EDINA resnica za UI pogojno
// upodabljanje; test čita SOURCE, ne render (jsdom ne nosi Radix+fetch mreže).
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { permissionsForRole } from '@/lib/permissions-core'

const ROUTE = path.join(__dirname, '../../app/api/material-orders/route.ts')
const UI = path.join(__dirname, '../../components/roksal/material-intelligence-tab.tsx')
const INV = path.join(__dirname, '../../components/roksal/inventory-tab.tsx')

const routeSrc = readFileSync(ROUTE, 'utf8')
const uiSrc = readFileSync(UI, 'utf8')
const invSrc = readFileSync(INV, 'utf8')

describe('R242 — API vrata PATCH /api/material-orders (dokumentacija matrike)', () => {
  it('matrika approve/receive: prehod ≠ DOBLJENO rabi approve, DOBLJENO zadostuje receive', () => {
    expect(routeSrc).toContain("hasPermission(auth, 'procurement.approve')")
    expect(routeSrc).toContain("hasPermission(auth, 'procurement.receive')")
    // vrata v vratah na ruti — ISTA logika, ki jo UI ogleduje
    expect(routeSrc).toContain("!canApprove && !canReceive")
    expect(routeSrc).toContain("!canApprove && status !== 'DOBLJENO'")
  })

  it('POST vrata: procurement.create (ustvarjanje naročila)', () => {
    expect(routeSrc).toContain("denyWithoutPermission(request, 'procurement.create')")
  })

  it('403 nosita človeku razumljiva razloga (fail-verbose vir, R140/R241)', () => {
    expect(routeSrc).toContain(
      'Sprememba naročil je pravica vodstva (procurement.approve); skladišče sme samo prejem (procurement.receive).',
    )
    expect(routeSrc).toContain(
      'Skladišče lahko naročilo samo prejme (DOBLJENO) — ostale prehode ureja vodstvo (procurement.approve).',
    )
  })
})

describe('R242 — UI fail-closed izpeljava pravic (EN VIR: GET /api/auth)', () => {
  it('pravice prihajajo iz GET /api/auth (R135 EN VIR RESNICE, fetch-on-mount)', () => {
    expect(uiSrc).toContain("fetch('/api/auth')")
    expect(uiSrc).toContain('data.permissions as readonly string[]')
    // alive guard — ne-državno tekmovanje ob odmontiranju ne piše stanja
    expect(uiSrc).toMatch(/let alive = true[\s\S]*alive = false/)
  })

  it('izpeljava je fail-closed: ?? false, nikoli ?? true / || true', () => {
    expect(uiSrc).toContain("myPermissions?.includes('procurement.approve') ?? false")
    expect(uiSrc).toContain("myPermissions?.includes('procurement.receive') ?? false")
    // prepovedana tiha inflacija pravic:
    expect(uiSrc).not.toMatch(/\?\?\s*true/)
    expect(uiSrc).not.toMatch(/\|\|\s*true/)
  })

  it('lahkoPrejme = approve ALI receive (ISTA disjunkcija kot API za DOBLJENO)', () => {
    expect(uiSrc).toMatch(
      /const lahkoPrejme =\s*\n\s*lahkoOdobri \|\| \(myPermissions\?\.includes\('procurement\.receive'\) \?\? false\)/,
    )
  })

  it('samoBranjeNarocil izgovarja resnico ŠELE ko je pravicni seznam znan (null = tišina)', () => {
    expect(uiSrc).toContain(
      'myPermissions !== null && !lahkoOdobri && !lahkoPrejme',
    )
  })
})

describe('R242 — UI vrata: štirje statusni prehodi pogojno upodobljeni po matriki', () => {
  it('Označi kot poslano (OSNUTEK→POSLANO) = procurement.approve', () => {
    expect(uiSrc).toContain("{order.status === 'OSNUTEK' && lahkoOdobri && (")
  })

  it('Potrdi (POSLANO→POTRJENO) = procurement.approve', () => {
    expect(uiSrc).toContain("{order.status === 'POSLANO' && lahkoOdobri && (")
  })

  it('Dobljeno (v zalogo) (POTRJENO→DOBLJENO) = approve ALI receive (lahkoPrejme)', () => {
    expect(uiSrc).toContain("{order.status === 'POTRJENO' && lahkoPrejme && (")
  })

  it('Prekliči (≠DOBLJENO prehod) = procurement.approve', () => {
    expect(uiSrc).toContain("order.status === 'POTRJENO') && lahkoOdobri && (")
  })

  it('obrambni AND v handleOrderStatus — ISTA disjunkcija kot API (vrata v vratah)', () => {
    expect(uiSrc).toMatch(
      /if \(!lahkoOdobri && !lahkoPrejme\) return[\s\S]*if \(!lahkoOdobri && status !== 'DOBLJENO'\) return/,
    )
  })

  it('obrambni AND na odpiranju prejemnega IN preklicnega dialoga (R239 vrata v vratah)', () => {
    expect(uiSrc).toContain('{ if (!lahkoPrejme) return; setReceiveDialogOrderId(order.id); }')
    expect(uiSrc).toContain('{ if (!lahkoOdobri) return; setCancelDialogOrderId(order.id); }')
  })
})

describe('R242 — vlogo-osveščen vodič (samo za gledalca brez pisalnih pravic)', () => {
  it('vodič navaja TOČNO imeni pravic iz API vrat (pariteta imen)', () => {
    expect(uiSrc).toContain('procurement.approve</span>')
    expect(uiSrc).toContain('procurement.receive</span>')
  })

  it('vodič je role="note" z aria-label (a11y družina R241) in brez kazalca na gumb', () => {
    expect(uiSrc).toContain('role="note"')
    expect(uiSrc).toContain('aria-label="Naročila so za branje — upravljanje zahteva pravice"')
    // nikoli kazalec na skriti gumb: besedilo vodiča (omejen blok) NE
    // omenja klikov/gumbov — samo pravice in vloge (R241 pariteta)
    const zacetek = uiSrc.indexOf('Pregled naročil je samo za branje')
    const konec = uiSrc.indexOf('{loading && orders.length === 0', zacetek)
    const vodic = uiSrc.slice(zacetek, konec)
    expect(vodic).not.toMatch(/klikni|gumb /)
  })

  it('vodič izključno žetoni (text-2xs + muted-foreground + bg-muted/40 — 0 novih hex)', () => {
    expect(uiSrc).toContain('rounded-lg border border-border bg-muted/40 px-3 py-2 text-2xs text-muted-foreground')
  })
})

describe('R242 — fail-verbose: detail PRED error (R241 vzorec)', () => {
  it('PATCH napaka prebere {error, detail} — razlog pride do uporabnika', () => {
    expect(uiSrc).toMatch(/\{ error\?: string; detail\?: string \}/)
    expect(uiSrc).toContain("data?.detail?.trim() || data?.error?.trim() || `HTTP ${res.status}`")
  })
})

describe('R242 — [Mandatory] stil: press-scale pariteta ISTIH akcij čez kontekste', () => {
  it('material-intelligence: izvoza Naročila CSV + Dobavitelji CSV/PDF + Nov dobavitelj CTA', () => {
    expect(uiSrc).toContain('"h-8 text-xs press-scale focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-1"')
    expect(uiSrc).toContain('"h-6 gap-1 text-2xs press-scale focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-1"')
    expect(uiSrc).toContain('"w-full bg-roksal-navy text-white shadow-sm press-scale focus-visible:ring-2 focus-visible:ring-roksal-navy/40"')
  })

  it('material-intelligence: vsi štirje statusni prehodi nosijo mikro-pritisk (19× press-scale — R333)', () => {
    // R245 sinhronizacija: 12 (R242 8 + R243 2 + R244 cenik pilli 2) +
    // 2 primerjalni pilli (CSV + PDF, ISTI pill razredi kot cenik par) = 14;
    // R257: +1 orders PDF pill (13. člen 'izvozi' družine) = 15;
    // R262: +2 = 1 pokritost pill className (18. člen) + 1 pill komentar
    // (regex šteje TUDI komentarje — R259 lekcija 2, dokumentirano) = 17;
    // R264: +1 pozicija pill className (20. člen, komentar BREZ besede
    // press-scale — števec predvidljiv) = 18;
    // R333: +1 pozicija CSV pill className (60. člen — CSV brat, ISTI žeton
    // kot PDF brat, komentar BREZ besede press-scale — števec predvidljiv) = 19
    const stevec = (uiSrc.match(/press-scale/g) ?? []).length
    expect(stevec).toBe(19)
  })

  it('inventory Osnutek dialog footer: CSV/PDF/Shrani = ISTI jezik kot header pilule sorojenci', () => {
    // dialog footer CSV + PDF (gap-1.5) + Shrani osnutek primarni
    expect(invSrc).toContain('"gap-1.5 press-scale focus-visible:ring-2 focus-visible:ring-roksal-navy/40 disabled:opacity-50"')
    expect(invSrc).toContain('"bg-roksal-navy hover:bg-roksal-navy/90 text-white shadow-sm transition-all press-scale focus-visible:ring-2 focus-visible:ring-roksal-navy/40 disabled:opacity-50"')
  })

  it('0 novih hex: material-intelligence-tab ostane brez literalnih barv (žetoni)', () => {
    const hexi = uiSrc.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []
    expect(hexi).toEqual([])
  })
})

describe('R242 — matrična pariteta vlog (permissions-core EN VIR, R241 vzorec)', () => {
  const ROLE_UI_VRATA = {
    // pričakovana izpeljava UI iz matrike: lahkoOdobri / lahkoPrejme
    ADMIN: { odobri: true, prejme: true },
    VODJA: { odobri: true, prejme: true },
    MONTER: { odobri: false, prejme: false },
    SKLADISCE: { odobri: false, prejme: true },
  } as const

  it('MONTER (11) nima nobene procurement pravice → vse akcije skrite, vodič viden', () => {
    const p = permissionsForRole('MONTER')
    expect(p.length).toBe(11)
    expect(p.includes('procurement.approve')).toBe(false)
    expect(p.includes('procurement.receive')).toBe(false)
    expect(p.includes('procurement.create')).toBe(false)
    expect(ROLE_UI_VRATA.MONTER.odobri || ROLE_UI_VRATA.MONTER.prejme).toBe(false)
  })

  it('SKLADISCE (7) = samo procurement.receive → vidi SAMO Dobljeno (v zalogo)', () => {
    const p = permissionsForRole('SKLADISCE')
    expect(p.length).toBe(7)
    expect(p.includes('procurement.receive')).toBe(true)
    expect(p.includes('procurement.approve')).toBe(false)
    expect(ROLE_UI_VRATA.SKLADISCE).toEqual({ odobri: false, prejme: true })
  })

  it('ADMIN/VODJA nosita obe pravici → vsi štirje prehodi vidni (pozitivna veja)', () => {
    for (const vloga of ['ADMIN', 'VODJA'] as const) {
      const p = permissionsForRole(vloga)
      expect(p.includes('procurement.approve')).toBe(true)
      expect(p.includes('procurement.receive')).toBe(true)
    }
  })
})
