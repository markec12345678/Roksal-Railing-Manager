// ---------------------------------------------------------------------------
// R241 — P1-i wave 3: RBAC UI ogledalo na Računi površini (invoice-manager).
// ---------------------------------------------------------------------------
//   • API ima vrata že od R239/R240 revizije: POST + DELETE → invoices.create,
//     PATCH IZDAN/PLACAN → invoices.issue, PATCH STORNIRAN → invoices.cancel
//     (denyUnlessInvoice v app/api/invoices/route.ts). UI do R241 ni poznal
//     pravic — MONTER/SKLADISCE (samo invoices.read) je videl gumb, ki bi
//     končal s 403 (naključno odkrivanje, R239 izkustveni argument).
//   • R241 ogledalo (ISTI vzorec kot dashboard R239 + team-tab R135):
//       – pravice se preberejo z GET /api/auth (EN VIR RESNICE, R135);
//       – fail-closed: med nalaganjem (null) in ob napaki ([]) so pisalne
//         akcije SKRITE (least privilege, nikoli lažni gumb);
//       – vlogo-osveščen vodič samo za gledalce brez pisalnih pravic —
//         navaja TOČNO permission-imeni iz vrat, nikoli kazalec na skrit gumb;
//       – obrambni AND na dialog open (R239 vzorec: vrata v vratah);
//       – fail-verbose: 403 {error, detail} — človeku razumljiv razlog pride
//         do uporabnika (do R241 je UI pokazal samo generični "Prepovedano").
//   • Stil (Mandatory): številčna poravnava računovodske površine — dialog
//     totals + QR znesek dobi tabular-nums; CTA press-scale pariteta s
//     sorojcem CSV v isti vrstici; vodič izključno žetoni (0 novih hex —
//     edini hex v datoteki so QRCode canvas barve, dokumentirana semantika).
//
// Strukturni pini (r238/r240 vzorec): vir = EDINA resnica za UI pogojno
// upodabljanje; Test čita SOURCE, ne render (jsdom ne nosi Radix+fetch mreže).
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { permissionsForRole } from '@/lib/permissions-core'

const ROUTE = path.join(__dirname, '../../app/api/invoices/route.ts')
const UI = path.join(__dirname, '../../components/roksal/invoice-manager.tsx')

const routeSrc = readFileSync(ROUTE, 'utf8')
const uiSrc = readFileSync(UI, 'utf8')

describe('R241 — API vrata (dokumentacija paritete, brez mutacij)', () => {
  it('POST /api/inphones ni — denyUnlessInvoice obstaja in pokriva točno tri pravice', () => {
    expect(routeSrc).toContain('denyUnlessInvoice(')
    // trije dovoljeni argumenti — natančna množica, ki jo ogleduje UI
    expect(routeSrc).toContain("'invoices.create'")
    expect(routeSrc).toContain("'invoices.issue'")
    expect(routeSrc).toContain("'invoices.cancel'")
  })

  it('403 nosi človeku razumljiv razlog s imenom pravice (fail-verbose vir)', () => {
    expect(routeSrc).toContain('potrebna je pravica ${permission}')
    expect(routeSrc).toContain('Računi so uradni dokumenti')
  })

  it('PATCH vrata so odločena po statusu: STORNIRAN → cancel, sicer issue', () => {
    expect(routeSrc).toContain(
      "bodyPreview.status === 'STORNIRAN' ? 'invoices.cancel' : 'invoices.issue'",
    )
  })
})

describe('R241 — UI fail-closed izpeljava pravic (EN VIR: GET /api/auth)', () => {
  it('pravice prihajajo iz GET /api/auth (R135 EN VIR RESNICE)', () => {
    expect(uiSrc).toContain("fetch('/api/auth')")
    expect(uiSrc).toContain("data.permissions as readonly string[]")
  })

  it('izpeljava je fail-closed: ?? false, nikoli ?? true / || true', () => {
    expect(uiSrc).toContain("myPermissions?.includes('invoices.create') ?? false")
    expect(uiSrc).toContain("myPermissions?.includes('invoices.issue') ?? false")
    expect(uiSrc).toContain("myPermissions?.includes('invoices.cancel') ?? false")
    // prepovedana tiha inflacija pravic:
    expect(uiSrc).not.toMatch(/\?\?\s*true/)
    expect(uiSrc).not.toMatch(/\|\|\s*true/)
  })

  it('samoBranje izgovarja resnico ŠELE ko je pravicni seznam znan (null = tišina)', () => {
    expect(uiSrc).toContain('myPermissions !== null && !lahkoUstvarja && !lahkoIzdaja && !lahkoStornira')
  })
})

