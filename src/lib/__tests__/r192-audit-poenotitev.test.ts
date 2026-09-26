// R192 — revizijski dnevnik poenotitev + družinski filtri + 429 korelacija.
// ---------------------------------------------------------------------------
// VARNOST.md "Revizijski dnevnik na vseh mutacijah": doslej je 13 rut pisalo
// v AuditLog s SVOJIMI prepisanimi klici (tx.auditLog.create / db.auditLog.create),
// bom-draft pa je pisal `userId: 'system'` — profil 'system' NE obstaja (issue
// #4 §13) → FK constraint je padal ŠELE PO uspešnem zapisu (odgovor 500, podatki
// že shranjeni). R192: VSI vpisi grede skozi src/lib/audit.ts (auditInTx /
// audit / auditStrict) + guard test, ki to jamči trajno.
//
// Družinske pravice, ki jih testi varujejo:
//  (a) STRAŽAR: `auditLog.create` sme obstajati SAMO v src/lib/audit.ts
//      (trajno, vzorec r191 inventarnega stražarja — nova ruta z inline
//      zapisom pade v CI);
//  (b) bom-draft FK regresija: NI več `userId: 'system'`;
//  (c) ipOverride/uaOverride (javni hash-IP pisci: setup, measure.ts) —
//      eksplicitna vrednost zmaga nad izpeljavo iz requesta, UA se odreže na 300;
//  (d) auditStrict je fail-verbose (vrže) — vzdržljiv dnevnik R132;
//  (e) 429 write odgovor odmeva `x-correlation-id` (§22 družina, R192);
//  (f) akcijaDruzina: EN VIR RESNICE za značke IN družinske chipe (vrstni red
//      klasifikacije nespremenjen: LOGIN → DELETE → CREATE → DEAL → ostalo).
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { db } from '@/lib/db'
import { audit, auditInTx, auditStrict } from '../audit'
import { akcijaDruzina, AKCIJA_DRUZINA_OMEJKE } from '../audit-csv'
import { zapisOmejitev, resetRateLimit, WRITE_LIMIT } from '../rate-limit'

const srcOf = (p: string): string => readFileSync(join(process.cwd(), p), 'utf8')

const createdProjects: string[] = []
const createdCustomers: string[] = []
const testAkcija = `R192TEST-${randomUUID().slice(0, 8)}`

afterAll(async () => {
  await db.auditLog.deleteMany({ where: { akcija: { startsWith: 'R192TEST-' } } })
  await db.auditLog.deleteMany({ where: { akcija: { startsWith: 'S9TEST-' } } })
  await db.project.deleteMany({ where: { id: { in: createdProjects } } })
  await db.customer.deleteMany({ where: { id: { in: createdCustomers } } })
  await db.$disconnect()
})

async function makeProject() {
  const customer = await db.customer.create({
    data: { ime: `R192-AUD-${randomUUID().slice(0, 8)}`, naslov: 'Test 1' },
  })
  createdCustomers.push(customer.id)
  const project = await db.project.create({
    data: { customerId: customer.id, nazivProjekta: 'R192 poenotitev' },
  })
  createdProjects.push(project.id)
  return project
}

// ---------------------------------------------------------------------------
// (a) STRAŽAR — auditLog.create samo v lib/audit.ts
// ---------------------------------------------------------------------------
function walkTs(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    const st = statSync(full)
    if (st.isDirectory()) {
      if (name === '__tests__' || name === 'node_modules') continue
      out.push(...walkTs(full))
    } else if (name.endsWith('.ts') || name.endsWith('.tsx')) {
      out.push(full)
    }
  }
  return out
}

