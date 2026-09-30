// R317 — 47. člen (issue #1 IZVOZI družina): izvoz avtomatizacijskega audita
// kot DETERMINISTIČNI CSV. EN VIR: avtomatizacijaAuditCsv() je ČISTA
// projekcija AVTOMATIZACIJA_AUDIT prek avtomatizacijaPregled() (validacija +
// WYSIWYG — NIČ podvojenih pravil); zaslon + testi + docs + IZVOZ berejo ISTI
// niz. Brez metapodatkov časa/hash (isti HEAD = bajtno identična datoteka —
// kanon koncnaVerifikacijaJson, 46. člen). Format = kanon R136 toCsv
// (BOM + podpičje + CRLF + RFC 4180 citiranje).
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  avtomatizacijaPregled,
  avtomatizacijaAuditCsv,
  avtomatizacijaAuditCsvFilename,
  RAZRED_PRIKAZNO,
} from '@/lib/avtomatizacija-pregled'
import { AVTOMATIZACIJA_AUDIT } from '@/lib/avtomatizacija-audit'

const GLAVE = ['Območje', 'Razred', 'Implementacije', 'Dokazi (testi)', 'Opomba']

describe('r317 avtomatizacija-audit CSV izvoz (47. člen — IZVOZI družina)', () => {
  const raw = avtomatizacijaAuditCsv()

  it('oblika kanona R136: BOM + CRLF + glave WYSIWYG + 11 podatkovnih vrstic + sklep meta', () => {
    expect(raw.startsWith('\uFEFF')).toBe(true)
    expect(raw.endsWith('\r\n')).toBe(true)
    const vrstice = raw.slice(1).split('\r\n').filter((v) => v.length > 0)
    // glava + 11 območij + prazna ločilna + Sklep + Vir
    expect(vrstice[0]).toBe(GLAVE.join(';'))
    const podatkovne = vrstice.slice(1, 1 + AVTOMATIZACIJA_AUDIT.length)
    expect(podatkovne).toHaveLength(11)
    const meta = vrstice.slice(1 + AVTOMATIZACIJA_AUDIT.length)
    expect(meta.some((v) => v.startsWith('Sklep;'))).toBe(true)
    expect(meta.some((v) => v.startsWith('Vir;'))).toBe(true)
    // brez volatilnih ključev (determinizem — kanon 46. člen)
    expect(raw).not.toContain('Izvoženo ob')
  })

  it('vsebina WYSIWYG: vrstni red = audit (nič prerazporejanja) + razred prikazno + poti pipe-joined + opomba verbatim', () => {
    const vrstice = raw.slice(1).split('\r\n').filter((v) => v.length > 0)
    const podatkovne = vrstice.slice(1, 1 + AVTOMATIZACIJA_AUDIT.length)
    AVTOMATIZACIJA_AUDIT.forEach((v, i) => {
      const celice = podatkovne[i].split(';')
      expect(celice[0]).toBe(v.obmocje)
      expect(celice[1]).toBe(RAZRED_PRIKAZNO[v.razred])
      expect(celice[2]).toBe(v.implementacija.join(' | '))
      expect(celice[3]).toBe(v.dokaz.join(' | '))
      // opomba vsebuje vejice/podpičja → RFC 4180 citirana; vsebina verbatim
      const opombaCelica = podatkovne[i].split(';').slice(4).join(';')
      expect(opombaCelica).toContain(v.opomba)
    })
  })

  it('sklep EN VIR: meta vrstica nosi ISTI sklep kot zaslon/testi (nič dvojnega sklepa)', () => {
    const pregled = avtomatizacijaPregled()
    expect(raw).toContain(pregled.sklep)
    expect(pregled.sklep).toContain('AI-OBVEZNO: 0 — jedro deluje brez AI')
  })

  it('DETERMINIZEM: dva klica = bajtno identična datoteka; filename brez datuma', () => {
    expect(avtomatizacijaAuditCsv()).toBe(raw)
    expect(avtomatizacijaAuditCsv()).toBe(avtomatizacijaAuditCsv())
    expect(avtomatizacijaAuditCsvFilename()).toBe('avtomatizacija-audit.csv')
    expect(avtomatizacijaAuditCsvFilename()).toBe(avtomatizacijaAuditCsvFilename())
  })

  it('RFC 4180 citiranje: opomba s podpičjem/narekovajem je varno citirana (kraftan audit)', () => {
    const kraft: typeof AVTOMATIZACIJA_AUDIT = [
      {
        obmocje: '§X Test',
        razred: 'DETERMINISTICNO',
        implementacija: ['src/lib/x.ts'],
        dokaz: ['src/lib/__tests__/x.test.ts'],
        opomba: 'opomba z podpičjem; in "narekovajem" ter vejico, tudi',
      },
    ]
    const csv = avtomatizacijaAuditCsv(kraft)
    const vrstice = csv.slice(1).split('\r\n').filter((v) => v.length > 0)
    expect(vrstice[1]).toBe('§X Test;DETERMINISTIČNO;src/lib/x.ts;src/lib/__tests__/x.test.ts;"opomba z podpičjem; in ""narekovajem"" ter vejico, tudi"')
  })

  it('fail-closed: pokvarjen audit propagira TypeError graditelja (tabela ne sme sanjati — tudi izvoz ne)', () => {
    // null (NE undefined — ta bi sprožil privzeti argument EN VIR)
    expect(() => avtomatizacijaAuditCsv(null as unknown as typeof AVTOMATIZACIJA_AUDIT)).toThrow(
      /avtomatizacijaPregled: pričakovan audit/,
    )
    expect(() => avtomatizacijaAuditCsv([])).toThrow(/audit brez vrstic/)
    const brezOpombe = [{ ...AVTOMATIZACIJA_AUDIT[0], opomba: '  ' }] as typeof AVTOMATIZACIJA_AUDIT
    expect(() => avtomatizacijaAuditCsv(brezOpombe)).toThrow(/brez opombe/)
  })

  it('vodja žičenje: gumb + aria + title + handler + CSV MIME + fail-verbose toast + filename klic', () => {
    const src = readFileSync(join(process.cwd(), 'src/components/roksal/vodja-dashboard.tsx'), 'utf8')
    expect(src).toContain('aria-label="Izvozi avtomatizacijski audit kot CSV"')
    expect(src).toContain('Izvozi avtomatizacijski audit (11 območij + klasifikacije + poti) kot deterministični CSV')
    expect(src).toContain('function exportAvtomatizacijaAuditCsv()')
    expect(src).toContain('const csv = avtomatizacijaAuditCsv()')
    expect(src).toContain("a.download = avtomatizacijaAuditCsvFilename()")
    // MIME CSV (brat JSON gumb nosi application/json — ISTA mehanika)
    expect(src).toContain("{ type: 'text/csv;charset=utf-8' }")
    // fail-verbose kanon (R316 vzorec)
    expect(src).toContain("title: 'Izvoz ni uspel'")
    expect(src).toContain('onClick={exportAvtomatizacijaAuditCsv}')
  })
})
