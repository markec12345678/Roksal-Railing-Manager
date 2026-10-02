import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// R361 — STIL val 44: ring PARITETA crm-tab družine (1 datoteka × 1 družina —
// R360 kandidat 3). 9 popravkov: 6 × izvozni bratje (press-scale, L959–1049)
// + CSV pill (ml-auto, L942) + status filter bratje (template literal, L931)
// + opomnik PDF (offset-1→2, L1289). Aria/title ZAMRZNJENI (vsi že nosijo —
// proaktiven pin sken: r353 val 36 [aria 'Shrani spremembe CRM zapisa
// stranke' + title], r354 val 37, r332, r234, r166, zivostna — vse
// contains-pini, nič ne prelomi). Era-diskriminatorji = NOVI className token
// nizi [NOV tip needleja — iskreno dokumentiran v r361.tsv; vsi 3 ×1 v
// virih, 0 v HEAD]. 0 novih hex [iskrena zamrznjena resnica: crm-tab NIMA
// hex literalov — LEKCIJA R360 (4): '0 novih' dokazujemo s ŠTETJEM
// najdišč, tu je števec 0]. FEATURE runde: e2e-lib dedup 1. val — 2 NOVA
// pomočnika (eb_kolektor_napak + eb_preberi_kolektor; 3. identični inline
// blok iz r358/r359/r360 utemeljil EN VIR — prag LEKCIJA R352; zamrznjeni
// spot skripti NI mutirani; IIFE ovojnica obvezna — r231 invariant).

const CRM = readFileSync(join(process.cwd(), 'src/components/roksal/crm-tab.tsx'), 'utf8')
const E2ELIB = readFileSync(join(process.cwd(), 'scripts/e2e-lib.sh'), 'utf8')
const MERITVE = readFileSync(join(process.cwd(), 'src/components/roksal/measurements-tab.tsx'), 'utf8')
const RACUN = readFileSync(join(process.cwd(), 'src/components/roksal/invoice-manager.tsx'), 'utf8')

