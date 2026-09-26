// R162 — audit-csv enote + dark token regresijski stražar.
// ---------------------------------------------------------------------------
// (1) audit-csv (izvoz revizijske sledi): družinski standard — determinizem
//     (2 klica = enak izhod), RFC 4180 citiranje (CSV injekcija zaščita),
//     null uporabnik → PRAZNI stolpci (nikoli 'null'/'sistemski dogodek'
//     izmišljeno besedilo v podatkih), fail-closed TypeError na pokvarjenih
//     podatkih, striktno deterministično ime datoteke, sklanjatev vpisov.
// (2) DARK TOKEN STRAŽAR: globals.css MORA definiran roksal-ink v obeh
//     temah, body MORA uporabljati bg-background (ne trdo kodirane svetle),
//     src MORA vsebovati text-roksal-ink — kršitev = rdeči test.
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import {
  buildAuditCsv,
  auditCsvFilename,
  revizijaLabel,
  formatAuditCas,
  AUDIT_CSV_HEADER,
  type AuditCsvRow,
} from '../audit-csv'

const row = (over: Partial<AuditCsvRow> = {}): AuditCsvRow => ({
  id: 'aud_1',
  akcija: 'CRM_UPDATE',
  oldValue: '{"status":"AKTIVEN"}',
  newValue: '{"status":"NEAKTIVEN"}',
  ipAddress: '203.0.113.7',
  timestamp: '2026-09-26T10:30:00.000Z',
  user: { ime: 'Ana Pisarna', email: 'ana@roksal.si', vloga: 'ADMIN' },
  ...over,
})

describe('audit-csv: glava + osnovno formatiranje', () => {
  it('ima BOM + natanko 8 stolpcev v glavi', () => {
    const { csv } = buildAuditCsv([])
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv).toContain(AUDIT_CSV_HEADER)
    expect(AUDIT_CSV_HEADER.split(',')).toEqual([
      'Čas', 'Akcija', 'Uporabnik', 'Vloga', 'E-pošta', 'IP', 'Staro stanje', 'Novo stanje',
    ])
  })

  it('prazno polje → samo glava (0 vrstic)', () => {
    const { csv, vrstic } = buildAuditCsv([])
    expect(vrstic).toBe(0)
    expect(csv).toBe('\uFEFF' + AUDIT_CSV_HEADER)
  })

  it('izvozene celice vsebujejo vse prikazane podatke (čas, akcija, uporabnik, vloga, e-pošta, IP, staro, novo)', () => {
    const { csv, vrstic } = buildAuditCsv([row()])
    expect(vrstic).toBe(1)
    const body = csv.slice(csv.indexOf('\n') + 1)
    // sl-SI z 2-mestnimi enotami — ISTI Intl klici kot formatCas v dialogu
    expect(body).toContain('26. 09. 2026')
    expect(body).toContain('"CRM_UPDATE"')
    expect(body).toContain('"Ana Pisarna"')
    expect(body).toContain('"ADMIN"')
    expect(body).toContain('"ana@roksal.si"')
    expect(body).toContain('"203.0.113.7"')
    expect(body).toContain('{""status"":""AKTIVEN""}')
    expect(body).toContain('{""status"":""NEAKTIVEN""}')
  })

  it('je 100 % determinističen (2 klica = enak izhod)', () => {
    const a = buildAuditCsv([row()])
    const b = buildAuditCsv([row()])
    expect(a.csv).toBe(b.csv)
    expect(a.vrstic).toBe(b.vrstic)
  })
})

describe('audit-csv: iskrenost — sistemski dogodek in null polja', () => {
  it('null uporabnik → Uporabnik/Vloga/E-pošta PRAZNI (nikoli "null", nikoli izmišljenega besedila)', () => {
    const { csv } = buildAuditCsv([row({ user: null })])
    const body = csv.slice(csv.indexOf('\n') + 1)
    expect(body).not.toContain('null')
    expect(body).toContain(',"CRM_UPDATE","","","",')
  })

  it('null IP/oldValue/newValue → prazni stolpci (nikoli "null" besedilo)', () => {
    const { csv } = buildAuditCsv([row({ ipAddress: null, oldValue: null, newValue: null })])
    const body = csv.slice(csv.indexOf('\n') + 1)
    expect(body).not.toContain('null')
  })
})

