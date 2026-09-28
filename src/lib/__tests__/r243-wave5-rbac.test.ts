// ---------------------------------------------------------------------------
// R243 — P1-i wave 5: RBAC UI ogledalo na Zaloga površini (inventory-tab:
// premik zaloge + Shrani osnutek) in Dobavitelji/Cene površini
// (material-intelligence-tab: Nov dobavitelj + Dodaj ceno).
// ---------------------------------------------------------------------------
//   • API vrata obstajajo že od §10/R135 (NIČ nove logike na API — ogledalo
//     samo bere pravice in skriva gumbe, TOČNO R239/R241/R242 vzorec):
//       – POST /api/inventory s tipPremika → inventory.write ("Premike
//         zaloge beležita vodstvo ali skladišče"); brez tipPremika (nov
//         artikel) → catalog.manage (master podatek kataloga);
//       – POST /api/material-orders (osnutek naročila) → procurement.create;
//       – POST /api/suppliers → catalog.manage;
//       – POST /api/material-prices → price.override.
//   • UI do R243 ni poznal pravic na teh štirih vstopnih točkah: MONTER je
//     videl 'Dodaj gibanje zaloge' + 'Shrani osnutek' + 'Nov dobavitelj' +
//     'Dodaj ceno' (vsak klik = 403), SKLADISCE je videl Shrani osnutek /
//     Nov dobavitelj / Dodaj ceno, ki mu API prepove (ima samo
//     inventory.write + procurement.receive).
//   • Ogledalo (TOČNO R242 vzorec): pravice z GET /api/auth (EN VIR
//     RESNICE), fetch-on-mount z alive guardom, napaka → []; fail-closed
//     izpeljava (?? false, NIKOLI tiha inflacija); med nalaganjem (null)
//     akcije SKRITE (tišina je iskrena, least privilege); obrambni AND v
//     handlerjih + guard na odpiranju dialoga (vrata v vratah, R239/R242);
//     vlogo-osveščeni vodiči navajajo TOČNO imena pravic iz API vrat,
//     role="note" + aria-label, izključno žetoni (0 novih hex).
//   • [Mandatory] stil — press-scale pariteta primarnih CTA v dialogih:
//     'Potrdi premik' + dialog 'Shrani' (dobavitelj) + 'Shrani ceno' dozdaj
//     brez mikro-pritiska, sorojenci ('Shrani osnutek', 'Nov dobavitelj'
//     CTA, izvozne pilule) pa z njim — zdaj ISTI jezik v vseh štirih
//     dialogih vala 5.
//
// Strukturni pini (r238/r240/r241/r242 vzorec): vir = EDINA resnica za UI
// pogojno upodabljanje; test čita SOURCE, ne render (jsdom ne nosi
// Radix+fetch mreže).
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { permissionsForRole } from '@/lib/permissions-core'

const INV_ROUTE = path.join(__dirname, '../../app/api/inventory/route.ts')
const ORDERS_ROUTE = path.join(__dirname, '../../app/api/material-orders/route.ts')
const SUPPLIERS_ROUTE = path.join(__dirname, '../../app/api/suppliers/route.ts')
const PRICES_ROUTE = path.join(__dirname, '../../app/api/material-prices/route.ts')
const INV_UI = path.join(__dirname, '../../components/roksal/inventory-tab.tsx')
const MAT_UI = path.join(__dirname, '../../components/roksal/material-intelligence-tab.tsx')

const invRoute = readFileSync(INV_ROUTE, 'utf8')
const ordersRoute = readFileSync(ORDERS_ROUTE, 'utf8')
const suppliersRoute = readFileSync(SUPPLIERS_ROUTE, 'utf8')
const pricesRoute = readFileSync(PRICES_ROUTE, 'utf8')
const invUi = readFileSync(INV_UI, 'utf8')
const matUi = readFileSync(MAT_UI, 'utf8')

