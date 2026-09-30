'use client'

// R163:
//  • FAIL-VERBOSE (prej fail-open z LAŽNIMI NIČLAMI!): pri neuspelih klicih je
//    `res.ok ? await res.json() : []` TIHO namestil prazna polja — vodja je
//    videl "0 € prihodka, 0 terminov" čeprav podatki sploh niso bili naloženi
//    (hujše od stale-state: aktivno izmišljanje ničel). Zdaj: če KATERIKOLI
//    od 7 APIjev pade → viden role=alert panel z razlogom + "Poskusi znova",
//    brez prikaza statistike (fail-closed — delni podatki bi izmišljali sliko).
//  • 🆕 IZVOZ DNEVNEGA PREGLEDA v CSV (vodja-csv.ts): KPI + opozorila +
//    današnji termini — točno to, kar je videti na zaslonu (IZVOŽENO = ZASLON).
//  • STIL pass: trdo kodirane svetle barve (svetlo zeleno/rdeče/modro
//    ozadje in obrobe) so v temni temi ostale svetle → dark: variante /
//    semantični žetoni; focus-visible ringi; dekorativne ikone aria-hidden;
//    tabular-nums. (R225: zadnje take barve v tej datoteki → žetoni.)

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRefetchOnFocus } from '@/hooks/use-refetch-on-focus'
import { casOznaka } from '@/lib/osvezitev-fokus'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/hooks/use-toast'
import { generateMonthlyReport } from '@/lib/boss-report-pdf'
import { buildVodjaCsv, vodjaCsvFilename, terminStatusLabel } from '@/lib/vodja-csv'
import { todayStamp, downloadCsvText } from '@/lib/csv-export'
// R293 (P1-f, 'izvozi' družina — 24. člen) — DOBIČKONOST PO PROJEKTIH CSV:
// CSV brat PDF R258 (vzorec R284→R285/R291/R292) — EN VIR: lib uvaža presek
// { vrste, povzetek } (NIČ ponovnega računa), znesekNiz iz PDF brata
// (ISTI strojni kanon zneskov) + projektBeseda (sklanjatev EN VIR);
// MARŽNI RAZGLED strip = ISTA izpeljava (WYSIWYG zaslon · PDF · CSV).
import {
  dobicikonostProjektiCsv,
  dobicikonostProjektiCsvFilename,
  dobicikonostSklep,
  type DobicikonostPresek,
} from '@/lib/dobicikonost-projekti-csv'
// R258 (P1-f, 'izvozi' družina — 14. člen) — DOBIČKONOST PO PROJEKTIH PDF
// (presek DVEH virov, ki ju vodja ŽE fetcha: /api/invoices + /api/material-
// orders — route NIČ; prihodki = IZDAN+PLACAN EN VIR STATUSI prihodki-pdf;
// stroški = ne-preklicana naročila EN VIR STATUSI_NAROCIL narocila-pregled-
// pdf R257; marža = izpeljana resnica, negativna RDEČA — NIKOLI utišana;
// fail-closed, bajtni determinizem, soli 0x7d–0x80).
import {
  buildDobicikonostPdfDoc,
  dobicikonostPdfFilename,
  dobicikonostPoProjektih,
  type DobicikonostRacun,
  type DobicikonostNarocilo,
} from '@/lib/dobicikonost-pdf'
// R261 (P1-f, 'izvozi' družina — 17. člen) — RAČUNI PO PROJEKTIH PDF
// (presek DVEH virov, ki ju vodja ŽE fetcha: /api/invoices + /api/projects —
// route NIČ; ponudba = SHRANJEN stolpec estimatedPrice — read-only, NIČ
// stika s pricing jedrom; realizirano = IZDAN+PLACAN EN VIR STATUSI
// prihodki-pdf; odstopanje = izpeljana resnica, negativna RDEČA — NIKOLI
// utišana; JOIN po IDENTITETI projectId === id — R260 lekcija; fail-closed,
// bajtni determinizem, soli 0x81–0x84).
import {
  buildRacuniProjektiPdfDoc,
  racuniProjektiPdfFilename,
  racuniProjektiPoProjektih,
  type RacuniProjektiRacun,
  type RacuniProjektiProjekt,
} from '@/lib/racuni-projekti-pdf'
// R228 — NOVA tema: zamujena dobava (obljubljeni datum pretekel, naročilo
// še odprto — sorojenec poteklih opomnikov; ISTI /api/material-orders fetch).
import { steviloZamujenihDobav, narociloBeseda } from '@/lib/zamujena-dobava'
// R187 — Sistem — zdravje kartica (21. površina živostne družine; javna
// sonda /api/public/health R186 iz vodjinega pogleda).
import { SistemZdravjeCard } from '@/components/roksal/sistem-zdravje-card'
// R294 — ISSUE #1 (Professional automation): avtomatizacijski katalog —
// EN VIR razreda funkcij (deterministic / SDK / script / AI-optional);
// AI = neobvezna pomoč, jedro deluje brez AI (docs/automacija-audit.md).
import { avtomatizacijaPovzetek } from '@/lib/automation/katalog'
// R311 — 41. člen issue #1 (Deliverable 5 na zaslonu): AI raba — iskrena
// resnica po površinah (ČISTA projekcija katalog × AI_KANDIDATI — NIČ
// nove resnice; WYSIWYG sklep).
import { aiRabaPregled } from '@/lib/ai-raba-pregled'
// R312 — 42. člen issue #1 (Deliverable 6): meritve zmogljivosti — iskrene
// meritve jedra (realno izvajanje, fiksni vhodi, vsak izhod preverjen;
// časi strojno odvisni — izris ŠELE v brskalniku, nič SSR laži).
import { izmeriZmogljivost } from '@/lib/zmogljivost-pregled'
import type { ZmogljivostPregled } from '@/lib/zmogljivost-pregled'
// R314 — 44. člen issue #1 (Deliverable 4 NA ZASLONU): feature-by-feature
// audit tabela — ČISTA projekcija EN VIR audita (avtomatizacija-audit:
// AVTOMATIZACIJA_AUDIT §1–§11 — vsako območje klasificirano z potmi
// implementacije + dokaza; WYSIWYG sklep, NIČ dvojnega sklepa).
// R315 — 45. člen issue #1 (Deliverable 7 NA ZASLONU): končna verifikacija
// proti HEAD — vezava območij audita na verifikacijske plasti + sprejemni
// kriteriji z mehanično izpeljavo in konkretnim dokazom (ČISTA projekcija EN
// VIR — koncna-verifikacija + avtomatizacija-audit; WYSIWYG sklep, NIČ
// dvojnega sklepa).
import { koncnaVerifikacija, koncnaVerifikacijaJson } from '@/lib/koncna-verifikacija'
import { avtomatizacijaPregled, avtomatizacijaAuditCsv, avtomatizacijaAuditCsvFilename } from '@/lib/avtomatizacija-pregled'
// 🆕 R318 (48. člen): PDF brat izvoza — LOČEN lib (družinski vzorec R302:
// logistics-tab uvaža buildKonfliktiPdfDoc iz konflikti-pdf; EN VIR validacija
// (pregled) ostane v bratu; PDF graditelj je determinističen — isti HEAD =
// bajtno identičen PDF).
import { generateAvtomatizacijaAuditPdf, avtomatizacijaAuditPdfFilename } from '@/lib/avtomatizacija-audit-pdf'
// 🆕 R320 (49. člen): PDF brat JSON izvoza končne verifikacije — LOČEN lib
// (vzorec R318 audit-pdf: jsPDF teža NE obremenjuje brata; EN VIR validacija
// ostane v bratu; determinističen PDF — isti HEAD = bajtno identičen).
import { generateKoncnaVerifikacijaPdf, koncnaVerifikacijaPdfFilename } from '@/lib/koncna-verifikacija-pdf'
// 🆕 R321 (50. člen): PDF brat zaslonu meritev zmogljivosti (Deliverable 6
// tisk) — LOČEN lib (vzorec R318/R320); pregled = POSREDOVANA resnica
// (meritev se izvede ENKRAT v brskalniku — R312 kontrakt; PDF NE meri
// znova); formatirajMs = EN VIR formatiranje zaslon + PDF (iz brata R312).
import { generateZmogljivostPdf, zmogljivostPdfFilename } from '@/lib/zmogljivost-pregled-pdf'
import { formatirajMs } from '@/lib/zmogljivost-pregled'
import {
  TrendingUp, Clock, Users, Package, Euro, CheckCircle2,
  AlertTriangle, Calendar, Truck, Bell, FileDown, Loader2, Download, Workflow,
  History, PackageX, CalendarX, FileText, FileSpreadsheet, Sparkles, Gauge, ClipboardList, BadgeCheck,
} from 'lucide-react'

// R314 — razred audita → žeton značka (100 % roksal žetoni — R225/R226
// STRAŽAR: vodjin pogled NIČ numericnih barvnih klas; kategorije med
// sorodniki: green = deterministično/varno, navy = SDK/informacija,
// ink = skripta/nevtralno, amber = AI-opcijsko/pozornost (r162: ink na
// žetonu), red = AI-obvezno/prepovedano).
const AVT_AUDIT_ZNACKA: Record<string, string> = {
  DETERMINISTICNO: 'border-roksal-green/40 bg-roksal-green/10 text-roksal-green',
  SDK: 'border-roksal-navy/40 bg-roksal-navy/10 text-roksal-navy dark:border-roksal-ink/30 dark:text-roksal-ink',
  SKRIPTA: 'border-roksal-navy/25 bg-roksal-navy/5 text-roksal-ink dark:border-roksal-ink/20',
  AI_OPCIJSKO: 'border-roksal-amber/40 bg-roksal-amber/10 text-roksal-ink',
  AI_ZAHTEVANO: 'border-roksal-red/40 bg-roksal-red/10 text-roksal-red',
}

interface VodjaStats {
  // Dnevno
  danasTermini: number
  danasZakljuceni: number
  danasVpripravi: number
  // Mesečno
  mesecnoProjektov: number
  mesecniPrihodek: number
  mesecnaMarza: number
  mesecnoUr: number
  // Prihodki (računi)
  odprtoZnesek: number
  zapadloZnesek: number
  zapadloSt: number
  // Ekipe
  aktivneEkipe: number
  ekipaZasedene: number
  // CRM
  potekliOpomniki: number
  aktivniOpomniki: number
  // Material
  nizkaZaloga: number
  odprtaNarocila: number
  // R224 — sedmi signalec konvergence: artikli brez VPISANE nabavne cene
  // (R221 dimenzija 'brez dobavitelja' v vodjinem pregledu — ISTA dimenzija,
  // ISTI vir; naročilni tok takih postavk ne more oceniti).
  brezDobavitelja: number
  // R228 — NOVA tema: zanesljivost dobav. Odprta naročila z IZRECNO
  // pretečenim datumom dobave (obljuba brez izpolnitve — fail-closed:
  // brez datuma NIKOLI ni zamude; ISTI /api/material-orders fetch).
  zamujeneDobave: number
  // Splošno
  skupajProjektov: number
  skupajStrank: number
  skupniLTV: number
}

interface InvLite {
  id: string
  // R261 — IDENTITETNI ključ joina (v === s — R260 lekcija; /api/invoices
  // odgovor nosi projectId — schema NOT NULL; naziv je samo prikaz).
  projectId: string
  stevilka: string
  status: string
  znesek: number
  datumIzdaje: string
  rokPlacilaDni: number
  placanoAt: string | null
  kupec?: string | null // JSON snapshot { ime, naslov, ... } — za poročilo
  project?: { nazivProjekta: string } | null
}

interface ProjectFull {
  id: string
  nazivProjekta: string
  status: string
  estimatedPrice?: number | null
  createdAt?: string
  customer?: { ime?: string; naslov?: string } | null
}

/** Ime kupca iz JSON snapshot-a (poročilo). */
function kupecIme(json?: string | null): string {
  try {
    return (JSON.parse(json ?? '') as { ime?: string })?.ime ?? ''
  } catch {
    return ''
  }
}

