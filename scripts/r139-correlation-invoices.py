#!/usr/bin/env python3
"""R139: apply correlation ID to invoices + sync routes (one-shot, idempotent-ish)."""
import sys

# ---------- invoices ----------
p = '/home/z/my-project/src/app/api/invoices/route.ts'
s = open(p).read()

s = s.replace(
  "import { authenticate, unauthorized, forbidden } from '@/lib/auth'",
  "import { authenticate, unauthorized, forbidden } from '@/lib/auth'\nimport { correlationFromRequest, logWithCorrelation } from '@/lib/correlation'",
  1)

# GET: gate then try
old = "export async function GET(request: Request) {\n  const auth = await authenticate(request)\n  if (!auth) return unauthorized()\n  try {"
new = "export async function GET(request: Request) {\n  const auth = await authenticate(request)\n  if (!auth) return unauthorized()\n  const correlationId = correlationFromRequest(request)\n  try {"
assert old in s, 'GET gate'
s = s.replace(old, new, 1)

# POST/PATCH: after denyUnlessInvoice + actor line
old = "  const denied = denyUnlessInvoice(auth, 'invoices.create')\n  if (denied) return denied\n  const actor = actorIdOf(auth)\n  try {"
new = "  const denied = denyUnlessInvoice(auth, 'invoices.create')\n  if (denied) return denied\n  const actor = actorIdOf(auth)\n  const correlationId = correlationFromRequest(request)\n  try {"
assert old in s, 'POST gate'
s = s.replace(old, new, 1)

old = "  const denied = denyUnlessInvoice(auth, 'invoices.create')\n  if (denied) return denied\n  try {"
new = "  const denied = denyUnlessInvoice(auth, 'invoices.create')\n  if (denied) return denied\n  const correlationId = correlationFromRequest(request)\n  try {"
assert old in s, 'DELETE gate'
s = s.replace(old, new, 1)

# PATCH: after bodyPreview/denied block — find the try after it
old = "  const denied = denyUnlessInvoice(auth, bodyPreview.status === 'STORNIRAN' ? 'invoices.cancel' : 'invoices.issue')\n  if (denied) return denied"
new = old + "\n  const correlationId = correlationFromRequest(request)"
assert old in s, 'PATCH gate'
s = s.replace(old, new, 1)

repl = [
  ("    console.error('Invoices GET error:', error)\n    return NextResponse.json({ error: 'Napaka pri branju računov' }, { status: 500 })",
   "    logWithCorrelation('invoices.get', correlationId, error)\n    return NextResponse.json({ error: 'Napaka pri branju računov', correlationId }, { status: 500 })"),
  ("    console.error('Invoices POST error:', error)\n    return NextResponse.json({ error: 'Napaka pri shranjevanju računa' }, { status: 500 })",
   "    logWithCorrelation('invoices.post', correlationId, error)\n    return NextResponse.json({ error: 'Napaka pri shranjevanju računa', correlationId }, { status: 500 })"),
  ("    console.error('Invoices PATCH error:', error)\n    return NextResponse.json({ error: 'Napaka pri posodabljanju računa' }, { status: 500 })",
   "    logWithCorrelation('invoices.patch', correlationId, error)\n    return NextResponse.json({ error: 'Napaka pri posodabljanju računa', correlationId }, { status: 500 })"),
  ("    console.error('Invoices DELETE error:', error)\n    return NextResponse.json({ error: 'Napaka pri brisanju računa' }, { status: 500 })",
   "    logWithCorrelation('invoices.delete', correlationId, error)\n    return NextResponse.json({ error: 'Napaka pri brisanju računa', correlationId }, { status: 500 })"),
]
for old, new in repl:
    assert old in s, old[:40]
    s = s.replace(old, new, 1)

open(p, 'w').write(s)
print('invoices OK')

# ---------- sync ----------
p = '/home/z/my-project/src/app/api/sync/route.ts'
s = open(p).read()
print('sync imports:', "from '@/lib/auth'" in s)
