#!/usr/bin/env python3
"""R139: apply correlation ID to sync route (POST + GET)."""

p = '/home/z/my-project/src/app/api/sync/route.ts'
s = open(p).read()

s = s.replace(
  "import { authenticate, unauthorized, forbidden } from '@/lib/auth'",
  "import { authenticate, unauthorized, forbidden } from '@/lib/auth'\nimport { correlationFromRequest, logWithCorrelation } from '@/lib/correlation'",
  1)

# POST: after apiKeyScopeDenied block
old = """  if (apiKeyScopeDenied(auth, 'projects:write')) {
    return forbidden('Ključ nima scope-a projects:write — vpis prek sync ni dovoljen.')
  }"""
new = old + "\n\n  // R139 (§22): correlation ID za korelacijo serije sync z Vercel logi.\n  const correlationId = correlationFromRequest(request)"
assert old in s, 'POST gate'
s = s.replace(old, new, 1)

# POST item error: structured log with correlation
old = "      console.error('Sync POST item error:', error)\n      results.push({ mobileProjectId: mobileProject.id, ok: false, error: message })"
new = "      logWithCorrelation('sync.post.item', correlationId, error)\n      results.push({ mobileProjectId: mobileProject.id, ok: false, error: message })"
assert old in s, 'POST item catch'
s = s.replace(old, new, 1)

# GET: after scope check forbidden
old = "    return forbidden('Ključ nima scope-a projects:read — branje sync zrcala ni dovoljeno.')\n  }\n  try {"
new = "    return forbidden('Ključ nima scope-a projects:read — branje sync zrcala ni dovoljeno.')\n  }\n  const correlationId = correlationFromRequest(request)\n  try {"
assert old in s, 'GET gate'
s = s.replace(old, new, 1)

old = "    console.error('Sync GET Error:', error)\n    return NextResponse.json({ error: 'Napaka pri pridobivanju projektov' }, { status: 500 })"
new = "    logWithCorrelation('sync.get', correlationId, error)\n    return NextResponse.json({ error: 'Napaka pri pridobivanju projektov', correlationId }, { status: 500 })"
assert old in s, 'GET catch'
s = s.replace(old, new, 1)

open(p, 'w').write(s)
print('sync OK')
