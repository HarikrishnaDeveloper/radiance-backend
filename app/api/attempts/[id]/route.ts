import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { loadAttemptQuestionsSafe } from '@/lib/attempt-questions'

type Context = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, ctx: Context) {
  const { user, response } = await requireAuth(request)
  if (!user) return response

  const { id } = await ctx.params
  const attemptId = Number(id)
  if (!Number.isInteger(attemptId)) {
    return NextResponse.json({ error: 'Invalid attempt id' }, { status: 400 })
  }

  const attempt = await prisma.quizAttempt.findFirst({ where: { id: attemptId, userId: user.id } })
  if (!attempt) return NextResponse.json({ error: 'Attempt not found' }, { status: 404 })

  const [questions, answers] = await Promise.all([
    loadAttemptQuestionsSafe(attempt),
    prisma.attemptAnswer.findMany({
      where: { attemptId },
      select: { questionId: true, selectedOptionId: true, isCorrect: true },
    }),
  ])

  return NextResponse.json({
    id: attempt.id,
    mode: attempt.mode,
    totalQuestions: attempt.totalQuestions,
    completedAt: attempt.completedAt,
    questions,
    answers,
  })
}
