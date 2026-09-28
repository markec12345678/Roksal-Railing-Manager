// ---------------------------------------------------------------------------
// R244 — P1-i wave 6: RBAC UI ogledalo na Logistika površini (logistics-tab:
// termini + oprema) — ZADNJA večja pisalna površina brez ogledala.
// ---------------------------------------------------------------------------
//   • API vrata obstajajo že od §10/R135 (NIČ nove logike na API — ogledalo
//     samo bere pravice in skriva gumbe, TOČNO R239/R241/R242/R243 vzorec):
//       – POST /api/schedules (nov termin) → production.manage;
//       – PATCH /api/schedules (statusni prehodi: začetek / preložitev /
//         zaključitev / QC finalize / override) → production.manage (×2
//         dodatni PATCH/DELETE vrati — iz UI jih kliče samo prek handlerjev);
//       – POST /api/crews {type:'equipment'} (nova oprema) → production.manage;
//       – PATCH /api/equipment (statusni prehodi opreme) → production.manage;
//       – POST /api/equipment/events (dogodek: pregled/kalibracija/servis) →
//         production.manage.
//   • UI do R244 ni poznal pravic na logistiki: MONTER je videl 'Nov termin
//     montaže', 'Začni montažo', 'Preloži', 'Zaključi (preverba + odštej
//     material)', 'Nova oprema', statusne prehode opreme in 'Zabeleži
//     dogodek' — vsak pisalni klik bi končal s 403 (API vrata iz §10).
//   • Ogledalo (TOČNO R243 vzorec): pravice z GET /api/auth (EN VIR RESNICE),
//     fetch-on-mount z alive guardom, napaka → []; fail-closed izpeljava
//     (?? false, NIKOLI tiha inflacija); med nalaganjem (null) akcije SKRITE
//     (tišina je iskrena, least privilege); obrambni AND v VSEH osmih
//     handlerjih + vrata na odpiranju dialogov in submitih (vrata v vratah);
//     vlogo-osveščeni vodiči navajajo TOČNO ime pravice, role="note" +
//     aria-label, izključno žetoni (0 novih hex).
//   • Bralni tokovi ostanejo VSEM (P1-k precedens — odjemalski dokumenti in
//     pregledi): CSV/ICS izvoz terminov, zgodovina dogodkov ('Zabeleži'
//     odpre dialog z zgodovino — gated je SAMO pisalni submit),
//     'Montažno dokazilo' (evidence route = project-access vrata, druga
//     plast — izven vala 6, dokumentirano).
//   • [Mandatory] stil — press-scale pariteta (mikro-pritisk) na vseh
//     primarnih CTA in dialog submitih logistike + token migracija
//     accent-[#1d2b3e] → accent-roksal-navy (arbitrary → žeton, 4 mesta;
//     dinamični crew barva fallback v style propu ostane — JS vrednost, ne
//     stilski razred, dokumentirana izjema).
//
// Strukturni pini (r238/r240/r241/r242/r243 vzorec): vir = EDINA resnica za
// UI pogojno upodabljanje; test čita SOURCE, ne render (jsdom ne nosi
// Radix+fetch mreže).
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { permissionsForRole } from '@/lib/permissions-core'

const SCHED_ROUTE = path.join(__dirname, '../../app/api/schedules/route.ts')
const CREWS_ROUTE = path.join(__dirname, '../../app/api/crews/route.ts')
const EQUIP_ROUTE = path.join(__dirname, '../../app/api/equipment/route.ts')
const EVENTS_ROUTE = path.join(__dirname, '../../app/api/equipment/events/route.ts')
const LOG_UI = path.join(__dirname, '../../components/roksal/logistics-tab.tsx')

const schedRoute = readFileSync(SCHED_ROUTE, 'utf8')
const crewsRoute = readFileSync(CREWS_ROUTE, 'utf8')
const equipRoute = readFileSync(EQUIP_ROUTE, 'utf8')
const eventsRoute = readFileSync(EVENTS_ROUTE, 'utf8')
const logUi = readFileSync(LOG_UI, 'utf8')

