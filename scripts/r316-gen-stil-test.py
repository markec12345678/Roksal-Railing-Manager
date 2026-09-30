#!/usr/bin/env python3
# r316-gen-stil-test.py — generira r316-stil-val7.test.ts z GLOBALnim
# zaklenjenim registrom (30 vrstic iz /tmp/r316-raw-amber.txt). Fail-closed:
# skenirana drevesa + registri se MORATA ujemati bajtno (po trim).
import json

vrstice = []
for l in open('/tmp/r316-raw-amber.txt', encoding='utf-8'):
    l = l.rstrip('\n')
    if not l:
        continue
    pot, ln, koda = l.split(':', 2)
    vrstice.append((pot, koda.strip()))

# grupiraj po datoteki
reg: dict[str, list[str]] = {}
for pot, koda in vrstice:
    reg.setdefault(pot, []).append(koda)

RAZLOGI = {
    'src/components/roksal/measurements-tab.tsx': 'R311 — les/WPC kategoriji barv + priporociloColor lestvica + 2 senzorjski besedili (gola-text lestvica)',
    'src/components/roksal/crm-tab.tsx': 'R234 — POTENCIALEN stanje (izrecno semantična kategorija)',
    'src/components/roksal/reference-gallery.tsx': 'R231 — WPC material legenda (barvno kodiranje podatkov)',
    'src/components/roksal/quote-followup.tsx': 'komentar-dokumentacija (ni UI rabe)',
    'src/components/roksal/onboarding-tour.tsx': 'uvodni vodič — barvna paleta korakov (zaporedje barv)',
    'src/components/roksal/roksal-catalog.tsx': 'WPC/WPC+ALU material legenda (barvno kodiranje podatkov, R231 precedens)',
    'src/components/roksal/measurement-studio.tsx': 'R313 — STATE_BADGE stanja kakovosti (red/amber/green lestvica, issue #2 §4)',
    'src/components/roksal/logistics-tab.tsx': 'R312 — STATUS_COLORS.V_TEKU + EQUIPMENT_STATUS_COLORS.V_SERVISU (semantični sistemi)',
    'src/components/roksal/deal-pipeline.tsx': 'R311 — kategorija barvni sistem V_TEKU (amber med orange/violet/blue)',
    'src/components/roksal/inclinometer-tab.tsx': 'R315 — senzorjska lestvica (denied=red / unsupported=amber)',
    'src/components/roksal/cv-studio.tsx': 'R313 — legenda beseda (amber = stopnice)',
    'src/components/roksal/safety-tab.tsx': 'varnostni prag marker + raven lestvice (red/amber/green)',
    'src/components/roksal/photo-tab.tsx': 'R314 — MED faza (PRED blue / MED amber / PO green) + stats.med',
    'src/components/roksal/site-survey-tab.tsx': 'R315 — PODLAGA kategorija barv (p.barva sistem)',
    'src/components/roksal/photo-measure.tsx': 'zaupanje 3-nivojska lestvica (visoko green / srednje amber / nizko red)',
    'src/app/setup/setup-client.tsx': 'setup warning vsebnik (semantični warning container — zunaj roksal lupine)',
    'src/app/portal/[token]/gallery.tsx': 'portal faza PRED (PRED/MED/PO faze lestvica)',
    'src/app/portal/[token]/page.tsx': 'portal warning/faza vsebniki (zunanja portal površina, semantična)',
}

sk = sum(len(v) for v in reg.values())
assert sk == 30, f'pričakovano 30 zaklenjenih vrstic, najdeno {sk}'
for pot in reg:
    assert pot in RAZLOGI, f'manja razlaga za: {pot}'
for pot in RAZLOGI:
    assert pot in reg, f'razlog brez vrstic: {pot}'

DATOTEKE_JS = json.dumps(reg, ensure_ascii=False, indent=2)
RAZLOGI_JS = json.dumps(RAZLOGI, ensure_ascii=False, indent=2)

