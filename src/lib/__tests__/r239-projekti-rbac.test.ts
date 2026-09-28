// ---------------------------------------------------------------------------
// R239 — P1-a (LASTNIŠKA prioriteta): RBAC vrata na POST /api/projects.
// ---------------------------------------------------------------------------
//   • POST /api/projects je do R239 preveril SAMO prijavo — vsak
//     avtenticiran uporabnik (tudi MONTER/SKLADISCE/API ključ) je lahko
//     ustvaril projekt. R239: denyUnless(MANAGER_ROLES) — ADMIN/VODJA
//     ustvarja, MONTER/SKLADISCE → 403 z razlogom, API ključ → 403
//     (poslovna ruta, ključ je samo za sinhronizacijo izmere).
//   • UI ogledalo (iskrenost): gumb 'Nov projekt' + dialog viden SAMO
//     vodstvu (isManagerRole = dokumentirana pariteta z MANAGER_ROLES);
//     prazni-stolpec vodič je vlogo-osveščen (nikoli kazalec na gumb, ki
//     ga uporabnik ne vidi — R161/R165 precedens).
//   • Fail-verbose: 403 {error, detail} razlog pride do uporabnika.
//
// Handlerji direktno, baza roksal_test prek globalSetup (vzorec R128/R155/
// R192). Unikatni e-naslovi/imena izključno za izolacijo.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { db } from '@/lib/db'
import { createTestUserWithSession } from './helpers/test-session'
import { POST as projectsPost } from '@/app/api/projects/route'
import { twMerge } from 'tailwind-merge'

const BASE = 'http://localhost/api'
const ROUTE = path.join(__dirname, '../../app/api/projects/route.ts')
const DASHBOARD = path.join(__dirname, '../../components/roksal/dashboard-tab.tsx')

function jsonReq(
  path_: string,
  token: string | null,
  init: { method?: string; body?: unknown } = {},
): Request {
  return new Request(`${BASE}${path_}`, {
    method: init.method ?? 'GET',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  })
}

/** Veljaven telesa za POST — stranka se ustvari na mestu (unikatno ime). */
async function makeCustomer(tag: string): Promise<string> {
  const customer = await db.customer.create({
    data: { ime: `Stranka r239 ${tag} ${Date.now()}`, naslov: 'Test 1' },
  })
  return customer.id
}

async function postAs(
  id: string,
  vloga: 'ADMIN' | 'VODJA' | 'MONTER' | 'SKLADISCE',
  body: Record<string, unknown>,
): Promise<Response> {
  const { token } = await createTestUserWithSession(id, vloga)
  return projectsPost(jsonReq('/projects', token, { method: 'POST', body }))
}

// ===========================================================================
// 1. RBAC vrata — strežnik
// ===========================================================================

describe('R239 — POST /api/projects: denyUnless(MANAGER_ROLES) vrata (P1-a)', () => {
  it('anon → 401 (brez seje ni dostopa)', async () => {
    const res = await projectsPost(
      jsonReq('/projects', null, { method: 'POST', body: { nazivProjekta: 'r239 x', customerId: 'x' } }),
    )
    expect(res.status).toBe(401)
  })

  it('MONTER → 403 z razlogom (fail-verbose: vloga je vidna v sporočilu)', async () => {
    const res = await postAs('r239-mon', 'MONTER', {
      nazivProjekta: `Projekt r239 monter ${Date.now()}`,
      customerId: await makeCustomer('monter'),
    })
    expect(res.status).toBe(403)
    const data = (await res.json()) as { error?: string; detail?: string }
    expect(data.error).toBe('Prepovedano')
    expect(typeof data.detail).toBe('string')
    expect(data.detail).toContain('ADMIN ali VODJA')
    expect(data.detail).toContain('MONTER')
  })

  it('SKLADISCE → 403 (neni izjeme — ustvarjanje je vodstveno dejanje)', async () => {
    const res = await postAs('r239-skl', 'SKLADISCE', {
      nazivProjekta: `Projekt r239 skladisce ${Date.now()}`,
      customerId: await makeCustomer('skladisce'),
    })
    expect(res.status).toBe(403)
    const data = (await res.json()) as { detail?: string }
    expect(data.detail).toContain('SKLADISCE')
  })

  it('ADMIN → 201 (projekt + audit v isti transakciji)', async () => {
    const customerId = await makeCustomer('admin')
    const res = await postAs('r239-adm', 'ADMIN', {
      nazivProjekta: `Projekt r239 admin ${Date.now()}`,
      customerId,
    })
    expect(res.status).toBe(201)
    const created = (await res.json()) as { id: string; customerId: string }
    expect(created.customerId).toBe(customerId)
    // audit sled ostaja (issue #4, §13 — RBAC vrata ne smejo obrati audit).
    const audit = await db.auditLog.findFirst({ where: { projectId: created.id, akcija: 'CREATE_PROJECT' } })
    expect(audit).not.toBeNull()
  })

  it('VODJA → 201 (druga vodstvena vloga)', async () => {
    const res = await postAs('r239-vod', 'VODJA', {
      nazivProjekta: `Projekt r239 vodja ${Date.now()}`,
      customerId: await makeCustomer('vodja'),
    })
    expect(res.status).toBe(201)
  })

  it('MONTER po neuspelih vratah NI ustvaril projekta (baza NESPREMENJENA)', async () => {
    const ime = `Projekt r239 nikoli ${Date.now()}`
    const customerId = await makeCustomer('blokada')
    await postAs('r239-blo', 'MONTER', { nazivProjekta: ime, customerId })
    const najden = await db.project.findFirst({ where: { nazivProjekta: ime } })
    expect(najden).toBeNull()
  })
})

