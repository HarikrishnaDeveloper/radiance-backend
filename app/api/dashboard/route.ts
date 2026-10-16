import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { computeLongestStreak, computeStreakFromDates, recentActivityDays } from '@/lib/streak'
import { getActivityDates } from '@/lib/user-activity'
import { getCategoryProgress } from '@/lib/category-progress'
import { getContinueLearning } from '@/lib/continue-learning'
import { getPerformanceSummary } from '@/lib/category-performance'
import { getOrCreateTodayChallenge } from '@/lib/daily-challenge'
import { FULL_TEST_WHERE, getTodayTasks } from '@/lib/study-plan'
import { getLeaderboard } from '@/lib/leaderboard'
import { buildNotifications } from '@/lib/notifications'

const LEADERBOARD_PREVIEW = 3

// Everything the home screen shows, computed here so scores, task completion,
// streaks and rankings have one source of truth — the app only renders them.
export async function GET(request: NextRequest) {
  const { user, response } = await requireAuth(request)
  if (!user) return response

  const syllabusStageWhere = { isPublished: true, category: { isActive: true } }

  const [
    student,
    activityDates,
    continueAttempt,
    categories,
    papers,
    categoryProgress,
    continueLearning,
    recentAchievements,
    performance,
    todayChallenge,
    paperTestsCompleted,
    totalStages,
    completedStages,
    todayTasks,
    leaderboard,
  ] = await Promise.all([
    prisma.user.findUnique({
      where: { id: user.id },
      select: { name: true, username: true, frozenDates: true, profile: { select: { fullName: true, targetExam: true, targetAttempt: true } } },
    }),
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
    getPerformanceSummary(user.id),
    getOrCreateTodayChallenge(prisma),
    prisma.quizAttempt.count({ where: { userId: user.id, ...FULL_TEST_WHERE } }),
    prisma.stage.count({ where: syllabusStageWhere }),
    prisma.userStageProgress.count({ where: { userId: user.id, status: 'COMPLETED', stage: syllabusStageWhere } }),
    getTodayTasks(user.id),
    getLeaderboard(user.id, LEADERBOARD_PREVIEW),
  ])

  if (!student) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  // Freeze-covered days keep the streak alive, same as the streak screen.
  const streakDates = [...activityDates, ...student.frozenDates]
  const streak = computeStreakFromDates(streakDates)
  const longestStreak = computeLongestStreak(streakDates)
  const todayStr = new Date().toISOString().slice(0, 10)
  const answeredToday = activityDates.some((d) => d.toISOString().slice(0, 10) === todayStr)

  const todayChallengeProgress = await prisma.userDailyChallengeProgress.findUnique({
    where: { userId_challengeId: { userId: user.id, challengeId: todayChallenge.id } },
  })
  const dailyChallengeCompleted = Boolean(todayChallengeProgress?.completedAt)

  const continueAttemptTitle = continueAttempt
    ? continueAttempt.mode === 'FULL_PAPER'
      ? continueAttempt.questionPaper?.title ?? `${continueAttempt.questionPaper?.year} Paper`
      : continueAttempt.categories.map((c) => c.category.name).join(', ')
    : ''

  return NextResponse.json({
    student: {
      name: student.profile?.fullName || student.name || student.username || '',
      targetExam: student.profile?.targetExam ?? null,
      targetAttempt: student.profile?.targetAttempt ?? null,
    },
    streak,
    longestStreak,
    stats: {
      questionsSolved: performance.questionsSolved,
      accuracy: performance.accuracy,
      syllabusCoverage: totalStages > 0 ? Math.round((completedStages / totalStages) * 100) : 0,
      paperTestsCompleted,
    },
    dailyGoal: todayTasks,
    categoryPerformance: {
      strong: performance.strong,
      weak: performance.weak,
      ratedCategories: performance.ratedCategories,
      minAnswersToRate: performance.minAnswersToRate,
    },
    leaderboard,
    notifications: buildNotifications({
      streak,
      answeredToday,
      dailyChallengeCompleted,
      today: todayTasks,
      unfinishedTest:
        continueAttempt?.mode === 'FULL_PAPER' ? { id: continueAttempt.id, title: continueAttemptTitle } : null,
    }),
    recentActivity: recentActivityDays(streakDates),
    todaysFocus: {
      answeredToday,
      dailyChallenge: {
        completed: dailyChallengeCompleted,
        starsEarned: dailyChallengeCompleted ? todayChallengeProgress!.starsEarned : null,
      },
    },
    continueAttempt: continueAttempt
      ? {
          id: continueAttempt.id,
          mode: continueAttempt.mode,
          totalQuestions: continueAttempt.totalQuestions,
          answeredCount: continueAttempt._count.answers,
          title: continueAttemptTitle,
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
