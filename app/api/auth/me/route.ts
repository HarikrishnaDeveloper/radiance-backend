import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const { user, response } = await requireAuth(request)
  if (!user) return response

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } })
  if (!dbUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  return NextResponse.json({
    id: dbUser.id,
    username: dbUser.username,
    name: dbUser.name,
    phone: dbUser.phone,
    email: dbUser.email,
    state: dbUser.state,
  })
}
