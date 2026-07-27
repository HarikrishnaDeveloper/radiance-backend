import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyPassword } from '@/lib/password'
import { signAccessToken } from '@/lib/jwt'
import { createRefreshToken } from '@/lib/refresh-tokens'

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const username = body?.username
  const password = body?.password

  if (typeof username !== 'string' || typeof password !== 'string') {
    return NextResponse.json({ error: 'username and password are required' }, { status: 400 })
  }

  const user = await prisma.user.findUnique({ where: { username } })
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 })
  }

  const accessToken = await signAccessToken({ id: user.id, username: user.username, name: user.name })
  const refreshToken = await createRefreshToken(user.id)

  return NextResponse.json({
    accessToken,
    refreshToken,
    user: { id: user.id, username: user.username, name: user.name },
  })
}