describe('R244 — API vrata (dokumentacija matrike, 4 rute / 6 vrat)', () => {
  it('POST /api/schedules (nov termin) → production.manage', () => {
    expect(schedRoute).toContain("denyWithoutPermission(request, 'production.manage')")
  })
  it('schedules: 3 vrata (POST + PATCH + DELETE) — vse pisalne metode gated', () => {
    const calls = schedRoute.split("denyWithoutPermission(request, 'production.manage')").length - 1
    expect(calls).toBe(3)
  })
  it('POST /api/crews (nova oprema prek type:equipment) → production.manage', () => {
    expect(crewsRoute).toContain("denyWithoutPermission(request, 'production.manage')")
  })
  it('PATCH /api/equipment (statusni prehodi opreme) → production.manage', () => {
    expect(equipRoute).toContain("denyWithoutPermission(request, 'production.manage')")
  })
  it('POST /api/equipment/events (pregled/kalibracija/servis) → production.manage', () => {
    expect(eventsRoute).toContain("denyWithoutPermission(request, 'production.manage')")
  })
  it('NIČ sprememb na API strani vala 6: število vrat nespremenjeno (ogledalo samo bere)', () => {
    // Pin paritete (r243 vzorec): ogledalo NE doda in NE odstrani vrat.
    expect(schedRoute.split('denyWithoutPermission(').length - 1).toBe(3)
    expect(crewsRoute.split('denyWithoutPermission(').length - 1).toBe(1)
    expect(equipRoute.split('denyWithoutPermission(').length - 1).toBe(1)
    expect(eventsRoute.split('denyWithoutPermission(').length - 1).toBe(1)
  })
})

describe('R244 — UI fail-closed izpeljava pravic (EN VIR: GET /api/auth)', () => {
  it('logistics-tab: pravice prihajajo iz GET /api/auth z alive guardom (R243 vzorec)', () => {
    expect(logUi).toContain("fetch('/api/auth')")
    expect(logUi).toContain('let alive = true')
    expect(logUi).toContain('alive = false')
    expect(logUi).toContain("setMyPermissions([])")
  })
  it('logistics-tab: izpeljava fail-closed — ?? false, nikoli ?? true / || true', () => {
    expect(logUi).toContain("myPermissions?.includes('production.manage') ?? false")
    expect(logUi).not.toContain('?? true')
    expect(logUi).not.toContain('|| true')
  })
  it('ena seja pravic — TOČNO EN fetch /api/auth v datoteki (brez druge mreže)', () => {
    expect(logUi.split("fetch('/api/auth')").length - 1).toBe(1)
  })
})

describe('R244 — UI vrata: pisalne vstopne točke pogojno upodobljene po matriki', () => {
  it("CTA 'Nov termin montaže' = POST /api/schedules (skrit med nalaganjem in ob napaki)", () => {
    expect(logUi).toContain('{lahkoUpravljaProizvodnjo && (')
    expect(logUi).toContain('Nov termin montaže')
    expect(logUi).toContain('setNewScheduleOpen(true)')
  })
  it("'Začni montažo' + 'Preloži' + 'Premakni na nov datum' = PATCH (pisalni prehidi)", () => {
    expect(logUi).toContain("handleStatusChange(s.id, 'V_TEKU')")
    expect(logUi).toContain('Premakni preloženi termin')
    expect(logUi).toContain("s.status === 'PRELOZENO' && lahkoUpravljaProizvodnjo")
  })
  it("'Zaključi (preverba + odštej material)' = QC tok z PATCH zaključitvijo (gated)", () => {
    expect(logUi).toContain('openQcDialog(s.id, s.project.id, s.project.nazivProjekta)')
    expect(logUi.indexOf('lahkoUpravljaProizvodnjo && (')).toBeLessThan(logUi.indexOf('openQcDialog(s.id'))
  })
  it("CTA 'Nova oprema' = POST /api/crews type:equipment (gated)", () => {
    expect(logUi).toContain('setNewEquipOpen(true)')
    expect(logUi).toContain('Nova oprema')
  })
  it('statusni prehodi opreme = PATCH /api/equipment (gated); UPOKOJENO ločeno', () => {
    expect(logUi).toContain("lahkoUpravljaProizvodnjo && allowedTransitions(e.status).filter((s) => s !== 'UPOKOJENO')")
    expect(logUi).toContain("lahkoUpravljaProizvodnjo && allowedTransitions(e.status).includes('UPOKOJENO')")
  })
  it("bralni vstop 'Zabeleži' (zgodovina) ostane VSEM — gated je SAMO submit v dialogu (P1-k)", () => {
    expect(logUi).toContain('Zabeleži dogodek za')
    // submit v event dialogu je gated, vstopni gumb ni
    const vstop = logUi.indexOf('Zabeleži dogodek za')
    const submit = logUi.indexOf('void handleLogEvent()')
    expect(vstop).toBeGreaterThan(-1)
    expect(logUi.slice(submit - 200, submit)).toContain('lahkoUpravljaProizvodnjo && (')
  })
  it("'Montažno dokazilo' ostane VSEM (evidence = project-access vrata, druga plast)", () => {
    expect(logUi).toContain('Montažno dokazilo')
  })
  it('dialog submiti: termin/oprema/dogodek/QC/preložitev/override — vsi gated (vrata v vratah)', () => {
    for (const marker of ['onClick={handleCreateSchedule}', 'onClick={handleCreateEquip}', 'void handleLogEvent()', 'void handleQcSubmit()', 'void handleMoveSchedule()', 'void handleQcOverride()']) {
      const i = logUi.indexOf(marker)
      expect(i).toBeGreaterThan(-1)
      expect(logUi.slice(Math.max(0, i - 420), i)).toContain('lahkoUpravljaProizvodnjo')
    }
  })
})

