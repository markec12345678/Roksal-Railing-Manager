// R240 — P1-g ZAKLEP: sistemska RBAC revizija vseh pisalnih rut (fence)
// ---------------------------------------------------------------------------
// R239 je postavil vrata na POST /api/projects (denyUnless(MANAGER_ROLES)).
// P1-g je zahteval sistemski pregled: KATERE pisalne rute še preverjajo samo
// prijavo? Revizija (scripts/r240-rbac-revizija.py + ta test) je pokazala, da
// repo ima TRI plasti dostopa:
//   1. denyUnless(request, ROLE)            — vlogovna vrata (invoices, jobs,
//                                             projects, security/rate-limit,
//                                             auth/register);
//   2. denyWithoutPermission(request, PERM) — dovoljenjska vrata (crews,
//                                             equipment, inventory,
//                                             material-orders, material-prices,
//                                             profili, schedules, suppliers);
//   3. matrika @/lib/access (canManage*/assert*/lacksPermission/
//      projectWhereForPrincipal/…) — 27 datotek.
// OSTANEK brez vrat je po oblikovanju VAREN in dokumentiran v DOVOLJENEM
// seznamu spodaj (vsak vnos z razlogom). Ta test je FENCE: NOVA pisalna ruta
// brez vsaj enega vratovega signala ALI izrecnega vnosa v seznam = RDEČI
// test (nikoli tiho skozi). Isti vzorec kot detektorji r168-fokus/r235-gray.
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const beri = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

const API_DIR = join(process.cwd(), 'src', 'app', 'api')

/** Rekurzivni sprehod čez api imenik → relativne poti route.ts. */
function zberiRute(dir: string, baza: string = ''): string[] {
  const izhodi: string[] = []
  for (const ime of readdirSync(dir)) {
    const polno = join(dir, ime)
    const rel = baza ? `${baza}/${ime}` : ime
    if (statSync(polno).isDirectory()) {
      izhodi.push(...zberiRute(polno, rel))
    } else if (ime === 'route.ts') {
      izhodi.push(rel)
    }
  }
  return izhodi
}

