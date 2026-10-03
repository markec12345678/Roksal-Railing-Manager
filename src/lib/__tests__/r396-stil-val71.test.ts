// r396-stil-val71.test.ts — R396 MANDATORY STIL val 71: DARK-MODE SCROLLBAR
// PARITETA (CSS-nivojska — globals.css +15 vrstic, 0 className žetonov).
//
// Disk resnica (r396-triaza.py + triaza2.py + scrollbar cenzus):
//   .scrollbar-thin            ×33 rab (app/roksal render plast) — palec
//                              #cbd5e1 (slate-300) v OBEH temah
//   .scrollbar-thin-dark       ×0 rab — temna govorica družine (#475569
//                              slate-600 + hover #334155 slate-700) bila
//                              DEFINIRANA a NIKOLI povezana (mrtvi CSS)
// → v temni temi je 33 površin nosilo SVETEL palec na temnem ozadju
//   (vidna nekonsistenost). val 71 poveže obstoječo govorico: .dark
//   .scrollbar-thin::-webkit-scrollbar-thumb { #475569 } + :hover
//   { #334155 } — VREDNOSTI IZ ISTE družine, nič izuma.
// Iskrene meje: (1) svetla tema bajtno nespremenjena (dodatek izključno
// pod .dark); (2) eksplicitni .scrollbar-thin-dark utility ostane
// (namenski Always-dark primeri, dokumentiran — NIČ brisanja brez
// naročila); (3) viz/** ZAŠČITENO jedro (kanon R167 izjeme) nič;
// (4) track ostane transparent v obeh temah (namerno).
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const GS = () => readFileSync(join(process.cwd(), 'src', 'app', 'globals.css'), 'utf8')

describe('R396 val 71 — dark-mode scrollbar pariteta', () => {
  it('(A) PARITETA: .dark .scrollbar-thin thumb + hover obstajata točno ×1, vrednosti iz družine (#475569/#334155)', () => {
    const css = GS()
    expect(css.split('.dark .scrollbar-thin::-webkit-scrollbar-thumb {').length - 1).toBe(1)
    expect(css.split('.dark .scrollbar-thin::-webkit-scrollbar-thumb:hover {').length - 1).toBe(1)
    // vrednosti = točno temna govorica obstoječe družine (.scrollbar-thin-dark)
    const blok = css.slice(css.indexOf('.dark .scrollbar-thin::-webkit-scrollbar-thumb {'), css.indexOf('.dark .scrollbar-thin::-webkit-scrollbar-thumb {') + 260)
    expect(blok).toContain('background-color: #475569;')
    expect(blok).toContain('background-color: #334155;')
  })

  it('(B) CENZUS: svetla tema bajtno nespremenjena — svetli thumb blok #cbd5e1 v prvotni obliki, TRACK transparent ×2 (thin + dark)', () => {
    const css = GS()
    const svetli = '.scrollbar-thin::-webkit-scrollbar-thumb {\n    background-color: #cbd5e1;\n    border-radius: 20px;\n  }'
    expect(css.split(svetli).length - 1).toBe(1)
    expect(css.split('.scrollbar-thin::-webkit-scrollbar-track {\n    background: transparent;').length - 1).toBe(1)
    expect(css.split('.scrollbar-thin-dark::-webkit-scrollbar-track {\n    background: transparent;').length - 1).toBe(1)
  })

  it('(C) DRUŽINA: .scrollbar-thin-dark utility OSTANE (namenski Always-dark primeri) — vir vrednosti, bajtno nespremenjen', () => {
    const css = GS()
    expect(css.split('.scrollbar-thin-dark::-webkit-scrollbar-thumb {\n    background-color: #475569;').length - 1).toBe(1)
    expect(css.split('.scrollbar-thin-dark::-webkit-scrollbar-thumb:hover {\n    background-color: #334155;').length - 1).toBe(1)
  })

  it('(D) RABA: .scrollbar-thin je živa družina (≥30 rab čez src) — pariteta doseže celotno družino naenkrat (CSS nivo, brez žetonov)', () => {
    // cenzus rabe — družina je razlog za CSS-nivojski popravek (×33 rab v
    // ~20 datotekah; className spremembe bi bile ×33 dotikov + tveganje
    // pinov; en .dark blok pokrije VSE obstoječe IN prihodnje rabe)
    let zadetki = 0
    const obišči = (dir: string) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const pot = join(dir, e.name)
        if (statSync(pot).isDirectory()) obišči(pot)
        else if (pot.endsWith('.tsx')) {
          const t = readFileSync(pot, 'utf8')
          // šteje SAMO scrollbar-thin brez -dark pripone (besedna meja)
          zadetki += (t.match(/scrollbar-thin(?![-\w])/g) ?? []).length
        }
      }
    }
    obišči(join(process.cwd(), 'src', 'components'))
    obišči(join(process.cwd(), 'src', 'app'))
    expect(zadetki).toBeGreaterThanOrEqual(30)
  })

  it('(E) MEJE: viz/** ZAŠČITENO jedro nič (kanon R167) + globals.css nosi dokumentacijski komentar val 71 (R396)', () => {
    const css = GS()
    expect(css).toContain('val 71 (R396)')
    expect(css).toContain('DARK-MODE SCROLLBAR PARITETA')
    // viz jedro se NE dotaknjeno — dark-token izjema dokumentirana že R167
    const vizHome = readFileSync(join(process.cwd(), 'src', 'components', 'viz', 'product-home.tsx'), 'utf8')
    expect(vizHome).not.toContain('scrollbar-thin') // ni rabe — nič za popravljati
  })
})