describe('R243 — API vrata (dokumentacija matrike, 4 vstopne točke)', () => {
  it('POST /api/inventory s tipPremika → inventory.write; brez (nov artikel) → catalog.manage', () => {
    expect(invRoute).toContain("hasPermission(auth, 'inventory.write')")
    expect(invRoute).toContain(
      'Premike zaloge beležita vodstvo ali skladišče (pravica inventory.write).',
    )
    expect(invRoute).toContain("denyWithoutPermission(request, 'catalog.manage')")
  })

  it('POST /api/material-orders (osnutek) → procurement.create (R242 pin pariteta)', () => {
    expect(ordersRoute).toContain("denyWithoutPermission(request, 'procurement.create')")
  })

  it('POST /api/suppliers → catalog.manage (vse tri pisalne metode)', () => {
    expect(suppliersRoute).toContain("denyWithoutPermission(request, 'catalog.manage')")
  })

  it('POST /api/material-prices → price.override', () => {
    expect(pricesRoute).toContain("denyWithoutPermission(request, 'price.override')")
  })
})

describe('R243 — UI fail-closed izpeljava pravic (EN VIR: GET /api/auth)', () => {
  it('inventory-tab: pravice prihajajo iz GET /api/auth z alive guardom (R242 vzorec)', () => {
    expect(invUi).toContain("fetch('/api/auth')")
    expect(invUi).toContain('data.permissions as readonly string[]')
    expect(invUi).toMatch(/let alive = true[\s\S]*alive = false/)
  })

  it('inventory-tab: izpeljava fail-closed — ?? false, nikoli ?? true / || true', () => {
    expect(invUi).toContain("myPermissions?.includes('inventory.write') ?? false")
    expect(invUi).toContain("myPermissions?.includes('procurement.create') ?? false")
    expect(invUi).not.toMatch(/\?\?\s*true/)
    expect(invUi).not.toMatch(/\|\|\s*true/)
  })

  it('material-intelligence-tab: dve novi izpeljavi iz ISTI fetch (brez druge mreže)', () => {
    // ISTA seja pravic — komponenta ima TOČNO EN fetch('/api/auth')
    expect((matUi.match(/fetch\('\/api\/auth'\)/g) ?? []).length).toBe(1)
    expect(matUi).toContain("myPermissions?.includes('catalog.manage') ?? false")
    expect(matUi).toContain("myPermissions?.includes('price.override') ?? false")
    expect(matUi).not.toMatch(/\?\?\s*true/)
  })
})

describe('R243 — UI vrata: štiri vstopne točke pogojno upodobljene po matriki', () => {
  it("gumb 'Dodaj gibanje zaloge' = inventory.write (skrit med nalaganjem in ob napaki)", () => {
    expect(invUi).toContain('{lahkoZapisujePremike && (')
    expect(invUi).toContain('aria-label="Dodaj gibanje zaloge"')
  })

  it("dialog Osnutka: 'Shrani osnutek' = procurement.create; CSV/PDF ostajata (odjemalska dokumentacija)", () => {
    expect(invUi).toContain('{lahkoUstvariNarocila && (')
    expect(invUi).toContain('onClick={handleShraniOsnutek}')
    // bralni tokova NISTA gated — P1-k precedens (naročilnica = odjemalski dokument)
    const osnutekZ = invUi.indexOf('<Dialog open={osnutekOpen}')
    const footerZ = invUi.indexOf('<DialogFooter>', osnutekZ)
    const footer = invUi.slice(footerZ, invUi.indexOf('</DialogFooter>', footerZ))
    expect(footer).toContain('aria-label="Prenesi naročilnico vidnih artiklov kot CSV"')
    expect(footer).toContain('aria-label="Prenesi naročilnico vidnih artiklov kot PDF"')
  })

  it("CTA 'Nov dobavitelj' = catalog.manage; sorojedni vodič nadomešča gumb", () => {
    expect(matUi).toContain('{lahkoUpravljaKatalog ? (')
    // R254 pin shift: codemod P1-d vstavil aria-hidden="true" (detektor r254).
    expect(matUi).toContain('<Plus aria-hidden="true" className="h-4 w-4 mr-2" /> Nov dobavitelj')
  })

  it("vhod v dialog cene = price.override + guard v onValueChange (vrata v vratah)", () => {
    expect(matUi).toContain('{lahkoUrejaCene ? (')
    expect(matUi).toContain('if (!lahkoUrejaCene) return')
  })
})

