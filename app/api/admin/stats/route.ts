import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminApiKey } from '@/lib/admin-auth'
import { FREE_STAGE_LIMIT } from '@/lib/entitlement'
import { MONTHLY_PLAN_AMOUNT_PAISE } from '@/lib/razorpay'
import { AUTOPAY_ON_STATUSES, ENDED_STATUSES, PAYMENT_ISSUE_STATUSES } from '@/lib/billing'

const REVENUE_MONTHS = 6
const DAY_MS = 24 * 60 * 60 * 1000

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export async function GET(request: NextRequest) {
  const denied = requireAdminApiKey(request)
  if (denied) return denied

  const now = new Date()
  const startOfToday = new Date(now)
  startOfToday.setHours(0, 0, 0, 0)
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const revenueSince = new Date(now.getFullYear(), now.getMonth() - (REVENUE_MONTHS - 1), 1)
  const sevenDaysAgo = new Date(now.getTime() - 7 * DAY_MS)
  const sevenDaysAhead = new Date(now.getTime() + 7 * DAY_MS)

  const [
    totalUsers,
    testUsers,
    premiumUsers,
    compUsers,
    newUsersToday,
    newUsersThisMonth,
    statusGroups,
    everSubscribed,
    newSubscribersThisMonth,
    cancelledThisMonth,
    renewalsNext7Days,
    revenueTotal,
    revenueThisMonth,
    recentPayments,
    freeLimitGroups,
    stagesCompletedToday,
    quizAttemptsToday,
    stageActivity7d,
    attemptActivity7d,
    draftsNeedingReview,
    liveQuestions,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { isTestUser: true } }),
    prisma.user.count({ where: { isPremium: true } }),
    // Premium without a live mandate behind it = granted by an admin.
    prisma.user.count({
      where: {
        isPremium: true,
        OR: [{ subscription: null }, { subscription: { status: { notIn: [...AUTOPAY_ON_STATUSES] } } }],
      },
    }),
    prisma.user.count({ where: { createdAt: { gte: startOfToday } } }),
    prisma.user.count({ where: { createdAt: { gte: startOfMonth } } }),
    prisma.subscription.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.subscription.count({ where: { activatedAt: { not: null } } }),
    prisma.subscription.count({ where: { activatedAt: { gte: startOfMonth } } }),
    prisma.subscription.count({ where: { cancelledAt: { gte: startOfMonth } } }),
    prisma.subscription.count({ where: { status: 'ACTIVE', chargeAt: { gte: now, lte: sevenDaysAhead } } }),
    prisma.payment.aggregate({ where: { status: 'CAPTURED' }, _sum: { amountPaise: true }, _count: true }),
    prisma.payment.aggregate({
      where: { status: 'CAPTURED', paidAt: { gte: startOfMonth } },
      _sum: { amountPaise: true },
      _count: true,
    }),
    prisma.payment.findMany({
      where: { status: 'CAPTURED', paidAt: { gte: revenueSince } },
      select: { paidAt: true, amountPaise: true },
    }),
    // Users who have used their whole free allowance — the paywall audience.
    prisma.userStageProgress.groupBy({
      by: ['userId'],
      where: { status: 'COMPLETED' },
      having: { userId: { _count: { gte: FREE_STAGE_LIMIT } } },
    }),
    prisma.userStageProgress.count({ where: { status: 'COMPLETED', completedAt: { gte: startOfToday } } }),
    prisma.quizAttempt.count({ where: { completedAt: { gte: startOfToday } } }),
    prisma.userStageProgress.findMany({
      where: { status: 'COMPLETED', completedAt: { gte: sevenDaysAgo } },
      select: { userId: true, completedAt: true },
    }),
    prisma.quizAttempt.findMany({
      where: { completedAt: { gte: sevenDaysAgo } },
      select: { userId: true, completedAt: true },
    }),
    prisma.draftQuestion.count({ where: { status: 'NEEDS_REVIEW' } }),
    prisma.question.count(),
  ])

  const byStatus: Record<string, number> = {}
  for (const group of statusGroups) byStatus[group.status] = group._count._all
  const sumStatuses = (statuses: readonly string[]) => statuses.reduce((n, s) => n + (byStatus[s] ?? 0), 0)
  const autopayOn = sumStatuses(AUTOPAY_ON_STATUSES)

  const hitFreeLimitIds = freeLimitGroups.map((g) => g.userId)
  const hitFreeLimitNotSubscribed = hitFreeLimitIds.length
    ? await prisma.user.count({ where: { id: { in: hitFreeLimitIds }, isPremium: false, isTestUser: false } })
    : 0

  const activeToday = new Set<string>()
  const active7d = new Set<string>()
  for (const row of [...stageActivity7d, ...attemptActivity7d]) {
    active7d.add(row.userId)
    if (row.completedAt && row.completedAt >= startOfToday) activeToday.add(row.userId)
  }

  const revenueByMonth = new Map<string, { amountPaise: number; payments: number }>()
  for (let i = 0; i < REVENUE_MONTHS; i++) {
    revenueByMonth.set(monthKey(new Date(revenueSince.getFullYear(), revenueSince.getMonth() + i, 1)), {
      amountPaise: 0,
      payments: 0,
    })
  }
  for (const payment of recentPayments) {
    const bucket = revenueByMonth.get(monthKey(payment.paidAt))
    if (bucket) {
      bucket.amountPaise += payment.amountPaise
      bucket.payments += 1
    }
  }

  const payingBase = totalUsers - testUsers

  return NextResponse.json({
    planAmountPaise: MONTHLY_PLAN_AMOUNT_PAISE,
    freeStageLimit: FREE_STAGE_LIMIT,
    users: {
      total: totalUsers,
      test: testUsers,
      premium: premiumUsers,
      comp: compUsers,
      free: totalUsers - premiumUsers - testUsers,
      newToday: newUsersToday,
      newThisMonth: newUsersThisMonth,
      hitFreeLimitNotSubscribed,
    },
    subscriptions: {
      byStatus,
      autopayOn,
      paymentIssues: sumStatuses(PAYMENT_ISSUE_STATUSES),
      ended: sumStatuses(ENDED_STATUSES),
      everSubscribed,
      newThisMonth: newSubscribersThisMonth,
      cancelledThisMonth,
      renewalsNext7Days,
      conversionRate: payingBase > 0 ? everSubscribed / payingBase : 0,
    },
    revenue: {
      mrrPaise: autopayOn * MONTHLY_PLAN_AMOUNT_PAISE,
      totalPaise: revenueTotal._sum.amountPaise ?? 0,
      totalPayments: revenueTotal._count,
      thisMonthPaise: revenueThisMonth._sum.amountPaise ?? 0,
      thisMonthPayments: revenueThisMonth._count,
      monthly: [...revenueByMonth.entries()].map(([month, v]) => ({ month, ...v })),
    },
    usage: {
      activeUsersToday: activeToday.size,
      activeUsers7d: active7d.size,
      stagesCompletedToday,
      quizAttemptsToday,
    },
    content: {
      draftsNeedingReview,
      liveQuestions,
    },
  })
}