describe('audit-csv: CSV injekcija zaščita (RFC 4180)', () => {
  it('narekovaji in vejice v vrednostih so citirani/podvojeni', () => {
    const { csv } = buildAuditCsv([
      row({
        akcija: 'AKCIJA, Z "NAREKOVAJEM"',
        newValue: 'rekel: "zdravo, svet"',
      }),
    ])
    const body = csv.slice(csv.indexOf('\n') + 1)
    expect(body).toContain('"AKCIJA, Z ""NAREKOVAJEM"""')
    expect(body).toContain('"rekel: ""zdravo, svet"""')
  })
})

describe('audit-csv: fail-closed (TypeError na pokvarjenih podatkih)', () => {
  it('ne-polje vhod → TypeError', () => {
    expect(() => buildAuditCsv(null as unknown as readonly AuditCsvRow[])).toThrow(TypeError)
    expect(() => buildAuditCsv('x' as unknown as readonly AuditCsvRow[])).toThrow(TypeError)
  })

  it('prazna/neveljavna akcija → TypeError', () => {
    expect(() => buildAuditCsv([row({ akcija: '' })])).toThrow(TypeError)
    expect(() => buildAuditCsv([row({ akcija: '   ' })])).toThrow(TypeError)
    expect(() => buildAuditCsv([row({ akcija: 42 as unknown as string })])).toThrow(TypeError)
  })

  it('neveljaven časovni žig → TypeError (tudi formatAuditCas sam)', () => {
    expect(() => buildAuditCsv([row({ timestamp: 'ne-obstaja' })])).toThrow(TypeError)
    expect(() => formatAuditCas('2026-13-99T99:99:99Z')).toThrow(TypeError)
  })

  it('neveljaven user/IP/oldValue/newValue tip → TypeError', () => {
    expect(() => buildAuditCsv([row({ user: 5 as unknown as null })])).toThrow(TypeError)
    expect(() => buildAuditCsv([row({ ipAddress: 9 as unknown as null })])).toThrow(TypeError)
    expect(() => buildAuditCsv([row({ oldValue: 1 as unknown as null })])).toThrow(TypeError)
    expect(() => buildAuditCsv([row({ newValue: {} as unknown as null })])).toThrow(TypeError)
  })
})

describe('audit-csv: ime datoteke (deterministično, striktno)', () => {
  it('revizija_<projectId>_<YYYY-MM-DD>.csv', () => {
    expect(auditCsvFilename('proj_123', '2026-09-26')).toBe('revizija_proj_123_2026-09-26.csv')
  })

  it('zavrne pokvarjen projectId in datum', () => {
    expect(() => auditCsvFilename('', '2026-09-26')).toThrow(TypeError)
    expect(() => auditCsvFilename('a/b', '2026-09-26')).toThrow(TypeError)
    expect(() => auditCsvFilename('proj_123', '26.09.2026')).toThrow(TypeError)
    expect(() => auditCsvFilename('proj_123', '2026-13-01')).toThrow(TypeError)
  })
})

describe('revizijaLabel: slovenska sklanjatev (matrika)', () => {
  it('pokrije 0–5, 11–14, 21–25, 100+ primere', () => {
    expect(revizijaLabel(0)).toBe('0 vpisov')
    expect(revizijaLabel(1)).toBe('1 vpis')
    expect(revizijaLabel(2)).toBe('2 vpisa')
    expect(revizijaLabel(3)).toBe('3 vpisi')
    expect(revizijaLabel(4)).toBe('4 vpisi')
    expect(revizijaLabel(5)).toBe('5 vpisov')
    expect(revizijaLabel(11)).toBe('11 vpisov')
    expect(revizijaLabel(12)).toBe('12 vpisov')
    expect(revizijaLabel(14)).toBe('14 vpisov')
    expect(revizijaLabel(21)).toBe('21 vpis')
    expect(revizijaLabel(22)).toBe('22 vpisa')
    expect(revizijaLabel(23)).toBe('23 vpisi')
    expect(revizijaLabel(25)).toBe('25 vpisov')
    expect(revizijaLabel(100)).toBe('100 vpisov')
    expect(revizijaLabel(101)).toBe('101 vpis')
    expect(revizijaLabel(111)).toBe('111 vpisov')
  })

  it('fail-closed na ne-celih in negativnih', () => {
    expect(() => revizijaLabel(1.5)).toThrow(TypeError)
    expect(() => revizijaLabel(-1)).toThrow(TypeError)
    expect(() => revizijaLabel(NaN)).toThrow(TypeError)
  })
})