describe('R243 — obrambni AND v handlerjih (R242 vrata v vratah)', () => {
  it('handleMovement: AND na inventory.write PRED validacijo', () => {
    const z = invUi.indexOf('async function handleMovement()')
    const blok = invUi.slice(z, z + 400)
    expect(blok).toContain('if (!lahkoZapisujePremike) return')
    expect(blok.indexOf('if (!lahkoZapisujePremike) return')).toBeLessThan(
      blok.indexOf("toast.error('Izpolnite vsa obvezna polja')"),
    )
  })

  it('handleShraniOsnutek: AND na procurement.create PRED validacijo', () => {
    const z = invUi.indexOf('async function handleShraniOsnutek()')
    const blok = invUi.slice(z, z + 400)
    expect(blok).toContain('if (!lahkoUstvariNarocila) return')
    expect(blok.indexOf('if (!lahkoUstvariNarocila) return')).toBeLessThan(
      blok.indexOf("toast.error('Izberite dobavitelja za osnutek naročila.')"),
    )
  })

  it('handleCreateSupplier: AND na catalog.manage PRED validacijo', () => {
    const z = matUi.indexOf('const handleCreateSupplier = async () => {')
    const blok = matUi.slice(z, z + 400)
    expect(blok).toContain('if (!lahkoUpravljaKatalog) return')
    expect(blok.indexOf('if (!lahkoUpravljaKatalog) return')).toBeLessThan(
      blok.indexOf('if (!newSupplier.naziv) return'),
    )
  })

  it('handleAddPrice: AND na price.override PRED validacijo', () => {
    const z = matUi.indexOf('const handleAddPrice = async () => {')
    const blok = matUi.slice(z, z + 400)
    expect(blok).toContain('if (!lahkoUrejaCene) return')
    expect(blok.indexOf('if (!lahkoUrejaCene) return')).toBeLessThan(
      blok.indexOf('if (!selectedInventory || !newPrice.supplierId || !newPrice.cena) return'),
    )
  })
})

describe('R243 — vlogo-osveščeni vodiči (vidni ŠELE ko so pravice znane)', () => {
  it('vodič premikov: null = tišina; sicer note z TOČNO pravico inventory.write', () => {
    expect(invUi).toContain('myPermissions !== null && !lahkoZapisujePremike && (')
    expect(invUi).toContain('aria-label="Premiki zaloge so za branje — beleženje zahteva pravico"')
    expect(invUi).toContain('inventory.write</span>')
  })

  it('vodič Osnutka: procurement.create + iskren umik na CSV/PDF (brez lažnega konca)', () => {
    expect(invUi).toContain('myPermissions !== null && !lahkoUstvariNarocila && (')
    expect(invUi).toContain('aria-label="Shranjevanje osnutka naročila zahteva pravico"')
    const z = invUi.indexOf('Shranjevanje osnutka naročila je pravica')
    const vodic = invUi.slice(z, z + 500)
    expect(vodic).toContain('procurement.create</span>')
    expect(vodic).toContain('CSV ali PDF')
  })

  it('vodič dobaviteljev: catalog.manage; vodič cen: price.override', () => {
    expect(matUi).toContain('myPermissions !== null ? (')
    expect(matUi).toContain('aria-label="Dobavitelji so za branje — urejanje zahteva pravico"')
    expect(matUi).toContain('catalog.manage</span>')
    expect(matUi).toContain('aria-label="Vpisi cen zahtevajo pravico"')
    expect(matUi).toContain('price.override</span>')
  })

  it('vsi vodiči: role="note" + R242 žeton recept (border-border bg-muted/40 text-2xs)', () => {
    const recept = 'rounded-lg border border-border bg-muted/40 px-3 py-2 text-2xs text-muted-foreground'
    expect((invUi.match(new RegExp(recept, 'g')) ?? []).length).toBe(2)
    expect((matUi.match(new RegExp(recept, 'g')) ?? []).length).toBe(3)
    expect((invUi.match(/role="note"/g) ?? []).length).toBe(2)
    expect((matUi.match(/role="note"/g) ?? []).length).toBe(3)
  })

  it('vodiči ne kazujejo na skrite gumbe (besedilo NE vsebuje klik imperative)', () => {
    for (const [ime, src] of [['inv', invUi], ['mat', matUi]] as const) {
      const vsebina = src
      const zacetki = [...vsebina.matchAll(/role="note"/g)].map((m) => m.index ?? 0)
      for (const z of zacetki) {
        const blok = vsebina.slice(z, z + 600)
        expect(blok, `${ime} vodič @${z}`).not.toMatch(/klikni|Klikni|gumb /)
      }
    }
  })
})

