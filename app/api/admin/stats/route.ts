import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminApiKey } from '@/lib/admin-auth'

export async function GET(request: NextRequest) {
  const denied = requireAdminApiKey(request)
  if (denied) return denied

  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)

  const [totalUsers, testUsers, activeSubscriptions, stagesCompletedToday, draftsNeedingReview, liveQuestions] =
    await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isTestUser: true } }),
      prisma.subscription.count({ where: { status: 'ACTIVE' } }),
      prisma.userStageProgress.count({ where: { status: 'COMPLETED', completedAt: { gte: startOfToday } } }),
      prisma.draftQuestion.count({ where: { status: 'NEEDS_REVIEW' } }),
      prisma.question.count(),
    ])

  return NextResponse.json({
    totalUsers,
    testUsers,
    activeSubscriptions,
    stagesCompletedToday,
    draftsNeedingReview,
    liveQuestions,
  })
}
