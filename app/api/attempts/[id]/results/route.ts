import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { loadAttemptQuestionsFull } from '@/lib/attempt-questions'

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
  if (!attempt.completedAt) {
    return NextResponse.json({ error: 'Attempt is not completed yet' }, { status: 409 })
  }

  const [questions, answers] = await Promise.all([
    loadAttemptQuestionsFull(attempt),
    prisma.attemptAnswer.findMany({ where: { attemptId } }),
  ])
  const answerByQuestion = new Map(answers.map((a) => [a.questionId, a]))

  return NextResponse.json({
    id: attempt.id,
    totalQuestions: attempt.totalQuestions,
    correctCount: attempt.correctCount,
    wrongCount: attempt.wrongCount,
    skippedCount: attempt.skippedCount,
    scorePercent:
      attempt.totalQuestions > 0 ? Math.round((attempt.correctCount / attempt.totalQuestions) * 100) : 0,
    questions: questions.map((q) => {
      const answer = answerByQuestion.get(q.id)
      return {
        id: q.id,
        text: q.text,
        explanation: q.explanation,
        isVoided: q.isVoided,
        category: q.category,
        options: q.options,
        selectedOptionId: answer?.selectedOptionId ?? null,
        isCorrect: answer?.isCorrect ?? false,
      }
    }),
  })
}
