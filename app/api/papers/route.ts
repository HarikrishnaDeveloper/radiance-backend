import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { PAYMENTS_ENABLED, hasFullAccess } from '@/lib/entitlement'
import { PAPER_DURATION_SECONDS } from '@/lib/paper-test'

export async function GET(request: NextRequest) {
  const { user, response } = await requireAuth(request)
  if (!user) return response

  const [papers, fullAccess, attempts] = await Promise.all([
    prisma.questionPaper.findMany({
      orderBy: { year: 'desc' },
      include: { examType: true, _count: { select: { questions: true } } },
    }),
    hasFullAccess(user.id),
    prisma.quizAttempt.findMany({
      where: { userId: user.id, mode: 'FULL_PAPER' },
      orderBy: { startedAt: 'desc' },
      select: {
        id: true,
        questionPaperId: true,
        sectionCategoryId: true,
        completedAt: true,
        correctCount: true,
        totalQuestions: true,
        score: true,
        maxScore: true,
      },
    }),
  ])
  // Newest paper is the free sample (see lib/paper-test.ts canAccessPaper).
  const freeYear = papers[0]?.year ?? null

  return NextResponse.json(
    papers.map((p) => {
      const mine = attempts.filter((a) => a.questionPaperId === p.id)
      // "Best" and "in progress" only consider whole-paper attempts; section
      // attempts show up on the paper's own screen.
      const fullAttempts = mine.filter((a) => a.sectionCategoryId === null)
      const best = fullAttempts
        .filter((a) => a.completedAt && a.score !== null)
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0]
      const inProgress = fullAttempts.find((a) => !a.completedAt)
      return {
        id: p.id,
        year: p.year,
        title: p.title,
        examType: { code: p.examType.code, name: p.examType.name },
        questionCount: p._count.questions,
        durationSeconds: PAPER_DURATION_SECONDS,
        locked: !fullAccess && p.year !== freeYear,
        isFree: PAYMENTS_ENABLED && p.year === freeYear,
        attemptCount: mine.filter((a) => a.completedAt).length,
        bestScore: best ? { score: best.score, maxScore: best.maxScore, attemptId: best.id } : null,
        inProgressAttemptId: inProgress?.id ?? null,
      }
    })
  )
}