describe('R244 — obrambni AND v handlerjih (vrata v vratah, PRED validacijo)', () => {
  const and = (h: string, telo: string) => {
    const i = logUi.indexOf(h)
    expect(i).toBeGreaterThan(-1)
    const teloSlice = logUi.slice(i, i + telo.length + 400)
    return teloSlice
  }
  it('handleCreateSchedule: AND na production.manage PRED validacijo', () => {
    const t = and('const handleCreateSchedule', 'if (!schedProject || !schedDate) return')
    expect(t.indexOf('if (!lahkoUpravljaProizvodnjo) return')).toBeLessThan(t.indexOf('if (!schedProject'))
  })
  it('handleStatusChange: AND PRED fetch', () => {
    const t = and('const handleStatusChange', "method: 'PATCH'")
    expect(t.indexOf('if (!lahkoUpravljaProizvodnjo) return')).toBeLessThan(t.indexOf("method: 'PATCH'"))
  })
  it('handleMoveSchedule: AND PRED validacijo', () => {
    const t = and('const handleMoveSchedule', 'if (!moveTarget || !moveDate) return')
    expect(t.indexOf('if (!lahkoUpravljaProizvodnjo) return')).toBeLessThan(t.indexOf('if (!moveTarget'))
  })
  it('handleQcSubmit: AND PRED QC fetch (finalize tok kot celota)', () => {
    const t = and('const handleQcSubmit', "fetch('/api/qc'")
    expect(t.indexOf('if (!lahkoUpravljaProizvodnjo) return')).toBeLessThan(t.indexOf("fetch('/api/qc'"))
  })
  it('handleQcOverride: AND PRED finalize (terminalni prehod z revizijo)', () => {
    const t = and('const handleQcOverride', 'finalizeSchedule(qcTarget.id, qcOverrideReason.trim())')
    expect(t.indexOf('if (!lahkoUpravljaProizvodnjo) return')).toBeLessThan(t.indexOf('finalizeSchedule(qcTarget.id'))
  })
  it('handleCreateEquip: AND PRED validacijo', () => {
    const t = and('const handleCreateEquip', 'if (!equipNaziv) return')
    expect(t.indexOf('if (!lahkoUpravljaProizvodnjo) return')).toBeLessThan(t.indexOf('if (!equipNaziv'))
  })
  it('handleEquipmentStatus + handleLogEvent: AND PRED fetch', () => {
    const t1 = and('const handleEquipmentStatus', "fetch('/api/equipment'")
    expect(t1.indexOf('if (!lahkoUpravljaProizvodnjo) return')).toBeLessThan(t1.indexOf("fetch('/api/equipment'"))
    const t2 = and('const handleLogEvent', "fetch('/api/equipment/events'")
    expect(t2.indexOf('if (!lahkoUpravljaProizvodnjo) return')).toBeLessThan(t2.indexOf("fetch('/api/equipment/events'"))
  })
  it('vseh 8 AND-ov v datoteki (noben handler ni pozabljen: createSchedule, createEquip, equipStatus, logEvent, statusChange, moveSchedule, qcSubmit, qcOverride)', () => {
    expect(logUi.split('if (!lahkoUpravljaProizvodnjo) return').length - 1).toBe(8)
  })
})

