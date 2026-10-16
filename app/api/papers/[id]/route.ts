import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { PAYMENTS_ENABLED } from '@/lib/entitlement'
import {
  MARKS_CORRECT,
  MARKS_WRONG,
  PAPER_DURATION_SECONDS,
  canAccessPaper,
  latestPaperYear,
  loadPaperSections,
  roundMarks,
} from '@/lib/paper-test'

type Context = { params: Promise<{ id: string }> }

const RECENT_ATTEMPTS = 10

// One paper's test menu: the full test, its subject sections, the marking
// scheme, and this user's attempts. Never includes question content, so it's
// safe to return for locked papers (the app shows what's inside the paywall).
export async function GET(request: NextRequest, ctx: Context) {
  const { user, response } = await requireAuth(request)
  if (!user) return response

  const { id } = await ctx.params
  const paperId = Number(id)
  if (!Number.isInteger(paperId)) {
    return NextResponse.json({ error: 'Invalid paper id' }, { status: 400 })
  }

  const paper = await prisma.questionPaper.findUnique({ where: { id: paperId }, include: { examType: true } })
  if (!paper) return NextResponse.json({ error: 'Paper not found' }, { status: 404 })

  const [{ total, sections }, accessible, freeYear, attempts] = await Promise.all([
    loadPaperSections(paperId),
    canAccessPaper(user.id, paper.year),
    latestPaperYear(),
    prisma.quizAttempt.findMany({
      where: { userId: user.id, questionPaperId: paperId },
      orderBy: { startedAt: 'desc' },
      take: RECENT_ATTEMPTS,
      include: { sectionCategory: { select: { id: true, name: true } } },
    }),
  ])

  const inProgress = attempts.filter((a) => !a.completedAt)

  return NextResponse.json({
    id: paper.id,
    year: paper.year,
    title: paper.title,
    examType: { code: paper.examType.code, name: paper.examType.name },
    questionCount: total,
    durationSeconds: PAPER_DURATION_SECONDS,
    marking: { correct: MARKS_CORRECT, wrong: roundMarks(MARKS_WRONG), maxScore: total * MARKS_CORRECT },
    locked: !accessible,
    isFree: PAYMENTS_ENABLED && paper.year === freeYear,
    sections: sections.map((s) => ({
      ...s,
      inProgressAttemptId: inProgress.find((a) => a.sectionCategoryId === s.categoryId)?.id ?? null,
    })),
    inProgressAttemptId: inProgress.find((a) => a.sectionCategoryId === null)?.id ?? null,
    attempts: attempts.map((a) => ({
      id: a.id,
      testMode: a.testMode,
      section: a.sectionCategory,
      startedAt: a.startedAt,
      completedAt: a.completedAt,
      totalQuestions: a.totalQuestions,
      correctCount: a.correctCount,
      wrongCount: a.wrongCount,
      skippedCount: a.skippedCount,
      score: a.score,
      maxScore: a.maxScore,
    })),
  })
}
