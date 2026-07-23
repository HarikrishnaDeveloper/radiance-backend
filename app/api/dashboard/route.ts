import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

function computeStreak(completedDates: Date[]): number {
  const dateStrings = new Set(completedDates.map((d) => d.toISOString().slice(0, 10)))
  if (dateStrings.size === 0) return 0

  const today = new Date()
  const cursor = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))

  // If today has no completed attempt yet, start counting from yesterday
  // so the streak doesn't visually reset before the user has had a chance to play.
  if (!dateStrings.has(cursor.toISOString().slice(0, 10))) {
    cursor.setUTCDate(cursor.getUTCDate() - 1)
  }

  let streak = 0
  while (dateStrings.has(cursor.toISOString().slice(0, 10))) {
    streak++
    cursor.setUTCDate(cursor.getUTCDate() - 1)
  }
  return streak
}

export async function GET(request: NextRequest) {
  const { user, response } = await requireAuth(request)
  if (!user) return response

  const [completedAttempts, continueAttempt, categories, papers] = await Promise.all([
    prisma.quizAttempt.findMany({
      where: { userId: user.id, completedAt: { not: null } },
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
  ])

  const streak = computeStreak(completedAttempts.map((a) => a.completedAt!))

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
  })
}
