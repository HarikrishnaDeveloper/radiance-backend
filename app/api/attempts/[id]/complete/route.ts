import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

type Context = { params: Promise<{ id: string }> }

function summarize(attempt: {
  id: number
  totalQuestions: number
  correctCount: number
  wrongCount: number
  skippedCount: number
}) {
  return {
    id: attempt.id,
    totalQuestions: attempt.totalQuestions,
    correctCount: attempt.correctCount,
    wrongCount: attempt.wrongCount,
    skippedCount: attempt.skippedCount,
    scorePercent:
      attempt.totalQuestions > 0 ? Math.round((attempt.correctCount / attempt.totalQuestions) * 100) : 0,
  }
}

export async function POST(request: NextRequest, ctx: Context) {
  const { user, response } = await requireAuth(request)
  if (!user) return response

  const { id } = await ctx.params
  const attemptId = Number(id)
  if (!Number.isInteger(attemptId)) {
    return NextResponse.json({ error: 'Invalid attempt id' }, { status: 400 })
  }

  const attempt = await prisma.quizAttempt.findFirst({ where: { id: attemptId, userId: user.id } })
  if (!attempt) return NextResponse.json({ error: 'Attempt not found' }, { status: 404 })

  if (attempt.completedAt) {
    return NextResponse.json(summarize(attempt))
  }

  const answers = await prisma.attemptAnswer.findMany({ where: { attemptId } })
  const correctCount = answers.filter((a) => a.isCorrect).length
  const wrongCount = answers.filter((a) => !a.isCorrect && a.selectedOptionId !== null).length
  const skippedCount = attempt.totalQuestions - correctCount - wrongCount

  const updated = await prisma.quizAttempt.update({
    where: { id: attemptId },
    data: { completedAt: new Date(), correctCount, wrongCount, skippedCount },
  })

  return NextResponse.json(summarize(updated))
}
