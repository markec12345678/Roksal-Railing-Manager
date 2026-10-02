'use client'

// Računi (FURS layer) — iz runde H, vir: FURS/ZDDV-1 raziskava (37. člen —
// obvezni podatki računa) + Jobber/ServiceTitan invoicing model iz forumov.
// Tok: ponudba (deal locked) → predračun/račun → plačilo, s storno sledjo.
// PDF v FURS obliki: izdajatelj z davčno št., naročnik, postavke, DDV 22 %,
// rok plačila, TRR. Osnutki se urejajo, izdani so zaklenjeni (samo storno).

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRefetchOnFocus } from '@/hooks/use-refetch-on-focus'
import { casOznaka } from '@/lib/osvezitev-fokus'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { useToast } from '@/hooks/use-toast'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import QRCode from 'qrcode'
import { registerSloPdfFonts } from '@/lib/pdf-sl-font'
import { buildUpnQrString, cleanIban, splitNaslov } from '@/lib/upn-qr'
import {
  Receipt,
  Plus,
  Trash2,
  FileDown,
  Loader2,
  CheckCircle2,
  Ban,
  Send,
  Pencil,
  AlertTriangle,
  Euro,
  PackageOpen,
  QrCode,
  FileCode2,
  Copy,
  Banknote,
  BellRing,
  Download,
  History,
  FileSpreadsheet,
} from 'lucide-react'
import { downloadCsv, downloadCsvText, todayStamp, slDatumKratko, formatSlDecimalno } from '@/lib/csv-export'
import {
  buildPrihodkiPdfDoc,
  prihodkiPdfFilename,
  prihodkiPovzetek,
  type PrihodkiPdfVnos,
} from '@/lib/prihodki-pdf'
import {
  prihodkiPoMesecih,
  racunBeseda,
  type PrihodkiMeseciPovzetek,
} from '@/lib/prihodki-meseci'
import {
  prihodkiMeseciCsv,
  prihodkiMeseciCsvFilename,
} from '@/lib/prihodki-meseci-csv'

// ---------- tipi ----------

interface Postavka {
  opis: string
  kolicina: number
  enota: string
  cenaNaEnoto: number
  ddvStopnja: number
}

interface Invoice {
  id: string
  projectId: string
  tip: 'PREDRACUN' | 'RACUN' | 'PREDPLACILNI'
  stevilka: string
  datumIzdaje: string
  datumStoritve: string | null
  rokPlacilaDni: number
  status: 'OSNUTEK' | 'IZDAN' | 'PLACAN' | 'STORNIRAN'
  placanoAt: string | null
  postavke: string
  kupec: string | null
  osnova: number
  ddv: number
  znesek: number
  opombe: string | null
  project?: { nazivProjekta: string; customer?: { ime: string; naslov: string } }
}

interface ProjectLite {
  id: string
  nazivProjekta: string
  clientToken?: string
}

// Izdajatelj (demo podatki — produkcija: nastavitve podjetja)
const IZDAJATELJ = {
  naziv: 'Roksal d.o.o.',
  naslov: 'Cesta Republike 14',
  posta: '4000 Kranj',
  davcna: 'SI 12345678',
  matična: '1234567000',
  trr: 'SI56 0201 0001 2345 678',
}

/** Datum zapadlosti (rok plačila) za izdani račun. */
function rokPlacilaDatum(inv: Pick<Invoice, 'datumIzdaje' | 'rokPlacilaDni'>): Date {
  const d = new Date(inv.datumIzdaje)
  d.setDate(d.getDate() + inv.rokPlacilaDni)
  return d
}

/** Zgradi UPN QR niz iz računa (vse izračune delaš na enem mestu). */
function upnQrString(inv: Invoice, kupec: ReturnType<typeof parseKupec>): string {
  const [ulicaP, krajP] = splitNaslov(kupec?.naslov ?? '')
  return buildUpnQrString({
    iban: cleanIban(IZDAJATELJ.trr),
    znesek: inv.znesek,
    rokPlacila: rokPlacilaDatum(inv),
    imePrejemnika: IZDAJATELJ.naziv,
    ulicaPrejemnika: IZDAJATELJ.naslov,
    krajPrejemnika: IZDAJATELJ.posta,
    referencaPrejemnika: `SI12 ${inv.stevilka}`,
    namenPlacila: `Plačilo računa ${inv.stevilka}`,
    imePlacnika: kupec?.ime ?? '',
    ulicaPlacnika: ulicaP,
    krajPlacnika: krajP,
  })
}

const TIP_META: Record<Invoice['tip'], { label: string; short: string }> = {
  PREDRACUN: { label: 'Predračun', short: 'PR' },
  RACUN: { label: 'Račun', short: 'R' },
  PREDPLACILNI: { label: 'Predplačilni', short: 'PP' },
}

const STATUS_META: Record<Invoice['status'], { label: string; className: string; dot: string }> = {
  // R229 — OSNUTEK na žetonih (en razred obe temi; stone dvojček izbrisan —
  // ISTA pot kot team-tab R228 / geselne površine R227: osnutek je NEVTRALNO
  // stanje — žetoni se sami prilagodijo; pika muted-foreground, R226 vzorec).
  OSNUTEK: { label: 'Osnutek', className: 'bg-muted text-muted-foreground border-border', dot: 'bg-muted-foreground' },
  IZDAN: { label: 'Izdan', className: 'bg-roksal-amber/10 text-roksal-ink border-roksal-amber/40', dot: 'bg-roksal-amber' },
  PLACAN: { label: 'Plačan', className: 'bg-roksal-green/10 text-roksal-ink border-roksal-green/40', dot: 'bg-roksal-green' },
  STORNIRAN: { label: 'Storniran', className: 'bg-roksal-red/10 text-roksal-ink border-roksal-red/40', dot: 'bg-roksal-red' },
}

const eur = (n: number) =>
  formatSlDecimalno(n, 2, 2) + ' €'

