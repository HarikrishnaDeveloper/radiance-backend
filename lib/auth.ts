import { createHash, randomBytes } from 'node:crypto'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'

const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString('hex')
  await prisma.session.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + SESSION_DURATION_MS),
    },
  })
  return token
}

function getBearerToken(request: NextRequest): string | null {
  const header = request.headers.get('authorization')
  if (!header?.startsWith('Bearer ')) return null
  return header.slice('Bearer '.length).trim() || null
}

export async function getAuthUser(request: NextRequest) {
  const token = getBearerToken(request)
  if (!token) return null

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  })

  if (!session || session.expiresAt < new Date()) return null
  return session.user
}

export async function requireAuth(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) {
    return { user: null, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  return { user, response: null }
}

export async function deleteSessionForToken(request: NextRequest) {
  const token = getBearerToken(request)
  if (!token) return
  await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } })
}
