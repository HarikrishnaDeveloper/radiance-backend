import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireAdminApiKey } from '@/lib/admin-auth'

const PAGE_SIZE = 25

// Every test and practice session users have started, newest first.
// filter: all | exam (timed full paper) | paper (full paper, practice mode) |
// category (subject practice) | unfinished.
export async function GET(request: NextRequest) {
  const denied = requireAdminApiKey(request)
  if (denied) return denied

  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')?.trim() || undefined
  const page = Math.max(1, Number(searchParams.get('page')) || 1)
  const filter = searchParams.get('filter') ?? 'all'

  const where: Prisma.QuizAttemptWhereInput = {}
  if (q) {
    where.user = {
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q, mode: 'insensitive' } },
        { username: { contains: q, mode: 'insensitive' } },
      ],
    }
  }
  if (filter === 'exam') Object.assign(where, { mode: 'FULL_PAPER', testMode: 'EXAM' })
  if (filter === 'paper') Object.assign(where, { mode: 'FULL_PAPER', testMode: 'PRACTICE' })
  if (filter === 'category') where.mode = 'CATEGORY_PRACTICE'
  if (filter === 'unfinished') where.completedAt = null

  const [attempts, total, counts, unfinished] = await Promise.all([
    prisma.quizAttempt.findMany({
      where,
      orderBy: { startedAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        user: { select: { id: true, name: true, phone: true, username: true, isTestUser: true } },
        questionPaper: { select: { year: true, examType: { select: { name: true } } } },
        sectionCategory: { select: { name: true } },
      },
    }),
    prisma.quizAttempt.count({ where }),
    prisma.quizAttempt.groupBy({ by: ['mode', 'testMode'], _count: { _all: true } }),
    prisma.quizAttempt.count({ where: { completedAt: null } }),
  ])

  const countOf = (mode: string, testMode?: string) =>
    counts.filter((c) => c.mode === mode && (!testMode || c.testMode === testMode)).reduce((n, c) => n + c._count._all, 0)

  return NextResponse.json({
    attempts: attempts.map((a) => ({
      id: a.id,
      user: a.user,
      mode: a.mode,
      testMode: a.testMode,
      paper: a.questionPaper ? { year: a.questionPaper.year, name: a.questionPaper.examType.name } : null,
      section: a.sectionCategory?.name ?? null,
      totalQuestions: a.totalQuestions,
      correctCount: a.correctCount,
      wrongCount: a.wrongCount,
      skippedCount: a.skippedCount,
      score: a.score,
      maxScore: a.maxScore,
      startedAt: a.startedAt,
      completedAt: a.completedAt,
    })),
    total,
    page,
    pageSize: PAGE_SIZE,
    counts: {
      all: counts.reduce((n, c) => n + c._count._all, 0),
      exam: countOf('FULL_PAPER', 'EXAM'),
      paper: countOf('FULL_PAPER', 'PRACTICE'),
      category: countOf('CATEGORY_PRACTICE'),
      unfinished,
    },
  })
}
