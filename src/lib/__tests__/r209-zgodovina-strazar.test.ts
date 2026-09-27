// R209 — F1: ZGODOVINA PREHODOV NAROČILA (stražar).
// ---------------------------------------------------------------------------
// Kartica naročila dobi gumb 'Zgodovina' (aria-expanded preklopnik) →
// /api/material-orders/history → timeline prehodov (kdo, kdaj, iz → v).
// Pravila družine (R201/R203/R204):
//  (1) pripadnost dogodka naročilu odloči STREŽNIK po TOČNI enakosti razčlenjenega
//      orderId (substring `contains` je LE predizbor — podniz nikoli ne odloča);
//  (2) starejši zapisi brez orderId se NE izmišljujejo — iskreno prazno stanje
//      z razlago (fail-closed, brez lažne zgodovine);
//  (3) PATCH audit dogodki nosijo { orderId, status } (R209 obogatitev — prej
//      gol status brez povezave na naročilo);
//  (4) fail-verbose (R140): napaka zgodovine je viden razlog, ne tiho prazno;
//  (5) UI NE razčlenja audit vrednosti (EN vir resnice na strežniku);
//  (6) 0 novih hex — obstoječa barvna družina značk (r166/r172 ogledala).
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '..', '..', '..')

const beri = (rel: string): string => readFileSync(join(ROOT, rel), 'utf-8')

function oknoMed(src: string, od: string, do_: string): string {
  const a = src.indexOf(od)
  expect(a).toBeGreaterThanOrEqual(0)
  const b = src.indexOf(do_, a)
  expect(b).toBeGreaterThan(a)
  return src.slice(a, b)
}

describe('R209 stražar: history ruta — avtorizacija + kontrakt', () => {
  const ruta = beri('src/app/api/material-orders/history/route.ts')

  it('isti kontrakt kot GET naročil: seja obvezna, API ključ zavrnjen (R126)', () => {
    expect(ruta).toContain('const auth = await authenticate(request)')
    expect(ruta).toContain('if (!auth) return unauthorized()')
    expect(ruta).toContain("auth.kind === 'apikey'")
    expect(ruta).toContain('Zgodovina naročil je poslovni podatek — API ključ nima dostopa.')
  })

  it('orderId obvezen (fail-closed 400) + neznano naročilo = 404 (brez prazne zgodovine za tuje ID)', () => {
    expect(ruta).toContain('orderId.length < 8')
    expect(ruta).toContain("error: 'Manjka ali je prekratek orderId.'")
    expect(ruta).toContain("error: 'Naročilo ne obstaja.'")
    expect(ruta).toContain('{ status: 404 }')
  })

  it('samo dogodki prehodov naročil (štiri akcije — ne cel dnevnik)', () => {
    const okno = oknoMed(ruta, 'const AKCIJA_PREHODOV', '] as const')
    expect(okno).toContain("'MATERIAL_ORDER_CREATED'")
    expect(okno).toContain("'MATERIAL_ORDER_STATUS'")
    expect(okno).toContain("'MATERIAL_RECEIPT'")
    expect(okno).toContain("'MATERIAL_RECEIPT_DUPLICATE'")
  })

  it('determinizem: substring je LE predizbor, odloča TOČNA enakost razčlenjenega orderId', () => {
    const okno = oknoMed(ruta, 'const dogodki = kandidati', '.slice(0, MAX_DOGEVKI)')
    expect(okno).toContain("staro.orderId === orderId ? staro.status : null")
    expect(okno).toContain("novo.orderId === orderId ? novo.status : null")
    expect(okno).toContain('.filter((d) => d.statusPrej !== null || d.statusPotem !== null)')
    expect(ruta).toContain('{ contains: orderId }')
    expect(ruta).toContain('OR: [{ oldValue: { contains: orderId } }, { newValue: { contains: orderId } }]')
  })

  it('zgornja meja + uporabnik (ime/email/vloga) + fail-verbose 500 s korelacijo', () => {
    expect(ruta).toContain('take: 200')
    expect(ruta).toContain('MAX_DOGEVKI = 50')
    expect(ruta).toContain("ime: true, email: true, vloga: true")
    expect(ruta).toContain("logWithCorrelation('material-orders.history'")
    expect(ruta).toContain("'Napaka pri branju zgodovine naročila'")
    expect(ruta).toContain('{ status: 500 }')
  })
})

describe('R209 stražar: PATCH audit obogatitev ({ orderId, status })', () => {
  const ruta = beri('src/app/api/material-orders/route.ts')

  it('MATERIAL_ORDER_STATUS nosi orderId v oldValue IN newValue (prej gol status)', () => {
    const okno = oknoMed(ruta, "akcija: 'MATERIAL_ORDER_STATUS'", 'NextResponse.json(updated)')
    expect(okno).toContain('oldValue: { orderId: id, status: existing.status }')
    expect(okno).toContain('newValue: { orderId: id, status }')
  })

  it('MATERIAL_RECEIPT nosi orderId (idempotenten prejem je tudi sledljiv)', () => {
    const okno = oknoMed(ruta, "akcija: result.alreadyReceived", 'return NextResponse.json')
    expect(okno).toContain('oldValue: { orderId: id, status: existing.status }')
    expect(okno).toContain("newValue: { orderId: id, status: 'DOBLJENO' }")
  })

  it('prehodni stroj NESPREMENJEN (5 stanj — R135/R140 kontrakt)', () => {
    const okno = oknoMed(ruta, 'const ORDER_TRANSITIONS', 'GET — naročila')
    expect(okno).toContain("OSNUTEK: ['POSLANO', 'POTRJENO', 'PREKlicANO']")
    expect(okno).toContain("POSLANO: ['POTRJENO', 'DOBLJENO', 'PREKlicANO']")
    expect(okno).toContain("POTRJENO: ['DOBLJENO', 'PREKlicANO']")
    expect(okno).toContain('DOBLJENO: []')
    expect(okno).toContain('PREKlicANO: []')
  })
})

