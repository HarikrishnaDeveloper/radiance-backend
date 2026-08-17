import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { timingSafeEqual } from 'node:crypto'

// Guards /api/admin/* — these routes are for radiance-admin only, not the
// mobile app, so they're authenticated with a shared static key rather than
// a per-user JWT. Human login happens on the admin website itself (its own
// session cookie); this key just proves the request came from that service.
export function requireAdminApiKey(request: NextRequest): NextResponse | null {
  const expected = process.env.ADMIN_API_KEY
  if (!expected) {
    return NextResponse.json({ error: 'ADMIN_API_KEY is not configured' }, { status: 500 })
  }

  const provided = request.headers.get('x-admin-api-key')
  if (!provided || !safeEqual(provided, expected)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return null
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}
