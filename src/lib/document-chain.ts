/**
 * R395 — DOKUMENTNA VERIGA PONUDBE (issue #13, korak R172 iz §16 —
 * SIGNATURE + DOCUMENT CHAIN).
 * ---------------------------------------------------------------------------
 * NEPREKINJENA vez (§16):
 *
 *   QuoteVersion → DocumentVersion → dejanski PDF bajti → SHA-256 →
 *   SignatureAudit → DealLock
 *
 * Ta modul je EN VIR skupne logike obeh poti, ki ustvarjata/porabljata
 * PONUDBA dokumente:
 *   • POST /api/quotes/[id]/pdf — izdaja PDF verzije ponudbe (teren/pisarna);
 *   • POST /api/deal-lock — podpis NAD točno določeno verzijo dokumenta
 *     (podana documentVersionId) ALI strežniška samodejna izdaja.
 *
 * BAZNE linije (migracija 20261010080100_r395_document_chain):
 *   • trigger document_version_no_update — DocumentVersion je IMMUTABLE;
 *   • partial UNIQUE Document_ponudba_quote_key — EN zabojnik PONUDBA na
 *     verzijo ponudbe (ta modul je prva linija: iskanje po quoteVersionId;
 *     baza je zadnja: vzporedni zapis pada, ne tiho podvoji);
 *   • trigger signature_audit_document_chain — pdfHash podpisa MORA biti
 *     enak sha256 vezane DocumentVersion (mimo store-plasti, kanon R393).
 *
 * VRATNA preverba (preveriVerzijoDokumenta) je JEDRO §16 "PDF hash = hash
 * dejanskih PDF bajtov": bajte POBERE IZ object storage in jih RE-HASHIRA —
 * zabeleženi sha256 velja SAMO, če se sklada z bajti, ki FIZIČNO ležijo v
 * storage. Zamenjava artefakta (refaktor, restore, napaka) se GLASNO odkrije.
 */
import { db } from '@/lib/db'
import { getObject, sha256Of } from '@/lib/object-storage'

export interface PonudbaKontekst {
  /** Zabojnik (Document, tip PONUDBA) — obstoječi ali novi id. */
  documentId: string
  /** Zaporedna številka NOVE DocumentVersion (obstoječe število + 1). */
  nextVersion: number
  /** true = še ni zabojnika (ustvariti ga je treba v transakciji). */
  isNewDocument: boolean
}

/**
 * Zabojnik PONUDBA dokumentov za verzijo ponudbe (+ števec obstoječih
 * verzij za naslednjo številko). Ena sama točka iskanja — delna UNIQUE
 * (baza) ujame vzporedne tekove, ki bi oba ustvarila zabojnik.
 */
export async function ponudbaKontekst(quoteVersionId: string): Promise<PonudbaKontekst> {
  const obstojeci = await db.document.findFirst({
    where: { quoteVersionId, tipDokumenta: 'PONUDBA' },
    select: { id: true, _count: { select: { versions: true } } },
  })
  return {
    documentId: obstojeci?.id ?? crypto.randomUUID(),
    nextVersion: (obstojeci?._count.versions ?? 0) + 1,
    isNewDocument: !obstojeci,
  }
}

/** Verzija dokumenta po id-ju z zabojnikom (za §16 preverbe). */
export async function verzijaDokumenta(documentVersionId: string) {
  return db.documentVersion.findUnique({
    where: { id: documentVersionId },
    include: { document: { select: { id: true, projectId: true, tipDokumenta: true } } },
  })
}

export type VerzijaDokumentaPreverba =
  | {
      ok: true
      dv: {
        id: string
        documentId: string
        version: number
        storageKey: string
        sha256: string
        sizeBytes: number
        quoteVersionId: string | null
      }
    }
  | { ok: false; status: number; error: string }

/**
 * §16 VRATA nad podpisano verzijo dokumenta (fail-closed, vsa sporočila
 * javna — needleji r395.tsv):
 *   1. verzija obstaja (404);
 *   2. nosi §16 vezavo NA PODPISOVANO verzijo ponudbe (409 — tuja/stara
 *      verzija ponudbe se ne podpisuje pod ta zaklep);
 *   3. pripada projektu zaklepa (409 — prečni dostop);
 *   4. je tip PONUDBA (409 — podpisuje se izključno PDF ponudbe);
 *   5. bajti FIZIČNO obstajajo v object storage (409 — prekinjena veriga);
 *   6. RE-HASH bajtov == zabeleženi sha256 (409 — zapečatenje ne drži več).
 *
 * Vrni { ok, dv } — dv.sha256 je edini vir za SignatureAudit.pdfHash.
 */
export async function preveriVerzijoDokumenta(
  documentVersionId: string,
  quoteVersionId: string,
  projectId: string,
): Promise<VerzijaDokumentaPreverba> {
  const dv = await verzijaDokumenta(documentVersionId)
  if (!dv) {
    return { ok: false, status: 404, error: 'Verzija dokumenta ne obstaja' }
  }
  if (!dv.quoteVersionId || dv.quoteVersionId !== quoteVersionId) {
    return {
      ok: false,
      status: 409,
      error: 'Verzija dokumenta ni vezana na podpisovano verzijo ponudbe (prečna vezava zavrnjena).',
    }
  }
  if (dv.document.projectId !== projectId) {
    return { ok: false, status: 409, error: 'Dokument ne pripada temu projektu (prečni dostop zavrnjen).' }
  }
  if (dv.document.tipDokumenta !== 'PONUDBA') {
    return {
      ok: false,
      status: 409,
      error: 'Podpis se veže izključno na PONUDBA dokument (PDF ponudbe).',
    }
  }
  const bajti = await getObject(dv.storageKey)
  if (!bajti) {
    return {
      ok: false,
      status: 409,
      error: 'PDF artefakt manjka v object storage — dokumentna veriga je prekinjena.',
    }
  }
  const dejanskiHash = sha256Of(bajti)
  if (dejanskiHash !== dv.sha256) {
    return {
      ok: false,
      status: 409,
      error: 'PDF bajti se ne ujemajo s SHA-256 verzije dokumenta — zapečatenje ne drži (zavrnjeno).',
    }
  }
  return {
    ok: true,
    dv: {
      id: dv.id,
      documentId: dv.documentId,
      version: dv.version,
      storageKey: dv.storageKey,
      sha256: dv.sha256,
      sizeBytes: dv.sizeBytes,
      quoteVersionId: dv.quoteVersionId,
    },
  }
}
