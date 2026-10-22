import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminApiKey } from '@/lib/admin-auth'

type Row = { value: string | null; count: number }

// The admin "Audience" page: how real (non-test) users answered onboarding,
// and how they use the study tools. Every list is sorted most-common first.
export async function GET(request: NextRequest) {
  const denied = requireAdminApiKey(request)
  if (denied) return denied

  const realUser = { isTestUser: false }
  const profileWhere = { user: realUser }

  const profileGroup = (by: 'referralSource' | 'preparationDuration' | 'preparationLevel' | 'targetAttempt' | 'preparationFocus') =>
    prisma.userProfile.groupBy({ by: [by], where: profileWhere, _count: { _all: true } })

  const [
    totalUsers,
    profileCompleted,
    phoneVerified,
    referral,
    duration,
    level,
    attempt,
    focus,
    states,
    goals,
    goalUsers,
    bookmarks,
    questionsAnswered,
    attemptsByMode,
    challengeCompletions,
    freezes,
  ] = await Promise.all([
    prisma.user.count({ where: realUser }),
    prisma.user.count({ where: { ...realUser, profileCompleted: true } }),
    prisma.user.count({ where: { ...realUser, phoneVerifiedAt: { not: null } } }),
    profileGroup('referralSource'),
    profileGroup('preparationDuration'),
    profileGroup('preparationLevel'),
    profileGroup('targetAttempt'),
    profileGroup('preparationFocus'),
    prisma.user.groupBy({ by: ['state'], where: realUser, _count: { _all: true } }),
    prisma.studyPlanGoal.groupBy({ by: ['type'], where: { user: realUser }, _count: { _all: true }, _avg: { target: true } }),
    prisma.studyPlanGoal.findMany({ where: { user: realUser }, distinct: ['userId'], select: { userId: true } }),
    prisma.userQuestionProgress.count({ where: { user: realUser, bookmarked: true } }),
    prisma.userQuestionProgress.count({ where: { user: realUser } }),
    prisma.quizAttempt.groupBy({
      by: ['mode', 'testMode'],
      where: { user: realUser, completedAt: { not: null } },
      _count: { _all: true },
    }),
    prisma.userDailyChallengeProgress.count({ where: { user: realUser, completedAt: { not: null } } }),
    prisma.user.aggregate({ where: realUser, _sum: { streakFreezesUsed: true } }),
  ])

  const rows = <K extends string>(groups: ({ _count: { _all: number } } & Record<K, string | null>)[], key: K): Row[] =>
    groups.map((g) => ({ value: g[key], count: g._count._all })).sort((a, b) => b.count - a.count)

  return NextResponse.json({
    totalUsers,
    profileCompleted,
    phoneVerified,
    onboarding: {
      referralSource: rows(referral, 'referralSource'),
      preparationDuration: rows(duration, 'preparationDuration'),
      preparationLevel: rows(level, 'preparationLevel'),
      targetAttempt: rows(attempt, 'targetAttempt'),
      preparationFocus: rows(focus, 'preparationFocus'),
      state: rows(states, 'state'),
    },
    studyPlan: {
      usersWithGoals: goalUsers.length,
      goals: goals
        .map((g) => ({ type: g.type, users: g._count._all, averageTarget: Math.round((g._avg.target ?? 0) * 10) / 10 }))
        .sort((a, b) => b.users - a.users),
    },
    engagement: {
      questionsAnswered,
      bookmarks,
      dailyChallengesCompleted: challengeCompletions,
      streakFreezesUsed: freezes._sum.streakFreezesUsed ?? 0,
      testsCompleted: attemptsByMode.map((a) => ({ mode: a.mode, testMode: a.testMode, count: a._count._all })),
    },
  })
}