describe('R243 — [Mandatory] stil: press-scale pariteta primarnih CTA v dialogih', () => {
  it("'Potrdi premik' + 'Shrani' + 'Shrani ceno' zdaj nosijo mikro-pritisk (sorojenci)", () => {
    const potrdi = invUi.slice(invUi.indexOf('onClick={handleMovement}'), invUi.indexOf('onClick={handleMovement}') + 300)
    expect(potrdi).toContain('press-scale')
    const shrani = matUi.slice(matUi.indexOf('onClick={handleCreateSupplier}'), matUi.indexOf('onClick={handleCreateSupplier}') + 200)
    expect(shrani).toContain('press-scale')
    const cena = matUi.slice(matUi.indexOf('onClick={handleAddPrice}'), matUi.indexOf('onClick={handleAddPrice}') + 200)
    expect(cena).toContain('press-scale')
  })

  it('štirje premik-gumb ikonski CTA ohrani družino amber fokusa + press-scale (pariteta z ostalimi ikonskimi)', () => {
    const z = invUi.indexOf('aria-label="Dodaj gibanje zaloge"')
    const blok = invUi.slice(Math.max(0, z - 400), z)
    expect(blok).toContain('bg-roksal-amber hover:bg-roksal-amber/90')
    expect(blok).toContain('press-scale')
  })

  it('0 novih hex: obe datoteki vala 5 ostaneta brez literalnih barv (žetoni)', () => {
    expect(invUi.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).toEqual([])
    expect(matUi.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).toEqual([])
  })
})

describe('R243 — matrična pariteta vlog (permissions-core EN VIR, R241/R242 vzorec)', () => {
  const PRIČAKOVANO = {
    // pričakovana izpeljava UI iz matrike:
    //   inventory-tab: premiki = inventory.write, osnutek = procurement.create
    //   material-tab:  dobavitelji = catalog.manage, cene = price.override
    ADMIN: { premiki: true, osnutek: true, dobavitelji: true, cene: true },
    VODJA: { premiki: true, osnutek: true, dobavitelji: true, cene: true },
    MONTER: { premiki: false, osnutek: false, dobavitelji: false, cene: false },
    SKLADISCE: { premiki: true, osnutek: false, dobavitelji: false, cene: false },
  } as const

  for (const [vloga, pričakovano] of Object.entries(PRIČAKOVANO)) {
    it(`vloga ${vloga}: UI vrata = API matrika (fail-closed dokumentacija)`, () => {
      const pravice = permissionsForRole(vloga)
      const ima = (p: string) => pravice.includes(p as never)
      expect(ima('inventory.write')).toBe(pričakovano.premiki)
      expect(ima('procurement.create')).toBe(pričakovano.osnutek)
      expect(ima('catalog.manage')).toBe(pričakovano.dobavitelji)
      expect(ima('price.override')).toBe(pričakovano.cene)
    })
  }

  it('NIČ sprememb na API strani vala 5: route vrata nespremenjena (ogledalo samo bere)', () => {
    // če kdo doda/odstrani vrata, se ta dokumentacija zlomi — namenoma
    // (štejejo se SAMO klici vrata — uvoz vrstice se ne štejeta)
    expect((suppliersRoute.match(/denyWithoutPermission\(request,/g) ?? []).length).toBe(3)
    expect((pricesRoute.match(/denyWithoutPermission\(request,/g) ?? []).length).toBe(1)
    expect((invRoute.match(/denyWithoutPermission\(request,/g) ?? []).length).toBe(1)
    expect((invRoute.match(/hasPermission\(auth, 'inventory.write'\)/g) ?? []).length).toBe(1)
  })
})
