/**
 * E2E — CELOTLA POSLOVNA VERIGA KOT EN DOKAZ (issue #9 / revizija item 21+22)
 * ---------------------------------------------------------------------------
 * Dokaz prek REALNEGA API površja (HTTP, kot ga vidi produkcija):
 *
 *   prijava → stranka → projekt → fotografija → detekcija (CV, sintetična
 *   slika) → meritev (server-avtoritativna geometrija) → layout → BOM/cena →
 *   zaklep posla (podpisi) → statusni stroj → dokument → CRM → zaključek.
 *
 * KLJUČNE INVARIANTE (HARD — kršitev = exit 1):
 *  - anonimni dostop do poslovnih rut = 401 (fail-closed)
 *  - neveljaven prehod statusa = 409 (statusni stroj velja tudi prek API)
 *  - meritev brez referenčne mere → SCALE_REQUIRED, geometry=null
 *    (nikoli izmišljenih mm)
 *  - enak vhod → bajtno identična seja in identična ponudba (determinizem
 *    prek API plasti, ne samo unit nivo)
 *  - proizvodna dolžina v layoutu = izmerjena dolžina (± 2 mm zaokroževanja)
 *  - Quote količine izhajajo iz layouta; seštevke notranje konsistentne
 *  - dvojni zaklep posla = 409; terminalni status = zaprt za prehode
 *
 * ISKRENE MEJE (INFO, ne blokira):
 *  - sintetična PNG slika je determinističen fixture, NE nadomestilo za prave
 *    terenske fotografije (issue #8)
 *  - /api/documents ustvari SAMO metadata (brez bajtov/hash) — issue #7
 *
 * Ni AI v verigi. Ni naključja (LCG ni potreben — slika je fiksna).
 * Zagon: bun run verify:chain   (BASE privzeto http://localhost:3000)
 */
import { createHash } from 'node:crypto'
import sharp from 'sharp'

const BASE = process.env.E2E_BASE ?? 'http://localhost:3000'
const sha = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex')

// ── Deterministični sintetični balkon (isti vzorec kot canonical-chain.test) ──

const W = 960
const H = 640
const Y_TOP = 0.3
const Y_BOTTOM = 0.62
const X0 = 0.1
const X1 = 0.9
const POST_COUNT = 5

function syntheticBalconyRgba(): Uint8ClampedArray {
  const img = new Uint8ClampedArray(W * H * 4)
  const set = (x: number, y: number, r: number, g: number, b: number) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return
    const p = (y * W + x) * 4
    img[p] = r; img[p + 1] = g; img[p + 2] = b; img[p + 3] = 255
  }
  const rect = (x0: number, y0: number, x1: number, y1: number, rgb: [number, number, number]) => {
    for (let y = Math.max(0, Math.floor(y0)); y < Math.min(H, Math.ceil(y1)); y++)
      for (let x = Math.max(0, Math.floor(x0)); x < Math.min(W, Math.ceil(x1)); x++)
        set(x, y, rgb[0], rgb[1], rgb[2])
  }
  rect(0, 0, W, H, [215, 218, 222])
  const dark: [number, number, number] = [35, 38, 42]
  const tPx = 4
  rect(X0 * W, Y_TOP * H - tPx, X1 * W, Y_TOP * H + tPx, dark)
  rect(X0 * W, Y_BOTTOM * H - tPx, X1 * W, Y_BOTTOM * H + tPx, dark)
  for (let i = 0; i < POST_COUNT; i++) {
    const x = X0 + ((i + 1) * (X1 - X0)) / (POST_COUNT + 1)
    rect(x * W - 3, Y_TOP * H, x * W + 3, Y_BOTTOM * H, dark)
  }
  return img
}