describe('R241 — UI vrata: akcije so pogojno upodobljene po pravicah', () => {
  it('Nov račun CTA viden SAMO nosilcu invoices.create', () => {
    const gated = uiSrc.includes('{lahkoUstvarja && (\n              <Button\n                size="sm"\n                onClick={() => setDialogOpen(true)}')
    expect(gated).toBe(true)
  })

  it('Uredi (brisi+zaključi osnutek) zahteva invoices.create', () => {
    expect(uiSrc).toContain("{inv.status === 'OSNUTEK' && lahkoUstvarja && (")
  })

  it('Izdaj in Plačan zahtevata invoices.issue (API pariteta: PATCH → issue)', () => {
    // Izdaj (OSNUTEK blok)
    expect(uiSrc).toMatch(/\{lahkoIzdaja && \(\n\s*<Button\n\s*size="sm"\n\s*className="h-7 text-xs bg-emerald-600[^"]*"\n\s*onClick=\{\(\) => patchStatus\(inv, 'IZDAN'\)\}/)
    // Plačan (IZDAN blok)
    expect(uiSrc).toMatch(/\{lahkoIzdaja && \(\n\s*<Button\n\s*size="sm"\n\s*className="h-7 text-xs bg-emerald-600[^"]*"\n\s*onClick=\{\(\) => patchStatus\(inv, 'PLACAN'\)\}/)
  })

  it('Briši zahteva invoices.create (DELETE vrata) — stale pin shiftan val 43 (R360, precedens R334/R355–R359: className ring kanon + aria/title dodana, vrata in pogoj ostajata)', () => {
    expect(uiSrc).toContain('{lahkoUstvarja && (\n                          <Button size="sm" variant="outline" className="h-7 text-xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2 focus-visible:border-roksal-navy/40 dark:focus-visible:border-roksal-ink/40" onClick={() => deleteInvoice(inv)} aria-label="Trajno izbriši osnutek računa" title="Trajno izbriši osnutek računa — brisanje ni možno razveljaviti">')
  })

  it('Storno zahteva invoices.cancel (destruktivna pravna akcija)', () => {
    expect(uiSrc).toContain('{lahkoStornira && (')
    expect(uiSrc).toContain("patchStatus(inv, 'STORNIRAN')")
  })

  it('obrambni AND na dialog open (R239 vzorec: vrata v vratah)', () => {
    expect(uiSrc).toContain('if (open && !lahkoUstvarja) return')
  })
})

describe('R241 — vlogo-osveščen vodič (nikoli kazalec na skrit gumb)', () => {
  it('vodič navaja TOČNO permission-imeni iz API vrat (pariteta besedišča)', () => {
    expect(uiSrc).toContain('Pregled računov je samo za branje')
    expect(uiSrc).toContain('invoices.create / invoices.issue / invoices.cancel')
    expect(uiSrc).toContain('izvaja vodstvo')
  })

  it('vodič je izključno žetoni (text-2xs + text-muted-foreground, brez stone)', () => {
    expect(uiSrc).toContain('className="text-2xs text-muted-foreground"')
    expect(uiSrc).not.toContain('bg-stone-')
    expect(uiSrc).not.toContain('text-stone-')
  })
})

describe('R241 — fail-verbose: 403 razlog pride do uporabnika', () => {
  it('createInvoice bere detail pred error (forbidden() nosi {error, detail})', () => {
    expect(uiSrc).toMatch(/const razlog: string \| null =\n\s*typeof err\?\.detail === 'string'/)
    expect(uiSrc).toContain("razlog ?? 'Napaka pri shranjevanju'")
  })

  it('patchStatus vrže Error z razlogom in catch pokaže sporočilo (ne generično tiho)', () => {
    expect(uiSrc).toContain("throw new Error(razlog ?? 'Napaka pri posodabljanju')")
    expect(uiSrc).toContain('e instanceof Error ? e.message')
  })

  it('deleteInvoice bere detail pred error', () => {
    expect(uiSrc).toContain("razlog ?? 'Napaka pri brisanju'")
  })
})

describe('R241 — [Mandatory] stil: številčna poravnava računovodske površine', () => {
  it('dialog totals (Osnova / DDV skupine / Za plačilo) nosijo tabular-nums', () => {
    expect(uiSrc).toContain('className="font-semibold tabular-nums">{eur(formTotals.osnova)}')
    expect(uiSrc).toContain('className="font-semibold tabular-nums">{eur(z)}')
    expect(uiSrc).toContain('className="tabular-nums">{eur(formTotals.znesek)}')
  })

  it('UPN QR dialog znesek nosi tabular-nums', () => {
    expect(uiSrc).toContain('className="text-base font-bold tabular-nums text-roksal-ink">{eur(qrInvoice.znesek)}')
  })

  it('Nov račun CTA ima press-scale pariteto s sorojcem CSV v isti vrstici', () => {
    // oba gumba v header akcijah nosita isti mikro-interakcijski jezik —
    // točen večvrstični pin (onClick vsebuje '>', ki bi prekinil [^>]* pin)
    // R309 pin shift: surovi par amber-500/navy-900 → žetona roksal-amber /
    // roksal-navy (harmonizacija surovih palet invoice-managerja, 0 novih hex).
    const headerOk = uiSrc.includes(
      '{lahkoUstvarja && (\n              <Button\n                size="sm"\n                onClick={() => setDialogOpen(true)}\n                className="h-8 bg-roksal-amber text-roksal-navy hover:bg-roksal-amber/90 press-scale"',
    )
    expect(headerOk).toBe(true)
  })

  it('0 novih hex — edini hex v datoteki so QRCode canvas barve (r235 per-kontekst)', () => {
    const hexDovoljeni = [
      "color: { dark: '#1d2b3e', light: '#ffffff' },",
      "color: { dark: '#1d2b3e', light: '#ffffff' },",
      "color: { dark: '#1d2b3e', light: '#ffffff' },",
    ]
    const najdeni = uiSrc.match(/color: \{ dark: '#[0-9a-f]{6}', light: '#[0-9a-f]{6}' \},/g) ?? []
    expect(najdeni).toEqual(hexDovoljeni)
    // noben drug hex (CSS razredi, inline stili) ne obstaja — vsak par ima
    // dve barvni vrednosti (#1d2b3e + #ffffff), skupaj 6 zadetkov
    const ostali = uiSrc.match(/#[0-9a-fA-F]{6}\b/g) ?? []
    expect(ostali).toEqual([
      '#1d2b3e', '#ffffff',
      '#1d2b3e', '#ffffff',
      '#1d2b3e', '#ffffff',
    ])
  })
})

describe('R241 — matrična pariteta: kdo vidi kaj (permissions-core EN VIR)', () => {
  it('MONTER in SKLADISCE imata samo invoices.read → vse pisalne akcije skrite', () => {
    for (const vloga of ['MONTER', 'SKLADISCE']) {
      const p = permissionsForRole(vloga)
      expect(p).toContain('invoices.read')
      expect(p).not.toContain('invoices.create')
      expect(p).not.toContain('invoices.issue')
      expect(p).not.toContain('invoices.cancel')
      // ogledalo: UI zastavice bi bile vse false — samoBranje = true
      const lahkoUstvarja = p.includes('invoices.create')
      const lahkoIzdaja = p.includes('invoices.issue')
      const lahkoStornira = p.includes('invoices.cancel')
      expect(lahkoUstvarja || lahkoIzdaja || lahkoStornira).toBe(false)
    }
  })

  it('ADMIN in VODJA nosita vse tri pravice → ogledalo kaže enake akcije kot API odpre', () => {
    for (const vloga of ['ADMIN', 'VODJA']) {
      const p = permissionsForRole(vloga)
      expect(p).toContain('invoices.create')
      expect(p).toContain('invoices.issue')
      expect(p).toContain('invoices.cancel')
    }
  })
})
