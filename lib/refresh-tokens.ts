import { createHash, randomBytes } from 'node:crypto'
import { prisma } from '@/lib/prisma'

const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export async function createRefreshToken(userId: string): Promise<string> {
  const token = randomBytes(32).toString('hex')
  await prisma.refreshToken.create({
    data: { userId, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS) },
  })
  return token
}

// Validates + rotates in one step: deletes the presented token's row and
// issues a brand-new one, so a given refresh token is usable exactly once.
export async function rotateRefreshToken(
  oldToken: string
): Promise<{ token: string; userId: string } | null> {
  const existing = await prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(oldToken) } })
  if (!existing || existing.expiresAt < new Date()) return null

  const newToken = randomBytes(32).toString('hex')
  await prisma.$transaction([
    prisma.refreshToken.delete({ where: { id: existing.id } }),
    prisma.refreshToken.create({
      data: {
        userId: existing.userId,
        tokenHash: hashToken(newToken),
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      },
    }),
  ])
  return { token: newToken, userId: existing.userId }
}

export async function revokeRefreshToken(token: string): Promise<void> {
  await prisma.refreshToken.deleteMany({ where: { tokenHash: hashToken(token) } })
}
