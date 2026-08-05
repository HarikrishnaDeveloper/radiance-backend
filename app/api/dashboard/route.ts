import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { computeLongestStreak, computeStreakFromDates, recentActivityDays } from '@/lib/streak'
import { getActivityDates } from '@/lib/user-activity'
import { getCategoryProgress } from '@/lib/category-progress'
import { getContinueLearning } from '@/lib/continue-learning'
import { getUserStats } from '@/lib/user-stats'
import { getOrCreateTodayChallenge } from '@/lib/daily-challenge'

export async function GET(request: NextRequest) {
  const { user, response } = await requireAuth(request)
  if (!user) return response

  const [
    activityDates,
    continueAttempt,
    categories,
    papers,
    categoryProgress,
    continueLearning,
    recentAchievements,
    stats,
    todayChallenge,
  ] = await Promise.all([
      getActivityDates(prisma, user.id),
      prisma.quizAttempt.findFirst({
        where: { userId: user.id, completedAt: null },
        orderBy: { startedAt: 'desc' },
        include: {
          questionPaper: true,
          categories: { include: { category: true } },
          _count: { select: { answers: true } },
        },
      }),
      prisma.category.findMany({
        orderBy: { name: 'asc' },
        include: { _count: { select: { questions: true } } },
      }),
      prisma.questionPaper.findMany({
        orderBy: { year: 'desc' },
        include: { examType: true, _count: { select: { questions: true } } },
      }),
      getCategoryProgress(user.id),
      getContinueLearning(user.id),
      prisma.userStageProgress.findMany({
        where: { userId: user.id, status: 'COMPLETED' },
        orderBy: { completedAt: 'desc' },
        take: 5,
        include: { stage: { include: { category: true } } },
      }),
      getUserStats(user.id),
      getOrCreateTodayChallenge(prisma),
    ])

  const streak = computeStreakFromDates(activityDates)
  const longestStreak = computeLongestStreak(activityDates)
  const todayStr = new Date().toISOString().slice(0, 10)
  const answeredToday = activityDates.some((d) => d.toISOString().slice(0, 10) === todayStr)

  const todayChallengeProgress = await prisma.userDailyChallengeProgress.findUnique({
    where: { userId_challengeId: { userId: user.id, challengeId: todayChallenge.id } },
  })

  return NextResponse.json({
    streak,
    longestStreak,
    stats,
    recentActivity: recentActivityDays(activityDates),
    todaysFocus: {
      answeredToday,
      dailyChallenge: {
        completed: Boolean(todayChallengeProgress?.completedAt),
        starsEarned: todayChallengeProgress?.completedAt ? todayChallengeProgress.starsEarned : null,
      },
    },
    continueAttempt: continueAttempt
      ? {
          id: continueAttempt.id,
          mode: continueAttempt.mode,
          totalQuestions: continueAttempt.totalQuestions,
          answeredCount: continueAttempt._count.answers,
          title:
            continueAttempt.mode === 'FULL_PAPER'
              ? continueAttempt.questionPaper?.title ?? `${continueAttempt.questionPaper?.year} Paper`
              : continueAttempt.categories.map((c) => c.category.name).join(', '),
        }
      : null,
    categories: categories.map((c) => ({ id: c.id, name: c.name, questionCount: c._count.questions })),
    papers: papers.map((p) => ({
      id: p.id,
      year: p.year,
      title: p.title,
      examType: { code: p.examType.code, name: p.examType.name },
      questionCount: p._count.questions,
    })),
    categoryProgress,
    continueLearning,
    recentAchievements: recentAchievements.map((a) => ({
      stageId: a.stageId,
      stageNumber: a.stage.stageNumber,
      categoryName: a.stage.category.name,
      foodWorldName: a.stage.foodWorldName,
      starsEarned: a.starsEarned,
      completedAt: a.completedAt,
    })),
  })
}
