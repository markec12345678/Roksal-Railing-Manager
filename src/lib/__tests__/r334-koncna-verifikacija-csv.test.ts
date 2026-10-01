// R334 — 61. člen (issue #1 IZVOZI družina): izvoz poročila končne
// verifikacije kot DETERMINISTIČNI CSV. EN VIR: koncnaVerifikacijaCsv() je
// ČISTA projekcija koncnaVerifikacija() graditelja R315 (validacija +
// WYSIWYG — NIČ podvojenih pravil); zaslon + JSON R316 + PDF R320 + testi +
// docs + CSV berejo ISTI niz. Brez metapodatkov časa/hash (isti HEAD =
// bajtno identična datoteka — kanon 46./47. člen). Format = kanon R136
// toCsv (BOM + podpičje + CRLF + RFC 4180 citiranje). Glavi = VERBATIM PDF
// autoTable head T1/T2 (anti-divergenca — testi pinajo PROTI PDF VIRU,
// vzorec R330/R331/R332).
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  koncnaVerifikacija,
  DOKAZI_AUDITA,
} from '@/lib/koncna-verifikacija'
import {
  koncnaVerifikacijaCsv,
  koncnaVerifikacijaCsvFilename,
  koncnaVerifikacijaCsvVrstica,
  koncnaVerifikacijaCsvKriterijVrstica,
  KONCNA_CSV_GLAVE_OBMOCJA,
  KONCNA_CSV_GLAVE_KRITERIJI,
  KONCNA_VIR_NIZ,
} from '@/lib/koncna-verifikacija-csv'
import {
  AVTOMATIZACIJA_AUDIT,
  type VrstaAudita,
} from '@/lib/avtomatizacija-audit'
import { koncnaVerifikacijaPdfFilename } from '@/lib/koncna-verifikacija-pdf'

const PDF_VIR = readFileSync(join(process.cwd(), 'src/lib/koncna-verifikacija-pdf.ts'), 'utf8')

