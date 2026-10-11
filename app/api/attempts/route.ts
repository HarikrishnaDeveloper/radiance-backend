import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { Prisma, TestMode } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { canAccessPaper, sectionDurationSeconds } from '@/lib/paper-test'

const PRACTICE_QUESTION_COUNT = 10

export async function POST(request: NextRequest) {
  const { user, response } = await requireAuth(request)
  if (!user) return response

  const body = await request.json().catch(() => null)
  const mode = body?.mode

  if (mode === 'FULL_PAPER') {
    const questionPaperId = Number(body?.questionPaperId)
    if (!Number.isInteger(questionPaperId)) {
      return NextResponse.json({ error: 'questionPaperId is required' }, { status: 400 })
    }

    const testMode: TestMode = body?.testMode === 'EXAM' ? 'EXAM' : 'PRACTICE'
    const sectionCategoryId =
      body?.sectionCategoryId === null || body?.sectionCategoryId === undefined ? null : Number(body.sectionCategoryId)
    if (sectionCategoryId !== null && !Number.isInteger(sectionCategoryId)) {
      return NextResponse.json({ error: 'sectionCategoryId must be an integer' }, { status: 400 })
    }

    const paper = await prisma.questionPaper.findUnique({ where: { id: questionPaperId }, select: { year: true } })
    if (!paper) return NextResponse.json({ error: 'Paper not found' }, { status: 404 })
    if (!(await canAccessPaper(user.id, paper.year))) {
      return NextResponse.json({ error: 'SUBSCRIPTION_REQUIRED' }, { status: 402 })
    }

    const [paperQuestions, totalQuestions] = await Promise.all([
      prisma.question.count({ where: { questionPaperId } }),
      prisma.question.count({
        where: { questionPaperId, ...(sectionCategoryId !== null ? { categoryId: sectionCategoryId } : {}) },
      }),
    ])
    if (totalQuestions === 0) {
      return NextResponse.json({ error: 'Paper or section has no questions' }, { status: 404 })
    }

    const attempt = await prisma.quizAttempt.create({
      data: {
        userId: user.id,
        mode: 'FULL_PAPER',
        questionPaperId,
        sectionCategoryId,
        testMode,
        totalQuestions,
        durationSeconds: testMode === 'EXAM' ? sectionDurationSeconds(totalQuestions, paperQuestions) : null,
      },
    })
    return NextResponse.json({ id: attempt.id }, { status: 201 })
  }

  if (mode === 'CATEGORY_PRACTICE') {
    const categoryIds: number[] = Array.isArray(body?.categoryIds)
      ? body.categoryIds.map(Number).filter(Number.isInteger)
      : []
    if (categoryIds.length === 0) {
      return NextResponse.json({ error: 'categoryIds is required' }, { status: 400 })
    }

    const availableQuestions = await prisma.question.count({ where: { categoryId: { in: categoryIds } } })
    if (availableQuestions === 0) {
      return NextResponse.json({ error: 'No questions found for selected categories' }, { status: 404 })
    }

    const totalQuestions = Math.min(PRACTICE_QUESTION_COUNT, availableQuestions)

    const attempt = await prisma.quizAttempt.create({
      data: {
        userId: user.id,
        mode: 'CATEGORY_PRACTICE',
        totalQuestions,
        categories: { create: categoryIds.map((categoryId) => ({ categoryId })) },
      },
    })
    return NextResponse.json({ id: attempt.id }, { status: 201 })
  }

  return NextResponse.json({ error: 'mode must be FULL_PAPER or CATEGORY_PRACTICE' }, { status: 400 })
}

export async function GET(request: NextRequest) {
  const { user, response } = await requireAuth(request)
  if (!user) return response

  const completedParam = request.nextUrl.searchParams.get('completed')
  const where: Prisma.QuizAttemptWhereInput = { userId: user.id }
  if (completedParam === 'true') where.completedAt = { not: null }
  if (completedParam === 'false') where.completedAt = null

  const attempts = await prisma.quizAttempt.findMany({
    where,
    orderBy: { startedAt: 'desc' },
    include: { questionPaper: true, sectionCategory: true, categories: { include: { category: true } } },
  })

  return NextResponse.json(
    attempts.map((a) => ({
      id: a.id,
      mode: a.mode,
      testMode: a.testMode,
      questionPaperId: a.questionPaperId,
      sectionName: a.sectionCategory?.name ?? null,
      score: a.score,
      maxScore: a.maxScore,
      startedAt: a.startedAt,
      completedAt: a.completedAt,
      totalQuestions: a.totalQuestions,
      correctCount: a.correctCount,
      wrongCount: a.wrongCount,
      skippedCount: a.skippedCount,
      title:
        a.mode === 'FULL_PAPER'
          ? a.questionPaper?.title ?? `${a.questionPaper?.year} Paper`
          : a.categories.map((c) => c.category.name).join(', '),
    }))
  )
}
