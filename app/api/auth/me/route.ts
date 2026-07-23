import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const { user, response } = await requireAuth(request)
  if (!user) return response

  return NextResponse.json({ id: user.id, username: user.username, name: user.name })
}