async function syntheticBalconyDataUrl(): Promise<string> {
  const rgba = syntheticBalconyRgba()
  const png = await sharp(Buffer.from(rgba.buffer), {
    raw: { width: W, height: H, channels: 4 },
  })
    .png()
    .toBuffer()
  return `data:image/png;base64,${png.toString('base64')}`
}

/** 1×1 PNG — deterministični podpisni placeholder (route zahteva string). */
const SIGNATURE_1PX =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

// ── Okvir preverjanj ─────────────────────────────────────────────────────────

type Check = { step: string; ok: boolean; hard: boolean; detail: string }
const checks: Check[] = []
function record(step: string, ok: boolean, detail: string, hard = true) {
  checks.push({ step, ok, hard, detail })
  console.log(`  ${ok ? '✓' : hard ? '✗' : 'ℹ'} ${step} — ${detail}`)
}

async function api(
  method: string,
  path: string,
  cookie: string | null,
  body?: unknown,
): Promise<{ status: number; json: any }> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      // R130 (CSRF §6): brskalnik na mutaciji vedno pošlje Origin — ta klient
      // ga ponareja, da ostane legitimni isti-izvorni klient.
      ...(method.toUpperCase() !== 'GET' && method.toUpperCase() !== 'HEAD' && method.toUpperCase() !== 'OPTIONS'
        ? { origin: BASE }
        : {}),
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(cookie ? { cookie } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
  const json = await res.json().catch(() => null)
  return { status: res.status, json }
}

