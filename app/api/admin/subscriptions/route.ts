import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminApiKey } from '@/lib/admin-auth'
import { AUTOPAY_ON_STATUSES, ENDED_STATUSES, PAYMENT_ISSUE_STATUSES } from '@/lib/billing'
import type { Prisma, SubscriptionStatus } from '@prisma/client'

const PAGE_SIZE = 25

// `filter` groups Razorpay statuses the way the admin thinks about them.
const FILTERS: Record<string, readonly SubscriptionStatus[]> = {
  autopay: AUTOPAY_ON_STATUSES,
  issues: PAYMENT_ISSUE_STATUSES,
  ended: ENDED_STATUSES,
  incomplete: ['CREATED'],
}

export async function GET(request: NextRequest) {
  const denied = requireAdminApiKey(request)
  if (denied) return denied

  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')?.trim() || undefined
  const filter = searchParams.get('filter') ?? 'all'
  const page = Math.max(1, Number(searchParams.get('page')) || 1)

  const where: Prisma.SubscriptionWhereInput = {}
  if (FILTERS[filter]) where.status = { in: [...FILTERS[filter]] }
  if (q) {
    where.OR = [
      { razorpaySubscriptionId: { contains: q, mode: 'insensitive' } },
      { user: { name: { contains: q, mode: 'insensitive' } } },
      { user: { phone: { contains: q, mode: 'insensitive' } } },
      { user: { username: { contains: q, mode: 'insensitive' } } },
      { user: { email: { contains: q, mode: 'insensitive' } } },
    ]
  }

  const [subscriptions, total] = await Promise.all([
    prisma.subscription.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { user: { select: { id: true, name: true, phone: true, username: true } } },
    }),
    prisma.subscription.count({ where }),
  ])

  const totals = subscriptions.length
    ? await prisma.payment.groupBy({
        by: ['subscriptionId'],
        where: { subscriptionId: { in: subscriptions.map((s) => s.id) }, status: 'CAPTURED' },
        _sum: { amountPaise: true },
        _max: { paidAt: true },
      })
    : []
  const totalsBySub = new Map(totals.map((t) => [t.subscriptionId, t]))

  return NextResponse.json({
    total,
    page,
    pageSize: PAGE_SIZE,
    subscriptions: subscriptions.map((sub) => ({
      id: sub.id,
      status: sub.status,
      autopayOn: (AUTOPAY_ON_STATUSES as readonly string[]).includes(sub.status),
      razorpaySubscriptionId: sub.razorpaySubscriptionId,
      currentStart: sub.currentStart,
      currentEnd: sub.currentEnd,
      chargeAt: sub.chargeAt,
      paidCount: sub.paidCount,
      activatedAt: sub.activatedAt,
      cancelledAt: sub.cancelledAt,
      totalPaidPaise: totalsBySub.get(sub.id)?._sum.amountPaise ?? 0,
      lastPaidAt: totalsBySub.get(sub.id)?._max.paidAt ?? null,
      updatedAt: sub.updatedAt,
      user: sub.user,
    })),
  })
}
