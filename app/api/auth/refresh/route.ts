import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { signAccessToken } from '@/lib/jwt'
import { rotateRefreshToken } from '@/lib/refresh-tokens'

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const refreshToken = body?.refreshToken
  if (typeof refreshToken !== 'string') {
    return NextResponse.json({ error: 'refreshToken is required' }, { status: 400 })
  }

  const rotated = await rotateRefreshToken(refreshToken)
  if (!rotated) {
    return NextResponse.json({ error: 'Invalid or expired refresh token' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({ where: { id: rotated.userId } })
  if (!user) {
    return NextResponse.json({ error: 'Invalid or expired refresh token' }, { status: 401 })
  }

  const accessToken = await signAccessToken({ id: user.id, username: user.username, name: user.name })
  return NextResponse.json({ accessToken, refreshToken: rotated.token })
}