describe('r334 koncna-verifikacija CSV izvoz (61. člen — IZVOZI družina)', () => {
  const raw = koncnaVerifikacijaCsv()
  const kv = koncnaVerifikacija()

  it('glavi = VERBATIM PDF autoTable head T1/T2 (anti-divergenca — glavi v viru PDF brata, nič dvojnega)', () => {
    expect(KONCNA_CSV_GLAVE_OBMOCJA).toEqual(['Območje', 'Razred', 'Plasti', 'Dokaz'])
    expect(KONCNA_CSV_GLAVE_KRITERIJI).toEqual(['Kriterij', 'Izpeljava', 'Dokaz'])
    // ANTI-DIVERGENCA pin: PDF VIR nosi ISTI niz stolpcev (autoTable head
    // T1 + T2 R320) — CSV in PDF NE moreta divergirati po konstrukciji
    expect(PDF_VIR).toContain("head: [['Območje', 'Razred', 'Plasti', 'Dokaz']]")
    expect(PDF_VIR).toContain("head: [['Kriterij', 'Izpeljava', 'Dokaz']]")
  })

  it('oblika kanona R136: BOM + CRLF + glava bloka A + 11 območij + prazna + glava bloka B + 8 kriterijev + prazna + meta KPI ×4 + Sklep + Vir', () => {
    expect(raw.startsWith('\uFEFF')).toBe(true)
    expect(raw.endsWith('\r\n')).toBe(true)
    const vrstice = raw.slice(1).split('\r\n').filter((v) => v.length > 0)
    // blok A glava + 11 območij + blok B glava + 8 kriterijev + meta 7
    expect(vrstice[0]).toBe(KONCNA_CSV_GLAVE_OBMOCJA.join(';'))
    const blokA = vrstice.slice(1, 1 + AVTOMATIZACIJA_AUDIT.length)
    expect(blokA).toHaveLength(11)
    const glavaB = vrstice[1 + AVTOMATIZACIJA_AUDIT.length]
    expect(glavaB).toBe(KONCNA_CSV_GLAVE_KRITERIJI.join(';'))
    const blokB = vrstice.slice(2 + AVTOMATIZACIJA_AUDIT.length, 2 + AVTOMATIZACIJA_AUDIT.length + kv.kriteriji.length)
    expect(blokB).toHaveLength(8)
    const meta = vrstice.slice(2 + AVTOMATIZACIJA_AUDIT.length + kv.kriteriji.length)
    expect(meta[0]).toBe('Območij;11')
    expect(meta[1]).toBe('Z dokazi;11')
    expect(meta[2]).toBe('Kriterijev;8')
    expect(meta[3]).toBe('AI-OBVEZNO;0')
    // sklep vsebuje SAMO vejice (ne podpičja) → NECITIRAN (quoteField
    // kanon R136 sproži SAMO na ;/narekovaj/newline/robni presledek)
    expect(meta[4]).toBe(`Sklep;${kv.sklep}`)
    // vir niz brez podpičja/narekovaja → NECITIRAN (quoteField kanon R136)
    expect(meta[5]).toBe(`Vir;${KONCNA_VIR_NIZ}`)
    // brez volatilnih ključev (determinizem — kanon 46./47. člen)
    expect(raw).not.toContain('Izvoženo ob')
  })

  it('vsebina WYSIWYG bloka A: vrstni red = audit (nič prerazporejanja) + razred prikazno + plasti pipe-joined + opomba verbatim (ISTI celici kot PDF body T1)', () => {
    const vrstice = raw.slice(1).split('\r\n').filter((v) => v.length > 0)
    const blokA = vrstice.slice(1, 1 + AVTOMATIZACIJA_AUDIT.length)
    AVTOMATIZACIJA_AUDIT.forEach((v, i) => {
      const celice = blokA[i].split(';')
      expect(celice[0]).toBe(v.obmocje)
      expect(celice[1]).toBe(kv.vrstice[i].razredPrikazno)
      expect(celice[2]).toBe(kv.vrstice[i].plasti.join(' | '))
      // opomba vsebuje vejice/podpičja → RFC 4180 citirana; vsebina verbatim
      const opombaCelica = blokA[i].split(';').slice(3).join(';')
      expect(opombaCelica).toContain(kv.vrstice[i].opombaDokaza)
    })
  })

  it('vsebina WYSIWYG bloka B: kriterij/izpeljava/dokaz VERBATIM (ISTI nizi kot PDF body T2 + JSON kriteriji)', () => {
    const vrstice = raw.slice(1).split('\r\n').filter((v) => v.length > 0)
    const blokB = vrstice.slice(2 + AVTOMATIZACIJA_AUDIT.length, 2 + AVTOMATIZACIJA_AUDIT.length + kv.kriteriji.length)
    kv.kriteriji.forEach((k, i) => {
      const celice = blokB[i].split(';')
      expect(celice[0]).toBe(k.kriterij)
      expect(celice[1]).toBe(k.izpeljava)
      // dokaz vsebuje poti z vejicami → citiran; vsebina verbatim
      const dokazCelica = blokB[i].split(';').slice(2).join(';')
      expect(dokazCelica).toContain(k.dokaz)
    })
  })

  it('meta KPI ×4 = ISTI izpisi kot PDF kpiBox (String števci iz EN VIR) + sklep EN VIR (ŠESTI potrošnik ENEGA niza)', () => {
    expect(raw).toContain(`Območij;${String(kv.stObmocij)}`)
    expect(raw).toContain(`Z dokazi;${String(kv.stObmocijZDokazi)}`)
    expect(raw).toContain(`Kriterijev;${String(kv.stKriterijev)}`)
    expect(raw).toContain(`AI-OBVEZNO;${String(kv.stAiObveznih)}`)
    expect(raw).toContain(kv.sklep)
    expect(kv.sklep).toContain('AI-OBVEZNO: 0 — jedro deluje brez AI')
  })

  it('DETERMINIZEM: dva klica = bajtno identična datoteka; filename brez datuma — bratska simetrija z JSON R316 + PDF R320 imenoma', () => {
    expect(koncnaVerifikacijaCsv()).toBe(raw)
    expect(koncnaVerifikacijaCsv()).toBe(koncnaVerifikacijaCsv())
    expect(koncnaVerifikacijaCsvFilename()).toBe('koncna-verifikacija.csv')
    expect(koncnaVerifikacijaCsvFilename()).toBe(koncnaVerifikacijaCsvFilename())
    expect(koncnaVerifikacijaPdfFilename()).toBe('koncna-verifikacija.pdf')
  })

  it('kraftan vhod: vezava z opombo s podpičjem/narekovajem je varno citirana (RFC 4180) + plasti pipe-joined — celice prihajajo iz DOKAZNE VEZAVE (EN VIR join, NE iz audit poti)', () => {
    const kraft: readonly VrstaAudita[] = [
      {
        obmocje: '§X Test',
        razred: 'DETERMINISTICNO',
        implementacija: ['src/lib/x.ts'],
        dokaz: ['src/lib/__tests__/x.test.ts'],
        opomba: 'opomba audita (NE pride v CSV — celice iz vezave)',
      },
    ]
    const kraftDokazi = {
      '§X Test': {
        plasti: ['vitest', 'E2E ŽIVO'] as const,
        opomba: 'vezava z podpičjem; in "narekovajem" ter vejico, tudi',
      },
    }
    const csv = koncnaVerifikacijaCsv(kraft, kraftDokazi)
    const vrstice = csv.slice(1).split('\r\n').filter((v) => v.length > 0)
    // celice = ISTI izpisi kot PDF body T1: plasti pipe-joined + opomba
    // dokaza (iz VEZAVE) RFC 4180 citirana (podpičje sproži citiranje)
    expect(vrstice[1]).toBe('§X Test;DETERMINISTIČNO;vitest | E2E ŽIVO;"vezava z podpičjem; in ""narekovajem"" ter vejico, tudi"')
  })

  it('vrstica graditelja fail-closed: ne-objekt vrstica/kriterij → TypeError z imenom graditelja', () => {
    expect(() => koncnaVerifikacijaCsvVrstica(null as unknown as never)).toThrow(
      /koncnaVerifikacijaCsvVrstica: pričakovana vrstica/,
    )
    expect(() => koncnaVerifikacijaCsvKriterijVrstica(null as unknown as never)).toThrow(
      /koncnaVerifikacijaCsvKriterijVrstica: pričakovan kriterij/,
    )
  })

  it('fail-closed podedovan prek EN VIR: pokvarjen audit/dokazi/kriteriji propagira TypeError graditelja (tabela ne sme sanjati — tudi izvoz ne)', () => {
    // null (NE undefined — ta bi sprožil privzeti argument EN VIR)
    expect(() => koncnaVerifikacijaCsv(null as unknown as readonly VrstaAudita[])).toThrow(
      /koncnaVerifikacija: pričakovan audit/,
    )
    expect(() => koncnaVerifikacijaCsv([])).toThrow(/audit brez vrstic/)
    expect(() =>
      koncnaVerifikacijaCsv(AVTOMATIZACIJA_AUDIT, null as unknown as never),
    ).toThrow(/pričakovane dokazne vezave/)
    expect(() =>
      koncnaVerifikacijaCsv(AVTOMATIZACIJA_AUDIT, DOKAZI_AUDITA, null as unknown as never),
    ).toThrow(/pričakovani sprejemni kriteriji/)
    // območje brez dokazne vezave (kraftan dokazi) — fail-closed izpeljava
    expect(() =>
      koncnaVerifikacijaCsv(AVTOMATIZACIJA_AUDIT, { '§NEZNANO': { plasti: ['vitest'], opomba: 'x' } }),
    ).toThrow(/brez dokazne vezave/)
  })
})