// ===========================================================================
// 2. Strukturni dokazi — vrata so v viru, UI ogledalo je vlogo-osveščeno
// ===========================================================================

describe('R239 — strukturni dokazi (vir rute + UI ogledalo)', () => {
  it('POST ruta ima denyUnless(MANAGER_ROLES) vrata (strukturni pin)', () => {
    const src = readFileSync(ROUTE, 'utf8')
    expect(src).toContain('denyUnless(request, MANAGER_ROLES)')
    // vrata PRED transakcijo (vrata so prva plast, ne zadnja — lekcija R155).
    const vrataIdx = src.indexOf('denyUnless(request, MANAGER_ROLES)')
    const txIdx = src.indexOf('db.$transaction')
    expect(vrataIdx).toBeGreaterThan(-1)
    expect(txIdx).toBeGreaterThan(vrataIdx)
  })

  it("UI ogledalo: 'Nov projekt' gumb + dialog vezan na smeUstvarjatiProjekte (isManagerRole = pariteta z MANAGER_ROLES)", () => {
    const src = readFileSync(DASHBOARD, 'utf8')
    expect(src).toContain('isManagerRole')
    expect(src).toContain('const smeUstvarjatiProjekte = isManagerRole(myVloga)')
    // gumb POGOJNO upodobljen (noga ni več brezpogojna)
    expect(src).toContain('{smeUstvarjatiProjekte && (')
    // dialog ima obrambni AND na open (stale seja ne sme prikazati dialoga)
    expect(src).toContain('open={smeUstvarjatiProjekte && newProjectOpen}')
  })

  it('UI fail-verbose: 403 detail pride do uporabnika (ni zamolčane napake)', () => {
    const src = readFileSync(DASHBOARD, 'utf8')
    expect(src).toContain("toast.error(razlog ? `Projekt ni bil ustvarjen: ${razlog}` : 'Napaka pri ustvarjanju projekta')")
  })

  it('prazni-stolpec vodič je vlogo-osveščen (vodstvo: gumb; ne-vodstvo: iskrena razlaga)', () => {
    const src = readFileSync(DASHBOARD, 'utf8')
    // vodstvena veja (pina R202 ostajajo — veja še vedno obstaja)
    expect(src).toContain("'Ustvari projekt z gumbom Nov projekt (zgoraj).'")
    // iskrna ne-vodstvena veja (R161/R165: vodič ne laže o vlogah)
    expect(src).toContain("'Projekt pripravi vodstvo — ko je objavljen, se pojavi na tem seznamu.'")
  })
})

// ===========================================================================
// 3. P1-e zaklep: numerična imena text-9/text-11 so twMerge COLOR klasa —
//    nikoli se ne uvajajo kot žetoni (dokaz iz R239 runde; arbitrary sta
//    legalni — različen konflikt-profil = tihi izris-konflikt).
// ===========================================================================

describe('R239 — P1-e zaklep: text-9/text-11 nimajo font-size konfliktnega profila', () => {
  it('tailwind-merge klasificira text-9/text-11 kot BARVO (gazi in jo gazi color)', () => {
    // dokaz: color class in text-9 se mutualno izločata (isti skupini)
    expect(twMerge('text-9 text-red-500')).toBe('text-red-500')
    expect(twMerge('text-red-500 text-9')).toBe('text-9')
    expect(twMerge('text-11 text-roksal-navy')).toBe('text-roksal-navy')
  })

  it('text-9/text-11 NE deduplirajo proti font-size žetonom (drugačna skupina → oba ostane → nepredvidljiv izris)', () => {
    expect(twMerge('text-xs text-11')).toBe('text-xs text-11')
    expect(twMerge('text-2xs text-9')).toBe('text-2xs text-9')
    // kontrast: 2xs/3xs (R238) imajo ISTI t-shirt profil (deduplirajo)
    expect(twMerge('text-xs text-2xs')).toBe('text-2xs')
    expect(twMerge('text-2xs text-3xs')).toBe('text-3xs')
  })
})
