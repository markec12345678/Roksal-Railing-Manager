// R360 — MANDATORY STIL val 43: a11y resnica računovodskih akcij družine —
// LEKCIJA R346 kanon (aria akcija+cilj; title dopolni kontekst/iskreno
// posledico; ring kanon focus-visible:ring-2 navy/40 + offset-2 — PARITETA;
// 0 novih hex). Družina = računi per-faktura akcije (invoice-manager.tsx —
// rdeči/destruktivni žig rdeče barve OHRANJEN, struktura dopolnjena). 9
// gumbov × 1 datoteko, VSE SPREMEMBE DODATNE (starejši aria/title nizi
// ostajajo bajtno identični; stale pin r241 'Briši' shiftan V ENI rundi —
// precedens R334/R355–R359):
//   1. 'Izdaj' → NOVI aria + NOVI title (iskrena posledica: neuspeh vrne
//      prejšnje stanje — optimistic update + rollback) + ring kanon;
//   2. 'Briši' → NOVI aria + NOVI title (deleteInvoice je PRAVI DELETE,
//      toast 'Osnutek brisan' — trajno, ni možno razveljaviti) + ring kanon;
//   3. 'Plačan' → NOVI aria + NOVI title (isti rollback resnica) + ring kanon;
//   4. 'Opomnik' → ring PARITETA (rdeči žig ohranjen; aria/title byte-identična);
//   5. 'Storno' → NOVI aria (dvoklik resnica) + NOVI title (3 s okno) + ring
//      PARITETA (roksal-red/40 ohranjena, ring-2 + offset-2 dopolnjena);
//   6. 'Uredi' → NOVI aria + NOVI title (iskrena posledica: osnutek se
//      odstrani, shranjevanje ustvari nov račun) + ring kanon (bil BREZ ringa);
//   7. 'PDF' → NOVI aria + NOVI title + ring kanon;
//   8. 'QR' → ring PARITETA (aria/title byte-identična);
//   9. 'XML' → ring PARITETA (aria/title byte-identična).
// Testi:
// (A) Izdaj blok: ring kanon + NOVI aria + NOVI title;
// (B) Briši blok: ring kanon + NOVI aria + NOVI title (trajno);
// (C) Plačan blok: ring kanon + NOVI aria + NOVI title;
// (D) Storno blok: ring-2 roksal-red/40 + offset-2 + NOVI aria/title;
// (E) Uredi blok: ring kanon + NOVI aria + NOVI title (iskrena posledica);
// (F) Opomnik + QR + XML: ring PARITETA + ZAMRZNJENI aria/title;
// (G) PDF blok: ring kanon + NOVI aria + NOVI title;
// (H) 0 novih hex (stil = žetonski razredi);
// (I) obrnjena regresija: val 42 bulk dialog + val 41 titleji (measurements
//     tab) ostanejo ŽIVI — parity nikoli ne ulomi prejšnjih valov;
// (J) NOVI nizi = enolični era-diskriminatorji (vsak točno ×1).
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const racuni = readFileSync(join(process.cwd(), 'src/components/roksal/invoice-manager.tsx'), 'utf8')
const tab = readFileSync(join(process.cwd(), 'src/components/roksal/measurements-tab.tsx'), 'utf8')

const RING_KANON = 'focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2'
const RED_KANON = 'focus-visible:ring-2 focus-visible:ring-roksal-red/40 focus-visible:ring-offset-2'

