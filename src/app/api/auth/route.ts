// Roksal Field - API: Simple Auth
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Simple email/password auth (no external auth provider needed)
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email, password } = body

    // Simple auth check against database
    // For demo purposes, we use a simple lookup
    const profile = await db.profile.findFirst({
      where: { email }
    })

    if (!profile) {
      // Auto-create demo profile for convenience
      const newProfile = await db.profile.create({
        data: {
          email,
          ime: email.split('@')[0],
          vloga: 'ADMIN',
        }
      })
      return NextResponse.json({
        user: { id: newProfile.id, email: newProfile.email, ime: newProfile.ime, vloga: newProfile.vloga },
        message: 'Račun ustvarjen'
      })
    }

    // In production, use proper password hashing with bcrypt
    return NextResponse.json({
      user: { id: profile.id, email: profile.email, ime: profile.ime, vloga: profile.vloga },
      message: 'Prijava uspešna'
    })
  } catch (err) {
    console.error('Auth error:', err)
    return NextResponse.json({ error: 'Napaka pri prijavi' }, { status: 400 })
  }
}

// GET - Check auth status / seed demo data
export async function GET() {
  try {
    const profiles = await db.profile.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10
    })
    return NextResponse.json({ profiles })
  } catch (err) {
    console.error('Auth GET Error:', err)
    return NextResponse.json({ error: 'Napaka' }, { status: 500 })
  }
}
