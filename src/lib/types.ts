// Roksal Railing Manager — shared domain types
// ---------------------------------------------------------------------------
// `Project` used to be redeclared locally in page.tsx, post-signature-panel.tsx
// and pdf-export.tsx with three subtly different shapes. TypeScript then
// reported "Type 'Project' is not assignable to type 'Project'" — two unrelated
// types with the same name — and `customer.telefon` existed in one copy but not
// the other. One canonical declaration here, imported everywhere, removes that
// whole class of bug.
//
// Rule of thumb for these fields: the API returns whatever Prisma selected, so
// every relation and every nullable column is optional AND nullable. Callers
// must narrow before use; nothing here promises a value the server may omit.

export interface ProjectCustomer {
  id?: string
  ime: string
  naslov: string
  telefon?: string | null
  email?: string | null
}

export interface ProjectMonter {
  id?: string
  ime: string
  vloga?: string | null
}

export interface ProjectMeasurementLite {
  dolzinaMm: number
  visinaMm: number
  createdAt: string
}

export interface Project {
  id: string
  nazivProjekta: string
  status: string
  datumMontaze?: string | null
  opombe?: string | null
  customer?: ProjectCustomer | null
  monter?: ProjectMonter | null

  // GPS lokacija projekta (npr. zajeta ob AR posnetku) — API ju vrača
  // (Prisma stolpca latitude/longitude), tipe so prej pomanjkanje.
  latitude?: number | null
  longitude?: number | null

  // V4.1 — post-signature / deal-lock fields
  dealLocked?: boolean | null
  dealLockedAt?: string | null
  dealSignedBy?: string | null
  dealSignedByMonter?: string | null
  marginLocked?: number | null
  estimatedPrice?: number | null

  // Javna povezava stranke: portal (/portal/[token]) + samomeritev (/m/[token])
  clientToken?: string | null
  // R133 (§8): scoped merilni žeton — LOČEN od portal žetona (lasten cikl).
  measureToken?: string | null
  measureEnabled?: boolean
  followUpDate?: string | null
  followUpOpomba?: string | null

  measurements?: ProjectMeasurementLite[]
}

/** One audit row as returned by `GET /api/signature-audit?projectId=…`. */
export interface SignatureAuditEntry {
  id: string
  signatureType: string
  signedByName: string
  signedByRole: string | null
  hasSignature: boolean
  ipAddress: string | null
  userAgent: string | null
  deviceFingerprint: string | null
  pdfHash: string | null
  createdAt: string
  geoLatitude: number | null
  geoLongitude: number | null
}
