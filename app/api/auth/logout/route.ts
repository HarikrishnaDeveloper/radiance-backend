import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { revokeRefreshToken } from '@/lib/refresh-tokens'

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const refreshToken = body?.refreshToken
  if (typeof refreshToken === 'string') {
    await revokeRefreshToken(refreshToken)
  }
  return NextResponse.json({ ok: true })
}
