import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminApiKey } from '@/lib/admin-auth'
import type { Prisma } from '@prisma/client'

const PAGE_SIZE = 25

export async function GET(request: NextRequest) {
  const denied = requireAdminApiKey(request)
  if (denied) return denied

  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')?.trim() || undefined
  const page = Math.max(1, Number(searchParams.get('page')) || 1)
  const filter = searchParams.get('filter') ?? 'all'

  const where: Prisma.UserWhereInput = {}
  if (q) {
    where.OR = [
      { username: { contains: q, mode: 'insensitive' } },
      { phone: { contains: q, mode: 'insensitive' } },
      { email: { contains: q, mode: 'insensitive' } },
      { name: { contains: q, mode: 'insensitive' } },
    ]
  }
  if (filter === 'premium') where.isPremium = true
  if (filter === 'free') Object.assign(where, { isPremium: false, isTestUser: false })
  if (filter === 'test') where.isTestUser = true

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        username: true,
        phone: true,
        email: true,
        name: true,
        isTestUser: true,
        isPremium: true,
        createdAt: true,
        profileCompleted: true,
        profile: {
          select: {
            targetExam: true,
            preparationLevel: true,
            targetAttempt: true,
            preparationFocus: true,
          },
        },
        subscription: { select: { status: true } },
      },
    }),
    prisma.user.count({ where }),
  ])

  return NextResponse.json({ users, total, page, pageSize: PAGE_SIZE })
}
