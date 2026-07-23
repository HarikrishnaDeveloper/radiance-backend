import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyPassword } from '@/lib/password'
import { createSession } from '@/lib/auth'

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

  const token = await createSession(user.id)

  return NextResponse.json({
    token,
    user: { id: user.id, username: user.username, name: user.name },
  })
}