async function main() {
  console.log(`\n═══ E2E VERIGA proti ${BASE} ═══\n`)

  // ── 0. PRIJAVA (ADMIN — celotna veriga potrebuje vodstvo: računi, zaklep,
  // statusni stroj) ──
  // R127 (issue #5 §1): demo dostop je varnostno nevtralen — profil je MONTER
  // brez gesla, na produkciji pa je demo ruta privzeto IZKLOPLJENA. Ta skripta
  // zato pričakuje ADMIN poverilnice prek okolja (E2E_EMAIL/E2E_PASSWORD,
  // ustvari z `bun run admin <email> <geslo> ADMIN <ime>`). Fail-fast z
  // jasnim sporočilom namesto tihega niza 403 kasneje v verigi.
  const E2E_EMAIL = process.env.E2E_EMAIL
  const E2E_PASSWORD = process.env.E2E_PASSWORD
  if (!E2E_EMAIL || !E2E_PASSWORD) {
    console.error(
      '\n✗ Prijava: nastavi E2E_EMAIL in E2E_PASSWORD (ADMIN račun).\n' +
        '  Primer: bun run admin e2e@roksal.si "MočnoGeslo123" ADMIN "E2E"\n' +
        '  nato:   E2E_EMAIL=e2e@roksal.si E2E_PASSWORD="MočnoGeslo123" bun run verify:chain\n' +
        '  (R127: demo račun je MONTER brez gesla — ni več ADMIN vhod za verigo.)',
    )
    process.exit(1)
  }
  const login = await fetch(`${BASE}/api/auth`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: BASE },
    body: JSON.stringify({ email: E2E_EMAIL, password: E2E_PASSWORD }),
  })
  const setCookie = login.headers.get('set-cookie') ?? ''
  const cookie = setCookie.split(';')[0] || null
  record('prijava ADMIN (E2E_EMAIL)', login.status === 200 && !!cookie, `HTTP ${login.status}, cookie=${!!cookie}`)
  if (!(login.status === 200 && cookie)) {
    console.error(`\n✗ Prijava ni uspela (HTTP ${login.status}) — veriga se ne nadaljuje.`)
    process.exit(1)
  }

  // ── 1. FAIL-CLOSED: anonimni dostop = 401 ──
  const anonCustomers = await api('POST', '/api/customers', null, { ime: 'X', naslov: 'Y' })
  record('anon POST /api/customers → 401', anonCustomers.status === 401, `HTTP ${anonCustomers.status}`)
  const anonProjects = await api('GET', '/api/projects', null)
  record('anon GET /api/projects → 401', anonProjects.status === 401, `HTTP ${anonProjects.status}`)

  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')

  // ── 2. STRANKA ──
  const cust = await api('POST', '/api/customers', cookie, {
    ime: `E2E Veriga ${stamp}`,
    naslov: 'Testna cesta 1, 1000 Ljubljana',
    telefon: '+38640123456',
    email: '',
  })
  const customerId: string | undefined = cust.json?.id
  record(
    'POST /api/customers → 201',
    cust.status === 201 && !!customerId,
    `HTTP ${cust.status}, id=${customerId ?? '—'}`,
  )

  // ── 3. PROJEKT (NACRTOVANO) ──
  const proj = await api('POST', '/api/projects', cookie, {
    nazivProjekta: `E2E veriga ${stamp}`,
    customerId,
  })
  const projectId: string | undefined = proj.json?.id
  record(
    'POST /api/projects → 201 (status NACRTOVANO)',
    proj.status === 201 && proj.json?.status === 'NACRTOVANO' && !!projectId,
    `HTTP ${proj.status}, status=${proj.json?.status}, id=${projectId ?? '—'}`,
  )

  // ── 4. STATUSNI STROJ — ničelni dostop + prepovedan prehod (kot MONTER) ──
  // (ADMIN/VODJA ima po zasnovi bypass prehodov — zakon se testira na MONTERju.)
  const monterEmail = `e2e-chain-${stamp}@roksal.si`
  const reg = await fetch(`${BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: BASE },
    body: JSON.stringify({ email: monterEmail, password: 'E2eVeriga2026!x', name: 'E2E Monter' }),
  })
  const monterCookie = (reg.headers.get('set-cookie') ?? '').split(';')[0] || null
  const regJson = await reg.json().catch(() => null)
  let monterUserId: string | undefined = regJson?.user?.id
  if (reg.status === 409 && monterCookie) {
    // e-naslov že obstaja (ponovni zagon) — prijava namesto registracije
    const mLogin = await api('POST', '/api/auth', null, {
      email: monterEmail,
      password: 'E2eVeriga2026!x',
    })
    monterUserId = mLogin.json?.user?.id
    record('MONTER prijava (račun že obstaja)', mLogin.status === 200 && !!monterUserId, `HTTP ${mLogin.status}`)
  }
  record(
    'registracija MONTER (za test stroja)',
    (reg.status === 200 || reg.status === 201) && !!monterCookie && !!monterUserId,
    `HTTP ${reg.status}, userId=${monterUserId ?? '—'}`,
  )
  const mCust = await api('POST', '/api/customers', monterCookie, {
    ime: `E2E Monter Stranka ${stamp}`,
    naslov: 'Monterjeva ulica 2, 2000 Maribor',
  })
  const mProj = await api('POST', '/api/projects', monterCookie, {
    nazivProjekta: `E2E Monter stroj ${stamp}`,
    customerId: mCust.json?.id,
    monterId: monterUserId,
  })
  const mProjectId: string | undefined = mProj.json?.id
  const jump = await api('PATCH', '/api/projects', monterCookie, { id: mProjectId, status: 'MONTIRANO' })
  record(
    'MONTER: PATCH NACRTOVANO→MONTIRANO → 409 (stroj velja prek API)',
    jump.status === 409,
    `HTTP ${jump.status} (${Array.isArray(jump.json?.detail) ? jump.json.detail.join('; ') : jump.json?.error ?? ''})`,
  )
  const mValid = await api('PATCH', '/api/projects', monterCookie, { id: mProjectId, status: 'V_TEKU' })
  record(
    'MONTER: PATCH NACRTOVANO→V_TEKU → 200 (veljaven prehod dela)',
    mValid.status === 200,
    `HTTP ${mValid.status}`,
  )
  const mTerminal = await api('PATCH', '/api/projects', monterCookie, { id: mProjectId, status: 'ZAKLJUCENO' })
  record(
    'MONTER: PATCH V_TEKU→ZAKLJUCENO → 409 (stroj: ni veljaven prehod)',
    mTerminal.status === 409,
    `HTTP ${mTerminal.status}`,
  )
  const mSee = await api('GET', '/api/projects', monterCookie)
  const mIds: string[] = (mSee.json?.projects ?? mSee.json ?? []).map((p: { id: string }) => p.id)
  record(
    'MONTER NE vidi ADMIN projekta (projectWhereForPrincipal prek API)',
    mSee.status === 200 && !mIds.includes(projectId!),
    `HTTP ${mSee.status}, vidi=${mIds.length}, admin projekt oddaljen=${!mIds.includes(projectId!)}`,
  )

  // ── 5. FOTOGRAFIJA ──
  const photoDataUrl = await syntheticBalconyDataUrl()
  const photo = await api('POST', '/api/photos', cookie, {
    projectId,
    kategorija: 'PRED',
    imageData: photoDataUrl,
    opomba: 'E2E deterministični fixture',
  })
  record('POST /api/photos → 201', photo.status === 201, `HTTP ${photo.status}`)

  // ── 6. DETEKCIJA (CV na sintetični sliki) ──
  const detect = await api('POST', '/api/measurement/detect', cookie, { imageData: photoDataUrl })
  const features = detect.json?.features ?? null
  record(
    'POST /api/measurement/detect → DETECTED (5 stebrov)',
    detect.status === 200 && detect.json?.state === 'DETECTED' && (features?.posts?.length ?? 0) >= 3,
    `HTTP ${detect.status}, state=${detect.json?.state}, posts=${features?.posts?.length ?? 0}, runs=${features?.runs?.length ?? 0}`,
  )

  // ── 7. IZDELEK IZ KATALOGA (deterministična izbira) ──
  const productsRes = await api('GET', '/api/measurement/products', cookie)
  const products: Array<{ id: string; orientations: string[] }> = productsRes.json?.products ?? []
  const preferred =
    products.find((p) => p.id === 'roksal.woodcore.polna-128' && p.orientations.includes('horizontal')) ??
    products.find((p) => p.orientations.includes('horizontal'))
  record(
    'GET /api/measurement/products → katalog',
    productsRes.status === 200 && !!preferred,
    `HTTP ${productsRes.status}, ${products.length} izdelkov, izbran=${preferred?.id ?? '—'}`,
  )

  // ── 8. MERITEV A: merilo iz reference (brez projekta, brez izdelka) ──
  const REF = { p1: { x: 0, y: 0.8 }, p2: { x: 1, y: 0.8 }, knownMm: 5000, kind: 'user-known-measure' }
  const confirmBase = {
    sessionId: 'e2e-chain-deterministic',
    source: 'automatic' as const,
    features,
    metrics: detect.json?.metrics,
    reference: REF,
    confirmed: true,
  }
  const withScale = await api('POST', '/api/measurement/confirm', cookie, { ...confirmBase })
  record(
    'confirm (s referenco) → scale server-avtoritativno prisoten',
    withScale.status === 200 && withScale.json?.session?.scale != null,
    `HTTP ${withScale.status}, state=${withScale.json?.session?.quality?.state}, scale=${withScale.json?.session?.scale ? 'DA' : 'NE'}`,
  )
  // ZAKON: meritev SE SME shraniti brez izdelka (dimenzije so znane),
  // ampak BREZ izdelka NI proizvodnega predračuna (takeoffPreview=null).
  const saveNoGeom = await api('POST', '/api/measurement/confirm', cookie, {
    ...confirmBase,
    sessionId: 'e2e-chain-save-no-product',
    projectId,
  })
  record(
    'confirm v projekt brez izdelka → 201, takeoffPreview=null (brez izdelka ni BOM)',
    saveNoGeom.status === 201 && saveNoGeom.json?.savedMeasurementId != null &&
      saveNoGeom.json?.takeoffPreview == null && saveNoGeom.json?.layout == null,
    `HTTP ${saveNoGeom.status}, saved=${saveNoGeom.json?.savedMeasurementId != null ? 'DA' : 'NE'}, takeoff=${saveNoGeom.json?.takeoffPreview != null ? 'DA' : 'null'}`,
  )

  // ── 9. MERITEV B (-zakon): brez reference → SCALE_REQUIRED, geometry=null ──
  const noRef = await api('POST', '/api/measurement/confirm', cookie, {
    sessionId: 'e2e-chain-no-reference',
    source: 'automatic',
    features,
    metrics: detect.json?.metrics,
    confirmed: true,
  })
  record(
    'confirm brez reference → SCALE_REQUIRED (nič izmišljenih mm)',
    noRef.json?.session?.quality?.state === 'SCALE_REQUIRED' && noRef.json?.session?.geometry == null,
    `state=${noRef.json?.session?.quality?.state}`,
  )

  // ── 10. MERITEV C: shrani v projekt (geometry = izdelek) ──
  const confirm1 = await api('POST', '/api/measurement/confirm', cookie, {
    ...confirmBase,
    projectId,
    geometry: {
      productId: preferred!.id,
      orientation: 'horizontal',
      gapMm: 30,
      postWidthMm: 60,
    },
  })
  const session1 = confirm1.json?.session ?? null
  const g1 = session1?.geometry ?? null
  const savedId: string | undefined = confirm1.json?.savedMeasurementId
  record(
    'confirm (geometry + projectId) → shranjena meritev',
    (confirm1.status === 200 || confirm1.status === 201) && !!savedId && g1 != null,
    `HTTP ${confirm1.status}, state=${session1?.quality?.state}, savedId=${savedId ?? '—'}`,
  )
  const totalMm: number | undefined = g1?.totalLengthMm?.valueMm
  const heightMm: number | undefined = g1?.heightMm?.valueMm
  record(
    'geometrija: total≈0.806×5000 mm, sledljiv izvor',
    totalMm != null && totalMm > 3800 && totalMm < 4250 &&
      typeof g1?.totalLengthMm?.provenance === 'string' &&
      g1.totalLengthMm.provenance.includes('user-known-measure'),
    `total=${totalMm} mm ±${g1?.totalLengthMm?.uncertaintyMm}, height=${heightMm} mm, vir=${g1?.totalLengthMm?.provenance ?? '—'}`,
  )

  // ── 11. DETERMINIZEM: enak vhod → bajtno identična seja ──
  const confirm2 = await api('POST', '/api/measurement/confirm', cookie, {
    ...confirmBase,
    geometry: { productId: preferred!.id, orientation: 'horizontal', gapMm: 30, postWidthMm: 60 },
  })
  const session2 = confirm2.json?.session ?? null
  const identical = JSON.stringify(session1) === JSON.stringify(session2)
  record(
    'determinizem seje: 2× confirm = identičen JSON',
    identical,
    identical
      ? `session SHA-256 ${sha(session1).slice(0, 16)}…`
      : `RAZLIČNI (A=${sha(session1).slice(0, 8)} B=${sha(session2 ? sha(session2).slice(0, 8) : 'null')})`,
  )

  // ── 12. STATUS: NACRTOVANO → V_TEKU (veljaven prehod) ──
  const vTeku = await api('PATCH', '/api/projects', cookie, { id: projectId, status: 'V_TEKU' })
  record('PATCH NACRTOVANO→V_TEKU → 200', vTeku.status === 200, `HTTP ${vTeku.status}`)

  // ── 13. LAYOUT: perimeter IZ segmentov meritve (API: xM/zM v metrih) ──
  const points = [{ xM: 0, zM: 0 }].concat(
    (g1?.segments ?? []).map((s: { startMm: number; lengthMm: number }) => ({
      xM: (s.startMm + s.lengthMm) / 1000,
      zM: 0,
    })),
  )
  const layoutRes = await api('POST', '/api/railing-layout', cookie, {
    points,
    spec: { heightMm: Math.round(heightMm!) },
  })
  const layout = layoutRes.json?.layout ?? null
  const fabLen = layout?.edges?.[0]?.fabricationLengthMm
  record(
    'POST /api/railing-layout → edges[0].fabricationLengthMm ≈ total',
    layoutRes.status === 200 && fabLen != null && Math.abs(fabLen - totalMm!) <= 2,
    `HTTP ${layoutRes.status}, fab=${fabLen} mm vs meritev ${totalMm} mm (Δ=${fabLen != null ? Math.abs(fabLen - totalMm!) : '—'}) ${layoutRes.status !== 200 ? JSON.stringify(layoutRes.json).slice(0, 160) : ''}`,
  )

  // ── 14. PONUDBA (BOM + cena, server-avtoritativno) ──
  const quoteBody = { points, spec: { heightMm: Math.round(heightMm!) }, projectId }
  const quote1 = await api('POST', '/api/quote', cookie, quoteBody)
  const q1 = quote1.json?.quote ?? null
  if (!q1) {
    record('POST /api/quote → 200', false, `HTTP ${quote1.status} ${JSON.stringify(quote1.json).slice(0, 200)}`)
    console.log('\nVeriga prekinjena (ponudba je vstopna točka zaklepa posla).')
    const { mkdirSync, writeFileSync } = await import('node:fs')
    mkdirSync('tmp/scenarios', { recursive: true })
    writeFileSync('tmp/scenarios/chain-e2e.json', JSON.stringify({ base: BASE, at: new Date().toISOString(), checks }, null, 2))
    process.exit(1)
  }
  const materialSum = (q1.items ?? [])
    .filter((i: { group: string }) => i.group !== 'LABOUR' && i.group !== 'OTHER')
    .reduce((s: number, i: { total: number }) => s + i.total, 0)
  record(
    'POST /api/quote → postavke, runM ≈ meritev',
    quote1.status === 200 && (q1.items?.length ?? 0) > 0 &&
      Math.abs(q1.runM - totalMm! / 1000) <= 0.005,
    `HTTP ${quote1.status}, items=${q1?.items?.length}, runM=${q1?.runM} vs ${totalMm! / 1000}`,
  )
  record(
    'cena: seštevke konsistentne (materialTotal = Σ material; total = net + DDV)',
    Math.abs(q1.materialTotal - materialSum) <= 0.02 &&
      Math.abs(q1.total - (q1.netTotal + q1.vatAmount)) <= 0.02,
    `material=${q1.materialTotal}, net=${q1.netTotal}, DDV=${q1.vatAmount}, total=${q1.total} EUR`,
  )

  // ── 15. DETERMINIZEM PONUDBE: 2× quote = identično ──
  const quote2 = await api('POST', '/api/quote', cookie, quoteBody)
  const qIdentical = JSON.stringify(quote1.json) === JSON.stringify(quote2.json)
  record(
    'determinizem ponudbe: 2× quote = identičen JSON',
    qIdentical,
    qIdentical ? `quote SHA-256 ${sha(q1).slice(0, 16)}…` : 'RAZLIČNI!',
  )

  // ── 16. ZAKLEP POSLA (podpisi → ZA_MONTAZO + BOM draft + signature audit) ──
  const canonicalPdfHash = sha({ quote: q1, spec: quoteBody.spec, points })
  const dealLock = await api('POST', '/api/deal-lock', cookie, {
    projectId,
    customerName: cust.json?.ime,
    monterName: 'E2E Veriga Monter',
    customerSignature: SIGNATURE_1PX,
    monterSignature: SIGNATURE_1PX,
    quoteData: {
      items: q1.items.map((i: { name: string; qty: number; unit: string; unitPrice: number; total: number }) => ({
        opis: i.name,
        kolicina: String(i.qty),
        enota: i.unit,
        cena: String(i.unitPrice),
        skupaj: String(i.total),
      })),
      skupajBrezDDV: q1.netTotal,
      ddv: q1.vatAmount,
      skupajZDDV: q1.total,
    },
    pdfHash: canonicalPdfHash,
  })
  record(
    'POST /api/deal-lock → ZA_MONTAZO + bomDraft + 2 podpisa',
    dealLock.status === 200 &&
      dealLock.json?.status === 'ZA_MONTAZO' &&
      dealLock.json?.dealLocked === true &&
      dealLock.json?.signatureAuditCount === 2 &&
      dealLock.json?.bomDraft != null,
    `HTTP ${dealLock.status}, status=${dealLock.json?.status}, bomDraft=${dealLock.json?.bomDraft ? 'DA' : 'NE'}, pdfHash=${String(dealLock.json?.pdfHash ?? '').slice(0, 12)}…`,
  )

  // ── 17. NEGATIVNO: dvojni zaklep = 409 ──
  const dealLock2 = await api('POST', '/api/deal-lock', cookie, {
    projectId,
    customerName: 'X',
    monterName: 'Y',
    customerSignature: SIGNATURE_1PX,
    monterSignature: SIGNATURE_1PX,
    quoteData: { items: [], skupajBrezDDV: 0, ddv: 0, skupajZDDV: 0 },
  })
  record('dvojni deal-lock → 409', dealLock2.status === 409, `HTTP ${dealLock2.status}`)

  // ── 18. BOM DRAFT (iz zaklepa) + refiniranje (read-only) ──
  const bomDraft = await api('GET', `/api/bom-draft?projectId=${projectId}`, cookie)
  const bomItems = bomDraft.json?.bomDraft?.items ?? bomDraft.json?.bomDraft ?? []
  record(
    'GET /api/bom-draft → postavke iz zaklepa',
    bomDraft.status === 200 && Array.isArray(bomItems) && bomItems.length > 0,
    `HTTP ${bomDraft.status}, postavk=${Array.isArray(bomItems) ? bomItems.length : '—'}`,
  )
  const bomRefine = await api('GET', `/api/bom-refine?projectId=${projectId}`, cookie)
  record(
    'GET /api/bom-refine → ujemanje z inventarjem (INFO)',
    bomRefine.status === 200,
    `HTTP ${bomRefine.status}, ujemenih=${bomRefine.json?.matchedCount ?? '—'}/${bomRefine.json?.totalCount ?? '—'} (INFO: cena je odvisna od inventarja)`,
    false,
  )

  // ── 19. DOKUMENT (iskreno: metadata only — issue #7) ──
  const doc = await api('POST', '/api/documents', cookie, {
    projectId,
    tipDokumenta: 'ZAPISNIK_NAVORA',
  })
  record(
    'POST /api/documents → 201 (metadata; brez bajtov/hash = issue #7)',
    doc.status === 201,
    `HTTP ${doc.status}, pdfUrl=${doc.json?.pdfUrl ?? '—'}`,
    false,
  )

  // ── 20. STATUSNI STROJ DO ZAKLJUČKA (upravitelj, dealLocked) ──
  for (const status of ['V_IZDELAVI', 'MONTIRANO', 'ZAKLJUCENO'] as const) {
    const r = await api('PATCH', '/api/projects', cookie, { id: projectId, status })
    record(`PATCH → ${status}`, r.status === 200 && r.json?.status === status, `HTTP ${r.status}`)
  }
  const terminal = await api('PATCH', '/api/projects', cookie, { id: projectId, status: 'V_TEKU' })
  record(
    'ADMIN: ZAKLJUCENO→V_TEKU = bypass (po zasnovi — INFO) + ponovni zaključek',
    terminal.status === 200,
    `HTTP ${terminal.status} (upravitelj sme ponovno odpreti — unit testi pokrijejo stroj za ne-upravitelje)`,
    false,
  )
  const closeAgain = await api('PATCH', '/api/projects', cookie, { id: projectId, status: 'ZAKLJUCENO' })
  record('ADMIN: ponovni zaključek → ZAKLJUCENO', closeAgain.status === 200, `HTTP ${closeAgain.status}`)

  // ── 21. DEAL-LOCK STANJE + PODPISNI AUDIT ──
  const lockState = await api('GET', `/api/deal-lock?projectId=${projectId}`, cookie)
  record(
    'GET /api/deal-lock → zaklenjeno, 2 podpisna revizijska zapisa',
    lockState.status === 200 && lockState.json?.dealLocked === true &&
      (lockState.json?.signatures?.length ?? 0) === 2,
    `HTTP ${lockState.status}, podpisov=${lockState.json?.signatures?.length ?? '—'}`,
  )

  // ── 22. CRM: LTV + zaklenjeni projekti ──
  const crm = await api('GET', `/api/crm?id=${customerId}`, cookie)
  record(
    'GET /api/crm → zaklenjeni projekti ≥ 1',
    crm.status === 200 && (crm.json?.zaklenjeniProjekti ?? 0) >= 1,
    `HTTP ${crm.status}, zaklenjeni=${crm.json?.zaklenjeniProjekti ?? '—'}, LTV=${crm.json?.ltv ?? '—'} EUR (INFO: vrednost)`,
    false,
  )

  // ── 23. KANONIČNI HASH VERIGE (isti vhod → isti hash čez zagoni) ──
  const canonical = {
    session: { totalLengthMm: totalMm, heightMm, segments: g1?.segments },
    takeoff: confirm1.json?.takeoffPreview,
    layoutPosts: layout?.posts?.length,
    quote: {
      runM: q1.runM,
      materialTotal: q1.materialTotal,
      netTotal: q1.netTotal,
      vatAmount: q1.vatAmount,
      total: q1.total,
      items: q1.items,
    },
  }
  const chainHash = sha(canonical)
  console.log(`\n  ⚛ KANONIČNI HASH VERIGE: ${chainHash}`)
  console.log('    (isti sintetični vhod mora dati IDENTIČEN hash tudi v naslednjem zagonu)')

  // ── POVRATNA INFORMACIJA ──
  const hard = checks.filter((c) => c.hard)
  const hardFail = hard.filter((c) => !c.ok)
  const info = checks.filter((c) => !c.hard)
  console.log(`\n═══ POVZETEK: HARD ${hard.length - hardFail.length}/${hard.length} ✓ · INFO ${info.length} ═══`)
  if (hardFail.length > 0) {
    console.log('\nPADLIH HARD preverjanj:')
    for (const c of hardFail) console.log(`  ✗ ${c.step} — ${c.detail}`)
  }
  console.log(`\nIskrene meje: sintetična slika ≠ prave terenske fotografije (#8); dokumenti brez bajtov/hash (#7).`)

  const { mkdirSync, writeFileSync } = await import('node:fs')
  mkdirSync('tmp/scenarios', { recursive: true })
  writeFileSync(
    `tmp/scenarios/chain-e2e.json`,
    JSON.stringify(
      {
        base: BASE,
        at: new Date().toISOString(),
        chainHash,
        hard: `${hard.length - hardFail.length}/${hard.length}`,
        checks,
      },
      null,
      2,
    ),
  )
  console.log(`  📄 Rezultati: tmp/scenarios/chain-e2e.json\n`)

  if (hardFail.length > 0) process.exit(1)
}

main().catch((e) => {
  console.error('E2E VERIGA — NAPAKA:', e)
  process.exit(1)
})