function parsePostavke(json: string): Postavka[] {
  try {
    const arr = JSON.parse(json)
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

function parseKupec(json: string | null): { ime: string; naslov: string; telefon?: string; email?: string } | null {
  if (!json) return null
  try {
    return JSON.parse(json)
  } catch {
    return null
  }
}

/** Zapadlost: izdan + datumIzdaje + rokPlacila < danes */
function zapadlaDni(inv: Invoice): number | null {
  if (inv.status !== 'IZDAN') return null
  const due = new Date(inv.datumIzdaje)
  due.setDate(due.getDate() + inv.rokPlacilaDni)
  const diff = Math.floor((Date.now() - due.getTime()) / 86400000)
  return diff > 0 ? diff : null
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

/** R136 — CSV izvoz računov (pregled za pisarno/računovodstvo; SI oblika). */
function exportRacuniCsv(invoices: Invoice[]) {
  if (invoices.length === 0) return
  const statusLabels: Record<Invoice['status'], string> = {
    OSNUTEK: 'Osnutek',
    IZDAN: 'Izdan',
    PLACAN: 'Plačan',
    STORNIRAN: 'Storniran',
  }
  const tipLabels: Record<string, string> = {
    RACUN: 'Račun',
    PREDRACUN: 'Predračun',
    PREDPLACILNI: 'Predplačilni',
  }
  downloadCsv(
    `racuni-${todayStamp()}.csv`,
    ['Številka', 'Tip', 'Status', 'Datum izdaje', 'Rok (dni)', 'Zapadlo (dni)', 'Osnova (EUR)', 'DDV (EUR)', 'Za plačilo (EUR)'],
    [...invoices]
      .sort((a, b) => (a.datumIzdaje > b.datumIzdaje ? -1 : a.datumIzdaje < b.datumIzdaje ? 1 : 0))
      .map((inv) => [
        inv.stevilka,
        tipLabels[inv.tip] ?? inv.tip,
        statusLabels[inv.status],
        inv.datumIzdaje.slice(0, 10),
        inv.rokPlacilaDni,
        zapadlaDni(inv),
        inv.osnova,
        inv.ddv,
        inv.znesek,
      ]),
  )
}

// ---------- prazna postavka ----------

const emptyPostavka = (): Postavka => ({
  opis: '',
  kolicina: 1,
  enota: 'm',
  cenaNaEnoto: 0,
  ddvStopnja: 22,
})

export function InvoiceManager() {
  const { toast } = useToast()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [projects, setProjects] = useState<ProjectLite[]>([])
  const [loading, setLoading] = useState(true)
  // R180 — pečat svežine: čas zadnjega USPEŠNEGA branja /api/invoices (vzorec
  // R170/R177/R178). Napaka/omrežje → null (fail-closed — NIČ lažne svežine;
  // zastareli seznam ostane viden, a BREZ pečata = uporabnik ve, da ni svež).
  const [racuniOsvezitev, setRacuniOsvezitev] = useState<Date | null>(null)

  // Nov račun dialog
  const [dialogOpen, setDialogOpen] = useState(false)
  const [prihodkiVTeku, setPrihodkiVTeku] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formProject, setFormProject] = useState<string>('')
  const [formTip, setFormTip] = useState<Invoice['tip']>('RACUN')
  const [formRok, setFormRok] = useState('8')
  const [formPostavke, setFormPostavke] = useState<Postavka[]>([emptyPostavka()])
  const [formOpombe, setFormOpombe] = useState('')
  const [bomLoading, setBomLoading] = useState(false)
  // Storno je destruktivna pravna akcija — dvostopenjska potrditev (3 s)
  const [stornoId, setStornoId] = useState<string | null>(null)
  // UPN QR dialog + slika
  const [qrInvoice, setQrInvoice] = useState<Invoice | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [xmlLoading, setXmlLoading] = useState<string | null>(null)
  // R241 (P1-i wave 3): UI ogledalo RBAC vrat na /api/invoices — komponenta
  // prebere svoje KONKRETNE pravice (GET /api/auth → permissions, R135) in
  // skrije akcije, ki bi končale s 403 (ISTI vzorec kot dashboard R239 in
  // team-tab R135: "ista pravila kot strežnik, le izkustveno, ne naključno").
  // Fail-closed: med nalaganjem (null) in ob napaki ([]) so VSE pisalne
  // akcije skrite — least privilege, nikoli lažni gumb, ki bi utišal 403.
  const [myPermissions, setMyPermissions] = useState<readonly string[] | null>(null)
  useEffect(() => {
    let alive = true
    fetch('/api/auth')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (alive && data?.permissions) setMyPermissions(data.permissions as readonly string[])
        else if (alive) setMyPermissions([])
      })
      .catch(() => {
        if (alive) setMyPermissions([])
      })
    return () => {
      alive = false
    }
  }, [])
  // Vrata = TOČNO ISTA imena pravic kot denyUnlessInvoice v /api/invoices
  // (POST + DELETE → invoices.create, PATCH IZDAN/PLACAN → invoices.issue,
  // PATCH STORNIRAN → invoices.cancel) — pariteto zaklene r241 test.
  const lahkoUstvarja = myPermissions?.includes('invoices.create') ?? false
  const lahkoIzdaja = myPermissions?.includes('invoices.issue') ?? false
  const lahkoStornira = myPermissions?.includes('invoices.cancel') ?? false
  // Vlogo-osveščen vodič (R239 precedens — nikoli kazalec na gumb, ki ga
  // uporabnik ne vidi): prikaže se SAMO, ko uporabnik nima NOBENE pisalne
  // pravice nad računi. Med nalaganjem (null) se ne izgovarjamo — resnica
  // še ni znana, tišina je iskrena.
  const samoBranje =
    myPermissions !== null && !lahkoUstvarja && !lahkoIzdaja && !lahkoStornira

  const loadInvoices = useCallback(async () => {
    try {
      const res = await fetch('/api/invoices')
      if (res.ok) {
        setInvoices(await res.json())
        // R180: pečat SAMO ob uspešnem branju (1×)
        setRacuniOsvezitev(new Date())
      } else {
        // fail-closed pečat: napaka → zastarel seznam ostane, a brez pečata
        setRacuniOsvezitev(null)
      }
    } catch {
      // offline — obdrži stanje; pečat počisti (NIČ lažne svežine)
      setRacuniOsvezitev(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadInvoices()
    fetch('/api/projects')
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setProjects(Array.isArray(d) ? d : []))
      .catch(() => {})
  }, [loadInvoices])
  // R180 — ponovni bris ob vrnitvi v zavihek (družinski hook, 30 s vrata R170):
  // računi so finančno kritični (zapadli rok plačila) — vrnitev v CRM pomeni
  // svež seznam. EN VIR: loadInvoices je isti loader kot mount + mutacije.
  useRefetchOnFocus(loadInvoices)

  // QR slika se generira, ko uporabnik odpre dialog (asinhrono, brez blokade)
  useEffect(() => {
    if (!qrInvoice) {
      setQrDataUrl(null)
      return
    }
    let cancelled = false
    QRCode.toDataURL(upnQrString(qrInvoice, parseKupec(qrInvoice.kupec)), {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 512,
      color: { dark: '#1d2b3e', light: '#ffffff' },
    })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url)
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl(null)
      })
    return () => {
      cancelled = true
    }
  }, [qrInvoice])

  // ---------- izračuni obrazca (živi) ----------
  const formTotals = useMemo(() => {
    let osnova = 0
    const ddvSkupine = new Map<number, number>()
    for (const p of formPostavke) {
      const vrstica = round2((p.kolicina || 0) * (p.cenaNaEnoto || 0))
      osnova += vrstica
      const d = round2(vrstica * (p.ddvStopnja / 100))
      ddvSkupine.set(p.ddvStopnja, round2((ddvSkupine.get(p.ddvStopnja) ?? 0) + d))
    }
    const ddv = round2([...ddvSkupine.values()].reduce((a, b) => a + b, 0))
    return { osnova: round2(osnova), ddvSkupine, ddv, znesek: round2(osnova + ddv) }
  }, [formPostavke])

  // ---------- povzetek ----------
  // R290 — EN VIR preslikava /api/invoices → PrihodkiPdfVnos: prihodki PDF
  // izvoz (R250) IN sekcija 'Prihodki po mesecih' (R290) poganjata iz ISTEGA
  // polja (WYSIWYG po konstrukciji — preslikava enkrat, ne dvakrat).
  const prihodkiVnosi = useMemo<PrihodkiPdfVnos[]>(
    () =>
      invoices.map((inv) => ({
        stevilka: inv.stevilka,
        tip: inv.tip,
        status: inv.status,
        datumIzdaje: inv.datumIzdaje,
        rokPlacilaDni: inv.rokPlacilaDni,
        placanoAt: inv.placanoAt,
        znesek: inv.znesek,
        // Snapshot kupca, sicer ime stranke projekta, sicer iskren vezaj
        // (prikazna resnica — NIČ izmišljenega; lib fail-closed preveri
        // strukturo vrstic, kupec je prikazna resnica per račun).
        kupec: inv.kupec?.trim() || inv.project?.customer?.ime?.trim() || '—',
        projekt: inv.project?.nazivProjekta?.trim() || '—',
      })),
    [invoices],
  )
  // R290 — prihodki po mesecih (plačila dimenzija): fail-verbose razčlenitev
  // (pokvaren vir = viden razlog, nikoli zrušitev ALI tiho praznina —
  // vzorec deal-pipeline R172).
  const meseciPovzetek = useMemo<{ ok: boolean; p?: PrihodkiMeseciPovzetek; napaka?: string }>(
    () => {
      try {
        return { ok: true, p: prihodkiPoMesecih(prihodkiVnosi) }
      } catch (err) {
        return { ok: false, napaka: err instanceof Error ? err.message : String(err) }
      }
    },
    [prihodkiVnosi],
  )
  // R291 — PRIHODKI PO MESECIH CSV (8. člen izvozne družine): EN VIR z
  // sekcijo (isti meseciPovzetek.p — WYSIWYG po konstrukciji, lib NE računa
  // znova). Gumb VEDNO viden (kanon R232); pri 0 mesecih fail-closed toast,
  // NIČ datoteke (R250 vzorec). Determinizem: EN now za žig + ime.
  const [meseciCsvVTeku, setMeseciCsvVTeku] = useState(false)
  const handleMeseciCsv = () => {
    if (meseciCsvVTeku) return
    if (!meseciPovzetek.ok) {
      toast({ title: 'CSV ni mogoče sestaviti iz teh podatkov', description: meseciPovzetek.napaka, variant: 'destructive' })
      return
    }
    setMeseciCsvVTeku(true)
    try {
      const p = meseciPovzetek.p!
      if (p.meseci.length === 0) {
        toast({ title: 'Ni plačanih računov', description: 'CSV se izvozi ob prvem plačilu.' })
        return
      }
      const now = new Date()
      const { csv } = prihodkiMeseciCsv(p, now)
      const ime = prihodkiMeseciCsvFilename(now)
      downloadCsvText(ime, csv)
      toast({
        title: `Prihodki po mesecih prenešeni v CSV (${ime})`,
        description: `${p.meseci.length} ${p.meseci.length === 1 ? 'mesec' : 'meseci'} — skupaj plačano ${p.skupajPrihodki.toFixed(2)} € (${p.skupajRacunov} ${racunBeseda(p.skupajRacunov)}).`,
      })
    } catch (err) {
      toast({ title: 'Izvoz CSV ni uspel', description: err instanceof Error ? err.message : String(err), variant: 'destructive' })
    } finally {
      setMeseciCsvVTeku(false)
    }
  }

  // R250 — prihodki PDF (7. člen 'izvozi' družine): agregatna resnica za
  // vodstvo iz ISTEGA odgovora /api/invoices (route NIČ). Bralni dokument —
  // brez pravice gate (P1-k precedens; vsi, ki vidijo Račune, nosijo
  // invoices.read). Determinizem: EN now za žig, ime IN zapadlost.
  const handlePrihodkiPdf = () => {
    if (prihodkiVTeku) return
    setPrihodkiVTeku(true)
    try {
      if (invoices.length === 0) {
        toast({ title: 'Ni računov za prihodke', description: 'PDF se izvozi, ko je vpisan prvi račun.' })
        return
      }
      const now = new Date()
      const vnosi = prihodkiVnosi
      const doc = buildPrihodkiPdfDoc(vnosi, { now })
      doc.save(prihodkiPdfFilename(now))
      // Toast pove REALNO agregatno resnico (ISTI trikot kot PDF KPI IN
      // Povzetek boxi na zaslonu — WYSIWYG; ',' ločilo — minifier ubeži '·'
      // v template literalih, R248 lekcija).
      const pov = prihodkiPovzetek(vnosi, now)
      toast({
        title: 'Prihodki prenešeni v PDF',
        description: `Prihodki-…pdf — plačano ${pov.placano.toFixed(2)} €, odprto ${pov.odprto.toFixed(2)} €, zapadlo ${pov.zapadlo.toFixed(2)} € (${pov.zapadloN} prek roka).`,
      })
    } catch (err) {
      if (err instanceof TypeError) {
        // fail-closed jedro: pokvaren vnos → viden razlog (nič izmišljenega dokumenta)
        toast({ title: 'Prihodki PDF ni mogoče sestaviti iz teh podatkov', description: err instanceof Error ? err.message : String(err), variant: 'destructive' })
      } else {
        toast({ title: `Izvoz PDF ni uspel: ${err instanceof Error ? err.message : String(err)}`, variant: 'destructive' })
      }
    } finally {
      setPrihodkiVTeku(false)
    }
  }

  const summary = useMemo(() => {
    let izdano = 0
    let placano = 0
    let zapadlo = 0
    let zapadloN = 0
    let osnutki = 0
    for (const inv of invoices) {
      if (inv.status === 'IZDAN' || inv.status === 'PLACAN') {
        izdano += inv.znesek
      }
      if (inv.status === 'PLACAN') placano += inv.znesek
      if (zapadlaDni(inv) !== null) {
        zapadlo += inv.znesek
        zapadloN += 1
      }
      if (inv.status === 'OSNUTEK') osnutki += 1
    }
    return { izdano, placano, zapadlo, zapadloN, osnutki }
  }, [invoices])

  // ---------- akcije ----------

  function resetForm() {
    setFormProject('')
    setFormTip('RACUN')
    setFormRok('8')
    setFormPostavke([emptyPostavka()])
    setFormOpombe('')
  }

  async function createInvoice() {
    const items = formPostavke.filter((p) => p.opis.trim() && p.kolicina > 0)
    if (!formProject) {
      toast({ title: 'Izberi projekt', variant: 'destructive' })
      return
    }
    if (items.length === 0) {
      toast({ title: 'Dodaj vsaj eno postavko z opisom', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: formProject,
          tip: formTip,
          postavke: items.map((p) => ({
            ...p,
            opis: p.opis.trim(),
            kolicina: Number(p.kolicina) || 0,
            cenaNaEnoto: Number(p.cenaNaEnoto) || 0,
            ddvStopnja: Number(p.ddvStopnja) || 0,
          })),
          rokPlacilaDni: Number(formRok) || 8,
          opombe: formOpombe.trim() || null,
        }),
      })
      if (res.status === 201) {
        toast({ title: 'Osnutek računa ustvarjen ✓' })
        setDialogOpen(false)
        resetForm()
        loadInvoices()
      } else {
        // R241: fail-verbose — 403 iz denyUnlessInvoice nosi {error, detail},
        // kjer je detail človeku razumljiv razlog ("Računi so uradni
        // dokumenti — potrebna je pravica invoices.create."). Do R241 je UI
        // pokazal samo generični error ("Prepovedano") — razlog je bil zamolčan.
        const err = await res.json().catch(() => ({}))
        const razlog: string | null =
          typeof err?.detail === 'string'
            ? err.detail
            : typeof err?.error === 'string'
              ? err.error
              : null
        toast({ title: razlog ?? 'Napaka pri shranjevanju', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Omrežna napaka', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  async function patchStatus(inv: Invoice, status: Invoice['status']) {
    // Optimistic update + rollback
    const prev = invoices
    setInvoices((cur) =>
      cur.map((i) =>
        i.id === inv.id
          ? { ...i, status, placanoAt: status === 'PLACAN' ? new Date().toISOString() : null }
          : i
      )
    )
    try {
      const res = await fetch('/api/invoices', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: inv.id, status }),
      })
      // R241: fail-verbose — 403 razlog iz {error, detail} pride do
      // uporabnika (do R241: generično "Napaka pri posodabljanju").
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { detail?: unknown; error?: unknown } | null
        const razlog: string | null =
          typeof err?.detail === 'string'
            ? err.detail
            : typeof err?.error === 'string'
              ? err.error
              : null
        throw new Error(razlog ?? 'Napaka pri posodabljanju')
      }
      toast({ title: status === 'PLACAN' ? 'Račun plačan ✓' : status === 'STORNIRAN' ? 'Račun storniran' : 'Račun izdan' })
    } catch (e) {
      setInvoices(prev)
      toast({ title: e instanceof Error ? e.message : 'Napaka pri posodabljanju', variant: 'destructive' })
    }
  }

  async function deleteInvoice(inv: Invoice) {
    try {
      const res = await fetch(`/api/invoices?id=${inv.id}`, { method: 'DELETE' })
      if (res.ok) {
        setInvoices((cur) => cur.filter((i) => i.id !== inv.id))
        toast({ title: 'Osnutek brisan' })
      } else {
        // R241: fail-verbose — detail iz denyUnlessInvoice, ne samo "Prepovedano".
        const err = await res.json().catch(() => ({}))
        const razlog: string | null =
          typeof err?.detail === 'string'
            ? err.detail
            : typeof err?.error === 'string'
              ? err.error
              : null
        toast({ title: razlog ?? 'Napaka pri brisanju', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Omrežna napaka', variant: 'destructive' })
    }
  }

  /** Kopiranje v odložišče z fallbackom za WebView/PWA (brez varnostnih izjem). */
  async function copyText(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text)
      toast({ title: `${label} kopirano ✓` })
    } catch {
      try {
        const ta = document.createElement('textarea')
        ta.value = text
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        ta.remove()
        toast({ title: `${label} kopirano ✓` })
      } catch {
        toast({ title: 'Kopiranje ni uspelo', variant: 'destructive' })
      }
    }
  }

  /** Prenos eRačun XML (eSlog 2.1 / UBL 2.1 / EN 16931) — za oddajo prek ponudnika. */
  async function downloadXml(inv: Invoice) {
    setXmlLoading(inv.id)
    try {
      const res = await fetch(`/api/invoices/eslog?id=${inv.id}`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast({ title: err.error ?? 'Napaka pri izvozu eRačuna', variant: 'destructive' })
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `eracun-${inv.stevilka}.xml`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast({ title: 'eRačun XML shranjen ✓' })
    } catch {
      toast({ title: 'Omrežna napaka', variant: 'destructive' })
    } finally {
      setXmlLoading(null)
    }
  }

  /** BOM draft → postavke (cena 0 — monter jo dopolni iz cenika) */
  async function importFromBom() {
    if (!formProject) {
      toast({ title: 'Najprej izberi projekt', variant: 'destructive' })
      return
    }
    setBomLoading(true)
    try {
      const res = await fetch(`/api/bom-draft?projectId=${formProject}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      const items = data?.bomDraft?.items
      if (!Array.isArray(items) || items.length === 0) {
        toast({ title: 'BOM ni razpoložljiv (zakleni deal po podpisu)' })
        return
      }
      setFormPostavke(
        items.map((it: { naziv: string; kolicina: number; enota?: string }) => ({
          opis: it.naziv,
          kolicina: it.kolicina || 1,
          enota: it.enota || 'kos',
          cenaNaEnoto: 0,
          ddvStopnja: 22,
        }))
      )
      toast({ title: `Uvoženih ${items.length} postavk iz BOM — dopolni cene` })
    } catch {
      toast({ title: 'Napaka pri branju BOM', variant: 'destructive' })
    } finally {
      setBomLoading(false)
    }
  }

  // ---------- PDF (FURS oblika + UPN QR) ----------

  async function generatePdf(inv: Invoice) {
    const postavke = parsePostavke(inv.postavke)
    const kupec = parseKupec(inv.kupec)
    const doc = new jsPDF()
    registerSloPdfFonts(doc)
    // UPN QR se generira ob generiranju PDF (niz je sinhroni, slika asinhrona)
    let upnQrUrl: string | null = null
    try {
      upnQrUrl = await QRCode.toDataURL(upnQrString(inv, kupec), {
        errorCorrectionLevel: 'M',
        margin: 1,
        width: 512,
        color: { dark: '#1d2b3e', light: '#ffffff' },
      })
    } catch {
      upnQrUrl = null // QR je priročna dodatna funkcija, ne pogoj — PDF ostane veljaven
    }

    // Glava — izdajatelj (levo) + naslov dokumenta (desno)
    doc.setFillColor(29, 43, 62) // roksal-navy
    doc.rect(0, 0, 210, 34, 'F')
    doc.setTextColor(250, 179, 32) // amber logo
    doc.setFont('Roboto', 'bold')
    doc.setFontSize(18)
    doc.text('ROKSAL', 14, 15)
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(9)
    doc.setFont('Roboto', 'normal')
    doc.text(`${IZDAJATELJ.naziv} — ograje in balustrade`, 14, 21)
    doc.text(`${IZDAJATELJ.naslov}, ${IZDAJATELJ.posta}`, 14, 26)

    doc.setFont('Roboto', 'bold')
    doc.setFontSize(16)
    doc.setTextColor(255, 255, 255)
    const naslovDoc = TIP_META[inv.tip].label.toUpperCase()
    doc.text(naslovDoc, 196, 15, { align: 'right' })
    doc.setFontSize(11)
    doc.text(`št. ${inv.stevilka}`, 196, 22, { align: 'right' })

    // Davčni podatki izdajatelja
    doc.setFontSize(8)
    doc.setFont('Roboto', 'normal')
    doc.text(`Davčna št.: ${IZDAJATELJ.davcna}   Matična št.: ${IZDAJATELJ.matična}`, 14, 43)
    doc.text(`TRR: ${IZDAJATELJ.trr}`, 14, 48)

    // Naročnik (desno)
    doc.setFontSize(8)
    doc.setTextColor(80, 80, 80)
    doc.text('NAROČNIK:', 196, 43, { align: 'right' })
    doc.setTextColor(0, 0, 0)
    doc.setFont('Roboto', 'bold')
    doc.text(kupec?.ime ?? '—', 196, 48, { align: 'right' })
    doc.setFont('Roboto', 'normal')
    if (kupec?.naslov) doc.text(kupec.naslov, 196, 53, { align: 'right' })

    // Datumi
    autoTable(doc, {
      startY: 58,
      body: [
        [
          `Datum izdaje: ${slDatumKratko(new Date(inv.datumIzdaje))}`,
          `Datum storitve: ${inv.datumStoritve ? slDatumKratko(new Date(inv.datumStoritve)) : '—'}`,
          `Rok plačila: ${inv.rokPlacilaDni} dni`,
        ],
      ],
      theme: 'plain',
      styles: { fontSize: 8, cellPadding: 1.5, font: "Roboto" },
    })

    // Postavke
    autoTable(doc, {
      startY: 72,
      head: [['#', 'Opis', 'Količina', 'Enota', 'Cena', 'DDV %', 'Znesek']],
      body: postavke.map((p, i) => {
        const vrstica = round2(p.kolicina * p.cenaNaEnoto)
        return [
          String(i + 1),
          p.opis,
          formatSlDecimalno(p.kolicina, 0, 3),
          p.enota,
          eur(p.cenaNaEnoto),
          `${p.ddvStopnja} %`,
          eur(vrstica),
        ]
      }),
      styles: { fontSize: 9, cellPadding: 2, font: "Roboto" },
      headStyles: { fillColor: [29, 43, 62], textColor: 255, fontSize: 9 },
      columnStyles: {
        0: { cellWidth: 8, halign: 'right' },
        2: { halign: 'right' },
        4: { halign: 'right' },
        5: { halign: 'right' },
        6: { halign: 'right' },
      },
    })

    // Vsote
    const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6
    const ddvSkupine = new Map<number, number>()
    for (const p of postavke) {
      const vrstica = round2(p.kolicina * p.cenaNaEnoto)
      ddvSkupine.set(p.ddvStopnja, round2((ddvSkupine.get(p.ddvStopnja) ?? 0) + vrstica * (p.ddvStopnja / 100)))
    }
    autoTable(doc, {
      startY: finalY,
      body: [
        ['Osnova', eur(inv.osnova)],
        ...[...ddvSkupine.entries()].map(([stopnja, z]) => [`DDV ${stopnja} %`, eur(round2(z))]),
        ['Za plačilo', eur(inv.znesek)],
      ],
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 2, font: "Roboto" },
      columnStyles: { 0: { cellWidth: 60, fontStyle: 'bold' }, 1: { halign: 'right' } },
      didParseCell: (data) => {
        if (data.section === 'body' && data.row.index === ddvSkupine.size + 1) {
          data.cell.styles.fillColor = [29, 43, 62]
          data.cell.styles.textColor = [255, 255, 255]
          data.cell.styles.fontStyle = 'bold'
        }
      },
      margin: { left: 120 },
    })

    // Opombe + UPN QR + podpisni prostor
    const footY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10
    if (inv.opombe) {
      doc.setFontSize(8)
      doc.setTextColor(80, 80, 80)
      doc.text(doc.splitTextToSize(`Opombe: ${inv.opombe}`, 180), 14, footY)
    }

    // UPN QR — nalog se izpolni samodejno ob branju z mobilno banko
    if (upnQrUrl) {
      doc.setFont('Roboto', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(0, 0, 0)
      doc.text('UPN QR — plačilo z mobilno banko', 14, 243)
      doc.addImage(upnQrUrl, 'PNG', 14, 247, 28, 28)
      doc.setFont('Roboto', 'normal')
      doc.setFontSize(7)
      doc.setTextColor(90, 90, 90)
      doc.text(`Preberi QR z aplikacijo banke — plačilo ${eur(inv.znesek)}`, 47, 251)
      doc.text(`se izpolni samodejno (rok: ${slDatumKratko(rokPlacilaDatum(inv))})`, 47, 255)
      doc.text(`Referenca: SI12 ${inv.stevilka}`, 47, 259)
    }

    doc.setFontSize(8)
    doc.setTextColor(120, 120, 120)
    doc.text(
      'Plačilo po predračunu/preko TRR. Ta dokument je računsko pravno veljaven po ZDDV-1, 37. členu.',
      14,
      280
    )
    doc.save(`racun-${inv.stevilka}.pdf`)
    toast({ title: 'PDF shranjen ✓' })
  }

  /**
   * Plačilni opomnik (runda M) — za zapadle izdane račune. Ni račun po
   * ZDDV-1 — le vljudna/uradna spomnilna listina: povzetek računa, dni
   * zapadlosti, plačilni podatki + UPN QR (isti nalog, rok = izvirni rok).
   */
  async function generateOpomnik(inv: Invoice) {
    const kupec = parseKupec(inv.kupec)
    const dniZapadlo = zapadlaDni(inv) ?? 0
    const doc = new jsPDF()
    registerSloPdfFonts(doc)

    let upnQrUrl: string | null = null
    try {
      upnQrUrl = await QRCode.toDataURL(upnQrString(inv, kupec), {
        errorCorrectionLevel: 'M',
        margin: 1,
        width: 512,
        color: { dark: '#1d2b3e', light: '#ffffff' },
      })
    } catch {
      upnQrUrl = null
    }

    // Glava (enaka identiteta kot račun, rdeč akcent letvice)
    doc.setFillColor(29, 43, 62)
    doc.rect(0, 0, 210, 34, 'F')
    doc.setFillColor(220, 38, 38)
    doc.rect(0, 34, 210, 1.4, 'F')
    doc.setTextColor(250, 179, 32)
    doc.setFont('Roboto', 'bold')
    doc.setFontSize(18)
    doc.text('ROKSAL', 14, 15)
    doc.setTextColor(255, 255, 255)
    doc.setFont('Roboto', 'normal')
    doc.setFontSize(9)
    doc.text(`${IZDAJATELJ.naziv} — ograje in balustrade`, 14, 21)
    doc.text(`${IZDAJATELJ.naslov}, ${IZDAJATELJ.posta}`, 14, 26)

    doc.setFont('Roboto', 'bold')
    doc.setFontSize(16)
    doc.text('PLAČILNI OPOMNIK', 196, 15, { align: 'right' })
    doc.setFontSize(10)
    doc.setFont('Roboto', 'normal')
    doc.text(slDatumKratko(new Date()), 196, 22, { align: 'right' })

    // Zadeva + prejemnik
    doc.setFontSize(9)
    doc.setTextColor(80, 80, 80)
    doc.text('PREJEMNIK:', 14, 45)
    doc.setTextColor(0, 0, 0)
    doc.setFont('Roboto', 'bold')
    doc.setFontSize(11)
    doc.text(kupec?.ime ?? '—', 14, 51)
    doc.setFont('Roboto', 'normal')
    doc.setFontSize(9)
    if (kupec?.naslov) doc.text(kupec.naslov, 14, 56)

    doc.setTextColor(80, 80, 80)
    doc.text(`Zadeva: zapadel račun št. ${inv.stevilka}`, 196, 45, { align: 'right' })
    doc.setTextColor(0, 0, 0)
    doc.text(`Projekt: ${inv.project?.nazivProjekta ?? '—'}`, 196, 50, { align: 'right' })

    // Rdeči povzetek zapadlosti
    doc.setFillColor(254, 242, 242)
    doc.setDrawColor(220, 38, 38)
    doc.setLineWidth(0.4)
    doc.roundedRect(14, 64, 182, 20, 2, 2, 'FD')
    doc.setLineWidth(0.2)
    doc.setFont('Roboto', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(185, 28, 28)
    doc.text(`Račun je zapadel ${dniZapadlo} dni`, 20, 72)
    doc.setFont('Roboto', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(80, 80, 80)
    doc.text(
      `Izvirni rok plačila: ${slDatumKratko(rokPlacilaDatum(inv))}   ·   Odprt znesek: ${eur(inv.znesek)}`,
      20,
      79
    )

    // Vsote
    autoTable(doc, {
      startY: 92,
      body: [
        ['Osnova', eur(inv.osnova)],
        ['DDV', eur(inv.ddv)],
        ['Za plačilo', eur(inv.znesek)],
      ],
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 2, font: 'Roboto' },
      columnStyles: { 0: { cellWidth: 60, fontStyle: 'bold' }, 1: { halign: 'right' } },
      didParseCell: (data) => {
        if (data.section === 'body' && data.row.index === 2) {
          data.cell.styles.fillColor = [29, 43, 62]
          data.cell.styles.textColor = [255, 255, 255]
          data.cell.styles.fontStyle = 'bold'
        }
      },
      margin: { left: 120 },
    })

    // Besedilo opomnika
    const besediloY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10
    doc.setFont('Roboto', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(40, 40, 40)
    const odstavek1 =
      `Vljudno vas prosimo, da znesek ${eur(inv.znesek)} za račun št. ${inv.stevilka} ` +
      `v najkrajšem možnem času poravnate na transakcijski račun ${IZDAJATELJ.trr} ` +
      `(referenca: SI12 ${inv.stevilka}).`
    const odstavek2 =
      'Če je plačilo že opravljeno, sprejmite to sporočilo kot zahvalo in ga štejte za nič. ' +
      'V primeru, da plačila ne uredite v naslednjih 8 dneh, si pridružujemo pravico, da ' +
      'zaračunamo zakonske zamudne obresti in vstopimo v izterjevalni postopek.'
    let by = besediloY
    doc.text(doc.splitTextToSize(odstavek1, 180), 14, by)
    by += doc.splitTextToSize(odstavek1, 180).length * 4.5 + 3
    doc.text(doc.splitTextToSize(odstavek2, 180), 14, by)
    by += doc.splitTextToSize(odstavek2, 180).length * 4.5 + 6

    // Plačilni podatki (mono-ish blok)
    doc.setFillColor(248, 250, 252)
    doc.setDrawColor(226, 232, 240)
    doc.roundedRect(14, by, 182, 24, 2, 2, 'FD')
    doc.setFont('Roboto', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(29, 43, 62)
    doc.text('PLAČILNI PODATKI', 18, by + 6)
    doc.setFont('Roboto', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(60, 60, 60)
    doc.text(`Prejemnik: ${IZDAJATELJ.naziv}`, 18, by + 12)
    doc.text(`TRR: ${IZDAJATELJ.trr}   ·   Referenca: SI12 ${inv.stevilka}`, 18, by + 17)
    doc.text(`Znesek: ${eur(inv.znesek)}   ·   Rok: takoj (izvirni rok ${slDatumKratko(rokPlacilaDatum(inv))})`, 18, by + 22)

    // UPN QR
    if (upnQrUrl) {
      doc.setFont('Roboto', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(0, 0, 0)
      doc.text('UPN QR — plačilo z mobilno banko', 14, 243)
      doc.addImage(upnQrUrl, 'PNG', 14, 247, 28, 28)
      doc.setFont('Roboto', 'normal')
      doc.setFontSize(7)
      doc.setTextColor(90, 90, 90)
      doc.text(`Preberi QR z aplikacijo banke — plačilo ${eur(inv.znesek)}`, 47, 251)
      doc.text('se izpolni samodejno (nalog za izvirni račun velja še).', 47, 255)
      doc.text(`Referenca: SI12 ${inv.stevilka}`, 47, 259)
    }

    doc.setFontSize(7.5)
    doc.setTextColor(120, 120, 120)
    doc.text(
      'Ta dokument ni račun po ZDDV-1 — upoštevati ga je treba skupaj s pripadajočim računom št. ' + inv.stevilka + '.',
      14,
      280
    )

    doc.save(`opomnik-${inv.stevilka}.pdf`)
    toast({ title: 'Opomnik shranjen ✓', description: `Plačilni opomnik za račun ${inv.stevilka} (${dniZapadlo} dni zapadlo)` })
  }

  // ---------- render ----------

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Receipt aria-hidden="true" className="h-4 w-4 text-roksal-amber" />
            Računi <span className="text-xs font-normal text-muted-foreground">(FURS)</span>
          </CardTitle>
          {/* R180 — pečat svežine (družina R170-R178, 9 površin): tight-header klasni
              niz IDENTIČEN družini — Računi so 10. notranja površina (portal
              stranke = dokumentirana stranska varianta); skrit na xs. */}
          {racuniOsvezitev && (
            <span
              className="hidden items-center gap-1 text-[11px] text-muted-foreground sm:flex"
              title="Čas zadnje uspešne osvežitve podatkov"
            >
              <History className="h-3 w-3 shrink-0" aria-hidden="true" />
              Osveženo ob{' '}
              <span className="tabular-nums">{casOznaka(racuniOsvezitev)}</span>
            </span>
          )}
          <div className="flex shrink-0 items-center gap-2">
            {/* R136 — CSV izvoz seznama računov (pregled za pisarno/računovodstvo) */}
            <Button
              size="sm"
              variant="outline"
              onClick={() => exportRacuniCsv(invoices)}
              className="h-8 gap-1.5 px-2.5 text-[11px] font-medium press-scale focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2"
              aria-label="Izvozi račune kot CSV"
              title="Izvozi vse račune (številka, status, zneski) kot CSV za Excel"
            >
              <Download aria-hidden="true" className="h-3.5 w-3.5" />
              CSV
            </Button>
            {/* R250 — prihodki PDF (7. člen 'izvozi' družine): agregatna
                resnica za vodstvo (plačano/odprto/zapadlo — ISTI trikot kot
                Povzetek boxi spodaj). Bralni dokument VEDNO viden (P1-k
                precedens); fail-closed toast pri 0 računov. */}
            <Button
              size="sm"
              variant="outline"
              onClick={handlePrihodkiPdf}
              disabled={prihodkiVTeku}
              className="h-8 gap-1.5 px-2.5 text-[11px] font-medium press-scale focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2"
              aria-label="Izvozi prihodke kot PDF"
              title="Prihodki, terjatve in zapadli računi kot pravi PDF — povzetek za vodstvo"
            >
              <FileDown aria-hidden="true" className="h-3.5 w-3.5" />
              PDF
            </Button>
            {/* R241: gumb viden SAMO nosilcu invoices.create — API bi sicer
                vrnil 403 (R239 ogledalo: nikoli gumb, ki ga pravica ne nosi). */}
            {lahkoUstvarja && (
              <Button
                size="sm"
                onClick={() => setDialogOpen(true)}
                className="h-8 bg-roksal-amber text-roksal-navy hover:bg-roksal-amber/90 press-scale"
              >
                <Plus aria-hidden="true" className="h-4 w-4" /> Nov račun
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* R241: vlogo-osveščen vodič — samo za gledalce brez pisalnih pravic
            (MONTER/SKLADISCE: invoices.read). Navaja TOČNO permission-imeni
            iz API vrat (pariteta r241 test), nikoli ne kaže na skrit gumb. */}
        {samoBranje && (
          <p className="text-2xs text-muted-foreground">
            Pregled računov je samo za branje — ustvarjanje, izdaja in storno
            (pravice invoices.create / invoices.issue / invoices.cancel) izvaja vodstvo.
          </p>
        )}
        {/* R250 — legenda izvozne skupine (pili povejo svojo resnico;
            žetoni, 0 novih hex; JSX tekst ohrani '·' dobesedno — r248
            lekcija). Imenuje ISTO izpeljavo kot Povzetek boxi IN PDF KPI —
            ENA resnica na treh mestih. */}
        <p className="text-right text-2xs text-muted-foreground">
          CSV = vsi računi (vrstice) · PDF = povzetek za vodstvo · Odprto = izdano, neplačano · Zapadlo = prek roka
        </p>
        {/* Povzetek */}
        {!loading && invoices.length > 0 && (
          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-2">
              {/* R290 MANDATORY STIL: hover title na KPI boxih — izpeljava
                  izrečena (WYSIWYG preglednost; ISTA izpeljava kot legenda
                  izvozne skupine in PDF KPI — ENA resnica na treh mestih). */}
              <div className="rounded-lg border border-roksal-green/30 bg-roksal-green/10 p-2 text-center transition-all hover:shadow-sm hover:border-roksal-green/50" title="Plačano = vsi računi s statusom PLACAN (vsota zneskov)">
                <div className="text-2xs uppercase tracking-wide text-roksal-ink">Plačano</div>
                <div className="text-sm font-bold tabular-nums text-roksal-ink">{eur(summary.placano)}</div>
              </div>
              <div className="rounded-lg border border-roksal-amber/30 bg-roksal-amber/10 p-2 text-center transition-all hover:shadow-sm hover:border-roksal-amber/50" title="Odprto = izdano (IZDAN + PLACAN), neplačano — ISTI trikot kot prihodki PDF">
                <div className="text-2xs uppercase tracking-wide text-roksal-ink">Odprto</div>
                <div className="text-sm font-bold tabular-nums text-roksal-ink">
                  {eur(Math.max(0, summary.izdano - summary.placano))}
                </div>
              </div>
              <div
                className={`rounded-lg border p-2 text-center transition-all hover:shadow-sm ${summary.zapadloN > 0 ? 'border-roksal-red/30 bg-roksal-red/10 hover:border-roksal-red/50' : 'border-border bg-muted/40'}`}
                title="Zapadlo = izdani računi prek roka plačila (rok = izdaja + rokPlacilaDni)"
              >
                <div className={`text-2xs uppercase tracking-wide ${summary.zapadloN > 0 ? 'text-roksal-ink' : 'text-muted-foreground'}`}>
                  Zapadlo
                </div>
                <div className={`text-sm font-bold tabular-nums ${summary.zapadloN > 0 ? 'text-roksal-ink' : 'text-muted-foreground'}`}>
                  {summary.zapadloN > 0 ? eur(summary.zapadlo) : '—'}
                </div>
                {summary.zapadloN > 0 && (
                  <div className="text-2xs tabular-nums text-roksal-ink">{summary.zapadloN} račun(ov)</div>
                )}
              </div>
            </div>
            {/* Razmerje plačanega k izdanemu — hitri vpogled v cashflow */}
            {summary.izdano > 0 && (
              <div className="space-y-1">
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-roksal-green to-roksal-green/70 transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(0, (summary.placano / summary.izdano) * 100))}%` }}
                  />
                </div>
                <div className="text-right text-2xs text-muted-foreground">
                  plačano {Math.round((summary.placano / summary.izdano) * 100)} % od izdanih {eur(summary.izdano)}
                </div>
              </div>
            )}
            {/* R290 — PRIHODKI PO MESECIH (plačila dimenzija): razčlenitev
                plačil po mesecu placanoAt — EN VIR s prihodki PDF (isti
                prihodkiVnosi, ISTA validacija/sort uvožena). Fail-verbose
                napaka (pokvaren vir = razlog, ne tiha praznina); meseci ASC;
                IZDAN/OSNUTEK/STORNIRAN poštevani — nič tihega izginjanja.
                Žetoni (border-border/60 · bg-muted/40 · text-muted-foreground
                · text-roksal-ink · tabular-nums) — 0 novih hex. */}
            {!meseciPovzetek.ok ? (
              <div
                role="alert"
                className="rounded-lg border border-roksal-amber/40 bg-roksal-amber/10 p-2 text-2xs text-roksal-ink"
              >
                Prihodki po mesecih iz teh podatkov ni mogoče razčleniti — {meseciPovzetek.napaka}
              </div>
            ) : (
              <section
                aria-label="Prihodki po mesecih — po mesecu plačila"
                className="rounded-lg border border-border/60 bg-muted/40 p-2"
              >
                <div className="flex items-baseline justify-between">
                  <h4 className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Prihodki po mesecih
                  </h4>
                  <div className="flex items-center gap-1.5">
                    {meseciPovzetek.p!.stStorniranih > 0 && (
                      <span className="text-2xs tabular-nums text-muted-foreground">
                        stornirani {meseciPovzetek.p!.stStorniranih} (izključeni iz zneskov)
                      </span>
                    )}
                    {/* R291 — CSV gumb VEDNO viden (kanon R232); pri 0 mesecih
                        fail-closed toast (R250 vzorec); press-scale + ring +
                        aria — družinska pariteta R285/R286 izvoznih gumbov. */}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleMeseciCsv}
                      disabled={meseciCsvVTeku}
                      className="h-6 gap-1 px-1.5 text-2xs font-medium press-scale focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2"
                      aria-label="Izvozi prihodke po mesecih kot CSV"
                      title="Prihodki po mesecih kot CSV — ista resnica kot sekcija (skupaj + v teku + stornirani)"
                    >
                      <FileSpreadsheet aria-hidden="true" className="h-3 w-3" />
                      CSV
                    </Button>
                  </div>
                </div>
                {meseciPovzetek.p!.meseci.length === 0 ? (
                  <p className="pt-1 text-2xs text-muted-foreground">
                    Ni plačanih računov — prihodki po mesecih se izrišejo ob prvem plačilu.
                  </p>
                ) : (
                  <>
                    <ul className="mt-1 space-y-0.5">
                      {meseciPovzetek.p!.meseci.map((m) => {
                        // R291 MANDATORY STIL: mini stolpc — deterministična
                        // širina = prihodki / največji mesec × 100 (isto
                        // merilo za VSE vrstice; 0 EUR = 0 % — iskreno);
                        // žetoni (bg-muted tir + bg-roksal-navy/30), 0 novih
                        // hex; aria-hidden (dekorativni — številke nosijo
                        // resnico, vzorec cashflow traku R241).
                        const najvecji = Math.max(...meseciPovzetek.p!.meseci.map((x) => x.prihodki))
                        const sirina = najvecji > 0 ? Math.min(100, (m.prihodki / najvecji) * 100) : 0
                        return (
                          <li
                            key={m.mesec}
                            className="rounded px-1 py-0.5 text-2xs transition-colors hover:bg-muted/60"
                            title={`${m.mesec}: ${eur(m.prihodki)} — ${najvecji > 0 ? Math.round((m.prihodki / najvecji) * 100) : 0} % največjega meseca`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="tabular-nums text-roksal-ink">{m.mesec}</span>
                              <span className="tabular-nums text-muted-foreground">
                                {m.stRacunov} {racunBeseda(m.stRacunov)}
                              </span>
                              <span className="tabular-nums font-semibold text-roksal-ink">{eur(m.prihodki)}</span>
                            </div>
                            <div aria-hidden="true" className="mt-0.5 h-1 overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full rounded-full bg-roksal-navy/30 transition-all duration-300"
                                style={{ width: `${sirina}%` }}
                              />
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                    <div className="mt-1 flex items-center justify-between border-t border-border/60 px-1 pt-1 text-2xs">
                      <span className="text-muted-foreground">Skupaj plačano</span>
                      <span className="tabular-nums text-muted-foreground">
                        {meseciPovzetek.p!.skupajRacunov} {racunBeseda(meseciPovzetek.p!.skupajRacunov)}
                      </span>
                      <span className="tabular-nums font-bold text-roksal-ink">{eur(meseciPovzetek.p!.skupajPrihodki)}</span>
                    </div>
                    {meseciPovzetek.p!.stIzdanih > 0 && (
                      <p className="px-1 pt-0.5 text-right text-2xs tabular-nums text-muted-foreground">
                        v teku: {meseciPovzetek.p!.stIzdanih} {racunBeseda(meseciPovzetek.p!.stIzdanih)} · {eur(meseciPovzetek.p!.znesekIzdanih)}
                      </p>
                    )}
                  </>
                )}
              </section>
            )}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : invoices.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="Ni še računov"
            description="Ustvari predračun ali račun iz projekta — FURS obvezni podatki so samodejni."
          />
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto pr-1 scrollbar-thin">
            {invoices.map((inv) => {
              const zapadlo = zapadlaDni(inv)
              const meta = STATUS_META[inv.status]
              // Levo letvica kartice pripoveduje status — hitro prepoznavanje brez branja
              const rail =
                zapadlo || inv.status === 'STORNIRAN'
                  ? 'border-l-roksal-red'
                  : inv.status === 'PLACAN'
                    ? 'border-l-roksal-green'
                    : inv.status === 'IZDAN'
                      ? 'border-l-roksal-amber'
                      : 'border-l-muted-foreground/40'
              return (
                <div
                  key={inv.id}
                  className={`rounded-xl border border-l-4 p-3 transition-all hover:shadow-md hover:border-roksal-navy/25 dark:hover:border-roksal-ink/25 ${rail} ${
                    zapadlo ? 'border-roksal-red/30 bg-roksal-red/10' : 'border-border/70 bg-card'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-sm font-bold text-roksal-ink">{inv.stevilka}</span>
                        <Badge variant="outline" className="text-2xs px-1.5">
                          {TIP_META[inv.tip].label}
                        </Badge>
                        <Badge variant="outline" className={`text-2xs px-1.5 gap-1 ${meta.className}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                          {meta.label}
                        </Badge>
                        {zapadlo && (
                          <Badge variant="outline" className="text-2xs px-1.5 border-roksal-red/40 bg-roksal-red/10 text-roksal-ink gap-1">
                            <AlertTriangle aria-hidden="true" className="h-3 w-3" /> zapadlo {zapadlo} dni
                          </Badge>
                        )}
                      </div>
                      <div className="mt-1 truncate text-xs text-muted-foreground">
                        {inv.project?.nazivProjekta ?? '—'} · {parseKupec(inv.kupec)?.ime ?? '—'}
                      </div>
                      <div className="mt-0.5 text-2xs tabular-nums text-muted-foreground">
                        izdano {slDatumKratko(new Date(inv.datumIzdaje))} · rok{' '}
                        {inv.rokPlacilaDni} dni
                        {inv.placanoAt && ` · plačano ${slDatumKratko(new Date(inv.placanoAt))}`}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-bold tabular-nums text-roksal-ink">{eur(inv.znesek)}</div>
                      <div className="text-2xs tabular-nums text-muted-foreground">z DDV {inv.ddv > 0 ? '22 %' : '0 %'}</div>
                    </div>
                  </div>

                  {/* Akcije */}
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {inv.status === 'OSNUTEK' && (
                      <>
                        {lahkoIzdaja && (
                          <Button
                            size="sm"
                            className="h-7 text-xs bg-emerald-600 hover:bg-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2"
                            onClick={() => patchStatus(inv, 'IZDAN')}
                            aria-label="Izdaj račun — status iz osnutka v izdan"
                            title="Potrdi izdajo računa — status se spremeni v izdan; neuspeh vrne prejšnje stanje"
                          >
                            <Send aria-hidden="true" className="h-3 w-3" /> Izdaj
                          </Button>
                        )}
                        {lahkoUstvarja && (
                          <Button size="sm" variant="outline" className="h-7 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2" onClick={() => deleteInvoice(inv)} aria-label="Trajno izbriši osnutek računa" title="Trajno izbriši osnutek računa — brisanje ni možno razveljaviti">
                            <Trash2 aria-hidden="true" className="h-3 w-3" /> Briši
                          </Button>
                        )}
                      </>
                    )}
                    {inv.status === 'IZDAN' && (
                      <>
                        {lahkoIzdaja && (
                          <Button
                            size="sm"
                            className="h-7 text-xs bg-emerald-600 hover:bg-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2"
                            onClick={() => patchStatus(inv, 'PLACAN')}
                            aria-label="Označi račun kot plačan"
                            title="Potrdi plačilo računa — status se spremeni v plačan; neuspeh vrne prejšnje stanje"
                          >
                            <CheckCircle2 aria-hidden="true" className="h-3 w-3" /> Plačan
                          </Button>
                        )}
                        {zapadlo && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs border-roksal-red/40 text-roksal-ink hover:bg-roksal-red/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-red/40 focus-visible:ring-offset-2"
                            onClick={() => generateOpomnik(inv)}
                            title={`Plačilni opomnik — zapadlo ${zapadlo} dni`}
                            aria-label={`Plačilni opomnik za račun ${inv.stevilka}`}
                          >
                            <BellRing aria-hidden="true" className="h-3 w-3" /> Opomnik
                          </Button>
                        )}
                        {lahkoStornira && (
                          <Button
                            size="sm"
                            variant="outline"
                            className={`h-7 text-xs border-roksal-red/40 hover:bg-roksal-red/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-red/40 focus-visible:ring-offset-2 ${stornoId === inv.id ? 'bg-roksal-red text-white hover:bg-roksal-red/90' : 'text-roksal-ink'}`}
                            onClick={() => {
                              if (stornoId === inv.id) {
                                setStornoId(null)
                                patchStatus(inv, 'STORNIRAN')
                              } else {
                                setStornoId(inv.id)
                                setTimeout(() => setStornoId((cur) => (cur === inv.id ? null : cur)), 3000)
                              }
                            }}
                            aria-label="Storniraj račun — drugi klik potrdi"
                            title="Storniraj račun — prvi klik prikaže potrditev, drugi klik stornira (3 s okno)"
                          >
                            <Ban aria-hidden="true" className="h-3 w-3" />
                            {stornoId === inv.id ? 'Potrdi storno?' : 'Storno'}
                          </Button>
                        )}
                      </>
                    )}
                    {inv.status === 'OSNUTEK' && lahkoUstvarja && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2"
                        onClick={() => {
                          setFormProject(inv.projectId)
                          setFormTip(inv.tip)
                          setFormRok(String(inv.rokPlacilaDni))
                          setFormPostavke(parsePostavke(inv.postavke))
                          setFormOpombe(inv.opombe ?? '')
                          deleteInvoice(inv)
                          setDialogOpen(true)
                        }}
                        aria-label="Uredi osnutek računa"
                        title="Uredi osnutek — osnutek se odstrani, dialog zapolni polja; shranjevanje ustvari nov račun"
                      >
                        <Pencil aria-hidden="true" className="h-3 w-3" /> Uredi
                      </Button>
                    )}
                    <Button size="sm" variant="outline" className="h-7 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2" onClick={() => generatePdf(inv)} aria-label="Prenesi račun kot PDF" title="Generiraj in prenesi račun kot PDF dokument">
                      <FileDown aria-hidden="true" className="h-3 w-3" /> PDF
                    </Button>
                    {inv.status !== 'STORNIRAN' && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2"
                        onClick={() => setQrInvoice(inv)}
                        title="UPN QR koda za plačilo"
                        aria-label="UPN QR koda za plačilo"
                      >
                        <QrCode aria-hidden="true" className="h-3 w-3" /> QR
                      </Button>
                    )}
                    {inv.status !== 'STORNIRAN' && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2"
                        onClick={() => void downloadXml(inv)}
                        disabled={xmlLoading === inv.id}
                        title="eRačun XML (eSlog 2.1 / EN 16931)"
                        aria-label="Prenesi eRačun XML"
                      >
                        {xmlLoading === inv.id ? <Loader2 aria-hidden="true" className="h-3 w-3 animate-spin" /> : <FileCode2 aria-hidden="true" className="h-3 w-3" />} XML
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>

      {/* Dialog: nov račun */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          // R241: obrambni AND (R239 vzorec) — dialog se ne odpre, če
          // pravica invoices.create ni znana/nosi (fail-closed vrata v vratah).
          if (open && !lahkoUstvarja) return
          setDialogOpen(open)
        }}
      >
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt aria-hidden="true" className="h-4 w-4 text-roksal-amber" /> Nov račun (FURS)
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-1">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Projekt</Label>
                <Select value={formProject} onValueChange={setFormProject}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Izberi projekt" /></SelectTrigger>
                  <SelectContent className="max-h-64">
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.nazivProjekta}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Vrsta dokumenta</Label>
                <Select value={formTip} onValueChange={(v) => setFormTip(v as Invoice['tip'])}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="RACUN">Račun</SelectItem>
                    <SelectItem value="PREDRACUN">Predračun</SelectItem>
                    <SelectItem value="PREDPLACILNI">Predplačilni račun</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Postavke */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Postavke</Label>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={importFromBom}
                    disabled={bomLoading}
                  >
                    {bomLoading ? <Loader2 aria-hidden="true" className="h-3 w-3 animate-spin" /> : <PackageOpen aria-hidden="true" className="h-3 w-3" />}
                    Iz BOM
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => setFormPostavke((cur) => [...cur, emptyPostavka()])}
                  >
                    <Plus aria-hidden="true" className="h-3 w-3" /> Vrstica
                  </Button>
                </div>
              </div>

              {formPostavke.map((p, i) => (
                <div key={i} className="rounded-lg border border-border/70 p-2 space-y-1.5 bg-muted/40">
                  <div className="flex gap-1.5">
                    <Input
                      className="h-8 text-xs"
                      placeholder="Opis (npr. WPC balustrada H-Line)"
                      value={p.opis}
                      onChange={(e) =>
                        setFormPostavke((cur) => cur.map((x, j) => (j === i ? { ...x, opis: e.target.value } : x)))
                      }
                    />
                    {formPostavke.length > 1 && (
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 shrink-0 text-roksal-red hover:bg-roksal-red/10"
                        onClick={() => setFormPostavke((cur) => cur.filter((_, j) => j !== i))}
                        aria-label="Odstrani vrstico"
                      >
                        <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    <Input
                      className="h-8 text-xs"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="kol."
                      value={p.kolicina || ''}
                      onChange={(e) =>
                        setFormPostavke((cur) => cur.map((x, j) => (j === i ? { ...x, kolicina: Number(e.target.value) } : x)))
                      }
                    />
                    <Input
                      className="h-8 text-xs"
                      placeholder="enota"
                      value={p.enota}
                      onChange={(e) =>
                        setFormPostavke((cur) => cur.map((x, j) => (j === i ? { ...x, enota: e.target.value } : x)))
                      }
                    />
                    <Input
                      className="h-8 text-xs"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="€/enoto"
                      value={p.cenaNaEnoto || ''}
                      onChange={(e) =>
                        setFormPostavke((cur) => cur.map((x, j) => (j === i ? { ...x, cenaNaEnoto: Number(e.target.value) } : x)))
                      }
                    />
                    <Select
                      value={String(p.ddvStopnja)}
                      onValueChange={(v) =>
                        setFormPostavke((cur) => cur.map((x, j) => (j === i ? { ...x, ddvStopnja: Number(v) } : x)))
                      }
                    >
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="22">DDV 22 %</SelectItem>
                        <SelectItem value="9.5">DDV 9,5 %</SelectItem>
                        <SelectItem value="0">0 % (prosto)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="text-right text-2xs text-muted-foreground">
                    vrstica: <span className="font-semibold text-foreground">
                      {eur(round2((p.kolicina || 0) * (p.cenaNaEnoto || 0)))}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Rok + žive vsote */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Rok plačila (dni)</Label>
                <Input
                  className="h-9"
                  type="number"
                  min="0"
                  max="365"
                  value={formRok}
                  onChange={(e) => setFormRok(e.target.value)}
                />
              </div>
              <div className="rounded-lg border border-roksal-amber/30 bg-roksal-amber/10 p-2">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Osnova</span>
                  <span className="font-semibold tabular-nums">{eur(formTotals.osnova)}</span>
                </div>
                {[...formTotals.ddvSkupine.entries()].map(([stopnja, z]) => (
                  <div key={stopnja} className="flex justify-between text-xs">
                    <span className="text-muted-foreground">DDV {stopnja} %</span>
                    <span className="font-semibold tabular-nums">{eur(z)}</span>
                  </div>
                ))}
                <div className="mt-1 flex justify-between border-t border-roksal-amber/30 pt-1 text-sm font-bold text-roksal-ink">
                  <span>Za plačilo</span>
                  <span className="tabular-nums">{eur(formTotals.znesek)}</span>
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Opombe (neobvezno)</Label>
              <Input
                className="h-9"
                placeholder="npr. montaža vključena, dostava v 14 dneh"
                value={formOpombe}
                onChange={(e) => setFormOpombe(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Prekliči</Button>
            <Button
              onClick={createInvoice}
              disabled={saving}
              className="bg-roksal-amber text-roksal-navy hover:bg-roksal-amber/90"
            >
              {saving ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <Euro aria-hidden="true" className="h-4 w-4" />}
              Shrani osnutek
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: UPN QR — plačilo z mobilno banko */}
      <Dialog open={qrInvoice !== null} onOpenChange={(o) => !o && setQrInvoice(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode aria-hidden="true" className="h-4 w-4 text-roksal-amber" />
              UPN QR — {qrInvoice?.stevilka}
            </DialogTitle>
          </DialogHeader>

          {qrInvoice && (
            <div className="space-y-3">
              <div className="flex flex-col items-center gap-2 rounded-xl border border-border/60 bg-card p-4">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt={`UPN QR koda za plačilo računa ${qrInvoice.stevilka}`}
                    className="h-48 w-48"
                  />
                ) : (
                  <div className="flex h-48 w-48 items-center justify-center">
                    <Loader2 aria-hidden="true" className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                )}
                <p className="flex items-center gap-1.5 text-[11px] font-medium text-roksal-ink">
                  <Banknote aria-hidden="true" className="h-3.5 w-3.5 text-roksal-green" />
                  Skeniraj z aplikacijo svoje banke — nalog se izpolni samodejno
                </p>
              </div>

              <div className="space-y-1.5 rounded-xl bg-muted/50 p-3 text-xs">
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Prejemnik</span>
                  <span className="font-semibold">{IZDAJATELJ.naziv}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="shrink-0 text-muted-foreground">IBAN</span>
                  <span className="font-mono font-semibold">{IZDAJATELJ.trr}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Referenca</span>
                  <span className="font-mono font-semibold">SI12 {qrInvoice.stevilka}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Rok plačila</span>
                  <span className="font-semibold">
                    {slDatumKratko(rokPlacilaDatum(qrInvoice))}
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-border/60 pt-1.5">
                  <span className="text-muted-foreground">Za plačilo</span>
                  <span className="text-base font-bold tabular-nums text-roksal-ink">{eur(qrInvoice.znesek)}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9"
                  onClick={() => void copyText(cleanIban(IZDAJATELJ.trr), 'IBAN')}
                >
                  <Copy aria-hidden="true" className="h-3.5 w-3.5" /> Kopiraj IBAN
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9"
                  onClick={() => void copyText(`SI12 ${qrInvoice.stevilka}`, 'Referenca')}
                >
                  <Copy aria-hidden="true" className="h-3.5 w-3.5" /> Kopiraj referenco
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  )
}