describe('R244 — vlogo-osveščeni vodiči (vidni ŠELE ko so pravice znane)', () => {
  it('vodič terminov: production.manage + iskren umik na CSV/ICS (bralni tok)', () => {
    expect(logUi).toContain('Pregled terminov je samo za branje')
    expect(logUi).toContain('statusni prehodi (začetek, preložitev, zaključitev) so pravica')
    expect(logUi).toContain('izvozite kot CSV')
    expect(logUi).toContain('koledarsko datoteko')
  })
  it('vodič opreme: production.manage + zgodovina ostane dosegljiva', () => {
    expect(logUi).toContain('Pregled opreme je samo za branje')
    expect(logUi).toContain('Dodajanje opreme in statusni')
    expect(logUi).toContain('odprete z Zabeleži')
  })
  it('vodič v event dialogu: zgodovina za branje, beleženje gated', () => {
    expect(logUi).toContain('Zgodovina dogodkov ostaja za branje')
    expect(logUi).toContain('Beleženje pregledov,')
  })
  it('vsi vodiči: role="note" + aria-label + R243 žeton recept (border-border bg-muted/40 text-2xs)', () => {
    for (const aria of ['Ustvarjanje terminov zahteva pravico', 'Upravljanje opreme zahteva pravico', 'Beleženje dogodkov zahteva pravico']) {
      expect(logUi).toContain(`aria-label="${aria}"`)
    }
    expect(logUi.split('rounded-lg border border-border bg-muted/40 px-3 py-2 text-2xs text-muted-foreground').length - 1).toBe(3)
    // 4 role="note" = 3 novi R244 vodiči + 1 obstoječi R203 fail-verbose
    // zgodovinska opomba (amber žeton, drugi recept — ostane nespremenjen)
    expect(logUi.split('role="note"').length - 1).toBe(4)
  })
  it('vodiči so vidni ŠELE ko so pravice znane (myPermissions !== null — tišina med nalaganjem)', () => {
    expect(logUi.split('myPermissions !== null && !lahkoUpravljaProizvodnjo').length - 1).toBe(3)
  })
  it('vodiči ne kazujejo na skrite gumbe (besedilo NE vsebuje klik imperative)', () => {
    const vodici = ['Pregled terminov je samo za branje', 'Pregled opreme je samo za branje', 'Zgodovina dogodkov ostaja za branje']
    for (const v of vodici) {
      const i = logUi.indexOf(v)
      const slice = logUi.slice(i, i + 400)
      expect(slice.toLowerCase()).not.toContain('kliknite')
      expect(slice.toLowerCase()).not.toContain('klikni ')
    }
  })
})

describe('R244 — [Mandatory] stil: press-scale pariteta + žeton migracija', () => {
  it("primarna CTA ('Nov termin montaže' + 'Nova oprema') zdaj nosita mikro-pritisk + shadow (sorojenci R242)", () => {
    expect(logUi).toContain('flex-1 bg-roksal-navy text-white shadow-sm press-scale')
    expect(logUi).toContain('w-full bg-roksal-navy text-white shadow-sm press-scale')
  })
  it('dialog submiti (5 navy + override rdeč) nosijo mikro-pritisk — ISTI jezik čez aplikacijo', () => {
    // 4 navy submiti z ISTIM receptom (termin/oprema/dogodek/QC/preloži)
    expect(logUi.split('bg-roksal-navy hover:bg-roksal-navy/90 text-white shadow-sm transition-all press-scale focus-visible:ring-2 focus-visible:ring-roksal-navy/40 disabled:opacity-50').length - 1).toBe(5)
    expect(logUi).toContain('bg-red-600 text-[11px] text-white hover:bg-red-700 focus-visible:ring-red-400/50 press-scale')
  })
  it('accent-[#1d2b3e] migriran na žeton accent-roksal-navy (4 mesta, 0 arbitrary accent ostane)', () => {
    expect(logUi.split('accent-roksal-navy').length - 1).toBe(4)
    expect(logUi).not.toContain('accent-[#')
  })
  it('0 novih hex: dinamični crew fallback ostane (JS vrednost, dokumentirana izjema)', () => {
    // edini preostali hex v datoteki = dinamični style fallback za crew barvo
    const hexes = logUi.match(/#[0-9a-fA-F]{6}\b/g) ?? []
    expect(hexes).toEqual(['#1d2b3e'])
  })
})

describe('R244 — matrična pariteta vlog (permissions-core EN VIR, R241/R242/R243 vzorec)', () => {
  const uiGate = 'lahkoUpravljaProizvodnjo'
  it('production.manage = ADMIN + VODJA; MONTER + SKLADISCE brez (API matrika)', () => {
    expect(permissionsForRole('ADMIN')).toContain('production.manage')
    expect(permissionsForRole('VODJA')).toContain('production.manage')
    expect(permissionsForRole('MONTER')).not.toContain('production.manage')
    expect(permissionsForRole('SKLADISCE')).not.toContain('production.manage')
  })
  it('UI vrata = ISTA izpeljava za vse vloge (fail-closed dokumentacija)', () => {
    for (const vloga of ['ADMIN', 'VODJA', 'MONTER', 'SKLADISCE'] as const) {
      const uiVrata = permissionsForRole(vloga).includes('production.manage')
      expect(uiVrata).toBe(vloga === 'ADMIN' || vloga === 'VODJA')
    }
    expect(logUi).toContain(uiGate)
  })
  it('katalog: label + opis (vodič besedilo ostane usklajeno z EN VIR katalogom)', () => {
    // vodiči v UI navajajo ime pravice (koda), katalog nosi oznako 'Upravljanje proizvodnje'
    expect(logUi).toContain('production.manage')
  })
})