describe('R209 stražar: UI zgodovina na kartici naročila', () => {
  const src = beri('src/components/roksal/material-intelligence-tab.tsx')

  it('stanja zgodovine: panel id + dogodki + nalaganje + napaka (kvartet)', () => {
    const okno = oknoMed(
      src,
      '// R209 — zgodovina prehodov: lenar odpiranje',
      'const { toast } = useToast()',
    )
    expect(okno).toContain('useState<string | null>(null)')
    expect(okno).toContain('useState<Record<string, ZgodovinaVnos[]>>({})')
    expect(okno).toContain('zgodovinaNalaganje')
    expect(okno).toContain('zgodovinaNapaka')
  })

  it('prinesiZgodovino: svež fetch z encodeURIComponent + fail-verbose + finally', () => {
    const okno = oknoMed(
      src,
      '// R209 — zgodovina prehodov: prinese SVEŽE',
      '// R206 — naročilnica iz naročila',
    )
    expect(okno).toContain('/api/material-orders/history?orderId=')
    expect(okno).toContain('encodeURIComponent(orderId)')
    expect(okno).toContain('Array.isArray(dogodki)')
    expect(okno).toContain('`Napaka ${res.status}`')
    expect(okno).toContain("setZgodovinaNapaka('Omrežna napaka')")
    expect(okno).toContain('setZgodovinaNalaganje(false)')
  })

  it('toggle je pravi preklopnik (isti panel → zapri, brez pošiljanja)', () => {
    const okno = oknoMed(
      src,
      '// R209 — toggle zgodovine na kartici',
      '// R206 — naročilnica iz naročila',
    )
    expect(okno).toContain('setZgodovinaOrderId(null)')
    expect(okno).toContain('void prinesiZgodovino(orderId)')
  })

  it('živi panel: nov prehod sveže zgodovino (brez zastarele sledi)', () => {
    const okno = oknoMed(
      src,
      '// R209 — če je panel zgodovine tega naročila odprt',
      "} else {",
    )
    expect(okno).toContain('zgodovinaOrderId === orderId')
    expect(okno).toContain('void prinesiZgodovino(orderId)')
  })

  it('gumb Zgodovina: aria-expanded + aria-label z dobaviteljem + History aria-hidden + focus ring', () => {
    const okno = oknoMed(
      src,
      '{/* R209 — zgodovina prehodov: pravi aria-expanded',
      'Zgodovina\n                        </Button>',
    )
    expect(okno).toContain('aria-expanded={zgodovinaOrderId === order.id}')
    expect(okno).toContain('aria-label={`Zgodovina prehodov naročila pri ${order.supplier.naziv}`}')
    expect(okno).toContain('<History className="h-3 w-3" aria-hidden="true" />')
    expect(okno).toContain('focus-visible:ring-roksal-navy/40')
  })

  it('timeline: nalaganje + fail-verbose alert + iskreno prazno (ne izmišljujemo) + regijska aria', () => {
    const okno = oknoMed(
      src,
      '{/* R209 — zgodovina prehodov (timeline)',
      '</CardContent>',
    )
    expect(okno).toContain('Nalaganje zgodovine …')
    expect(okno).toContain('Zgodovine ni mogoče prikazati:')
    expect(okno).toContain('Še ni zapisanih prehodov za to naročilo.')
    expect(okno).toContain('jih ne izmišljujemo.')
    expect(okno).toContain('role="alert"')
    expect(okno).toContain('role="region"')
  })

  it('UI NE razčlenja audit vrednosti (EN vir resnice na strežniku — statusPrej/statusPotem)', () => {
    const okno = oknoMed(
      src,
      '{/* R209 — zgodovina prehodov (timeline)',
      '</CardContent>',
    )
    expect(okno).toContain('d.statusPotem')
    expect(okno).toContain('d.statusPrej')
    expect(okno).not.toContain('JSON.parse')
  })

  it('akcijaOznaka: štiri znane akcije + iskren surovi fallback za neznane', () => {
    const okno = oknoMed(src, 'function akcijaOznaka', 'return zemljevid[akcija] ?? akcija')
    expect(okno).toContain("MATERIAL_ORDER_CREATED: 'Ustvarjeno'")
    expect(okno).toContain("MATERIAL_ORDER_STATUS: 'Sprememba statusa'")
    expect(okno).toContain("MATERIAL_RECEIPT: 'Prejem v zalogo'")
    expect(okno).toContain("MATERIAL_RECEIPT_DUPLICATE: 'Podvojen prejem zavrnjen (idempotentno)'")
  })

  it('statusZnackaCls ogledala barvne družine značk na kartici (vsi dark: na isti vrstici)', () => {
    const okno = oknoMed(src, 'function statusZnackaCls', "'bg-gray-50 dark:bg-gray-950/40")
    expect(okno).toContain('bg-red-50 dark:bg-red-950/40')
    expect(okno).toContain('bg-green-50 dark:bg-green-950/40')
    expect(okno).toContain('bg-blue-50 dark:bg-blue-950/40')
    expect(okno).toContain('bg-amber-50 dark:bg-amber-950/40')
  })

  it('0 novih hex v R209 oknih (tokeni, r166/r172 družina)', () => {
    const okna = [
      oknoMed(src, 'function statusZnackaCls', 'function downloadOrdersCsv'),
      oknoMed(src, '{/* R209 — zgodovina prehodov (timeline)', '</CardContent>'),
    ]
    for (const okno of okna) expect(okno).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })
})
