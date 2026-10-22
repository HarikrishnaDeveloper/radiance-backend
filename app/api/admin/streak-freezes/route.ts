import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminApiKey } from '@/lib/admin-auth'
import { getFreezeSettings } from '@/lib/streak-freeze'

const PAGE_SIZE = 50
const MONTHS = 6

const monthKey = (d: Date) => d.toISOString().slice(0, 7)

// The admin "Streak freezes" page: how many free and bought freezes real
// (non-test) students use, what's been sold, and every purchase.
export async function GET(request: NextRequest) {
  const denied = requireAdminApiKey(request)
  if (denied) return denied

  const { searchParams } = new URL(request.url)
  const page = Math.max(1, Number(searchParams.get('page')) || 1)

  const now = new Date()
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const historyStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (MONTHS - 1), 1))
  const realUser = { isTestUser: false }

  const [rules, usesBySource, paid, attempts, restores, outOfFree, holding, recentUses, recentPurchases, purchases, purchaseCount] =
    await Promise.all([
      getFreezeSettings(prisma),
      prisma.streakFreezeUse.groupBy({ by: ['source'], where: { user: realUser }, _count: { _all: true } }),
      prisma.streakFreezePurchase.aggregate({
        where: { user: realUser, status: 'PAID' },
        _count: { _all: true },
        _sum: { amountPaise: true, quantity: true },
      }),
      prisma.streakFreezePurchase.count({ where: { user: realUser } }),
      prisma.streakFreezePurchase.count({ where: { user: realUser, status: 'PAID', forRestore: true } }),
      prisma.user.count({ where: { ...realUser, streakFreezesAvailable: 0, freezesRefilledFor: monthKey(now) } }),
      prisma.user.aggregate({ where: { ...realUser, paidStreakFreezes: { gt: 0 } }, _count: { _all: true }, _sum: { paidStreakFreezes: true } }),
      prisma.streakFreezeUse.findMany({ where: { user: realUser, createdAt: { gte: historyStart } }, select: { createdAt: true, source: true } }),
      prisma.streakFreezePurchase.findMany({
        where: { user: realUser, createdAt: { gte: historyStart } },
        select: { createdAt: true, status: true, amountPaise: true, quantity: true, forRestore: true },
      }),
      prisma.streakFreezePurchase.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        include: { user: { select: { id: true, name: true, phone: true, username: true, isTestUser: true } } },
      }),
      prisma.streakFreezePurchase.count(),
    ])

  // Month-by-month, oldest first.
  const months = Array.from({ length: MONTHS }, (_, i) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (MONTHS - 1) + i, 1))
    return { month: monthKey(d), freeUsed: 0, paidUsed: 0, attempts: 0, sold: 0, restores: 0, revenuePaise: 0 }
  })
  const byMonth = new Map(months.map((m) => [m.month, m]))
  for (const use of recentUses) {
    const m = byMonth.get(monthKey(use.createdAt))
    if (m) m[use.source === 'FREE' ? 'freeUsed' : 'paidUsed']++
  }
  for (const p of recentPurchases) {
    const m = byMonth.get(monthKey(p.createdAt))
    if (!m) continue
    m.attempts++
    if (p.status !== 'PAID') continue
    m.sold += p.quantity
    m.revenuePaise += p.amountPaise
    if (p.forRestore) m.restores++
  }
  const thisMonth = byMonth.get(monthKey(monthStart))!

  const used = (source: 'FREE' | 'PAID') => usesBySource.find((u) => u.source === source)?._count._all ?? 0

  return NextResponse.json({
    rules,
    thisMonth,
    allTime: {
      freeUsed: used('FREE'),
      paidUsed: used('PAID'),
      sold: paid._sum.quantity ?? 0,
      revenuePaise: paid._sum.amountPaise ?? 0,
      purchaseAttempts: attempts,
      restores,
    },
    students: {
      outOfFreeThisMonth: outOfFree,
      holdingPaid: holding._count._all,
      paidFreezesHeld: holding._sum.paidStreakFreezes ?? 0,
    },
    months,
    total: purchaseCount,
    page,
    pageSize: PAGE_SIZE,
    purchases: purchases.map((p) => ({
      id: p.id,
      createdAt: p.createdAt,
      paidAt: p.paidAt,
      status: p.status,
      quantity: p.quantity,
      amountPaise: p.amountPaise,
      forRestore: p.forRestore,
      razorpayPaymentId: p.razorpayPaymentId,
      user: p.user,
    })),
  })
}