/** Odstrani komentarje (bločne + vrstične), da signali v komentarjih ne štejejo. */
function brezKomentarjev(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((l) => !/^\s*\/\//.test(l))
    .join('\n')
}

const PISALNE = ['POST', 'PATCH', 'PUT', 'DELETE'] as const

function metodeRute(src: string): string[] {
  return PISALNE.filter((m) =>
    new RegExp(`export\\s+(?:async\\s+)?function\\s+${m}\\b`).test(src)
  )
}

/** Vratile signal vrata (katerakoli od treh plasti) — kot detektor R240. */
const VRATA_RE =
  /denyUnless|denyWithoutPermission|canManage|canDelete|assertProjectAccess|assertOwnsProject|lacksPermission|hasPermission|apiKeyScopeDenied|projectWhereForPrincipal|projectAccessAllowed|@\/lib\/access|hasRole|vloga\s*===|vloga\s*!==|MANAGER_ROLES|ADMIN|VODJA|MONTER|SKLADISCE/

/**
 * DOVOLJENI brez-vrat seznam — EN VIR RESNICE (mirror detektorja). Vsak vnos
 * IMA razlog; brez razloga = test spodleti (ni tihih izjem).
 */
const DOVOLJENO_BREZ_VRAT: Record<string, string> = {
  // Sejna samooskrba — dejanja NAD SVOJO sejo (ni poslovnih podatkov).
  'auth/demo/route.ts': 'Javna demo-prijava (lastna seja, rate-limit).',
  'auth/email/route.ts': 'Samooskrba: preverjanje/iskanje lastnega e-naslova.',
  'auth/logout/route.ts': 'Odjava lastne seje (ali vseh svojih).',
  'auth/password/route.ts': 'Menjava LASTNEGA gesla (zahteva trenutno geslo).',
  'auth/sessions/route.ts': 'Brisanje lastnih sej (DELETE = odjavi ostale naprave).',
  'auth/sessions/[id]/route.ts': 'Preklic lastne seje po id (404 na tuji — filtrirano).',
  // Žetonske javne rute — fail-closed z lastnim žetonom/števcem, brez seje.
  'users/activate/route.ts': 'Aktivacija povabljenega računa (enkraten žeton + rate limit).',
  'public/measure/route.ts': 'Javni merilni tok z lastnim žetonom (brez seje po oblikovanju).',
  // Brezstanjska računanja/analize — NE pišejo poslovnih podatkov.
  'calculator/route.ts': 'Račun ponudbe (čista funkcija, brez zapisa v bazo).',
  'railing-layout/route.ts': 'Izračun ograjne postavitve (čista funkcija).',
  'measure/photo/route.ts': 'Analiza fotometrije (izračun, brez poslovnega zapisa).',
  'measurement/detect/route.ts': 'Detekcija meritev s slike (izračun, brez poslovnega zapisa).',
  'ar/analyze/route.ts': 'AR analiza prizora (izračun, brez poslovnega zapisa).',
  'vision/placement/route.ts': 'Vizija: predlog postavitve (izračun).',
  'vision/scene/route.ts': 'Vizija: scena (izračun).',
  // Stanje obvestil LASTNIKA seje.
  'notifications/read/route.ts': 'Označi SVOJA obvestila kot prebrana.',
  // BOM core — prepoved AI sprememb (trda pravilo); prijava je obvezna,
  // vlogovni model je lastnikova domena (ni AI delovnega prostora).
  'bom-draft/route.ts': 'BOM core — AI prepovedano; prijava obvezna (authenticate).',
  'bom-refine/route.ts': 'BOM core — AI prepovedano; prijava obvezna (authenticate).',
  // Viz produkt — samostojna površina z lastnim podatkovnim modelom (brez
  // Roksal vlog; spec §7) — izven matrike §10 po oblikovanju.
  'viz/preview/route.ts': 'Viz produkt (ločena površina, lastni model).',
  'viz/product-preview/route.ts': 'Viz produkt (ločena površina, lastni model).',
  'viz/projects/route.ts': 'Viz produkt (ločena površina, lastni model).',
  'viz/projects/[id]/route.ts': 'Viz produkt (ločena površina, lastni model).',
  'viz/projects/[id]/duplicate/route.ts': 'Viz produkt (ločena površina, lastni model).',
  'viz/render/route.ts': 'Viz produkt (ločena površina, lastni model).',
  'viz/stage/route.ts': 'Viz produkt (ločena površina, lastni model).',
}

function kljucRute(rel: string): string {
  return rel.replace(/\\/g, '/')
}

describe('R240 — P1-g revizija: vsaka pisalna ruta ima vrata ALI je dokumentirano brez-vratna', () => {
  const rute = zberiRute(API_DIR)
  const pisalne = rute
    .map((rel) => ({ rel: kljucRute(rel), src: brezKomentarjev(readFileSync(join(API_DIR, rel), 'utf8')) }))
    .filter(({ src }) => metodeRute(src).length > 0)

  it('revizija je pokrila realno stanje: več kot 50 datotek z metodami pisanja', () => {
    expect(rute.length).toBeGreaterThan(50)
    expect(pisalne.length).toBeGreaterThan(50)
  })

  it('FENCE: vsaka pisalna ruta ima vrata (3 plasti) ALI je v DOVOLJENEM seznamu z razlogom', () => {
    const kršitve: string[] = []
    for (const { rel, src } of pisalne) {
      const imaVrata = VRATA_RE.test(src)
      const razlog = DOVOLJENO_BREZ_VRAT[rel]
      if (!imaVrata && !razlog) {
        kršitve.push(`${rel} (${metodeRute(src).join(',')}) — brez vrat in brez vnosa v seznam`)
      }
      // Vnos v seznam BREZ razloga je prepovedan (ni tihih izjem).
      if (razlog === '') kršitve.push(`${rel} — vnos v seznam brez razloga`)
    }
    expect(kršitve, kršitve.join('\n')).toEqual([])
  })

  it('seznam ne vsebuje rut, ki ZDELA imajo vrata (zastareli vnosi = napaka vzdrževanja)', () => {
    const zastareli: string[] = []
    for (const rel of Object.keys(DOVOLJENO_BREZ_VRAT)) {
      const target = pisalne.find((r) => r.rel === rel)
      if (target && VRATA_RE.test(target.src)) {
        zastareli.push(rel)
      }
    }
    expect(zastareli, 'odstranite zastarele vnose (ruta ima že vrata)').toEqual([])
  })

  it('ključne poslovne rute imajo IZRECNO pravo plast (pin globine, ne le signala)', () => {
    // Plast 1 — vlogovna vrata: projekti (R239) + računi + jobs.
    expect(beri('src/app/api/projects/route.ts')).toContain('denyUnless(request, MANAGER_ROLES)')
    expect(beri('src/app/api/invoices/route.ts')).toContain('denyUnless')
    // Plast 2 — dovoljenjska vrata: proizvodnja/nabava/katalog.
    expect(beri('src/app/api/crews/route.ts')).toContain("denyWithoutPermission(request, 'production.manage')")
    expect(beri('src/app/api/suppliers/route.ts')).toContain('denyWithoutPermission')
    expect(beri('src/app/api/inventory/route.ts')).toContain('denyWithoutPermission')
    // Plast 3 — matrika: stranke/CRM (R156), fotografije, sinhronizacija.
    expect(beri('src/app/api/customers/route.ts')).toContain('canManageCustomers')
    expect(beri('src/app/api/crm/route.ts')).toContain('canManageCustomers')
    expect(beri('src/app/api/photos/route.ts')).toContain("@/lib/access")
    expect(beri('src/app/api/sync/route.ts')).toContain('@/lib/access')
    // Ekipa (users) — vodstvena površina.
    expect(beri('src/app/api/users/route.ts')).toMatch(/denyUnless|canManage|hasRole|ADMIN/)
  })

  it('detektor obstaja na disku in je re-uporaben (vsaka runda ga lahko požene)', () => {
    const detektor = beri('scripts/r240-rbac-revizija.py')
    expect(detektor).toContain('denyUnless')
    expect(detektor).toContain('denyWithoutPermission')
    expect(detektor).toContain('@/lib/access')
  })
})