// ---------------------------------------------------------------------------
// DARK TOKEN STRAŽAR (R162) — globals.css + src preiskova
// ---------------------------------------------------------------------------

function findSrcDir(): string {
  let dir = process.cwd()
  for (let i = 0; i < 5; i++) {
    if (readdirSync(dir).includes('src')) return join(dir, 'src')
    dir = join(dir, '..')
  }
  throw new Error('src direktorij ni najden')
}

function walkFiles(dir: string, ext: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) out.push(...walkFiles(p, ext))
    else if (p.endsWith(ext)) out.push(p)
  }
  return out
}

describe('dark token stražar (R162): roksal-ink v obeh temah + body bg-background', () => {
  const globalsCss = (() => {
    const src = findSrcDir()
    return readFileSync(join(src, 'app', 'globals.css'), 'utf-8')
  })()

  it('globals.css definira raw --roksal-ink v :root (svetla) in .dark (temna), utility pa var() referenco', () => {
    // @theme inline MORA referencirati var() — hex literal bi bil vstavljen
    // v utility in .dark override ne bi veljal (E2E R162: ujeto živo).
    expect(globalsCss).toMatch(/--color-roksal-ink:\s*var\(--roksal-ink\)/)
    expect(globalsCss).toMatch(/--roksal-ink:\s*#1d2b3e/)
    const darkBlock = globalsCss.slice(globalsCss.indexOf('.dark {'))
    expect(darkBlock).toMatch(/--roksal-ink:\s*#d7e3f4/)
  })

  it('body uporablja bg-background (ne trdo kodirane svetle #f7f9ff)', () => {
    expect(globalsCss).not.toMatch(/bg-\[#f7f9ff\]/)
    expect(globalsCss).toMatch(/@apply\s+bg-background\s+text-foreground/)
  })

  it('src vsebuje text-roksal-ink rabe (rename se je zgodil) in text-roksal-navy JE ŠE (izjeme)', () => {
    const src = findSrcDir()
    let ink = 0
    let navy = 0
    for (const f of walkFiles(src, '.tsx')) {
      const content = readFileSync(f, 'utf-8')
      ink += (content.match(/text-roksal-ink(?![\w/-])/g) ?? []).length
      navy += (content.match(/text-roksal-navy(?![\w/-])/g) ?? []).length
    }
    expect(ink).toBeGreaterThan(600)
    // Izjeme (beli overlayji / solid amber) morajo obstajati — če kdo ročno
    // pobere vse, so platnani overlayji v temni temi neberljivi.
    expect(navy).toBeGreaterThan(15)
  })

  it('text-roksal-navy izjeme so VEDNO na svetli podlagi ALI imajo dark:text- override', () => {
    const src = findSrcDir()
    const reWhite = /bg-white(?:\/\d+)?(?![\w-])/
    const reAmberSolid = /bg-roksal-amber(?![/\w-])/
    const reAmberLight = /bg-amber-(?:100|50)(?![\w-])/
    const reDarkOverride = /dark:text-/
    for (const f of walkFiles(src, '.tsx')) {
      const content = readFileSync(f, 'utf-8')
      for (const line of content.split('\n')) {
        const trimmed = line.trim()
        // komentarji niso uporaba razreda
        if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue
        if (/text-roksal-navy(?![\w/-])/.test(line)) {
          const onLight = reWhite.test(line) || reAmberSolid.test(line) || reAmberLight.test(line)
          const darkHandled = reDarkOverride.test(line)
          expect({ file: f, line: trimmed.slice(0, 140), ok: onLight || darkHandled }).toEqual(
            expect.objectContaining({ ok: true }),
          )
        }
      }
    }
  })
})
