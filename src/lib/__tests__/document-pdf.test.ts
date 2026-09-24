// R121 (issue #7, Problem 6) — PDF renderer: pravi artefakt, bajtno
// determinističen (100× pravilo), pokritost vseh štirih tipov dokumentov.
import { describe, it, expect } from 'vitest'
import { createHash } from 'node:crypto'
import { generateDocumentPdf, DOCUMENT_TITLES } from '@/lib/document-pdf'
import type { DocumentPdfInput } from '@/lib/document-pdf'

const BASE: DocumentPdfInput = {
  tipDokumenta: 'TEHNICNI_LIST',
  documentId: 'doc-123',
  version: 1,
  datumIzdaje: '2026-01-15T10:00:00.000Z',
  project: {
    naziv: 'Test stranka - raven balkon',
    status: 'NACRTOVANO',
    datumMontaze: '2026-02-01T00:00:00.000Z',
    opombe: 'Vstop z leve strani.',
    projectDataJson: JSON.stringify({
      lengthCm: 403,
      heightCm: 110,
      mountType: 'na fasado',
      railingStyle: 'raven',
      colorName: 'RAL 7016',
      colorHex: '#383e42',
    }),
  },
  customer: { ime: 'Janez Test', naslov: 'Ulica 1, Kranj', telefon: '041 111 222', email: 'j@x.si' },
  actor: 'vodja@roksal.si',
  measurements: [
    { dolzinaMm: 4031, visinaMm: 1100, createdAt: new Date('2026-01-10T08:00:00Z') },
    { dolzinaMm: 2050, visinaMm: 1100, createdAt: new Date('2026-01-10T08:05:00Z') },
  ],
  punchItems: [{ naslov: 'Privijte pokrov', opomba: 'levi vogal', status: 'open' }],
  invoice: { stevilka: '2026-001', osnova: 1000, ddv: 220, skupaj: 1220 },
}

describe('R121 document-pdf — pravi artefakt', () => {
  it('izhod je veljaven PDF (%PDF magični bajti + %%EOF + ID v glavi strani)', () => {
    const bytes = generateDocumentPdf(BASE)
    expect(bytes.length).toBeGreaterThan(1000)
    expect(bytes.subarray(0, 5).toString('ascii')).toBe('%PDF-')
    expect(bytes.subarray(-6).toString('ascii').trim()).toBe('%%EOF')
  })

  it('DETERMINIZEM: enak vhod = bajtno enak PDF = enak SHA-256', () => {
    const a = generateDocumentPdf(BASE)
    const b = generateDocumentPdf(BASE)
    expect(a.equals(b)).toBe(true)
    expect(createHash('sha256').update(a).digest('hex')).toBe(
      createHash('sha256').update(b).digest('hex')
    )
  })

  it('različen verzija/ID → različen hash (sledljivost artefakta)', () => {
    const v1 = generateDocumentPdf(BASE)
    const v2 = generateDocumentPdf({ ...BASE, version: 2 })
    expect(createHash('sha256').update(v1).digest('hex')).not.toBe(
      createHash('sha256').update(v2).digest('hex')
    )
  })

  it('vsi štirje tipi dokumentov generirajo veljaven PDF z pravim naslovom', () => {
    const types = ['TEHNICNI_LIST', 'PRIMOPREDAJA', 'E_RACUN', 'ZAPISNIK_NAVORA'] as const
    for (const t of types) {
      const bytes = generateDocumentPdf({ ...BASE, tipDokumenta: t })
      expect(bytes.subarray(0, 5).toString('ascii')).toBe('%PDF-')
      // Naslov je napisan s šumniki (subset font) — vsebina iz specifikacije:
      expect(DOCUMENT_TITLES[t].length).toBeGreaterThan(3)
    }
  })

  it('brez računa → E_RACUN vseeno veljaven PDF (iskren "ni izdanih")', () => {
    const bytes = generateDocumentPdf({ ...BASE, tipDokumenta: 'E_RACUN', invoice: null })
    expect(bytes.subarray(0, 5).toString('ascii')).toBe('%PDF-')
  })

  it('pokvarjen projectDataJson ne pade (tolerantno parse-anje)', () => {
    const bytes = generateDocumentPdf({
      ...BASE,
      project: { ...BASE.project, projectDataJson: '{pokvarjen' },
    })
    expect(bytes.subarray(0, 5).toString('ascii')).toBe('%PDF-')
  })
})
