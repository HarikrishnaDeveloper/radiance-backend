import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { computeStreakFromDates } from '@/lib/streak'
import { getCategoryProgress } from '@/lib/category-progress'
import { getContinueLearning } from '@/lib/continue-learning'

export async function GET(request: NextRequest) {
  const { user, response } = await requireAuth(request)
  if (!user) return response

  const [completedAttempts, completedStages, continueAttempt, categories, papers, categoryProgress, continueLearning, recentAchievements] =
    await Promise.all([
      prisma.quizAttempt.findMany({
        where: { userId: user.id, completedAt: { not: null } },
        select: { completedAt: true },
      }),
      prisma.userStageProgress.findMany({
        where: { userId: user.id, status: 'COMPLETED', completedAt: { not: null } },
        select: { completedAt: true },
      }),
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
    ])

  const streak = computeStreakFromDates([
    ...completedAttempts.map((a) => a.completedAt!),
    ...completedStages.map((s) => s.completedAt!),
  ])

  return NextResponse.json({
    streak,
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
