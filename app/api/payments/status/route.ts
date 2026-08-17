import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { MONTHLY_PLAN_AMOUNT_PAISE } from '@/lib/razorpay'
import { FREE_STAGE_LIMIT } from '@/lib/entitlement'

export async function GET(request: NextRequest) {
  const { user, response } = await requireAuth(request)
  if (!user) return response

  const [dbUser, subscription, completedStages] = await Promise.all([
    prisma.user.findUnique({ where: { id: user.id }, select: { isTestUser: true, isPremium: true } }),
    prisma.subscription.findUnique({ where: { userId: user.id } }),
    prisma.userStageProgress.count({ where: { userId: user.id, status: 'COMPLETED' } }),
  ])

  return NextResponse.json({
    isTestUser: dbUser?.isTestUser ?? false,
    isPremium: dbUser?.isPremium ?? false,
    freeStageLimit: FREE_STAGE_LIMIT,
    freeStagesUsed: Math.min(completedStages, FREE_STAGE_LIMIT),
    monthlyAmountPaise: MONTHLY_PLAN_AMOUNT_PAISE,
    subscription: subscription
      ? {
          status: subscription.status,
          currentStart: subscription.currentStart,
          currentEnd: subscription.currentEnd,
        }
      : null,
  })
}