/** Prihodki po mesecih (zadnjih 6) iz plačanih računov — za vrstični graf. */
function prihodkiPoMesecih(invoices: InvLite[]): { label: string; eur: number }[] {
  const now = new Date()
  const months: { key: string; label: string; eur: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push({
      key: `${d.getFullYear()}-${d.getMonth()}`,
      label: d.toLocaleDateString('sl-SI', { month: 'short' }).replace('.', ''),
      eur: 0,
    })
  }
  const idx = new Map(months.map((m, i) => [m.key, i]))
  for (const inv of invoices) {
    if (inv.status !== 'PLACAN' || !inv.placanoAt) continue
    const d = new Date(inv.placanoAt)
    const i = idx.get(`${d.getFullYear()}-${d.getMonth()}`)
    if (i !== undefined) months[i].eur += inv.znesek || 0
  }
  return months
}

interface TerminDanes {
  id: string
  datumZacetka: string
  status: string
  predvideneUre: number
  project: { nazivProjekta: string; customer: { ime: string; naslov: string } }
  crew: { naziv: string; barva: string } | null
}

function formatEUR(eur: number): string {
  return eur.toLocaleString('sl-SI', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' €'
}

function formatTime(d: string): string {
  return new Date(d).toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit' })
}

export function VodjaDashboard() {
  const { toast } = useToast()
  const [stats, setStats] = useState<VodjaStats | null>(null)
  const [termini, setTermini] = useState<TerminDanes[]>([])
  const [prihodki, setPrihodki] = useState<{ label: string; eur: number }[]>([])
  const [allProjects, setAllProjects] = useState<ProjectFull[]>([])
  const [allInvoices, setAllInvoices] = useState<InvLite[]>([])
  // R258 — dobičkonost presek: naročila si zapomnimo (ISTI fetch — EN VIR)
  // kot minimalni prerez za lib (status + skupajCena + projekt naziv).
  const [allOrders, setAllOrders] = useState<DobicikonostNarocilo[]>([])
  const [reportLoading, setReportLoading] = useState(false)
  // R312 — 42. člen: meritve zmogljivosti (Deliverable 6) — izvedene ŠELE v
  // brskalniku (useEffect; SSR izriše iskreno "teče …", NIČ hydration laži).
  const [zmogljivost, setZmogljivost] = useState<ZmogljivostPregled | null>(null)
  const [dobicikonostVTeku, setDobicikonostVTeku] = useState(false)
  // R293 — dvoklik guard dobičkonostnega CSV (pariteta brata dobicikonostVTeku R258).
  const [dobicikonostCsvVTeku, setDobicikonostCsvVTeku] = useState(false)
  const [racuniProjektiVTeku, setRacuniProjektiVTeku] = useState(false)
  const [loading, setLoading] = useState(true)
  // R163: fail-verbose — razlog, zakaj podatkov NI (namesto lažnih ničel).
  const [loadError, setLoadError] = useState<string | null>(null)
  // R180 — pečat svežine: čas zadnjega USPEŠNEGA branja vseh 7 virov (vzorec
  // R170/R177/R178). Napaka → clearOnFail počisti TUDI pečat (fail-closed —
  // NIČ lažne svežine nad error panelom).
  const [vodjaOsvezitev, setVodjaOsvezitev] = useState<Date | null>(null)

  const clearOnFail = useCallback(() => {
    // Fail-closed: brez podatkov NI prikaza — delna statistika bi izmišljala sliko
    // (npr. padli računi → "Prihodek 0 €" je laž, ne nič).
    setStats(null)
    setTermini([])
    setPrihodki([])
    setAllProjects([])
    setAllInvoices([])
    setAllOrders([])
    // R180: pečat brez podatkov = lažna svežina — počisti ga (vsi 3 fail
    // poti: neuspešni odgovori, neveljaven odgovor, omrežna napaka).
    setVodjaOsvezitev(null)
  }, [])

  const loadData = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      // Pridobi vse podatke vzporedno
      const [projRes, custRes, schedRes, crmRes, invRes, ordRes, invoicesRes] = await Promise.all([
        fetch('/api/projects', { credentials: 'same-origin' }),
        fetch('/api/customers', { credentials: 'same-origin' }),
        fetch('/api/schedules', { credentials: 'same-origin' }),
        fetch('/api/crm', { credentials: 'same-origin' }),
        fetch('/api/inventory', { credentials: 'same-origin' }),
        fetch('/api/material-orders', { credentials: 'same-origin' }),
        fetch('/api/invoices', { credentials: 'same-origin' }),
      ])

      // R163 fail-verbose: NE `res.ok ? json : []` (lažne ničle), ampak jasna
      // napaka z imeni virov, ki niso vrstili podatkov.
      const sources: Array<[string, Response]> = [
        ['projektov', projRes],
        ['strank', custRes],
        ['terminov', schedRes],
        ['CRM', crmRes],
        ['zaloge', invRes],
        ['naročil', ordRes],
        ['računov', invoicesRes],
      ]
      const failed = sources.filter(([, r]) => !r.ok)
      if (failed.length > 0) {
        const st = failed[0][1].status
        setLoadError(
          st === 401
            ? 'Prijava je potekla. Ponovno se prijavite.'
            : `Strežnik ni vrnil podatkov (${failed.map(([n]) => n).join(', ')}; napaka ${st}).`,
        )
        clearOnFail()
        return
      }
      const [projects, customers, schedules, crm, inventory, orders, invoices] = (await Promise.all([
        projRes.json().catch(() => null),
        custRes.json().catch(() => null),
        schedRes.json().catch(() => null),
        crmRes.json().catch(() => null),
        invRes.json().catch(() => null),
        ordRes.json().catch(() => null),
        invoicesRes.json().catch(() => null),
      ])) as unknown[]
      if (!Array.isArray(projects) || !Array.isArray(customers) || !Array.isArray(schedules) ||
        !Array.isArray(inventory) || !Array.isArray(orders) || !Array.isArray(invoices) ||
        crm === null || typeof crm !== 'object' || Array.isArray(crm)) {
        setLoadError('Neveljaven odgovor strežnika.')
        clearOnFail()
        return
      }
      const crmStats = (crm as { stats?: { potekliOpomniki?: number; zOpomniki?: number } }).stats ?? {}

      // Današnji termini
      const danas = new Date()
      danas.setHours(0, 0, 0, 0)
      const jutri = new Date(danas)
      jutri.setDate(jutri.getDate() + 1)

      const danasTermini = schedules.filter((s: TerminDanes) => {
        const d = new Date(s.datumZacetka)
        return d >= danas && d < jutri
      })

      // FIX: prej so se šteli SAMO vnosi iz koledarja (Logistika). Projekt z
      // datumMontaze danes, za katerega še ni termina v koledarju, je izgledal
      // kot "0 terminov" — zdaj ga sintetiziramo iz projekta (brez dvojkov).
      const projectsToday = (Array.isArray(projects) ? projects : []).filter(
        (p: { datumMontaze?: string | null; status: string; nazivProjekta: string }) => {
          if (!p.datumMontaze || p.status === 'ZAKLJUCENO') return false
          const d = new Date(p.datumMontaze)
          return d >= danas && d < jutri
        }
      )
      const scheduledNames = new Set(
        danasTermini.map((s: TerminDanes) => s.project?.nazivProjekta)
      )
      const synthesized: TerminDanes[] = projectsToday
        .filter((p: { nazivProjekta: string }) => !scheduledNames.has(p.nazivProjekta))
        .map((p: { id: string; datumMontaze: string; status: string; nazivProjekta: string; customer?: { ime?: string; naslov?: string } }) => ({
          id: `project-${p.id}`,
          datumZacetka: p.datumMontaze,
          status: p.status,
          predvideneUre: 0,
          project: {
            nazivProjekta: p.nazivProjekta,
            customer: { ime: p.customer?.ime || 'Ni stranke', naslov: p.customer?.naslov || 'Ni naslova' },
          },
          crew: null,
        }))
      const vsiTerminiDanes = [...danasTermini, ...synthesized]

      const danasZakljuceni = vsiTerminiDanes.filter((s: TerminDanes) => s.status === 'ZAKLJUCENO').length
      const danasVpripravi = vsiTerminiDanes.filter((s: TerminDanes) => s.status === 'V_TEKU').length

      // Mesečni projekti
      const mesecZacetek = new Date()
      mesecZacetek.setDate(1)
      mesecZacetek.setHours(0, 0, 0, 0)

      const mesecnoProjektov = projects.filter((p: { createdAt: string }) => new Date(p.createdAt) >= mesecZacetek).length
      // Prihodek = zares PLAČANI računi tega meseca (placanoAt); prej je gledal
      // samo dealLockedAt projektov, zaradi česar je bil plačan račun "neviden"
      // (npr. 2026-001 plačan 22. 9. je pokazal Prihodek 0 €).
      const placaniTaMesec = invoices.filter(
        (inv: InvLite) => inv.status === 'PLACAN' && inv.placanoAt && new Date(inv.placanoAt) >= mesecZacetek
      )
      const mesecniPrihodek = placaniTaMesec.reduce((sum: number, inv: InvLite) => sum + (inv.znesek || 0), 0)

      // Odprti in zapadli računi (IZDAN, rok plačila = datumIzdaje + rokPlacilaDni)
      const izdani = invoices.filter((inv: InvLite) => inv.status === 'IZDAN')
      const odprtoZnesek = izdani.reduce((sum: number, inv: InvLite) => sum + (inv.znesek || 0), 0)
      const danes0 = new Date(); danes0.setHours(0, 0, 0, 0)
      const zapadli = izdani.filter((inv: InvLite) => {
        const rok = new Date(inv.datumIzdaje)
        rok.setDate(rok.getDate() + (inv.rokPlacilaDni || 8))
        return rok < danes0
      })
      const zapadloZnesek = zapadli.reduce((sum: number, inv: InvLite) => sum + (inv.znesek || 0), 0)

      // Mesečne ure
      const mesecnoUr = schedules
        .filter((s: TerminDanes) => new Date(s.datumZacetka) >= mesecZacetek)
        .reduce((sum: number, s: TerminDanes) => sum + (s.predvideneUre || 0), 0)

      // LTV — iz /api/projects (customers API vrača samo _count, ne vrstic
      // s cenami; prej je bil zato LTV vedno 0 €)
      const skupniLTV = projects.reduce(
        (sum: number, p: { estimatedPrice?: number | null }) => sum + (p.estimatedPrice || 0),
        0,
      )

      // Nizka zaloga
      const nizkaZaloga = inventory.filter((i: { kolicinaZaloga: number; minimalnaZaloga: number }) =>
        i.kolicinaZaloga <= i.minimalnaZaloga).length

      // R224 (P1-c nadaljevanje) — SEDMI signalec konvergence: 'Brez
      // dobavitelja' v vodjinem pregledu (sorojenica 'nizka zaloga', DRUGA
      // dimenzija: nabavna pripravljenost). Izpeljanka iz ISTEGA /api/inventory
      // fetcha (EN VIR zasidranja — nič nove zahteve; _count.prices je na
      // odgovoru od R221). STROGOST brez izmišljanja: manjkajoči števec
      // (starejši predpomnjeni odgovor brez polja) NIKOLI ni 'brez
      // dobavitelja' — le izrecna 0 pomeni 'nihče vpisan' (fail-closed
      // konservativno; ISTA dobesedna enačba kot čip R221, zvonček R222 in
      // Domov kartica R223 — brez `?? 0` / `<= 0` ohlapnosti).
      const brezDobavitelja = inventory.filter(
        (i: { _count?: { prices?: number } }) => i._count?.prices === 0,
      ).length

      // Odprta naročila
      const odprtaNarocila = orders.filter((o: { status: string }) =>
        ['OSNUTEK', 'POSLANO', 'POTRJENO'].includes(o.status)).length

      // R228 — zamujena dobava: ISTI orders fetch (EN VIR) — odprta
      // naročila z IZRECNO pretečenim datumDobave. danas (polnoč) je
      // zgoraj že izračunan (ISTI datumski jezik kot danasTermini).
      // Fail-closed: brez izrecnega datuma NIKOLI ni zamude (manjkajoča
      // obljuba ni prekršek) — steviloZamujenihDobav lib (strogo === veje).
      const zamujeneDobave = steviloZamujenihDobav(
        orders as { status: string; datumDobave?: string | null }[],
        danas,
      )

      setStats({
        danasTermini: vsiTerminiDanes.length,
        danasZakljuceni,
        danasVpripravi,
        mesecnoProjektov,
        mesecniPrihodek,
        mesecnaMarza: mesecniPrihodek * 0.25, // 25% marža
        mesecnoUr,
        odprtoZnesek,
        zapadloZnesek,
        zapadloSt: zapadli.length,
        aktivneEkipe: 0, // TODO: iz /api/crews
        ekipaZasedene: danasVpripravi,
        potekliOpomniki: crmStats.potekliOpomniki || 0,
        aktivniOpomniki: crmStats.zOpomniki || 0,
        nizkaZaloga,
        odprtaNarocila,
        zamujeneDobave,
        brezDobavitelja,
        skupajProjektov: projects.length,
        skupajStrank: customers.length,
        skupniLTV,
      })
      setTermini(vsiTerminiDanes)
      setPrihodki(prihodkiPoMesecih(invoices as InvLite[]))
      // celotne vhodne podatke si zapomnimo za izvoz PDF poročila (runda M)
      setAllProjects(projects as unknown as ProjectFull[])
      setAllInvoices(invoices as InvLite[])
      // R258 — dobičkonost presek: minimalni prerez naročil (ISTI odgovor —
      // route include prinese project.nazivProjekta; fail-verbose veriga
      // zgoraj zagotavlja, da je odgovor seznam — nič tihega ignore).
      setAllOrders(
        (orders as Array<{ status: string; skupajCena: number; project?: { nazivProjekta: string } | null }>).map(
          (o) => ({ status: o.status, skupajCena: o.skupajCena, projekt: o.project?.nazivProjekta ?? null }),
        ),
      )
      // R180: pečat = vseh 7 virov uspešno prebranih (enoten trenutek svežine)
      setVodjaOsvezitev(new Date())
    } catch {
      // R163: nič tihega ignore — omrežna napaka je vidna z razlogom.
      setLoadError('Ni povezave s strežnikom. Preverite omrežje in poskusite znova.')
      clearOnFail()
    } finally {
      setLoading(false)
    }
  }, [clearOnFail])

  /** Mesečno PDF poročilo — KPI + graf + računi + projekti + opozorila. */
  function downloadReport() {
    if (!stats) return
    setReportLoading(true)
    try {
      const now = new Date()
      const mesecZacetek = new Date(now.getFullYear(), now.getMonth(), 1)
      const row = (inv: InvLite) => ({
        stevilka: inv.stevilka,
        kupec: kupecIme(inv.kupec),
        projekt: inv.project?.nazivProjekta ?? '',
        znesek: inv.znesek,
        datumIzdaje: inv.datumIzdaje,
        rokPlacilaDni: inv.rokPlacilaDni,
        status: inv.status,
        placanoAt: inv.placanoAt,
      })
      const placaniTaMesec = allInvoices
        .filter((inv) => inv.status === 'PLACAN' && inv.placanoAt && new Date(inv.placanoAt) >= mesecZacetek)
        .map(row)
      const izdaniZapadli = allInvoices
        .filter((inv) => {
          if (inv.status !== 'IZDAN') return false
          const rok = new Date(inv.datumIzdaje)
          rok.setDate(rok.getDate() + (inv.rokPlacilaDni || 8))
          return rok < now
        })
        .map(row)

      generateMonthlyReport({
        mesec: { year: now.getFullYear(), month: now.getMonth() },
        generatedAt: now,
        stats: {
          prihodekMesec: stats.mesecniPrihodek,
          marza: stats.mesecnaMarza,
          odprtoZnesek: stats.odprtoZnesek,
          zapadloZnesek: stats.zapadloZnesek,
          zapadloSt: stats.zapadloSt,
          projektovNovih: stats.mesecnoProjektov,
          ureMesec: stats.mesecnoUr,
          skupajProjektov: stats.skupajProjektov,
          skupajStrank: stats.skupajStrank,
          skupniLTV: stats.skupniLTV,
          nizkaZaloga: stats.nizkaZaloga,
          odprtaNarocila: stats.odprtaNarocila,
          brezDobavitelja: stats.brezDobavitelja,
          zamujeneDobave: stats.zamujeneDobave,
          potekliOpomniki: stats.potekliOpomniki,
        },
        prihodki6: prihodki,
        placaniTaMesec,
        izdaniZapadli,
        projekti: allProjects.map((p) => ({
          naziv: p.nazivProjekta,
          stranka: p.customer?.ime ?? '',
          status: p.status,
          cena: p.estimatedPrice ?? null,
        })),
      })
      toast({ title: 'Poročilo shranjeno ✓', description: `Mesečno poročilo ${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')} PDF` })
    } catch {
      toast({ title: 'Napaka pri generiranju poročila', variant: 'destructive' })
    } finally {
      setReportLoading(false)
    }
  }

  // R293 — ENA izpeljava vhodov za presek (WYSIWYG ISTI vir kot PDF brat,
  // CSV 24. člen IN MARŽNI RAZGLED strip): DTO pruning iz ISTIH state-ov,
  // ki jih loadData ŽE napolni — NIČ nove mreže (vzorec R261). Memo —
  // preverba teče samo ob spremembi virov, ne vsak render.
  const dobicikonostVhodi = useMemo<{ racuni: DobicikonostRacun[]; narocila: DobicikonostNarocilo[] }>(
    () => ({
      racuni: allInvoices.map((inv) => ({
        stevilka: inv.stevilka,
        status: inv.status,
        znesek: inv.znesek,
        projekt: inv.project?.nazivProjekta ?? null,
      })),
      narocila: allOrders,
    }),
    [allInvoices, allOrders],
  )
  // R293 — presek = ENA izpeljava za strip + CSV + PDF toast (ISTA čista
  // funkcija na ISTIH vhodih — divergenca nemogoča).
  const dobicikonostIzpeljava = useMemo<DobicikonostPresek>(
    () => dobicikonostPoProjektih(dobicikonostVhodi.racuni, dobicikonostVhodi.narocila),
    [dobicikonostVhodi],
  )

  // R258 — DOBIČKONOST PO PROJEKTIH PDF (14. člen 'izvozi' družine): presek
  // DVEH virov, ki ju vodja ŽE ima (allInvoices + allOrders — NIČ nove mreže).
  // ENA resnica v libu: prihodki = IZDAN+PLACAN, stroški = ne-preklicana
  // naročila, marža = izpeljava; brez-projektni + stornirani/osnutki =
  // poimenovani v sklepu (NIKOLI tiho). Fail-closed: prazen presek (0 računov
  // IN 0 naročil) → iskren toast; TypeError → viden razlog. EN now za žig IN
  // ime (lekcija R121/R235). Bralni dokument — brez dodatnega pravicnega
  // gate (vodja pregled že nosi oba vira; P1-k precedens).
  // R293: DTO pruning preseljen v dobicikonostVhodi memo (EN VIR — isti
  // rezultat, R290 vzorec 'stara inline preslikava izbrisana').
  const handleDobicikonostPdf = () => {
    if (dobicikonostVTeku || loading) return
    setDobicikonostVTeku(true)
    try {
      if (allInvoices.length === 0 && allOrders.length === 0) {
        toast({ title: 'Ni podatkov za dobičkonost', description: 'PDF se izvozi, ko je vpisan prvi račun ali naročilo.' })
        return
      }
      const now = new Date()
      const racuni = dobicikonostVhodi.racuni
      const doc = buildDobicikonostPdfDoc(racuni, allOrders, { now })
      doc.save(dobicikonostPdfFilename(now))
      // Toast pove REALNO agregatno resnico (ISTA izpeljava dobicikonostPoProjektih
      // kot PDF KPI IN sklep — WYSIWYG; ',' ločilo — R248 lekcija).
      const { povzetek } = dobicikonostPoProjektih(racuni, allOrders)
      toast({
        title: 'Dobičkonost prenešena v PDF',
        description: `Dobicikonost-projektov-…pdf — ${povzetek.projektov} projektov, prihodki ${povzetek.prihodki.toFixed(2)} €, stroški ${povzetek.stroski.toFixed(2)} €, marža ${povzetek.marza.toFixed(2)} €.`,
      })
    } catch (err) {
      if (err instanceof TypeError) {
        // fail-closed jedro: pokvaren vnos → viden razlog (nič izmišljenega dokumenta)
        toast({ title: 'Dobičkonost PDF ni mogoče sestaviti iz teh podatkov', description: err instanceof Error ? err.message : String(err), variant: 'destructive' })
      } else {
        toast({ title: `Izvoz PDF ni uspel: ${err instanceof Error ? err.message : String(err)}`, variant: 'destructive' })
      }
    } finally {
      setDobicikonostVTeku(false)
    }
  }

  // R293 — 24. člen 'izvozi' družine: DOBIČKONOST PO PROJEKTIH CSV — CSV brat
  // PDF R258 (vzorec R284→R285/R291/R292): fail-closed PREJ (0 računov IN 0
  // naročil → iskren toast, NIKOLI prazna datoteka — ISTI gate kot brat),
  // potem ENA izpeljava (ISTI presek memo + ISTI now za CSV + ime — lekcija
  // R121/R235); agregat v toastu = ISTI lib sklep kot MARŽNI RAZGLED strip
  // (WYSIWYG, sklanjatev EN VIR projektBeseda); fail-verbose catch (R291/R292
  // vzorec); dvoklik guard (pariteta brata dobicikonostVTeku R258).
  const handleDobicikonostCsv = () => {
    if (dobicikonostCsvVTeku || loading) return
    setDobicikonostCsvVTeku(true)
    try {
      if (allInvoices.length === 0 && allOrders.length === 0) {
        toast({ title: 'Ni podatkov za dobičkonost', description: 'CSV se izvozi, ko je vpisan prvi račun ali naročilo.' })
        return
      }
      const now = new Date()
      const { csv } = dobicikonostProjektiCsv(dobicikonostIzpeljava, now)
      const ime = dobicikonostProjektiCsvFilename(now)
      downloadCsvText(ime, csv)
      toast({
        title: `Dobičkonost prenešena v CSV (${ime})`,
        description: `${dobicikonostSklep(dobicikonostIzpeljava.povzetek)}.`,
      })
    } catch (err) {
      toast({ title: 'Izvoz CSV ni uspel', description: err instanceof Error ? err.message : String(err), variant: 'destructive' })
    } finally {
      setDobicikonostCsvVTeku(false)
    }
  }

  // R294 — ISSUE #1: razred funkcij — EN VIR izpeljava iz kataloga (WYSIWYG
  // kartica; NIKOLI ročno vpisane številke — isti povzetek kot testi + docs).
  const avtomatizacija = avtomatizacijaPovzetek()

  // R311 — 41. člen: AI raba pregled (ČISTA projekcija katalog × kandidati
  // — EN VIR, NIČ dvojnega računa; vzorec R305/R306/R307 memojev).
  const aiRaba = aiRabaPregled()

  // R314 — 44. člen: audit tabela po območjih (ČISTA projekcija EN VIR
  // audita — števec izračunani, sklep verbatim; vzorec R311/R312).
  const avtAudit = avtomatizacijaPregled()
  const koncna = koncnaVerifikacija()

  // R312 — 42. člen: meritve zmogljivosti jedra — realna ura, fiksni vhodi,
  // vsak izhod preverjen (fail-closed lib). Enkrat ob prikazu pregleda.
  useEffect(() => {
    try {
      setZmogljivost(izmeriZmogljivost())
    } catch {
      // fail-closed: lib vrže TypeError na pokvaren izhod — zaslon ostane
      // pri iskrenem "teče …" brez števil (nikoli izmišljenih meritev);
      // testi + STRAŽAR čuvajo lib, tukaj je samo zaščita izrisa.
    }
  }, [])

  // R293 — MARŽNI RAZGLED merilo: največja |marža| čez vrste (ISTO merilo za
  // VSE vrstice — vzorec R291/R292 mini tir; 0 pri praznem preseku).
  const maxMarza = useMemo(
    () => dobicikonostIzpeljava.vrste.reduce((m, v) => Math.max(m, Math.abs(v.marza)), 0),
    [dobicikonostIzpeljava],
  )

  useEffect(() => { loadData() }, [loadData])
  // R180 — ponovni bris ob vrnitvi v zavihek (družinski hook, 30 s vrata R170):
  // vodjin pregled (prihodki, zapadli računi, termini) mora biti pri vrnitvi
  // VEDNO svež — EN VIR: loadData je isti loader kot mount + "Poskusi znova".
  useRefetchOnFocus(loadData)

  // R261 — ENA izpeljava vhodov za presek (WYSIWYG ISTI vir kot PDF KPI,
  // tabela, sklep, mini-vrstica IN toast): DTO pruning iz ISTIH state-ov,
  // ki jih loadData ŽE napolni — NIČ nove mreže. Memo — preverba teče samo
  // ob spremembi virov, ne vsak render.
  const racuniProjektiVhodi = useMemo(() => {
    const racuni: RacuniProjektiRacun[] = allInvoices.map((inv) => ({
      stevilka: inv.stevilka,
      status: inv.status,
      znesek: inv.znesek,
      projectId: inv.projectId,
      projekt: inv.project?.nazivProjekta ?? null,
    }))
    const projekti: RacuniProjektiProjekt[] = allProjects.map((p) => ({
      id: p.id,
      nazivProjekta: p.nazivProjekta,
      estimatedPrice: p.estimatedPrice ?? null,
    }))
    return { racuni, projekti }
  }, [allInvoices, allProjects])
  const racuniProjektiPovzetek = useMemo(
    () => racuniProjektiPoProjektih(racuniProjektiVhodi.racuni, racuniProjektiVhodi.projekti).povzetek,
    [racuniProjektiVhodi],
  )

  // R261 — RAČUNI PO PROJEKTIH PDF (17. člen 'izvozi' družine): presek
  // DVEH virov, ki ju vodja ŽE ima (allInvoices + allProjects — NIČ nove
  // mreže). ENA resnica v libu: ponudba = SHRANJEN estimatedPrice (read-only
  // — NIČ pricing jedra), realizirano = IZDAN+PLACAN, odstopanje = izpeljava;
  // brez-ponudbe + brez-zapisa + stornirani/osnutki = poimenovani v sklepu
  // (NIKOLI tiho). Fail-closed: prazen presek (0 računov IN 0 projektov) →
  // iskren toast; TypeError → viden razlog. EN now za žig IN ime (lekcija
  // R121/R235). Bralni dokument — brez dodatnega pravicnega gate (vodja
  // pregled že nosi oba vira; P1-k precedens).
  const handleRacuniProjektiPdf = () => {
    if (racuniProjektiVTeku || loading) return
    setRacuniProjektiVTeku(true)
    try {
      if (allInvoices.length === 0 && allProjects.length === 0) {
        toast({ title: 'Ni podatkov za račune po projektih', description: 'PDF se izvozi, ko je vpisan prvi račun ali projektna ponudba.' })
        return
      }
      const now = new Date()
      const doc = buildRacuniProjektiPdfDoc(racuniProjektiVhodi.racuni, racuniProjektiVhodi.projekti, { now })
      doc.save(racuniProjektiPdfFilename(now))
      // Toast pove REALNO agregatno resnico (ISTA izpeljava
      // racuniProjektiPoProjektih kot PDF KPI IN mini-vrstica — WYSIWYG;
      // '—' = iskrena ni-definirana resnica, nič izmišljene 0.00).
      const { povzetek } = racuniProjektiPoProjektih(racuniProjektiVhodi.racuni, racuniProjektiVhodi.projekti)
      toast({
        title: 'Računi po projektih prenešeni v PDF',
        description: `Racuni-po-projektih-…pdf — ${povzetek.projektov} projektov, ponudba ${povzetek.ponudba !== null ? povzetek.ponudba.toFixed(2) : '—'} €, realizirano ${povzetek.realizirano.toFixed(2)} €, odstopanje ${povzetek.odstopanje !== null ? povzetek.odstopanje.toFixed(2) : '—'} €.`,
      })
    } catch (err) {
      if (err instanceof TypeError) {
        // fail-closed jedro: pokvaren vnos → viden razlog (nič izmišljenega dokumenta)
        toast({ title: 'Računi po projektih PDF ni mogoče sestaviti iz teh podatkov', description: err instanceof Error ? err.message : String(err), variant: 'destructive' })
      } else {
        toast({ title: `Izvoz PDF ni uspel: ${err instanceof Error ? err.message : String(err)}`, variant: 'destructive' })
      }
    } finally {
      setRacuniProjektiVTeku(false)
    }
  }

  /** 🆕 R163: izvoz dnevnega pregleda v CSV — točno zaslonski podatki. */
  function exportDailyCsv() {
    if (!stats) return
    try {
      const danesIso = todayStamp()
      const { csv } = buildVodjaCsv({
        kpi: {
          danasTermini: stats.danasTermini,
          danasZakljuceni: stats.danasZakljuceni,
          danasVpripravi: stats.danasVpripravi,
          mesecnoProjektov: stats.mesecnoProjektov,
          mesecniPrihodek: stats.mesecniPrihodek,
          mesecnaMarza: stats.mesecnaMarza,
          mesecnoUr: stats.mesecnoUr,
          odprtoZnesek: stats.odprtoZnesek,
          zapadloZnesek: stats.zapadloZnesek,
          zapadloSt: stats.zapadloSt,
          potekliOpomniki: stats.potekliOpomniki,
          nizkaZaloga: stats.nizkaZaloga,
          odprtaNarocila: stats.odprtaNarocila,
          brezDobavitelja: stats.brezDobavitelja,
          zamujeneDobave: stats.zamujeneDobave,
          skupajProjektov: stats.skupajProjektov,
          skupajStrank: stats.skupajStrank,
          skupniLTV: stats.skupniLTV,
        },
        termini: termini.map((t) => ({
          datumZacetka: t.datumZacetka,
          status: t.status,
          project: { nazivProjekta: t.project.nazivProjekta, customer: { ime: t.project.customer?.ime ?? null } },
          crew: t.crew ? { naziv: t.crew.naziv } : null,
        })),
        prihodki,
        danesIso,
      })
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = vodjaCsvFilename(danesIso)
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast({ title: 'Dnevni pregled izvožen ✓', description: vodjaCsvFilename(danesIso) })
    } catch (e) {
      // fail-verbose: razlog vidno, ne tiho
      toast({
        title: 'Izvoz ni uspel',
        description: e instanceof Error ? e.message : String(e),
        variant: 'destructive',
      })
    }
  }

  /** 🆕 R316 (46. člen, issue #1 IZVOZI družina): izvoz poročila končne
   *  verifikacije kot deterministični JSON — EN VIR (koncnaVerifikacijaJson),
   *  brez metapodatkov časa/hash (isti HEAD = bajtno identična datoteka).
   *  Fail-verbose: razlog vidno, ne tiho (kanon). */
  function exportKoncnaVerifikacijaJson() {
    try {
      const json = koncnaVerifikacijaJson()
      const blob = new Blob([json], { type: 'application/json;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'koncna-verifikacija.json'
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast({ title: 'Poročilo končne verifikacije izvoženo ✓', description: 'koncna-verifikacija.json' })
    } catch (e) {
      toast({
        title: 'Izvoz ni uspel',
        description: e instanceof Error ? e.message : String(e),
        variant: 'destructive',
      })
    }
  }

  /** 🆕 R317 (47. člen, issue #1 IZVOZI družina): izvoz avtomatizacijskega
   *  audita kot deterministični CSV — EN VIR (avtomatizacijaAuditCsv), brez
   *  metapodatkov časa/hash (isti HEAD = bajtno identična datoteka — kanon
   *  koncnaVerifikacijaJson, 46. člen). Fail-verbose: razlog vidno, ne tiho
   *  (kanon). */
  function exportAvtomatizacijaAuditCsv() {
    try {
      const csv = avtomatizacijaAuditCsv()
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = avtomatizacijaAuditCsvFilename()
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast({ title: 'Avtomatizacijski audit izvožen ✓', description: avtomatizacijaAuditCsvFilename() })
    } catch (e) {
      toast({
        title: 'Izvoz ni uspel',
        description: e instanceof Error ? e.message : String(e),
        variant: 'destructive',
      })
    }
  }

  /** 🆕 R318 (48. člen, issue #1 IZVOZI družina): izvoz avtomatizacijskega
   *  audita kot DETERMINISTIČNI PDF — EN VIR (isti pregled validacije kot
   *  CSV brat), brez metapodatkov časa v vsebini (isti HEAD = bajtno
   *  identičen PDF — kanon 46./47. člen). Fail-verbose: razlog vidno, ne
   *  tiho (kanon). */
  function exportAvtomatizacijaAuditPdf() {
    try {
      // fail-closed brezplačno: graditelj validira prek EN VIR pregleda —
      // pokvaren audit ne more postati lažno poročilo (kanon R299/R302/R306).
      generateAvtomatizacijaAuditPdf()
      toast({ title: 'Avtomatizacijski audit izvožen ✓', description: avtomatizacijaAuditPdfFilename() })
    } catch (e) {
      toast({
        title: 'Izvoz ni uspel',
        description: e instanceof Error ? e.message : String(e),
        variant: 'destructive',
      })
    }
  }

  /** 🆕 R320 (49. člen, issue #1 IZVOZI družina): izvoz poročila končne
   *  verifikacije kot DETERMINISTIČNI PDF — PDF brat JSON R316 (EN VIR isti
   *  koncnaVerifikacija graditelj; ločen lib po vzorcu R318), brez
   *  metapodatkov časa v vsebini (isti HEAD = bajtno identičen PDF). Fail-
   *  verbose: razlog vidno, ne tiho (kanon). */
  function exportKoncnaVerifikacijaPdf() {
    try {
      // fail-closed brezplačno: graditelj validira prek EN VIR brata —
      // pokvarjeni vhodi ne morejo postati lažno poročilo (kanon R299/R302/R306).
      generateKoncnaVerifikacijaPdf()
      toast({ title: 'Poročilo končne verifikacije izvoženo ✓', description: koncnaVerifikacijaPdfFilename() })
    } catch (e) {
      toast({
        title: 'Izvoz ni uspel',
        description: e instanceof Error ? e.message : String(e),
        variant: 'destructive',
      })
    }
  }

  /** 🆕 R321 (50. člen, issue #1 IZVOZI družina): izvoz meritev zmogljivosti
   *  kot DETERMINISTIČNI PDF — Deliverable 6 kot tisk; pregled = POSREDOVANA
   *  resnica (meritev se izvede ENKRAT v brskalniku — R312 kontrakt; PDF NE
   *  meri znova, drugi tek bi izkazal druge čase). Iskrena ničelna veja: brez
   *  izvedene meritve NI izvoza (NIČ izmišljenih števil). Fail-verbose:
   *  razlog vidno, ne tiho (kanon). */
  function exportZmogljivostPdf() {
    if (!zmogljivost) {
      // iskrena ničelna veja (vzorec dobičkonost gate) — merjenje teče ali
      // ni še zaključeno; lažnega PDF-a ni (fail-closed v handlerju).
      toast({
        title: 'Meritve še niso izvedene',
        description: 'PDF se izvozi, ko je merjenje zaključeno v brskalniku.',
      })
      return
    }
    try {
      // fail-closed brezplačno: graditelj validira kontrakt vsake meritve —
      // pokvarena meritev ne more postati lažno poročilo (kanon R299/R302/R306).
      generateZmogljivostPdf(zmogljivost)
      toast({ title: 'Meritve zmogljivosti izvožene ✓', description: zmogljivostPdfFilename() })
    } catch (e) {
      toast({
        title: 'Izvoz ni uspel',
        description: e instanceof Error ? e.message : String(e),
        variant: 'destructive',
      })
    }
  }

  if (loading) {
    return (
      <div className="space-y-3 p-4" aria-busy="true" aria-live="polite">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    )
  }

  // R163 fail-verbose: viden panel z razlogom + poskus znova — NE lažne ničle.
  if (loadError) {
    return (
      <div className="space-y-4 p-4">
        <div
          role="alert"
          className="flex flex-col gap-2 rounded-xl border border-roksal-amber/40 bg-roksal-amber/10 p-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-roksal-amber" aria-hidden="true" />
            <p className="text-sm break-words text-roksal-ink">{loadError}</p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void loadData()}
            className="shrink-0 focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2"
            aria-label="Ponovno naloži pregled za vodjo"
          >
            Poskusi znova
          </Button>
        </div>
      </div>
    )
  }

  if (!stats) return null

  return (
    <div className="space-y-4 p-4">
      {/* Naslov */}
      <div className="flex flex-wrap items-center gap-2">
        <TrendingUp aria-hidden="true" className="h-5 w-5 text-roksal-amber" />
        <h2 className="text-base font-bold text-roksal-ink">Pregled za vodjo</h2>
        <Badge variant="outline" className="text-[9px] bg-roksal-amber/10 text-roksal-amber">
          {new Date().toLocaleDateString('sl-SI', { weekday: 'long', day: '2-digit', month: 'long' })}
        </Badge>
        {/* R180 — pečat svežine (družina R170-R178, 9 površin): tight-header klasni
            niz IDENTIČEN družini — Vodja pregled je 11. notranja površina
            (Računi 10., portal stranke = dokumentirana stranska varianta);
            viden TOČKO, ko so podatki dejansko sveži — napaka ga počisti. */}
        {vodjaOsvezitev && (
          <span
            className="hidden items-center gap-1 text-[11px] text-muted-foreground sm:flex"
            title="Čas zadnje uspešne osvežitve podatkov"
          >
            <History className="h-3 w-3 shrink-0" aria-hidden="true" />
            Osveženo ob{' '}
            <span className="tabular-nums">{casOznaka(vodjaOsvezitev)}</span>
          </span>
        )}
        {/* 🆕 R163: izvoz dnevnega pregleda v CSV — KPI + opozorila + termini */}
        <Button
          size="sm"
          variant="outline"
          className="h-8 gap-1.5 border-roksal-navy/25 dark:border-roksal-ink/25 text-xs text-roksal-ink press-scale transition-all hover:border-roksal-amber hover:bg-roksal-amber/10 hover:text-roksal-ink focus-visible:ring-2 focus-visible:ring-roksal-amber/50 focus-visible:ring-offset-2"
          onClick={exportDailyCsv}
          aria-label="Izvozi dnevni pregled vodje kot CSV"
          title="Izvozi dnevni pregled (KPI, opozorila in današnji termini) kot CSV za Excel"
        >
          <Download className="h-3.5 w-3.5" aria-hidden="true" />
          Izvozi CSV
        </Button>
        {/* Mesečno poročilo PDF (runda M) — KPI + graf + računi + projekti */}
        <Button
          size="sm"
          variant="outline"
          className="ml-auto h-8 gap-1.5 border-roksal-navy/25 dark:border-roksal-ink/25 text-xs text-roksal-ink press-scale transition-all hover:border-roksal-amber hover:bg-roksal-amber/10 hover:text-roksal-ink focus-visible:ring-2 focus-visible:ring-roksal-amber/50 focus-visible:ring-offset-2"
          onClick={downloadReport}
          disabled={reportLoading}
          aria-label="Prenesi mesečno PDF poročilo"
        >
          {reportLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <FileDown className="h-3.5 w-3.5" aria-hidden="true" />}
          Poročilo PDF
        </Button>
        {/* R258 — DOBIČKONOST PO PROJEKTIH PDF (14. člen 'izvozi' družine):
            presek prihodkov (računi) in stroškov materiala (naročila) —
            bralni dokument, VEDNO viden (P1-k precedens), press-scale +
            FileText aria-hidden (pill družina). */}
        <Button
          size="sm"
          variant="outline"
          className="h-6 gap-1 text-2xs press-scale focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-1"
          onClick={handleDobicikonostPdf}
          disabled={loading || dobicikonostVTeku}
          aria-label="Izvozi dobičkonosnost projektov kot PDF"
          title="Dobičkonosnost po projektih kot pravi PDF — prihodki (računi) vs stroški materiala (naročila) z maržo in akcijskim redom"
        >
          <FileText className="h-3 w-3" aria-hidden="true" />
          PDF
        </Button>
        {/* R261 — RAČUNI PO PROJEKTIH PDF (17. člen 'izvozi' družine):
            presek ponudbe (shranjen estimatedPrice) in realizacije (računi)
            — bralni dokument, VEDNO viden (P1-k precedens), press-scale +
            FileText aria-hidden (pill družina — pariteta R258). */}
        <Button
          size="sm"
          variant="outline"
          className="h-6 gap-1 text-2xs press-scale focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-1"
          onClick={handleRacuniProjektiPdf}
          disabled={loading || racuniProjektiVTeku}
          aria-label="Izvozi račune po projektih kot PDF"
          title="Računi po projektih kot pravi PDF — ponudba (vpisana ocena) vs realizacija (izdani + plačani računi) z odstopanjem"
        >
          <FileText className="h-3 w-3" aria-hidden="true" />
          PDF
        </Button>
        {/* R293 — DOBIČKONOST PO PROJEKTIH CSV (24. člen 'izvozi' družine):
            CSV brat PDF R258 — bralni dokument, VEDNO viden (P1-k precedens),
            press-scale + FileSpreadsheet aria-hidden (pill družina — pariteta
            R258/R261). */}
        <Button
          size="sm"
          variant="outline"
          className="h-6 gap-1 text-2xs press-scale focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-1"
          onClick={handleDobicikonostCsv}
          disabled={loading || dobicikonostCsvVTeku}
          aria-label="Izvozi dobičkonosnost projektov kot CSV"
          title="Dobičkonosnost po projektih kot CSV — ista resnica kot PDF (prihodki · stroški · marža)"
        >
          <FileSpreadsheet className="h-3 w-3" aria-hidden="true" />
          CSV
        </Button>
      </div>
      {/* R258 — legenda dobičkonostne resnice (želona pariteta R245/R252/R257:
          vsaka izpeljava pove svojo definicijo — WYSIWYG; žetoni, 0 novih hex).
          R261 — substring-parna nadgradna (R260 lekcija 3): nova resnica
          PRIPEPENA ZA obstoječo — stara dobesedna resnica ostane, vsi stari
          toContain pini ostanejo zeleni BREZ premika.
          R293 — pripona: CSV = ista resnica kot PDF (24. člen). */}
      <p className="text-right text-2xs text-muted-foreground">
        Prihodki = izdani + plačani računi · Stroški = ne-preklicana naročila · Marža = prihodki − stroški · Marža (%) = marža / prihodki · Brez projekta = izključeni iz preseka · Ponudba = vpisana ocena (estimatedPrice) · Realizirano = izdani + plačani računi · Odstopanje = realizirano − ponudba · CSV = ista resnica kot PDF
      </p>

      {/* R293 — MARŽNI RAZGLED (MANDATORY STIL) — dobičkonostna resnica NA
          ZASLONU (do zdaj samo v PDF R258): ENA resnica z izvozoma — EN VIR
          dobicikonostIzpeljava (ISTI presek kot PDF IN CSV — divergenca
          nemogoča). MARŽA ASC (ISTI akcijski red kot PDF tabela — najslabša
          PRVA, R252 vzorec); NEGATIVNA marža rdeča (iskren alarm — PDF RED
          bold pariteta, NIKOLI utišana); '—' % = iskrena ni-definirana
          resnica (NIKOLI izmišljen 0 %); mini tir vzorec R291/R292: širina =
          |marža| / najvišja marža × 100 — ISTO merilo za VSE vrstice, 0 %
          iskreno pri praznem preseku, aria-hidden (številka nosi resnico),
          hover title z izrečeno izpeljavo. 0 novih hex — samo obstoječi
          žetoni (baseline pregled r226 — hex literali v komentarjih ŠTEJEJO,
          r225/r261 pin lekcija). */}
      <div
        className="rounded-lg border border-border bg-muted/40 px-3 py-2"
        role="group"
        aria-label="Maržni razgled — marža po projektih"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
          <p className="text-2xs font-medium text-roksal-ink">Maržni razgled</p>
          <p className="text-2xs text-muted-foreground" data-testid="marzni-razgled-sklep">
            {dobicikonostIzpeljava.vrste.length === 0
              ? 'Ni projektov v preseku — dobičkonost se izriše ob prvem računu ali naročilu.'
              : `${dobicikonostSklep(dobicikonostIzpeljava.povzetek)}.`}
          </p>
        </div>
        {dobicikonostIzpeljava.vrste.length > 0 && (
          <div className="mt-1.5 space-y-1">
            {dobicikonostIzpeljava.vrste.map((v) => {
              const negativna = v.marza < 0
              const sirina =
                maxMarza === 0
                  ? 0
                  : Math.min(100, Math.round((Math.abs(v.marza) / maxMarza) * 100))
              return (
                <div
                  key={v.projekt}
                  className="flex min-w-0 items-center gap-2"
                  title={`${v.projekt}: marža ${v.marza.toFixed(2)} EUR — ${sirina} % najvišje marže (po absolutni vrednosti)${v.marzaOdstotek === null ? ' · brez prihodkov (% ni definiran)' : ''}`}
                >
                  <span className="w-24 shrink-0 truncate text-2xs text-roksal-ink">{v.projekt}</span>
                  <div className="h-1 min-w-0 flex-1 rounded-full bg-muted" aria-hidden="true">
                    <div
                      className={`h-1 rounded-full ${negativna ? 'bg-roksal-red/40' : 'bg-roksal-navy/30'}`}
                      style={{ width: `${sirina}%` }}
                    />
                  </div>
                  {/* R294 (MANDATORY STIL): števca dokumentov iz ISTE vrste
                      (PDF tabela stolpca Računov/Naročil — resnica NA ZASLONU). */}
                  <span
                    className="w-14 shrink-0 text-right text-2xs tabular-nums text-muted-foreground"
                    title={`Računov: ${v.racunov} · Naročil: ${v.narocil} (ista resnica kot PDF tabela)`}
                  >
                    {v.racunov} r · {v.narocil} n
                  </span>
                  <span
                    className={`w-20 shrink-0 text-right text-2xs tabular-nums ${negativna ? 'font-medium text-roksal-red' : 'text-roksal-ink'}`}
                  >
                    {v.marza.toFixed(2)}
                  </span>
                  <span className="w-10 shrink-0 text-right text-2xs tabular-nums text-muted-foreground">
                    {v.marzaOdstotek === null ? '—' : `${v.marzaOdstotek.toFixed(1)} %`}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* R294 — AVTOMATIZACIJA — razred funkcij (issue #1: feature-by-feature
          audit NA ZASLONU — EN VIR katalog (WYSIWYG — iste številke kot testi
          in docs/automacija-audit.md); AI = neobvezna pomoč z IZREČENIM
          determinističnim nadomestkom — jedro deluje brez AI; skripti tile
          POGOJNI (iskrena 0 = ni skriptov v katalogu — kanon r277); 0 novih
          hex — samo žetoni). */}
      <section
        className="rounded-lg border border-border bg-muted/40 px-3 py-2"
        aria-label="Avtomatizacija — razred funkcij"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
          <p className="flex items-center gap-1 text-2xs font-medium text-roksal-ink">
            <Workflow className="h-3 w-3" aria-hidden="true" />
            Avtomatizacija — razred funkcij
          </p>
          <p className="text-2xs tabular-nums text-muted-foreground">
            {avtomatizacija.skupaj} funkcij · {avtomatizacija.stObmocij} območij poslovanja
          </p>
        </div>
        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
          <span
            className="text-2xs text-roksal-ink"
            title="Deterministične funkcije: čista geometrija, poslovna pravila in izpeljave — enaki vhodi = enak izhod."
          >
            {avtomatizacija.deterministicnih} determinističnih
          </span>
          <span
            className="text-2xs text-roksal-ink"
            title="SDK funkcije: uveljavljene knjižnice (npr. jsPDF) pod determinističnimi predlogami."
          >
            {avtomatizacija.sdk} SDK
          </span>
          {avtomatizacija.skriptov > 0 && (
            <span className="text-2xs text-roksal-ink" title="Lokalni skripti/delavci.">
              {avtomatizacija.skriptov} skriptov
            </span>
          )}
          <span
            className="text-2xs text-roksal-amber"
            title="AI = neobvezna pomoč: vsaka AI zmožnost IZRECNO deklarira deterministični nadomestek (kanon issue #1 §11) — AI nikoli ni vir resnice."
          >
            {avtomatizacija.ai} AI (neobvezne)
          </span>
        </div>
        <p className="mt-1 text-2xs text-muted-foreground">
          AI = neobvezna pomoč ({avtomatizacija.aiZNadomestkom} zmožnosti z izrečenim determinističnim nadomestkom) — jedro deluje brez AI.
        </p>
      </section>

      {/* R311 — 41. člen issue #1 (Deliverable 5 NA ZASLONU): AI raba —
          iskrena resnica po površinah. ČISTA projekcija EN VIR (katalog
          'ai' vnosi z razrešenim nadomestkom + AI_KANDIDATI verbatim) —
          ISTI nizi kot testi in docs/automacija-audit.md (WYSIWYG);
          AI = neobvezna pomoč z IZREČENIM nadomestkom — jedro deluje brez
          AI; kandidati so ISKRENI (NE-IMPLEMENTIRANO, nič povezano —
          nikoli lažna implementacija); 0 novih hex — samo žetoni;
          dolgo besedilo ink (r162 lekcija), žeton na ikoni. */}
      <section
        className="rounded-lg border border-border bg-muted/40 px-3 py-2"
        aria-label="AI raba — iskrena resnica"
        data-testid="ai-raba-dokaz"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
          <p className="flex items-center gap-1 text-2xs font-medium text-roksal-ink">
            <Sparkles className="h-3 w-3 text-roksal-amber" aria-hidden="true" />
            AI raba — iskrena resnica
          </p>
          <p className="text-2xs tabular-nums text-muted-foreground" title="ISTI katalog kot 'Avtomatizacija — razred funkcij' in docs/automacija-audit.md — EN VIR.">
            {aiRaba.stAi} AI · {aiRaba.stKandidatov} kandidatov · 0 AI-obveznih
          </p>
        </div>
        {aiRaba.zive.map((z) => (
          <div key={z.id} className="mt-1.5 rounded-md border border-border bg-background/60 px-2 py-1.5">
            <p className="text-2xs font-medium text-roksal-ink">{z.opis}</p>
            <p className="text-2xs text-muted-foreground">
              → nadomestek (brez AI): {z.nadomestekOpis}
            </p>
          </div>
        ))}
        <div className="mt-1.5">
          <p className="text-2xs font-medium text-roksal-ink">
            Kandidati — {aiRaba.kandidatiStatus ?? 'različni statusi'}:
          </p>
          <ul className="mt-0.5 space-y-0.5">
            {aiRaba.kandidati.map((k) => (
              <li key={k.funkcija} className="text-2xs leading-relaxed text-roksal-ink/80">
                <span className="font-medium text-roksal-ink">{k.funkcija}</span> — {k.zakaj}
              </li>
            ))}
          </ul>
        </div>
        <p className="mt-1.5 text-2xs text-muted-foreground" data-testid="ai-raba-sklep">
          {aiRaba.sklep}
        </p>
      </section>

      {/* R312 — 42. člen issue #1 (Deliverable 6): meritve zmogljivosti —
          iskrene meritve jedra. Realno izvajanje pravih funkcij na fiksnih
          predstavitvenih vhodih (lib zmogljivost-pregled — vsak izhod
          preverjen, fail-closed); časi so strojno odvisna resnica (izrecno
          'na tej napravi') — izris šele v brskalniku, brez izvedene meritve
          NIKOLI izmišljenih števil; struktura + izhodi deterministični.
          WYSIWYG: sklep verbatim (NIČ dvojnega sklepa — vzorec R311). */}
      <section
        className="rounded-lg border border-border bg-muted/40 px-3 py-2"
        aria-label="Meritve zmogljivosti jedra"
        data-testid="zmogljivost-dokaz"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
          <p className="flex items-center gap-1 text-2xs font-medium text-roksal-ink">
            <Gauge className="h-3 w-3 text-roksal-amber" aria-hidden="true" />
            Meritve zmogljivosti jedra
          </p>
          <div className="flex items-center gap-1.5">
            <p className="text-2xs tabular-nums text-muted-foreground" title="Realna meritev izvajanja jedra (deterministični kalkulator, konflikti, CSV, AI-raba projekcija) — struktura EN VIR z lib testi.">
              {zmogljivost
                ? `${zmogljivost.meritve.length} operacij · ${zmogljivost.skupajIteracij} iteracij`
                : 'merjenje teče …'}
            </p>
            {/* R321 — 50. člen (IZVOZI družina): PDF tisk meritev (Deliverable
                6) — a11y izvozne družine (aria + title, R291/R293); amber/50
                ring + taktilna mikrointerakcija (družinska simetrija blok
                glav — val8/val9 registri); fail-verbose toast + iskrena
                ničelna veja. */}
            <Button
              size="sm"
              variant="outline"
              className="h-6 gap-1 border-roksal-navy/25 px-2 text-2xs text-roksal-ink press-scale transition-all hover:border-roksal-amber hover:bg-roksal-amber/10 hover:text-roksal-ink focus-visible:ring-2 focus-visible:ring-roksal-amber/50 focus-visible:ring-offset-2 dark:border-roksal-ink/25"
              onClick={exportZmogljivostPdf}
              aria-label="Izvozi meritve zmogljivosti kot PDF"
              title="Izvozi meritve zmogljivosti jedra (operacije × iteracije × časi — EN VIR zaslon) kot deterministični PDF"
            >
              <Download className="h-3 w-3" aria-hidden="true" />
              PDF
            </Button>
          </div>
        </div>
        {zmogljivost ? (
          <ul className="mt-1 space-y-0.5" data-testid="zmogljivost-vrstice">
            {zmogljivost.meritve.map((m) => (
              <li
                key={m.id}
                className="flex items-baseline justify-between gap-2 rounded-md border border-border bg-background/60 px-2 py-1 transition-colors hover:border-roksal-amber/40"
                data-testid="zmogljivost-vrstica"
                title={m.modul}
              >
                <span className="text-2xs text-roksal-ink">
                  <span className="font-medium">{m.opis}</span>
                  <span className="text-muted-foreground">
                    {' '}· {m.iteracij}× · vsi izhodi preverjeni
                  </span>
                </span>
                <span
                  className="shrink-0 text-2xs tabular-nums text-roksal-ink"
                  title="najmanj / mediana / največ (ms) — resnična meritev na tej napravi (strojno odvisna)"
                >
                  {formatirajMs(m.najmanj)}
                  {' / '}
                  {formatirajMs(m.mediana)}
                  {' / '}
                  {formatirajMs(m.najvec)} ms
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-2xs text-muted-foreground">
            Merjenje se izvede v brskalniku ob odprtju pregleda — brez izvedene meritve ni izmišljenih števil.
          </p>
        )}
        {zmogljivost && (
          <p className="mt-1.5 text-2xs text-muted-foreground" data-testid="zmogljivost-sklep">
            {zmogljivost.sklep}
          </p>
        )}
      </section>

      {/* R314 — 44. člen issue #1 (Deliverable 4 NA ZASLONU): feature-by-feature
          audit tabela — vsako območje (§1–§11) izrecno klasificirano z potmi
          implementacije + dokaza (števec IZRAČUNANI iz EN VIR — tabela ne sme
          sanjati; strazar R294 dokazuje, da poti obstajajo na disku).
          Značke = kategorije barv med sorodniki (R308/R312 lekcija);
          AI-OPCIJSKO = roksal žeton opozorilne družine (r162); sklep verbatim
          EN VIR ({avtAudit.sklep} — NIČ dvojnega sklepa, vzorec R311/R312). */}
      <section
        className="rounded-lg border border-border bg-muted/40 px-3 py-2"
        aria-label="Avtomatizacija — audit po območjih"
        data-testid="avtomatizacija-dokaz"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
          <p className="flex items-center gap-1 text-2xs font-medium text-roksal-ink">
            <ClipboardList className="h-3 w-3 text-roksal-amber" aria-hidden="true" />
            Avtomatizacija — audit po območjih
          </p>
          <p
            className="text-2xs tabular-nums text-muted-foreground"
            title="ISTI audit kot docs/automacija-audit.md — EN VIR. Vsaka vrstica nosi KONKRETNE poti implementacije + dokaza."
          >
            {avtAudit.stObmocij} območij · {avtAudit.poRazredu.DETERMINISTICNO} DETERMINISTIČNO · {avtAudit.poRazredu.AI_OPCIJSKO} AI-OPCIJSKO
          </p>
          {/* 🆕 R317 (47. člen) + R318 (48. člen): izvoz istega EN VIR audita
              kot CSV in PDF — a11y družina (aria-label + title, R291/R293
              precedens); ISTI gumb vzorec kot JSON brat (46. člen) — amber
              ring par (WYSIWYG); PDF brat (48. člen) nosi ISTI vzorec
              (bratska simetrija blok glave — register val8 val9 ×4). */}
          <Button
            size="sm"
            variant="outline"
            className="h-6 gap-1 border-roksal-navy/25 px-2 text-2xs text-roksal-ink press-scale transition-all hover:border-roksal-amber hover:bg-roksal-amber/10 hover:text-roksal-ink focus-visible:ring-2 focus-visible:ring-roksal-amber/50 focus-visible:ring-offset-2 dark:border-roksal-ink/25"
            onClick={exportAvtomatizacijaAuditCsv}
            aria-label="Izvozi avtomatizacijski audit kot CSV"
            title="Izvozi avtomatizacijski audit (11 območij + klasifikacije + poti) kot deterministični CSV"
          >
            <Download className="h-3 w-3" aria-hidden="true" />
            CSV
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-6 gap-1 border-roksal-navy/25 px-2 text-2xs text-roksal-ink press-scale transition-all hover:border-roksal-amber hover:bg-roksal-amber/10 hover:text-roksal-ink focus-visible:ring-2 focus-visible:ring-roksal-amber/50 focus-visible:ring-offset-2 dark:border-roksal-ink/25"
            onClick={exportAvtomatizacijaAuditPdf}
            aria-label="Izvozi avtomatizacijski audit kot PDF"
            title="Izvozi avtomatizacijski audit (11 območij + klasifikacije + poti) kot deterministični PDF"
          >
            <Download className="h-3 w-3" aria-hidden="true" />
            PDF
          </Button>
        </div>
        <ul className="mt-1 space-y-0.5" data-testid="avtomatizacija-vrstice">
          {avtAudit.vrstice.map((v) => (
            <li
              key={v.obmocje}
              className="rounded-md border border-border bg-background/60 px-2 py-1.5 transition-colors hover:border-roksal-amber/40"
              data-testid="avtomatizacija-vrstica"
            >
              <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5">
                <span className="flex items-center gap-1.5 text-2xs font-medium text-roksal-ink">
                  <span
                    className={`rounded border px-1 py-px text-[9px] font-bold uppercase tracking-wide ${AVT_AUDIT_ZNACKA[v.razred]}`}
                    title={`Razred: ${v.razredPrikazno}`}
                  >
                    {v.razredPrikazno}
                  </span>
                  {v.obmocje}
                </span>
                <span
                  className="shrink-0 text-2xs tabular-nums text-muted-foreground"
                  title="vsaka pot implementacije mora obstajati (strazar R294) in imeti testni dokaz"
                >
                  {v.stImplementacij} impl · {v.stDokazov} dokazov
                </span>
              </div>
              <p className="mt-0.5 text-2xs leading-relaxed text-roksal-ink/80">{v.opomba}</p>
            </li>
          ))}
        </ul>
        <p className="mt-1.5 text-2xs text-muted-foreground" data-testid="avtomatizacija-sklep">
          {avtAudit.sklep}
        </p>
      </section>

      {/* R315 — 45. člen issue #1 (Deliverable 7 NA ZASLONU): končna verifikacija
          proti HEAD — vsako območje audita z IZRECNO vezavo na verifikacijske
          plasti (vitest · build-needleji · E2E ŽIVO · prod-qa · smoke) + 8
          sprejemnih kriterijev z mehanično izpeljavo in konkretnim dokazom.
          Števec IZRAČUNANI iz EN VIR (koncna-verifikacija) — verifikacija ne
          sme sanjati; sklep verbatim ({koncna.sklep} — NIČ dvojnega sklepa,
          vzorec R311/R312/R314). Značke plasti = roksal žetoni (r162). */}
      <section
        className="rounded-lg border border-border bg-muted/40 px-3 py-2"
        aria-label="Končna verifikacija — dokazne plasti po območjih"
        data-testid="koncna-verifikacija-dokaz"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
          <p className="flex items-center gap-1 text-2xs font-medium text-roksal-ink">
            <BadgeCheck className="h-3 w-3 text-roksal-amber" aria-hidden="true" />
            Končna verifikacija — dokazne plasti
          </p>
          <p
            className="text-2xs tabular-nums text-muted-foreground"
            title="Verifikacija se izvede nad delovnim drevesom PRED vsakim commitom (tsc · eslint · vitest · build · smoke · E2E ŽIVO · prod-qa) — drevo je byte-določeno s HEAD; vezava na commit je implicitna in reproduktibilna."
          >
            {koncna.stObmocijZDokazi}/{koncna.stObmocij} območij · {koncna.stKriterijev} kriterijev
          </p>
          {/* 🆕 R316 (46. člen): izvoz istega EN VIR poročila kot JSON —
              a11y družina (aria-label + title, R291/R293 precedens). */}
          <Button
            size="sm"
            variant="outline"
            className="h-6 gap-1 border-roksal-navy/25 px-2 text-2xs text-roksal-ink press-scale transition-all hover:border-roksal-amber hover:bg-roksal-amber/10 hover:text-roksal-ink focus-visible:ring-2 focus-visible:ring-roksal-amber/50 focus-visible:ring-offset-2 dark:border-roksal-ink/25"
            onClick={exportKoncnaVerifikacijaJson}
            aria-label="Izvozi poročilo končne verifikacije kot JSON"
            title="Izvozi poročilo končne verifikacije (11 območij + 8 kriterijev + sklep) kot deterministični JSON"
          >
            <Download className="h-3 w-3" aria-hidden="true" />
            JSON
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-6 gap-1 border-roksal-navy/25 px-2 text-2xs text-roksal-ink press-scale transition-all hover:border-roksal-amber hover:bg-roksal-amber/10 hover:text-roksal-ink focus-visible:ring-2 focus-visible:ring-roksal-amber/50 focus-visible:ring-offset-2 dark:border-roksal-ink/25"
            onClick={exportKoncnaVerifikacijaPdf}
            aria-label="Izvozi poročilo končne verifikacije kot PDF"
            title="Izvozi poročilo končne verifikacije (11 območij + 8 kriterijev + sklep) kot deterministični PDF"
          >
            <Download className="h-3 w-3" aria-hidden="true" />
            PDF
          </Button>
        </div>
        <ul className="mt-1 space-y-0.5" data-testid="koncna-verifikacija-vrstice">
          {koncna.vrstice.map((v) => (
            <li
              key={v.obmocje}
              className="rounded-md border border-border bg-background/60 px-2 py-1.5 transition-colors hover:border-roksal-amber/40"
              data-testid="koncna-verifikacija-vrstica"
            >
              <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5">
                <span className="flex items-center gap-1.5 text-2xs font-medium text-roksal-ink">
                  {v.obmocje}
                </span>
                <span className="flex flex-wrap items-center gap-1">
                  {v.plasti.map((p) => (
                    <span
                      key={p}
                      className="rounded border border-roksal-navy/20 bg-roksal-navy/[0.04] px-1 py-px text-[9px] font-semibold text-roksal-ink dark:border-roksal-ink/25 dark:bg-roksal-ink/[0.08]"
                      title={`Plast: ${p}`}
                    >
                      {p}
                    </span>
                  ))}
                </span>
              </div>
              <p className="mt-0.5 text-2xs leading-relaxed text-roksal-ink/80">{v.opombaDokaza}</p>
            </li>
          ))}
        </ul>
        <p className="mt-1.5 text-2xs font-medium text-roksal-ink">Sprejemni kriteriji (issue #1):</p>
        <ul className="mt-0.5 space-y-0.5" data-testid="koncna-verifikacija-kriteriji">
          {koncna.kriteriji.map((k) => (
            <li
              key={k.kriterij}
              className="rounded-md border border-border bg-background/60 px-2 py-1.5"
              data-testid="koncna-verifikacija-kriterij"
            >
              <p className="text-2xs font-medium leading-snug text-roksal-ink">{k.kriterij}</p>
              <p className="mt-0.5 text-2xs leading-relaxed text-roksal-ink/80">
                <span className="font-semibold">izpeljava:</span> {k.izpeljava}
              </p>
              <p className="text-2xs leading-relaxed text-muted-foreground">
                <span className="font-semibold">dokaz:</span> {k.dokaz}
              </p>
            </li>
          ))}
        </ul>
        <p className="mt-1.5 text-2xs text-muted-foreground" data-testid="koncna-verifikacija-sklep">
          {koncna.sklep}
        </p>
      </section>

      {/* Današnji pregled */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Danes</h3>
        <div className="grid grid-cols-3 gap-2">
          <Card className="group border-roksal-navy/20 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-roksal-navy/40 dark:border-roksal-ink/20 dark:hover:border-roksal-ink/30">
            <CardContent className="p-3 text-center">
              <Calendar className="h-4 w-4 mx-auto text-roksal-ink mb-1 transition-transform duration-200 group-hover:scale-110" aria-hidden="true" />
              <div className="text-xl font-bold tabular-nums text-roksal-ink">{stats.danasTermini}</div>
              <div className="text-[9px] text-muted-foreground">Termini</div>
            </CardContent>
          </Card>
          {/* R225 — token harmonizacija (družina R224): roksal-amber/ink/green
              — opacity žetoni delujejo v OBEH temah (brez dark: dvojčkov). */}
          <Card className="group border-roksal-amber/30 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-roksal-amber/50">
            <CardContent className="p-3 text-center">
              <Clock className="h-4 w-4 mx-auto text-roksal-amber mb-1 transition-transform duration-200 group-hover:scale-110" aria-hidden="true" />
              <div className="text-xl font-bold tabular-nums text-roksal-amber">{stats.danasVpripravi}</div>
              <div className="text-[9px] text-muted-foreground">V teku</div>
            </CardContent>
          </Card>
          <Card className="group border-roksal-green/30 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-roksal-green/50">
            <CardContent className="p-3 text-center">
              <CheckCircle2 className="h-4 w-4 mx-auto text-roksal-green mb-1 transition-transform duration-200 group-hover:scale-110" aria-hidden="true" />
              <div className="text-xl font-bold tabular-nums text-roksal-green">{stats.danasZakljuceni}</div>
              <div className="text-[9px] text-muted-foreground">Zaključeni</div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Današnji termini seznam */}
      {termini.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5 text-roksal-amber" aria-hidden="true" />
              Današnji termini
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {termini.map((t) => (
              <div key={t.id} className="flex items-center gap-2 rounded-lg border border-border p-2">
                <div className="h-8 w-1 rounded-full" style={{ backgroundColor: t.crew?.barva || '#1d2b3e' }} />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium text-roksal-ink truncate">{t.project.nazivProjekta}</div>
                  <div className="text-[9px] text-muted-foreground truncate">
                    {formatTime(t.datumZacetka)} · {t.project.customer.ime} · {t.crew?.naziv || 'Brez ekipe'}
                  </div>
                </div>
                {/* R225 — žetoni na žetone (ISTO strukturo kot Domov
                    STATUS_ZETONI): opacity žetoni brez dark: dvojčkov. */}
                <Badge variant="outline" className={`text-3xs shrink-0 ${
                  t.status === 'ZAKLJUCENO' ? 'bg-roksal-green/15 text-roksal-green border-roksal-green/30' :
                  t.status === 'V_TEKU' ? 'bg-roksal-amber/15 text-roksal-amber border-roksal-amber/30' :
                  'bg-roksal-navy/10 text-roksal-ink border-roksal-navy/25 dark:border-roksal-ink/25'
                }`}>
                  {terminStatusLabel(t.status)}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Mesečni pregled */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Ta mesec</h3>
        <div className="grid grid-cols-2 gap-2">
          <Card className="border-roksal-navy/20 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-border">
            <CardContent className="p-3">
              <div className="flex items-center gap-1 mb-1">
                <Euro className="h-3 w-3 text-roksal-ink" aria-hidden="true" />
                <span className="text-2xs text-muted-foreground">Prihodek (plačano)</span>
              </div>
              <div className="text-lg font-bold tabular-nums text-roksal-ink">{formatEUR(stats.mesecniPrihodek)}</div>
              <div className="text-[9px] text-muted-foreground">iz plačanih računov</div>
            </CardContent>
          </Card>
          <Card className="border-roksal-green/25 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
            <CardContent className="p-3">
              <div className="flex items-center gap-1 mb-1">
                <TrendingUp className="h-3 w-3 text-roksal-green" aria-hidden="true" />
                <span className="text-2xs text-muted-foreground">Marža (25%)</span>
              </div>
              <div className="text-lg font-bold tabular-nums text-roksal-green">{formatEUR(stats.mesecnaMarza)}</div>
            </CardContent>
          </Card>
          {/* R225 — vijolična NI tokenna družina → navy (informacija; ISTO
              kot Prihodek kartica — navy obroba z dark dvojčkom). */}
          <Card className="border-roksal-navy/20 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-border">
            <CardContent className="p-3">
              <div className="flex items-center gap-1 mb-1">
                <Package className="h-3 w-3 text-roksal-ink" aria-hidden="true" />
                <span className="text-2xs text-muted-foreground">Projektov</span>
              </div>
              <div className="text-lg font-bold tabular-nums text-roksal-ink">{stats.mesecnoProjektov}</div>
            </CardContent>
          </Card>
          <Card className="border-roksal-amber/30 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
            <CardContent className="p-3">
              <div className="flex items-center gap-1 mb-1">
                <Clock className="h-3 w-3 text-roksal-amber" aria-hidden="true" />
                <span className="text-2xs text-muted-foreground">Ure</span>
              </div>
              <div className="text-lg font-bold tabular-nums text-roksal-ink">{stats.mesecnoUr}h</div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Prihodki — zadnjih 6 mesecev (plačani računi) + stevca odprto/zapadlo.
          Čisti DOM stolpci (brez graf knjižnic), višina sorazmerna max vrednosti;
          mesec z vrednostjo pokaže znesek tudi ob hoveru (title). */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Prihodki — zadnjih 6 mesecev</h3>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-end justify-between gap-1.5" style={{ height: 96 }}>
              {prihodki.map((m) => {
                const max = Math.max(...prihodki.map((x) => x.eur), 1)
                const h = Math.max((m.eur / max) * 76, m.eur > 0 ? 6 : 2)
                const isCurrent = m === prihodki[prihodki.length - 1]
                return (
                  <div
                    key={m.label}
                    className="flex flex-1 flex-col items-center justify-end gap-1 transition-opacity duration-200 hover:opacity-80"
                    title={`${m.label}: ${formatEUR(m.eur)}`}
                  >
                    {m.eur > 0 && (
                      <span className="text-3xs font-semibold tabular-nums text-roksal-ink">{formatEUR(m.eur)}</span>
                    )}
                    <div
                      className={`w-full max-w-[38px] rounded-t-md transition-all duration-500 ${
                        isCurrent
                          ? 'bg-gradient-to-t from-roksal-amber to-roksal-amber/50'
                          : 'bg-gradient-to-t from-roksal-navy/80 to-roksal-navy/40 dark:from-roksal-ink/45 dark:to-roksal-ink/15'
                      }`}
                      style={{ height: h }}
                      aria-hidden="true"
                    />
                  </div>
                )
              })}
            </div>
            <div className="mt-1.5 flex justify-between gap-1.5">
              {prihodki.map((m) => (
                <span key={m.label} className="flex-1 text-center text-[9px] text-muted-foreground">
                  {m.label}
                </span>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-2.5 py-1.5">
                <span className="h-2 w-2 shrink-0 rounded-full bg-roksal-amber" aria-hidden />
                <div className="min-w-0">
                  <p className="text-[9px] text-muted-foreground">Odprto (izdano)</p>
                  <p className="text-xs font-bold text-roksal-ink">{formatEUR(stats.odprtoZnesek)}</p>
                </div>
              </div>
              <div className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 ${
                  stats.zapadloSt > 0 ? 'border-roksal-red/20 bg-roksal-red/5' : 'border-border bg-muted/40'
                }`}>
                <span className={`h-2 w-2 shrink-0 rounded-full ${stats.zapadloSt > 0 ? 'bg-roksal-red' : 'bg-muted-foreground'}`} aria-hidden />
                <div className="min-w-0">
                  <p className={`text-[9px] ${stats.zapadloSt > 0 ? 'text-roksal-red' : 'text-muted-foreground'}`}>Zapadlo</p>
                  <p className={`text-xs font-bold tabular-nums ${stats.zapadloSt > 0 ? 'text-roksal-red' : 'text-roksal-ink'}`}>
                    {formatEUR(stats.zapadloZnesek)}
                    {stats.zapadloSt > 0 && <span className="ml-1 font-medium">({stats.zapadloSt})</span>}
                  </p>
                </div>
              </div>
              {/* R261 — F2 ponudbeni pregled (WYSIWYG ISTA izpeljava
                  racuniProjektiPoProjektih kot PDF KPI — EN vir resnice
                  zaslon/PDF; žetoni, 0 novih hex; '—' = iskrena
                  ni-definirana vsota, NIKOLI izmišljena ničla). */}
              <div className={`col-span-2 flex items-center gap-2 rounded-lg border px-2.5 py-1.5 ${
                  racuniProjektiPovzetek.brezPonudbe > 0 ? 'border-roksal-amber/30 bg-roksal-amber/5' : 'border-border bg-muted/40'
                }`}>
                <span className={`h-2 w-2 shrink-0 rounded-full ${racuniProjektiPovzetek.brezPonudbe > 0 ? 'bg-roksal-amber' : 'bg-roksal-green'}`} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-[9px] text-muted-foreground">Ponudbe v izvedbi</p>
                  <p className="text-xs font-bold tabular-nums text-roksal-ink">
                    {racuniProjektiPovzetek.ponudba !== null ? formatEUR(racuniProjektiPovzetek.ponudba) : '—'}
                    <span className="ml-1 text-[9px] font-normal text-muted-foreground">od {racuniProjektiPovzetek.ponudbaZneskov + racuniProjektiPovzetek.brezPonudbe} projektov</span>
                  </p>
                </div>
                {racuniProjektiPovzetek.brezPonudbe > 0 && (
                  <span className="shrink-0 rounded-full border border-roksal-amber/40 bg-roksal-amber/10 px-1.5 py-0.5 text-[9px] font-medium text-roksal-amber">
                    {racuniProjektiPovzetek.brezPonudbe} brez vpisane ponudbe
                  </span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Opozorila */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Opozorila</h3>
        <div className="space-y-2">
          {/* R225 — token harmonizacija Opozoril (družina R224): vsa tri
              preostala trdo kodirana svetla ozadja (red-50/blue-50/green-50
              + dark: dvojčki) → opacity žetoni, ki delujejo v OBEH temah.
              Semantika: potekli opomniki = ALARM (roksal-red, ISTO kot nizka
              zaloga R224); odprta naročila = INFORMACIJA (navy — čaka
              dobavo, ni napaka); 'vse v redu' = POZITIVNO (roksal-green).
              0 novih hex. */}
          {stats.potekliOpomniki > 0 && (
            <Card className="border-roksal-red/20 bg-roksal-red/5">
              <CardContent className="p-3 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-roksal-red shrink-0" aria-hidden="true" />
                <div className="flex-1">
                  <div className="text-xs font-medium text-roksal-ink"><span className="tabular-nums">{stats.potekliOpomniki}</span> poteklih opomnikov</div>
                  <div className="text-2xs text-roksal-red">Preveri v CRM → Stranke</div>
                </div>
              </CardContent>
            </Card>
          )}
          {stats.nizkaZaloga > 0 && (
            // R224 — semantična harmonizacija: nizka zaloga = roksal-red
            // družina (ISTO pomenovskjo barvo kot Domov kartica 'Nizka zaloga
            // materiala' + Zaloga čipa 'Pod/Na minimumu' R219/R220 — barva je
            // APP-WIDE pomen, ne dekoracija prejšnje odločitve). Opacity
            // žetoni delujejo v OBEH temah (brez dark: dvojčkov).
            <Card className="border-roksal-red/20 bg-roksal-red/5">
              <CardContent className="p-3 flex items-center gap-2">
                <Package className="h-4 w-4 text-roksal-red shrink-0" aria-hidden="true" />
                <div className="flex-1">
                  <div className="text-xs font-medium text-roksal-ink"><span className="tabular-nums">{stats.nizkaZaloga}</span> materialov z nizko zalogo</div>
                  <div className="text-2xs text-roksal-red">Naroči pri dobavitelju</div>
                </div>
              </CardContent>
            </Card>
          )}
          {stats.brezDobavitelja > 0 && (
            // R224 (P1-c nadaljevanje) — SEDMI signalec konvergence: kartica
            // 'Brez dobavitelja' v vodjinem pregledu (sorojenica Domov kartice
            // R223 — ISTA dimenzija, ISTI vir, ISTA navigacija). Vidna LE ko
            // je števec > 0 (iskreno — nalagalna napaka je svoja fail-verbose
            // veja zgoraj, lažnega 0 NI). roksal-amber = pozornost, ne alarm
            // (rdeča ostane nizki zalogi). Barva NI edini nosilec: dobeseden
            // naslov + tabular-nums števec + PackageX (en vizual en pomen —
            // ISTA ikona kot čip/zvonček/Domov) + iskren aria-label + title.
            // Klik → Zaloga s filtrom 'brez-dobavitelja' (R221 protokol, ISTI
            // dispatch kot Domov kartica R223 — centralNavigate zapre več-
            // list in poniža stare namige).
            <button
              type="button"
              className="flex w-full cursor-pointer items-center gap-2 rounded-xl border border-roksal-amber/40 bg-roksal-amber/5 p-3 text-left shadow-sm animate-fade-in-up transition-colors hover:bg-roksal-amber/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-amber/40 focus-visible:ring-offset-1"
              aria-label={`Brez dobavitelja (${stats.brezDobavitelja}) — odpre Zalogo s filtrom brez dobavitelja`}
              title="Artikli brez vpisane nabavne cene — klik odpre Zalogo s filtrom 'Brez dobavitelja'"
              onClick={() =>
                window.dispatchEvent(
                  new CustomEvent('roksal:navigate', {
                    detail: { tab: 'inventory', filter: 'brez-dobavitelja' },
                  }),
                )
              }
            >
              <PackageX className="h-4 w-4 shrink-0 text-roksal-amber" aria-hidden="true" />
              <div className="flex-1">
                <div className="text-xs font-medium text-roksal-ink">Brez dobavitelja — <span className="tabular-nums">{stats.brezDobavitelja}</span> artiklov brez vpisane cene</div>
                <div className="text-2xs text-roksal-amber">Naročilni tok postavke ne more oceniti — klik odpre Zalogo s filtrom</div>
              </div>
            </button>
          )}
          {stats.zamujeneDobave > 0 && (
            // R228 — NOVA tema: zamujena dobava (ALARM — pretečen rok, ISTA
            // rdeča družina kot potekli opomniki/nizka zaloga: barva je
            // pomen, ne dekoracija). Barva NI edini nosilec: dobeseden
            // naslov + slovenske oblike (narociloBeseda R220 vzorec) +
            // tabular-nums števec + CalendarX (en vizual en pomen — datum,
            // ki ni bil izpolnjen) + iskren aria-label + title. Klik →
            // Material → Naročila (ISTI dispatch protokol kot zvonček
            // digest R208 — subTab whitelist isMaterialSubTab).
            <button
              type="button"
              className="flex w-full cursor-pointer items-center gap-2 rounded-xl border border-roksal-red/20 bg-roksal-red/5 p-3 text-left shadow-sm animate-fade-in-up transition-colors hover:bg-roksal-red/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-red/40 focus-visible:ring-offset-1"
              aria-label={`Zamujena dobava (${stats.zamujeneDobave}) — odpre Material → Naročila`}
              title="Obljubljeni datum dobave je pretekel, naročilo pa še ni prejeto"
              onClick={() =>
                window.dispatchEvent(
                  new CustomEvent('roksal:navigate', {
                    detail: { tab: 'more', more: 'material', subTab: 'orders' },
                  }),
                )
              }
            >
              <CalendarX className="h-4 w-4 shrink-0 text-roksal-red" aria-hidden="true" />
              <div className="flex-1">
                <div className="text-xs font-medium text-roksal-ink">Zamujena dobava — <span className="tabular-nums">{stats.zamujeneDobave}</span> {narociloBeseda(stats.zamujeneDobave)} z pretečenim rokom</div>
                <div className="text-2xs text-roksal-red">Obljubljeni datum je pretekel — klik odpre Naročila</div>
              </div>
            </button>
          )}
          {stats.odprtaNarocila > 0 && (
            <Card className="border-roksal-navy/20 bg-roksal-navy/5 dark:border-roksal-ink/20">
              <CardContent className="p-3 flex items-center gap-2">
                <Truck className="h-4 w-4 text-roksal-navy dark:text-roksal-ink shrink-0" aria-hidden="true" />
                <div className="flex-1">
                  <div className="text-xs font-medium text-roksal-ink"><span className="tabular-nums">{stats.odprtaNarocila}</span> odprtih naročil</div>
                  <div className="text-2xs text-roksal-navy dark:text-roksal-ink/80">Čaka na dobavo</div>
                </div>
              </CardContent>
            </Card>
          )}
          {/* R224 — iskreno 'vse v redu': TUDI brez-dobavitelja mora biti 0
              (prej bi kartica lažno trdila 'vse v redu', čeprav so artikli brez
              vpisane cene samo skriti — ISTA iskrenost kot Zaloga per-čip
              prazna stanja R221). R228 — TUDI zamujeneDobave mora biti 0
              (pretečen rok je alarm, ki ga kartica ne sme zamolčati). */}
          {stats.potekliOpomniki === 0 && stats.nizkaZaloga === 0 && stats.odprtaNarocila === 0 && stats.brezDobavitelja === 0 && stats.zamujeneDobave === 0 && (
            <Card className="border-roksal-green/20 bg-roksal-green/5">
              <CardContent className="p-3 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-roksal-green shrink-0" aria-hidden="true" />
                <div className="text-xs font-medium text-roksal-green">Vse v redu — ni opozoril</div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Skupno stanje */}
      <Separator />
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Skupno</h3>
        <div className="grid grid-cols-3 gap-2">
          <Card>
            <CardContent className="p-2.5 text-center">
              <div className="text-sm font-bold text-roksal-ink">{stats.skupajProjektov}</div>
              <div className="text-[9px] text-muted-foreground">Projektov</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-2.5 text-center">
              <div className="text-sm font-bold text-roksal-ink">{stats.skupajStrank}</div>
              <div className="text-[9px] text-muted-foreground">Strank</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-2.5 text-center">
              <div className="text-sm font-bold text-roksal-amber">{formatEUR(stats.skupniLTV)}</div>
              <div className="text-[9px] text-muted-foreground">Skupni LTV</div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* R187 — Sistem — zdravje (javna sonda /api/public/health): baza
          odgovarja? odzivni čas? kdaj je build? fail-verbose panel z
          'Poskusi znova' + samodejna preverba ob vrnitvi povezave. */}
      <SistemZdravjeCard />
    </div>
  )
}