describe('R361 — STIL val 44: ring pariteta crm-tab družine', () => {
  it('(A) status filter bratje: navy/40 ring-2 + ring-offset-2 v template literalu (NOV needle ×1)', () => {
    expect(CRM).toContain(
      'focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2 ${statusFilter'
    )
    expect(CRM.match(/ring-roksal-navy\/40 focus-visible:ring-offset-2 \$\{statusFilter/g) ?? []).toHaveLength(1)
  })

  it('(B) CSV pill: ml-auto className + offset-2 (NOV needle ×1) + zamrznjena aria/title (era-kontrakt)', () => {
    expect(CRM).toContain(
      'className="ml-auto h-7 shrink-0 gap-1.5 text-[11px] focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2"'
    )
    // zamrznjeni nizi — needleji iz prejšnjih val ere ostanejo bajtno identični:
    expect(CRM).toContain('Izvozi CSV (')
    expect(CRM).toContain('title="Izvozi prikazani seznam strank v CSV"')
  })

  it('(C) izvozni bratje ×6: press-scale + navy/40 + offset-2 (števec, ne null — LEKCIJA R360 (4))', () => {
    const bratje = CRM.match(/press-scale focus-visible:ring-2 focus-visible:ring-roksal-navy\/40 focus-visible:ring-offset-2/g) ?? []
    expect(bratje).toHaveLength(6)
    // zamrznjeni aria/title vseh 6 bratov (r332 era + starejši):
    for (const aria of [
      'Izvozi potekle opomnike kot PDF',
      'Izvozi potekle opomnike kot CSV',
      'Izvozi koledar pregledov kot PDF',
      'Izvozi koledar pregledov kot CSV',
      'Izvozi koledar pregledov kot ICS',
      'Izvozi pokritost opomnikov kot PDF',
    ]) {
      expect(CRM).toContain(`aria-label="${aria}"`)
    }
  })

  it('(D) opomnik PDF: ring-offset-1 → ring-offset-2 (NOV needle ×1); ring-offset-1 IZKORENINJEN iz datoteke', () => {
    expect(CRM).toContain(
      'className="h-8 gap-1.5 px-2.5 text-[11px] font-medium press-scale focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2"'
    )
    expect(CRM).not.toContain('ring-offset-1')
    expect(CRM).toContain('aria-label="Pripravi opomnik kot PDF"')
    expect(CRM).toContain('title="Terenski list za ponovni kontakt kot pravi PDF — stranka, naloga, kontekst"')
  })

  it('(E) PARITETA POPOLNA: vseh 13 navy/40 nosi offset-2; 0 × ring-2 navy/40 brez offseta (obrnjen invariant)', () => {
    const navy40 = CRM.match(/focus-visible:ring-roksal-navy\/40/g) ?? []
    const zOffsetom = CRM.match(/focus-visible:ring-roksal-navy\/40 focus-visible:ring-offset-2/g) ?? []
    expect(navy40).toHaveLength(13)
    expect(zOffsetom).toHaveLength(13)
    const brezOffseta = CRM.match(/focus-visible:ring-2 focus-visible:ring-roksal-navy\/40(?! focus-visible:ring-offset)/g) ?? []
    expect(brezOffseta).toHaveLength(0)
  })

  it('(F) destruktivni/amber žig NESPREMENJEN: amber kartica že nosila offset-2 (parity kanon starejše ere)', () => {
    expect(CRM).toContain('focus-visible:ring-roksal-amber focus-visible:ring-offset-2')
  })

  it('(G) 0 novih hex: števec hex literalov v datoteki = zamrznjena resnica (0 — crm-tab jih ni imel)', () => {
    const hexi = CRM.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []
    expect(hexi).toHaveLength(0)
  })

  it('(H) r353 era-kontrakt CRM Shrani: aria + title + RING + aria-busy bajtno identični (val 44 NI posegel)', () => {
    expect(CRM).toContain('aria-label="Shrani spremembe CRM zapisa stranke"')
    expect(CRM).toContain('title="Shrani urejene podatke stranke v CRM register"')
    expect(CRM).toContain('focus-visible:ring-2 focus-visible:ring-roksal-navy/40')
    expect(CRM).toContain('aria-busy={saving}')
  })

  it('(I) FEATURE e2e-lib dedup 1. val: NOVA pomočnika + IIFE invariant (r231 lekcija) + zamrznjeni starejši', () => {
    expect(E2ELIB).toContain('eb_kolektor_napak()')
    expect(E2ELIB).toContain('eb_preberi_kolektor()')
    // LEKCIJA R358 je ZAPRTA v helperju (kolektor šele PO prijavi — dokumentirano):
    expect(E2ELIB).toContain('ŠELE PO prijavi')
    // IIFE invariant: vsaka eval vrstica (brez $pred indirekcije) je klican IIFE:
    const vrstice = E2ELIB.split('\n').filter((l) => l.includes('agent-browser eval') && !l.includes('$pred'))
    expect(vrstice.length).toBeGreaterThan(0)
    for (const l of vrstice) {
      expect(l, `predikat ni IIFE: ${l}`).toContain('})()"')
    }
    // starejši pomožniki ostanejo (r231/r232/r235 kontrakti):
    expect(E2ELIB).toContain('eb_odpri_in_prijavi()')
    expect(E2ELIB).toContain('eb_zajem_pdf()')
    expect(E2ELIB).toContain('eb_csv_capture()')
  })

  it('(J) obrnjena regresija val 41/42/43: starejše ere ostanejo ŽIVO (križna veriga)', () => {
    // val 41 (R358) — measurements syncAll title:
    expect(MERITVE).toContain('Sinhroniziraj vse lokalne osnutke v bazo — zaporedno v determinističnem vrstnem redu')
    // val 42 (R359) — bulk dialog Arhiviraj aria:
    expect(MERITVE).toContain('Potrdi arhiviranje izbranih meritev v bazo')
    // val 43 (R360) — invoice Briši title (pravi DELETE resnica):
    expect(RACUN).toContain('Trajno izbriši osnutek računa — brisanje ni možno razveljaviti')
  })

  it('(K) era-diskriminatorji val 44: ×1/×1/×2 v crm-tab (register r361.tsv sovinizacija; LEKCIJA R361: statičen segment brez interpolacijske meje)', () => {
    const stevec = (needle: string) =>
      (CRM.match(new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) ?? []).length
    expect(stevec('ml-auto h-7 shrink-0 gap-1.5 text-[11px] focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2')).toBe(1)
    expect(stevec('font-medium press-scale focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2')).toBe(1)
    // N3' pokriva ×2 mesti (status filter bratje + CSV pill) — multiplicita
    // iskreno dokumentirana v register glavi (precedens r349 '×2 mesti');
    // 1. kandidat '…offset-2 ${statusFilter' ZAVRŽEN — SWC konkatenacija v
    // buildu (1. build needle tek MISS — LEKCIJA R361):
    expect(stevec('text-[11px] focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2')).toBe(2)
  })
})