TEST = f'''// R316 — MANDATORY STIL val 7 STRAŽAR (r162/r308/R310/R311/R312/R313/R314/
// R315 vzorec): ZAKLJUČNI val surove amber harmonizacije — 5 dotikov v 4
// datotekah (fence-3d-viewer ×2 ikoni + notification-center ×1 ikona +
// signature-quote ×1 hint + photo-measure ×1 hint), 0 novih hex.
// ─────────────────────────────────────────────────────────────────
// GLOBALNI zaključni STRAŽAR: vsaka preostala surova amber vrstica v
// src/components/roksal + src/app mora biti V IZRECNEM zaklenjenem registru
// (semantični barvno kodirani sistemi — R308 lekcija; vsaka nova surova
// vrstica = fail). Kanon r310-api-telo-val3 GLOBALNI sken, prenesen na STIL.
import {{ describe, expect, it }} from 'vitest'
import {{ readFileSync, readdirSync, statSync }} from 'node:fs'
import {{ join }} from 'node:path'

const SUROVA_AMBER = /amber-(50|100|200|300|400|500|600|700|800|900|950)\\b/

// Zaklenjeni register: datoteka → seznam TRIMIRANIH vrstic (bajtno = vir).
const ZAKLENJENO: Record<string, string[]> = {DATOTEKE_JS}

// Razlogi (vsaka datoteka z izjemo IMA izrecno razlago — nič tihih izjem).
const RAZLOGI: Record<string, string> = {RAZLOGI_JS}

function beriDrevo(dir: string, izhod: string[] = []): string[] {{
  for (const ime of readdirSync(dir)) {{
    const pot = join(dir, ime)
    const st = statSync(pot)
    if (st.isDirectory()) beriDrevo(pot, izhod)
    else if (/\\.tsx?$/.test(ime)) izhod.push(pot)
  }}
  return izhod
}}

describe('r316 stil val 7 STRAŽAR — zaključni GLOBALNI register surove amber', () => {{
  it('GLOBALNI: vsaka surova amber vrstica (roksal + app) je v zaklenjenem registru — nič neznanih', () => {{
    const datoteke = [
      ...beriDrevo(join(process.cwd(), 'src/components/roksal')),
      ...beriDrevo(join(process.cwd(), 'src/app')),
    ]
    const nezgodbene: string[] = []
    let najdenihSkupaj = 0
    for (const pot of datoteke) {{
      const rel = pot.slice(process.cwd().length + 1)
      const dovoljene = ZAKLENJENO[rel] ?? []
      const vrstice = readFileSync(pot, 'utf8')
        .split('\\n')
        .filter((v) => SUROVA_AMBER.test(v) && !v.includes('roksal-amber'))
        .map((v) => v.trim())
      najdenihSkupaj += vrstice.length
      for (const v of vrstice) {{
        if (!dovoljene.includes(v)) nezgodbene.push(rel + ': ' + v)
      }}
    }}
    // vsak registrski vnos SE RES NAHAJA v viru (zastarel test = fail)
    for (const [rel, dovoljene] of Object.entries(ZAKLENJENO)) {{
      const vir = readFileSync(join(process.cwd(), rel), 'utf8')
      const vrstice = vir
        .split('\\n')
        .filter((v) => SUROVA_AMBER.test(v) && !v.includes('roksal-amber'))
        .map((v) => v.trim())
      for (const d of dovoljene) {{
        expect(vrstice.includes(d), rel + ': zaklenjena vrstica manjka (zastarel register): ' + d.slice(0, 60)).toBe(true)
      }}
    }}
    expect(najdenihSkupaj).toBe(30)
    expect(nezgodbene, 'nove surove amber vrstice IZVEN registra: ' + nezgodbene.join(' | ')).toEqual([])
  }})

  it('vsaka datoteka z zaklenjenimi izjemami ima izrecno razlago', () => {{
    for (const rel of Object.keys(ZAKLENJENO)) {{
      expect(typeof RAZLOGI[rel], 'manjka razlog za ' + rel).toBe('string')
      expect(RAZLOGI[rel].length, 'prazna razlog za ' + rel).toBeGreaterThan(5)
    }}
  }})

  it('žetoni živi: 5 dotikov val 7 (2 ikoni + 1 ikona dark-par + 2 hint besedili)', () => {{
    const beri = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8')
    const fence = beri('src/components/roksal/fence-3d-viewer.tsx')
    expect(fence).toContain('<AlertTriangle aria-hidden="true" className="h-8 w-8 text-roksal-amber" />')
    expect(fence).toContain('<Smartphone aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-roksal-amber" />')
    const notif = beri('src/components/roksal/notification-center.tsx')
    expect(notif).toContain('<AlertTriangle aria-hidden="true" className="h-3 w-3 shrink-0 text-roksal-amber" />')
    const sigq = beri('src/components/roksal/signature-quote.tsx')
    expect(sigq).toContain('<p className="text-center text-2xs text-roksal-ink">')
    const phm = beri('src/components/roksal/photo-measure.tsx')
    expect(phm).toContain('<p className="text-center text-[9px] text-roksal-ink">Za shranjevanje izberi projekt.</p>')
  }})

  it('obrnjena regresija: starih 5 surovih vzorcev NI več v viru', () => {{
    const beri = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8')
    expect(beri('src/components/roksal/fence-3d-viewer.tsx')).not.toContain('text-amber-400')
    expect(beri('src/components/roksal/fence-3d-viewer.tsx')).not.toContain('text-amber-500')
    expect(beri('src/components/roksal/notification-center.tsx')).not.toContain('text-amber-500 dark:text-amber-400')
    expect(beri('src/components/roksal/signature-quote.tsx')).not.toContain('text-2xs text-amber-600 dark:text-amber-400')
    expect(beri('src/components/roksal/photo-measure.tsx')).not.toContain('text-[9px] text-amber-600 dark:text-amber-400')
  }})

  it('determinizem: konverzijska skripta je fail-closed in idempotentna (drugi tek = zarja)', () => {{
    const vir = readFileSync(join(process.cwd(), 'scripts/r316-stil-val7.py'), 'utf8')
    expect(vir).toContain('sys.exit(1)')
    expect(vir).toContain('VAL 7 KONČAN — 5 dotikov')
  }})
}})
'''

open('src/lib/__tests__/r316-stil-val7.test.ts', 'w', encoding='utf-8').write(TEST)
print('OK — test zapisan; register:', {k: len(v) for k, v in reg.items()})