describe('R192 stražar — enoten vpisni kanal', () => {
  it('auditLog.create obstaja IZKLJUČNO v src/lib/audit.ts', () => {
    const srcDir = join(process.cwd(), 'src')
    const offenders = walkTs(srcDir).filter((f) => {
      if (f.endsWith(join('lib', 'audit.ts'))) return false
      return readFileSync(f, 'utf8').includes('auditLog.create')
    })
    expect(offenders, `inline vpisi zunaj lib/audit.ts: ${offenders.join(', ')}`).toEqual([])
  })

  it('pretvorjene rute uvažajo helperje iz @/lib/audit', () => {
    const traziInTx = [
      'src/app/api/schedules/route.ts',
      'src/app/api/measurements/route.ts',
      'src/app/api/measurements/[id]/route.ts',
      'src/app/api/projects/route.ts',
      'src/app/api/equipment/route.ts',
      'src/app/api/equipment/events/route.ts',
      'src/app/api/qc/route.ts',
      'src/app/api/customers/route.ts',
      'src/app/api/evidence/route.ts',
      'src/app/api/portal/route.ts',
      'src/app/api/setup/route.ts',
    ]
    for (const f of traziInTx) {
      expect(srcOf(f).includes('auditInTx'), `${f} mora uporabljati auditInTx`).toBe(true)
    }
    expect(srcOf('src/app/api/crm/route.ts')).toContain('audit(')
    expect(srcOf('src/app/api/bom-draft/route.ts')).toContain('audit(')
    expect(srcOf('src/lib/measure.ts')).toContain('auditStrict(')
  })

  it('bom-draft FK regresija: NI več userId \'system\' (null = sistemski, S+9)', () => {
    const src = srcOf('src/app/api/bom-draft/route.ts')
    expect(src.includes("userId: 'system'")).toBe(false)
    expect(src).toContain('userId: null')
    expect(src).toContain('BOM_DRAFT_UPDATED')
  })

  it('hash-IP pisci (setup, measure) uporabljajo ipOverride/uaOverride', () => {
    const setup = srcOf('src/app/api/setup/route.ts')
    expect((setup.match(/ipOverride: ipHash,/g) ?? []).length).toBe(3)
    expect(setup.includes('ipAddress: ipHash')).toBe(false)
    const measure = srcOf('src/lib/measure.ts')
    expect(measure).toContain('ipOverride: entry.ipHash')
    expect(measure).toContain('auditStrict(')
  })
})

// ---------------------------------------------------------------------------
// (c)+(d) ipOverride / uaOverride / auditStrict — realna baza
// ---------------------------------------------------------------------------
describe('R192 helperji — overrides in fail-verbose', () => {
  it('auditInTx z overrides zapiše TOČNO podani IP/UA (prednost pred requestom)', async () => {
    const project = await makeProject()
    const req = new Request('https://roksal.example/api/test', {
      headers: { 'x-forwarded-for': '203.0.113.99', 'user-agent': 'IzpeljaniAgent/1.0' },
    })
    const dolgUa = 'x'.repeat(400)
    await db.$transaction(async (tx) => {
      await auditInTx(tx, {
        request: req,
        akcija: testAkcija,
        projectId: project.id,
        newValue: 'override-test',
        ipOverride: '10.0.0.42',
        uaOverride: dolgUa,
      })
    })
    const row = await db.auditLog.findFirst({ where: { akcija: testAkcija, projectId: project.id } })
    expect(row).not.toBeNull()
    expect(row!.ipAddress).toBe('10.0.0.42') // override zmaga nad x-forwarded-for
    expect(row!.userAgent).toHaveLength(300) // odrez na 300 (izpeljiPrikaz)
    expect(row!.userAgent!.startsWith('xxx')).toBe(true)
  })

  it('audit() brez requesta in overrides → ipAddress null, userId iz inputa', async () => {
    const project = await makeProject()
    await audit({ userId: null, akcija: testAkcija, projectId: project.id, newValue: 'brez-requesta' })
    const row = await db.auditLog.findFirst({
      where: { akcija: testAkcija, projectId: project.id, newValue: 'brez-requesta' },
    })
    expect(row).not.toBeNull()
    expect(row!.userId).toBeNull()
    expect(row!.ipAddress).toBeNull()
    expect(row!.userAgent).toBeNull()
  })

  it('auditStrict je fail-verbose: tuj projectId (FK) VRŽE napako', async () => {
    await expect(
      auditStrict({
        userId: null,
        akcija: testAkcija,
        projectId: 'r192-ne-obstaja-certainly-not',
        newValue: 'fk-test',
      }),
    ).rejects.toThrow()
  })
})

// ---------------------------------------------------------------------------
// (e) 429 write odgovor — x-correlation-id odmev (§22)
// ---------------------------------------------------------------------------
const zahteva = (ip: string, correlationId?: string): Request =>
  new Request('https://roksal.example/api/test', {
    method: 'POST',
    headers: {
      'x-forwarded-for': ip,
      ...(correlationId ? { 'x-correlation-id': correlationId } : {}),
    },
  })