describe('r360 STIL val 43 — a11y resnica računovodskih akcij družine', () => {
  it('(A) Izdaj blok: ring kanon + NOVI aria (akcija+cilj) + NOVI title (iskrena posledica rollback)', () => {
    const z = racuni.indexOf("onClick={() => patchStatus(inv, 'IZDAN')}")
    expect(z).toBeGreaterThan(-1)
    const okno = racuni.slice(Math.max(0, z - 400), z + 400)
    expect(okno).toContain(RING_KANON)
    expect(okno).toContain('aria-label="Izdaj račun — status iz osnutka v izdan"')
    expect(okno).toContain('title="Potrdi izdajo računa — status se spremeni v izdan; neuspeh vrne prejšnje stanje"')
  })

  it('(B) Briši blok: ring kanon + NOVI aria + NOVI title (deleteInvoice = PRAVI DELETE — trajno)', () => {
    const z = racuni.indexOf('onClick={() => deleteInvoice(inv)}')
    expect(z).toBeGreaterThan(-1)
    const okno = racuni.slice(Math.max(0, z - 300), z + 300)
    expect(okno).toContain(RING_KANON)
    expect(okno).toContain('aria-label="Trajno izbriši osnutek računa"')
    expect(okno).toContain('title="Trajno izbriši osnutek računa — brisanje ni možno razveljaviti"')
  })

  it('(C) Plačan blok: ring kanon + NOVI aria + NOVI title (isti rollback resnica; EVOLVED R402 §19: gumb zdaj ZABELEŽI PLAČILO prek zabeleziPlacilo — odprta razlika iz strežniške izpeljave, status se izpelje na strežniku)', () => {
    const z = racuni.indexOf('onClick={() => zabeleziPlacilo(inv)}')
    expect(z).toBeGreaterThan(-1)
    const okno = racuni.slice(Math.max(0, z - 400), z + 400)
    expect(okno).toContain(RING_KANON)
    expect(okno).toContain('aria-label={`Zabeleži plačilo ${eur(odprto)} na račun ${inv.stevilka}`}')
    expect(okno).toContain('title={`Zabeleži plačilo (${eur(odprto)}) prek /api/payments — status se izpelje strežniško (R402 §19); delno plačilo → Delno plačan`}')
  })

  it('(D) Storno blok: ring-2 roksal-red/40 + offset-2 (destruktivni žig ohranjen) + NOVI aria (dvoklik resnica) + NOVI title (3 s okno)', () => {
    const z = racuni.indexOf("patchStatus(inv, 'STORNIRAN')")
    expect(z).toBeGreaterThan(-1)
    const okno = racuni.slice(Math.max(0, z - 700), z + 600)
    expect(okno).toContain(RED_KANON)
    expect(okno).toContain('aria-label="Storniraj račun — drugi klik potrdi"')
    expect(okno).toContain('title="Storniraj račun — prvi klik prikaže potrditev, drugi klik stornira (3 s okno)"')
  })

  it('(E) Uredi blok: ring kanon (prej BREZ ringa) + NOVI aria + NOVI title (iskrena posledica: osnutek se odstrani)', () => {
    const z = racuni.indexOf('aria-label="Uredi osnutek računa"')
    expect(z).toBeGreaterThan(-1)
    const okno = racuni.slice(Math.max(0, z - 700), z + 300)
    expect(okno).toContain(RING_KANON)
    expect(okno).toContain('title="Uredi osnutek — osnutek se odstrani, dialog zapolni polja; shranjevanje ustvari nov račun"')
  })

  it('(F) Opomnik + QR + XML: ring PARITETA + ZAMRZNJENI aria/title (starejši nizi byte-identični)', () => {
    // Opomnik: rdeči ring parity, aria/title ostajata (template literali).
    const o = racuni.indexOf('onClick={() => generateOpomnik(inv)}')
    expect(o).toBeGreaterThan(-1)
    const oknoO = racuni.slice(Math.max(0, o - 300), o + 400)
    expect(oknoO).toContain(RED_KANON)
    expect(oknoO).toContain('title={`Plačilni opomnik — zapadlo ${zapadlo} dni`}')
    expect(oknoO).toContain('aria-label={`Plačilni opomnik za račun ${inv.stevilka}`}')
    // QR: navy parity, zamrznjena aria/title.
    const q = racuni.indexOf('onClick={() => setQrInvoice(inv)}')
    expect(q).toBeGreaterThan(-1)
    const oknoQ = racuni.slice(Math.max(0, q - 300), q + 400)
    expect(oknoQ).toContain(RING_KANON)
    expect(oknoQ).toContain('title="UPN QR koda za plačilo"')
    expect(oknoQ).toContain('aria-label="UPN QR koda za plačilo"')
    // XML: navy parity, zamrznjena aria/title.
    const x = racuni.indexOf('onClick={() => void downloadXml(inv)}')
    expect(x).toBeGreaterThan(-1)
    const oknoX = racuni.slice(Math.max(0, x - 300), x + 400)
    expect(oknoX).toContain(RING_KANON)
    expect(oknoX).toContain('title="eRačun XML (eSlog 2.1 / EN 16931)"')
    expect(oknoX).toContain('aria-label="Prenesi eRačun XML"')
  })

  it('(G) PDF blok: ring kanon + NOVI aria + NOVI title', () => {
    const z = racuni.indexOf('onClick={() => generatePdf(inv)}')
    expect(z).toBeGreaterThan(-1)
    const okno = racuni.slice(Math.max(0, z - 300), z + 400)
    expect(okno).toContain(RING_KANON)
    expect(okno).toContain('aria-label="Prenesi račun kot PDF"')
    expect(okno).toContain('title="Generiraj in prenesi račun kot PDF dokument"')
  })

  it('(H) 0 novih hex — edini hex v datoteki = 3 × QR barvni par (pred val 43, nedotaknjen — zamrznjen seznam)', () => {
    const hex = racuni.match(/#[0-9a-fA-F]{6}\b/g) ?? []
    // 3 QR kode (temno #1d2b3e + svetlo #ffffff) — prejšnja resnica, val 43 NI dodal nobenega:
    expect(hex.length).toBe(6)
    expect(hex.every((h) => h === '#1d2b3e' || h === '#ffffff')).toBe(true)
  })

  it('(I) obrnjena regresija: val 42 bulk dialog + val 41 titleji (measurements tab) ostanejo ŽIVI', () => {
    // val 42 (R359): bulk dialog Prekliči + Arhiviraj.
    expect(tab).toContain('title="Zapri pogovorno okno — nič se ne arhivira, izbira meritev ostane"')
    expect(tab).toContain('aria-label="Potrdi arhiviranje izbranih meritev v bazo"')
    // val 41 (R358): syncAll + per-draft + discard titleji.
    expect(tab).toContain('title="Sinhroniziraj vse lokalne osnutke v bazo — zaporedno v determinističnem vrstnem redu"')
    expect(tab).toContain('title="Pošlji shranjeno telo osnutka v bazo (neuspeh ostane lokalni osnutek)"')
    expect(tab).toContain('title="Odstrani lokalni osnutek — ni bil nikoli poslan v bazo"')
  })

  it('(J) NOVI nizi = enolični era-diskriminatorji (vsak točno ×1; EVOLVED R402 §19: "Označi račun kot plačan" → zabeleziPlacilo dobesedno ×1 + Novi gumb Poslan aria ×1)', () => {
    expect(racuni.match(/Izdaj račun — status iz osnutka v izdan/g)?.length).toBe(1)
    expect(racuni.match(/aria-label="Trajno izbriši osnutek računa"/g)?.length).toBe(1)
    expect(racuni.match(/zabeleziPlacilo\(inv\)/g)?.length).toBe(1)
    expect(racuni.match(/aria-label="Označi račun kot poslan kupcu"/g)?.length).toBe(1)
    expect(racuni.match(/Storniraj račun — drugi klik potrdi/g)?.length).toBe(1)
    expect(racuni.match(/Uredi osnutek — osnutek se odstrani, dialog zapolni polja; shranjevanje ustvari nov račun/g)?.length).toBe(1)
    expect(racuni.match(/Prenesi račun kot PDF/g)?.length).toBe(1)
    expect(racuni.match(/Generiraj in prenesi račun kot PDF dokument/g)?.length).toBe(1)
  })
})
