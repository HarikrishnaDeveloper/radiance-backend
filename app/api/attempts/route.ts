import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

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

    const totalQuestions = await prisma.question.count({ where: { questionPaperId } })
    if (totalQuestions === 0) {
      return NextResponse.json({ error: 'Paper not found or has no questions' }, { status: 404 })
    }

    const attempt = await prisma.quizAttempt.create({
      data: { userId: user.id, mode: 'FULL_PAPER', questionPaperId, totalQuestions },
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
    include: { questionPaper: true, categories: { include: { category: true } } },
  })

  return NextResponse.json(
    attempts.map((a) => ({
      id: a.id,
      mode: a.mode,
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