describe('R192 — 429 korelacija (zapisOmejitev)', () => {
  beforeEach(() => resetRateLimit())

  it('429 odmeva x-correlation-id iz requesta + Retry-After ostane', async () => {
    const ruta = `r192-corr-${randomUUID().slice(0, 8)}`
    let res: Response | null = null
    for (let i = 0; i < WRITE_LIMIT.limit + 1; i++) {
      res = zapisOmejitev(zahteva('192.0.2.77', 'r192-prog-123'), ruta)
    }
    expect(res).not.toBeNull()
    expect(res!.status).toBe(429)
    expect(res!.headers.get('x-correlation-id')).toBe('r192-prog-123')
    // Retry-After: hitrost zanke je variabilna → intervalna trditev (1–60 s)
    const retryAfter = Number(res!.headers.get('retry-after'))
    expect(Number.isInteger(retryAfter) && retryAfter >= 1 && retryAfter <= 60).toBe(true)
  })

  it('brez correlation glave 429 USTVARI novega (nepraznega, ≤128 znakov)', async () => {
    const ruta = `r192-corr-${randomUUID().slice(0, 8)}`
    let res: Response | null = null
    for (let i = 0; i < WRITE_LIMIT.limit + 1; i++) {
      res = zapisOmejitev(zahteva('192.0.2.78'), ruta)
    }
    expect(res).not.toBeNull()
    const cid = res!.headers.get('x-correlation-id')
    expect(typeof cid === 'string' && cid.length > 0 && cid.length <= 128).toBe(true)
  })

  it('pod limitom ostane null (odmev ne spreminja vedenja uspešnih zahtevkov)', () => {
    const ruta = `r192-corr-${randomUUID().slice(0, 8)}`
    expect(zapisOmejitev(zahteva('192.0.2.79', 'r192-ne-blokira'), ruta)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// (f) akcijaDruzina — EN VIR RESNICE (značke + chips)
// ---------------------------------------------------------------------------
describe('R192 — akcijaDruzina klasifikacija', () => {
  it('družine po vrstnem redu pravil: LOGIN → DELETE → CREATE → DEAL → ostalo', () => {
    expect(akcijaDruzina('LOGIN')).toBe('prijava')
    expect(akcijaDruzina('LOGIN_FAILED')).toBe('prijava')
    expect(akcijaDruzina('AUTH_LOGOUT')).toBe('ostalo') // ni 'LOGIN' podniza
    expect(akcijaDruzina('SESSION_DELETED')).toBe('brisanje')
    expect(akcijaDruzina('TOKEN_REVOKED')).toBe('brisanje')
    expect(akcijaDruzina('CREATE_PROJECT')).toBe('ustvarjanje')
    expect(akcijaDruzina('SETUP_BOOTSTRAP')).toBe('ustvarjanje')
    expect(akcijaDruzina('DEAL_LOCK')).toBe('zaklep')
    expect(akcijaDruzina('QUOTE_SIGNED')).toBe('zaklep')
    expect(akcijaDruzina('CRM_UPDATE')).toBe('ostalo')
    expect(akcijaDruzina('QC_SUBMITTED')).toBe('ostalo')
    expect(akcijaDruzina('SCHEDULE_RESCHEDULED')).toBe('ostalo')
  })

  it('case-neodvisno in odporno na ne-nize (fail-closed → ostalo)', () => {
    expect(akcijaDruzina('login')).toBe('prijava')
    expect(akcijaDruzina('CreateMeasurement')).toBe('ustvarjanje')
    expect(akcijaDruzina(undefined as unknown as string)).toBe('ostalo')
  })

  it('oznake chipov so popolne nad vsemi ključi (vključno z vse)', () => {
    for (const key of ['vse', 'prijava', 'brisanje', 'ustvarjanje', 'zaklep', 'ostalo'] as const) {
      expect(typeof AKCIJA_DRUZINA_OMEJKE[key]).toBe('string')
      expect(AKCIJA_DRUZINA_OMEJKE[key].length).toBeGreaterThan(0)
    }
  })

  it('dialog uporablja skupni vir (družinski chips + aria-pressed + tabular-nums)', () => {
    const src = srcOf('src/components/roksal/audit-trail-dialog.tsx')
    expect(src).toContain('akcijaDruzina')
    expect(src).toContain('AKCIJA_DRUZINA_OMEJKE')
    expect(src).toContain('aria-pressed')
    expect(src).toContain('tabular-nums')
    // značka in chip iz ISTEGA razreda (druzinaRazred)
    expect(src).toContain('druzinaRazred')
  })
})
